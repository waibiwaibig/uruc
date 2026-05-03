import { createHash } from 'crypto';

import { FederationDocumentError, federationDocumentDigest, parseFederationDocument, type FederationDocument } from './document.js';
import { evaluateTrustPolicy, type FederationPolicyResult, type TrustPolicySubject } from './policy.js';
import type { CityFederationSpec } from '../plugin-platform/types.js';

type FetchLike = typeof fetch;

export interface FederationDocumentServiceOptions {
  fetch?: FetchLike;
  timeoutMs?: number;
  maxDocumentBytes?: number;
  now?: () => Date;
}

export interface FederationDocumentStatus {
  federationId: string;
  status: 'valid' | 'failed' | 'not_configured';
  code: string;
  cacheKey?: string;
  digest?: string;
  validUntil?: string;
}

interface CacheEntry {
  document: FederationDocument;
  digest: string;
  validUntilMs: number;
}

function requireJsonContentType(response: Response): void {
  const mediaType = (response.headers.get('content-type') ?? '').toLowerCase().split(';', 1)[0].trim();
  if (mediaType !== 'application/json' && !mediaType.endsWith('+json')) {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_CONTENT_TYPE_INVALID', 'Federation Document response content-type is not JSON');
  }
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) return response.text();
  const chunks: Uint8Array[] = [];
  let size = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    size += value.byteLength;
    if (size > maxBytes) {
      reader.cancel().catch(() => undefined);
      throw new FederationDocumentError('FEDERATION_RESPONSE_TOO_LARGE', 'Federation response is too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_JSON_INVALID', 'Federation Document response is not valid JSON');
  }
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, stableValue((value as Record<string, unknown>)[key])]),
  );
}

