import { createHash } from 'crypto';

import { FederationDocumentError, federationDocumentDigest, parseFederationDocument, type FederationDocument } from './document.js';
import { evaluateTrustPolicy, type FederationPolicyResult, type TrustPolicyDecision, type TrustPolicySubject } from './policy.js';
import type { CityFederationSpec } from '../plugin-platform/types.js';

type FetchLike = typeof fetch;
export const FEDERATION_POLICY_MATERIAL_SCHEMA = 'uruc.federation.policy-material@v0';

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

export interface FederationPolicyMaterial {
  schema: typeof FEDERATION_POLICY_MATERIAL_SCHEMA;
  federationId: string;
  policyRefId: string;
  version?: number;
  issuedAt?: string;
  expiresAt?: string;
  policy: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface FederationPolicyRefVerificationResult {
  policyRefId: string;
  decision: TrustPolicyDecision;
  code: string;
  source: 'network' | 'cache' | 'none';
  digest?: string;
  mediaType?: string;
  fetchedAt?: string;
  expiresAt?: string;
  reasons: string[];
}

interface PolicyMaterialCacheEntry {
  material: FederationPolicyMaterial;
  digest: string;
  fetchedAt: string;
  expiresAt: string;
  expiresAtMs: number;
  source: string;
  verification: FederationPolicyRefVerificationResult;
}

function requireJsonContentType(response: Response): void {
  const mediaType = (response.headers.get('content-type') ?? '').toLowerCase().split(';', 1)[0].trim();
  if (mediaType !== 'application/json' && !mediaType.endsWith('+json')) {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_CONTENT_TYPE_INVALID', 'Federation Document response content-type is not JSON');
  }
}

async function readLimitedText(response: Response, maxBytes: number): Promise<string> {
  const reader = response.body?.getReader();
  if (!reader) {
    const text = await response.text();
    if (Buffer.byteLength(text, 'utf8') > maxBytes) {
      throw new FederationDocumentError('FEDERATION_RESPONSE_TOO_LARGE', 'Federation response is too large');
    }
    return text;
  }
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

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
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

function requiredPolicyRefDecision(ref: FederationDocument['policyRefs'][number], fallback: TrustPolicyDecision = 'unknown'): TrustPolicyDecision {
  return ref.required === false ? (ref.onFailure ?? fallback) : 'reject';
}

function policyRefFailureResult(
  ref: FederationDocument['policyRefs'][number],
  code: string,
  reason: string,
  source: FederationPolicyRefVerificationResult['source'],
  options: {
    decision?: TrustPolicyDecision;
    digest?: string;
    fetchedAt?: string;
    expiresAt?: string;
    mediaType?: string;
  } = {},
): FederationPolicyRefVerificationResult {
  return {
    policyRefId: ref.id,
    decision: options.decision ?? requiredPolicyRefDecision(ref),
    code,
    source,
    ...(options.digest ? { digest: options.digest } : {}),
    ...(options.fetchedAt ? { fetchedAt: options.fetchedAt } : {}),
    ...(options.expiresAt ? { expiresAt: options.expiresAt } : {}),
    ...(options.mediaType ? { mediaType: options.mediaType } : {}),
    reasons: [reason],
  };
}

function expiredCacheResult(
  ref: FederationDocument['policyRefs'][number],
  cached: PolicyMaterialCacheEntry,
  reason = 'cached policy material is expired',
): FederationPolicyRefVerificationResult {
  const staleDecision = ref.required === false ? (ref.cache?.stale ?? ref.onFailure ?? 'unknown') : 'reject';
  return policyRefFailureResult(ref, 'FEDERATION_POLICY_REF_CACHE_EXPIRED', reason, 'cache', {
    decision: staleDecision,
    digest: cached.digest,
    fetchedAt: cached.fetchedAt,
    expiresAt: cached.expiresAt,
  });
}

function normalizeMediaType(value: string | null): string {
  return (value ?? '').toLowerCase().split(';', 1)[0].trim();
}

function mediaTypeMatches(actual: string, expected: string): boolean {
  if (actual === expected) return true;
  return expected === 'application/json' && actual.endsWith('+json');
}

function parseFederationPolicyMaterial(raw: unknown): FederationPolicyMaterial {
  if (!isRecord(raw)) {
    throw new FederationDocumentError('FEDERATION_POLICY_MATERIAL_INVALID', 'Invalid federation policy material');
  }
  if (raw.schema !== FEDERATION_POLICY_MATERIAL_SCHEMA) {
    throw new FederationDocumentError('FEDERATION_POLICY_MATERIAL_SCHEMA_INVALID', 'Unsupported federation policy material schema');
  }
  const federationId = typeof raw.federationId === 'string' && raw.federationId.trim() ? raw.federationId : undefined;
  const policyRefId = typeof raw.policyRefId === 'string' && raw.policyRefId.trim() ? raw.policyRefId : undefined;
  if (!federationId || !policyRefId || !isRecord(raw.policy)) {
    throw new FederationDocumentError('FEDERATION_POLICY_MATERIAL_INVALID', 'Invalid federation policy material');
  }
  if (raw.version !== undefined && (typeof raw.version !== 'number' || !Number.isInteger(raw.version) || raw.version <= 0)) {
    throw new FederationDocumentError('FEDERATION_POLICY_MATERIAL_INVALID', 'Invalid federation policy material version');
  }
  for (const field of ['issuedAt', 'expiresAt'] as const) {
    const value = raw[field];
    if (value !== undefined && (typeof value !== 'string' || parseIsoTimestamp(value) === null)) {
      throw new FederationDocumentError('FEDERATION_POLICY_MATERIAL_INVALID', `Invalid federation policy material ${field}`);
    }
  }
  if (raw.metadata !== undefined && !isRecord(raw.metadata)) {
    throw new FederationDocumentError('FEDERATION_POLICY_MATERIAL_INVALID', 'Invalid federation policy material metadata');
  }
  return {
    schema: FEDERATION_POLICY_MATERIAL_SCHEMA,
    federationId,
    policyRefId,
    ...(raw.version !== undefined ? { version: raw.version } : {}),
    ...(raw.issuedAt !== undefined ? { issuedAt: raw.issuedAt as string } : {}),
    ...(raw.expiresAt !== undefined ? { expiresAt: raw.expiresAt as string } : {}),
    policy: raw.policy,
    ...(raw.metadata !== undefined ? { metadata: raw.metadata } : {}),
  };
}

function earliestExpiry(candidates: Array<string | undefined>, fallback: Date): { iso: string; time: number } {
  const times = candidates
    .map((value) => (value ? parseIsoTimestamp(value) : null))
    .filter((value): value is number => value !== null);
  const time = times.length > 0 ? Math.min(...times) : fallback.getTime();
  return { iso: new Date(time).toISOString(), time };
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
    const document = parseFederationDocument(
      parseJson(await readLimitedText(response, this.maxDocumentBytes)),
      { now: this.now() },
    );
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

export interface FederationPolicyMaterialServiceOptions {
  fetch?: FetchLike;
  timeoutMs?: number;
  maxPolicyBytes?: number;
  now?: () => Date;
}

export class FederationPolicyMaterialService {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly maxPolicyBytes: number;
  private readonly now: () => Date;
  private readonly cache = new Map<string, PolicyMaterialCacheEntry>();

  constructor(options: FederationPolicyMaterialServiceOptions = {}) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 3_000;
    this.maxPolicyBytes = options.maxPolicyBytes ?? 64 * 1024;
    this.now = options.now ?? (() => new Date());
  }

  async verifyPolicyRef(input: {
    document: FederationDocument;
    policyRefId: string;
  }): Promise<FederationPolicyRefVerificationResult> {
    const ref = input.document.policyRefs.find((item) => item.id === input.policyRefId);
    if (!ref) {
      return {
        policyRefId: input.policyRefId,
        decision: 'reject',
        code: 'FEDERATION_POLICY_REF_MISSING',
        source: 'none',
        reasons: ['policy ref is not present in the Federation Document'],
      };
    }
    const now = this.now();
    const nowMs = now.getTime();
    if (ref.type !== 'trust-policy') {
      return policyRefFailureResult(ref, 'FEDERATION_POLICY_REF_TYPE_UNSUPPORTED', 'policy ref is not a trust policy', 'none');
    }
    if (ref.validFrom && Date.parse(ref.validFrom) > nowMs) {
      return policyRefFailureResult(ref, 'FEDERATION_POLICY_REF_NOT_YET_VALID', 'policy ref is not yet valid', 'none');
    }
    if (ref.validUntil && Date.parse(ref.validUntil) <= nowMs) {
      return policyRefFailureResult(ref, 'FEDERATION_POLICY_REF_EXPIRED', 'policy ref is expired', 'none');
    }
    if (ref.federationId && ref.federationId !== input.document.federationId) {
      return policyRefFailureResult(ref, 'FEDERATION_POLICY_REF_MISMATCH', 'policy ref federation id does not match document', 'none');
    }
    if (ref.version !== undefined && ref.version !== input.document.version) {
      return policyRefFailureResult(ref, 'FEDERATION_POLICY_REF_VERSION_UNSUPPORTED', 'policy ref version does not match document version', 'none');
    }
    const expectedDigest = ref.integrity ?? ref.digest;
    if (!expectedDigest) {
      return policyRefFailureResult(ref, 'FEDERATION_POLICY_REF_INTEGRITY_REQUIRED', 'policy ref does not declare digest or integrity', 'none');
    }

    const cacheKey = `${input.document.federationId}:${ref.id}:${ref.ref}`;
    const cached = this.cache.get(cacheKey);
    if (cached) {
      if (cached.expiresAtMs > nowMs && cached.digest === expectedDigest) {
        return {
          ...cached.verification,
          code: 'FEDERATION_POLICY_REF_CACHE_HIT',
          source: 'cache',
        };
      }
    }

    return this.fetchAndVerify(ref, input.document, expectedDigest, now, cached);
  }

  private async fetchAndVerify(
    ref: FederationDocument['policyRefs'][number],
    document: FederationDocument,
    expectedDigest: string,
    now: Date,
    expiredCache?: PolicyMaterialCacheEntry,
  ): Promise<FederationPolicyRefVerificationResult> {
    let response: Response;
    try {
      response = await this.fetchWithTimeout(ref.ref, {
        method: 'GET',
        headers: { accept: ref.mediaType ?? 'application/json' },
      });
    } catch (error) {
      const code = error instanceof FederationDocumentError ? error.code : 'FEDERATION_POLICY_REF_FETCH_FAILED';
      if (expiredCache) {
        return expiredCacheResult(ref, expiredCache, code === 'FEDERATION_POLICY_REF_FETCH_TIMEOUT'
          ? 'cached policy material is expired and fresh fetch timed out'
          : 'cached policy material is expired and fresh fetch failed');
      }
      return policyRefFailureResult(ref, code, code === 'FEDERATION_POLICY_REF_FETCH_TIMEOUT' ? 'policy material fetch timed out' : 'policy material fetch failed', 'network');
    }
    const expectedMediaType = ref.mediaType ?? 'application/json';
    const actualMediaType = normalizeMediaType(response.headers.get('content-type'));
    if (!mediaTypeMatches(actualMediaType, expectedMediaType)) {
      return policyRefFailureResult(ref, 'FEDERATION_POLICY_REF_CONTENT_TYPE_INVALID', 'policy material response content-type is invalid', 'network', {
        mediaType: actualMediaType,
      });
    }
    if (!response.ok) {
      return policyRefFailureResult(ref, 'FEDERATION_POLICY_REF_FETCH_FAILED', `policy material fetch failed with HTTP ${response.status}`, 'network');
    }

    let raw: unknown;
    try {
      raw = parseJson(await readLimitedText(response, this.maxPolicyBytes));
    } catch (error) {
      const code = error instanceof FederationDocumentError && error.code === 'FEDERATION_RESPONSE_TOO_LARGE'
        ? 'FEDERATION_POLICY_REF_RESPONSE_TOO_LARGE'
        : 'FEDERATION_POLICY_REF_JSON_INVALID';
      const reason = code === 'FEDERATION_POLICY_REF_RESPONSE_TOO_LARGE'
        ? 'policy material response is too large'
        : 'policy material response is not valid JSON';
      return policyRefFailureResult(ref, code, reason, 'network', { mediaType: actualMediaType });
    }

    const digest = hashStableJson(raw);
    if (digest !== expectedDigest) {
      return policyRefFailureResult(ref, 'FEDERATION_POLICY_REF_HASH_MISMATCH', 'policy material digest does not match policy ref integrity', 'network', {
        digest,
        mediaType: actualMediaType,
      });
    }

    let material: FederationPolicyMaterial;
    try {
      material = parseFederationPolicyMaterial(raw);
    } catch (error) {
      const code = error instanceof FederationDocumentError ? error.code : 'FEDERATION_POLICY_MATERIAL_INVALID';
      return policyRefFailureResult(ref, code, 'policy material schema is invalid', 'network', { digest, mediaType: actualMediaType });
    }
    if (material.federationId !== document.federationId || material.policyRefId !== ref.id) {
      return policyRefFailureResult(ref, 'FEDERATION_POLICY_MATERIAL_MISMATCH', 'policy material identity does not match policy ref', 'network', { digest, mediaType: actualMediaType });
    }
    if (material.version !== undefined && ref.version !== undefined && material.version !== ref.version) {
      return policyRefFailureResult(ref, 'FEDERATION_POLICY_MATERIAL_VERSION_UNSUPPORTED', 'policy material version does not match policy ref', 'network', { digest, mediaType: actualMediaType });
    }
    if (material.issuedAt && Date.parse(material.issuedAt) > now.getTime()) {
      return policyRefFailureResult(ref, 'FEDERATION_POLICY_MATERIAL_NOT_YET_VALID', 'policy material is not yet valid', 'network', { digest, mediaType: actualMediaType });
    }
    if (material.expiresAt && Date.parse(material.expiresAt) <= now.getTime()) {
      return policyRefFailureResult(ref, 'FEDERATION_POLICY_MATERIAL_EXPIRED', 'policy material is expired', 'network', { digest, mediaType: actualMediaType });
    }

    const fallbackExpiry = new Date(now.getTime() + (ref.cache?.maxAgeSeconds ?? 300) * 1000);
    const maxAgeExpiry = ref.cache?.maxAgeSeconds ? new Date(now.getTime() + ref.cache.maxAgeSeconds * 1000).toISOString() : undefined;
    const expiry = earliestExpiry([ref.validUntil, material.expiresAt, maxAgeExpiry], fallbackExpiry);
    const fetchedAt = now.toISOString();
    const verification: FederationPolicyRefVerificationResult = {
      policyRefId: ref.id,
      decision: 'accept',
      code: 'FEDERATION_POLICY_REF_VERIFIED',
      source: 'network',
      digest,
      mediaType: actualMediaType,
      fetchedAt,
      expiresAt: expiry.iso,
      reasons: ['policy material integrity verified before trust evaluation'],
    };
    this.cache.set(`${document.federationId}:${ref.id}:${ref.ref}`, {
      material,
      digest,
      fetchedAt,
      expiresAt: expiry.iso,
      expiresAtMs: expiry.time,
      source: ref.ref,
      verification,
    });
    return verification;
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => {
        controller.abort();
        reject(new FederationDocumentError('FEDERATION_POLICY_REF_FETCH_TIMEOUT', 'Policy material request timed out'));
      }, this.timeoutMs);
    });
    try {
      return await Promise.race([
        this.fetchImpl(url, { ...init, signal: controller.signal }),
        timeout,
      ]);
    } catch (error) {
      if (error instanceof FederationDocumentError) throw error;
      if (error instanceof Error && error.name === 'AbortError') {
        throw new FederationDocumentError('FEDERATION_POLICY_REF_FETCH_TIMEOUT', 'Policy material request timed out');
      }
      throw new FederationDocumentError('FEDERATION_POLICY_REF_FETCH_FAILED', 'Policy material request failed');
    } finally {
      if (timer) clearTimeout(timer);
    }
  }
}