function hashStableJson(value: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(stableValue(value))).digest('hex')}`;
}

function parseIsoTimestamp(value: string): number | null {
  const time = Date.parse(value);
  if (Number.isNaN(time) || new Date(time).toISOString() !== value) return null;
  return time;
}

export class FederationDocumentService {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly maxDocumentBytes: number;
  private readonly now: () => Date;
  private readonly cache = new Map<string, CacheEntry>();

  constructor(options: FederationDocumentServiceOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 3_000;
    this.maxDocumentBytes = options.maxDocumentBytes ?? 64 * 1024;
    this.now = options.now ?? (() => new Date());
  }

  async fetchDocument(cityPolicy: Pick<CityFederationSpec, 'federationId' | 'document'>): Promise<{ document: FederationDocument; status: FederationDocumentStatus }> {
    if (!cityPolicy.document) {
      throw new FederationDocumentError('FEDERATION_DOCUMENT_URL_REQUIRED', 'Federation membership needs a document URL');
    }
    const cacheKey = `${cityPolicy.federationId}:${cityPolicy.document}`;
    const cached = this.cache.get(cacheKey);
    if (cached && cached.validUntilMs > this.now().getTime()) {
      return {
        document: cached.document,
        status: {
          federationId: cached.document.federationId,
          status: 'valid',
          code: 'FEDERATION_DOCUMENT_CACHE_HIT',
          cacheKey,
          digest: cached.digest,
          validUntil: cached.document.validUntil,
        },
      };
    }

    const response = await this.fetchWithTimeout(cityPolicy.document, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    requireJsonContentType(response);
    if (!response.ok) {
      throw new FederationDocumentError('FEDERATION_DOCUMENT_FETCH_FAILED', `Federation Document fetch failed with HTTP ${response.status}`);
    }
    const document = parseFederationDocument(parseJson(await readLimitedText(response, this.maxDocumentBytes)));
    if (document.federationId !== cityPolicy.federationId) {
      throw new FederationDocumentError('FEDERATION_DOCUMENT_ID_MISMATCH', 'Federation Document id does not match city membership');
    }
    const validUntilMs = Date.parse(document.validUntil);
    const digest = federationDocumentDigest(document as unknown as Record<string, unknown>);
    this.cache.set(cacheKey, { document, digest, validUntilMs });
    return {
      document,
      status: {
        federationId: document.federationId,
        status: 'valid',
        code: 'FEDERATION_DOCUMENT_FETCHED',
        cacheKey,
        digest,
        validUntil: document.validUntil,
      },
    };
  }

  diagnosticForMissing(federationId: string): FederationDocumentStatus {
    return { federationId, status: 'not_configured', code: 'FEDERATION_NOT_JOINED' };
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, { ...init, signal: controller.signal });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new FederationDocumentError('FEDERATION_REQUEST_TIMEOUT', 'Federation request timed out');
      }
      throw new FederationDocumentError('FEDERATION_REQUEST_FAILED', 'Federation request failed');
    } finally {
      clearTimeout(timer);
    }
  }
}

export interface VerifyPolicyRefInput {
  document: FederationDocument;
  policyRefId: string;
  body: unknown;
  now?: Date;
}

export function verifyFederationPolicyRef(input: VerifyPolicyRefInput): { ok: true; digest: string } | { ok: false; code: string } {
  const ref = input.document.policyRefs.find((item) => item.id === input.policyRefId);
  if (!ref) return { ok: false, code: 'FEDERATION_POLICY_REF_MISSING' };
  const now = input.now?.getTime() ?? Date.now();
  if (ref.validFrom && Date.parse(ref.validFrom) > now) return { ok: false, code: 'FEDERATION_POLICY_REF_NOT_YET_VALID' };
  if (ref.validUntil && Date.parse(ref.validUntil) <= now) return { ok: false, code: 'FEDERATION_POLICY_REF_EXPIRED' };
  if (ref.federationId && ref.federationId !== input.document.federationId) return { ok: false, code: 'FEDERATION_POLICY_REF_MISMATCH' };
  if (ref.version !== undefined && ref.version !== input.document.version) return { ok: false, code: 'FEDERATION_POLICY_REF_VERSION_UNSUPPORTED' };
  const digest = hashStableJson(input.body);
  if (ref.digest && ref.digest !== digest) return { ok: false, code: 'FEDERATION_POLICY_REF_HASH_MISMATCH' };
  return { ok: true, digest };
}

export type FederationFeedKind = 'risk' | 'conformance';

export interface FederationFeedEntry {
  id: string;
  federationId: string;
  kind: FederationFeedKind;
  issuerId: string;
  subject: TrustPolicySubject;
  riskLevel?: 'low' | 'medium' | 'high' | 'unknown';
  conformanceBadges?: string[];
  issuedAt: string;
  expiresAt: string;
}

export function evaluateVerifiedFeedEntry(input: {
  document: FederationDocument;
  cityPolicy?: Pick<CityFederationSpec, 'federationId' | 'trustPolicy'>;
  entry: FederationFeedEntry;
  now?: Date;
}): FederationPolicyResult {
  if (input.entry.federationId !== input.document.federationId) {
    return {
      federationId: input.document.federationId,
      decision: 'unknown',
      code: 'FEDERATION_FEED_MISMATCH',
      scope: input.entry.subject.kind,
      reasons: ['feed federation id does not match document'],
    };
  }
  const now = input.now?.getTime() ?? Date.now();
  const issuedAt = parseIsoTimestamp(input.entry.issuedAt);
  const expiresAt = parseIsoTimestamp(input.entry.expiresAt);
  if (issuedAt === null || expiresAt === null || issuedAt >= expiresAt) {
    return {
      federationId: input.document.federationId,
      decision: 'unknown',
      code: 'FEDERATION_FEED_INVALID',
      scope: input.entry.subject.kind,
      reasons: ['feed entry has an invalid time window'],
    };
  }
  if (issuedAt > now) {
    return {
      federationId: input.document.federationId,
      decision: 'unknown',
      code: 'FEDERATION_FEED_NOT_YET_VALID',
      scope: input.entry.subject.kind,
      reasons: ['feed entry is not yet valid'],
    };
  }
  if (expiresAt <= now) {
    return {
      federationId: input.document.federationId,
      decision: 'unknown',
      code: 'FEDERATION_FEED_EXPIRED',
      scope: input.entry.subject.kind,
      reasons: ['feed entry is expired'],
    };
  }
  const issuerTrusted = input.document.trustAnchors.some((anchor) => anchor.id === input.entry.issuerId || anchor.ref === input.entry.issuerId);
  if (!issuerTrusted) {
    return {
      federationId: input.document.federationId,
      decision: 'unknown',
      code: 'FEDERATION_FEED_ISSUER_UNTRUSTED',
      scope: input.entry.subject.kind,
      reasons: ['feed issuer is not a federation trust anchor'],
    };
  }
  const subject = {
    ...input.entry.subject,
    ...(input.entry.riskLevel ? { riskLevel: input.entry.riskLevel } : {}),
    ...(input.entry.conformanceBadges ? { conformanceBadges: input.entry.conformanceBadges } : {}),
  } as TrustPolicySubject;
  return evaluateTrustPolicy({ document: input.document, cityPolicy: input.cityPolicy, subject });
}