function scopeForSubject(subject: TrustPolicySubject): FederationPolicyResult['scope'] {
  return subject.kind;
}

function selectTrustPolicyRefIds(document: FederationDocument, cityPolicy: Pick<CityFederationSpec, 'trustPolicy'>): string[] {
  const configured = cityPolicy.trustPolicy?.policyRefs;
  if (configured && configured.length > 0) return configured;
  return document.policyRefs.filter((ref) => ref.type === 'trust-policy').map((ref) => ref.id);
}

function mostSeverePolicyRefFailure(results: FederationPolicyRefVerificationResult[]): FederationPolicyRefVerificationResult | undefined {
  return results.find((item) => item.decision === 'reject')
    ?? results.find((item) => item.decision === 'warn')
    ?? results.find((item) => item.decision === 'unknown');
}

export async function evaluateTrustPolicyWithVerifiedPolicyRefs(input: {
  document: FederationDocument;
  cityPolicy?: Pick<CityFederationSpec, 'federationId' | 'trustPolicy'>;
  subject: TrustPolicySubject;
  materialService?: FederationPolicyMaterialService;
}): Promise<FederationPolicyResult> {
  if (!input.cityPolicy || input.cityPolicy.federationId !== input.document.federationId) {
    return evaluateTrustPolicy(input);
  }
  const materialService = input.materialService ?? new FederationPolicyMaterialService();
  const policyRefs = await Promise.all(
    selectTrustPolicyRefIds(input.document, input.cityPolicy).map((policyRefId) => materialService.verifyPolicyRef({
      document: input.document,
      policyRefId,
    })),
  );
  const failure = mostSeverePolicyRefFailure(policyRefs);
  if (failure) {
    return {
      federationId: input.document.federationId,
      decision: failure.decision,
      code: failure.code,
      scope: scopeForSubject(input.subject),
      reasons: failure.reasons,
      policyRefs,
    };
  }
  return {
    ...evaluateTrustPolicy(input),
    policyRefs,
  };
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
