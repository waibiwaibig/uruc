import { createHash, createPublicKey, generateKeyPairSync, randomUUID, sign, verify } from 'crypto';
import { and, desc, eq } from 'drizzle-orm';

import { type UrucDb, schema } from '../database/index.js';
import type { CommandSchema, WSMessage } from '../plugin-system/hook-registry.js';
import type { AgentSession } from '../../types/index.js';
import type { PermissionCredential } from '../permission/service.js';
import type { PluginPlatformHealthProvider } from '../plugin-platform/types.js';
import { DomainDocumentError } from './document.js';

export const DOMAIN_DISPATCH_ENVELOPE_SCHEMA = 'uruc.domain.dispatch.envelope@v0';
export const DOMAIN_DISPATCH_RECEIPT_SCHEMA = 'uruc.domain.dispatch.receipt@v0';
export const DOMAIN_DISPATCH_ENVELOPE_CANONICALIZATION = 'uruc-domain-dispatch-envelope-v0-sorted-json-without-proof';
export const DOMAIN_DISPATCH_RECEIPT_CANONICALIZATION = 'uruc-domain-dispatch-receipt-v0-sorted-json-without-proof';
export const DOMAIN_DISPATCH_ENVELOPE_SIGNED_FIELDS = [
  'attachment',
  'audit',
  'city',
  'domain',
  'issuedAt',
  'nonce',
  'proofs',
  'request',
  'resident',
  'schema',
  'venue',
] as const;
export const DOMAIN_DISPATCH_RECEIPT_SIGNED_FIELDS = [
  'auditId',
  'cityId',
  'code',
  'domainId',
  'envelopeHash',
  'eventRef',
  'issuedAt',
  'receiptId',
  'requestId',
  'schema',
  'status',
] as const;

type FetchLike = typeof fetch;

export interface DomainDispatchServiceOptions {
  cityId: string;
  cityKeyId?: string;
  privateKeyPem?: string;
  publicKeyPem?: string;
  fetch?: FetchLike;
  timeoutMs?: number;
  maxReceiptBytes?: number;
  now?: () => Date;
  nonce?: () => string;
  pluginPlatform?: PluginPlatformHealthProvider;
}

export interface DomainDispatchInput {
  schema: CommandSchema;
  msg: WSMessage;
  session: AgentSession;
  permissionCredentials: PermissionCredential[];
}

export interface DomainDispatchCompactReceipt {
  ok: boolean;
  code: string;
  receiptId?: string;
  eventRef?: string;
  auditId?: string;
  domainId?: string;
  cityId: string;
  venueModuleId: string;
}

export type DomainDispatchResult =
  | { status: 'skipped' }
  | {
    status: 'delivered' | 'failed';
    receipt: DomainDispatchCompactReceipt;
  };

declare module '../plugin-system/service-registry.js' {
  interface ServiceMap {
    'domain-dispatch': DomainDispatchService;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!isRecord(value)) return value;
  return Object.fromEntries(
    Object.keys(value)
      .sort()
      .map((key) => [key, stableValue(value[key])]),
  );
}

export function canonicalDomainDispatchEnvelopePayload(envelope: Record<string, unknown>): Buffer {
  const { proof: _proof, envelopeHash: _envelopeHash, ...payload } = envelope;
  return Buffer.from(JSON.stringify(stableValue(payload)), 'utf8');
}

export function canonicalDomainDispatchReceiptPayload(receipt: Record<string, unknown>): Buffer {
  const { proof: _proof, ...payload } = receipt;
  return Buffer.from(JSON.stringify(stableValue(payload)), 'utf8');
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
      throw new DomainDocumentError('DOMAIN_RESPONSE_TOO_LARGE', 'Domain response is too large');
    }
    chunks.push(value);
  }
  return Buffer.concat(chunks).toString('utf8');
}

function requireJsonContentType(response: Response, code: string): void {
  const mediaType = (response.headers.get('content-type') ?? '').toLowerCase().split(';', 1)[0].trim();
  if (mediaType !== 'application/json' && !mediaType.endsWith('+json')) {
    throw new DomainDocumentError(code, 'Domain response content-type is not JSON');
  }
}

function parseJson(text: string, code: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainDocumentError(code, 'Domain response is not valid JSON');
  }
}

function parsePublicKeys(raw: string): Array<{ id: string; type: 'ed25519-pem'; publicKeyPem: string }> {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((key): key is { id: string; type: 'ed25519-pem'; publicKeyPem: string } => (
      isRecord(key)
      && typeof key.id === 'string'
      && key.type === 'ed25519-pem'
      && typeof key.publicKeyPem === 'string'
    ));
  } catch {
    return [];
  }
}

function hashPayload(payload: Buffer): string {
  return createHash('sha256').update(payload).digest('hex');
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function requireExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  code: string,
  label: string,
): void {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  const missing = allowed.filter((key) => !(key in value));
  if (extra.length > 0 || missing.length > 0) {
    throw new DomainDocumentError(code, `Invalid dispatch ${label}`);
  }
}

function requireIsoTimestamp(value: unknown, code: string, label: string): string {
  const text = stringValue(value);
  const time = text ? Date.parse(text) : Number.NaN;
  if (!text || Number.isNaN(time) || new Date(time).toISOString() !== text) {
    throw new DomainDocumentError(code, `Invalid dispatch ${label}`);
  }
  return text;
}

function compactReceipt(input: {
  ok: boolean;
  code: string;
  cityId: string;
  venueModuleId: string;
  domainId?: string;
  auditId?: string;
  receiptId?: string;
  eventRef?: string;
}): DomainDispatchCompactReceipt {
  return {
    ok: input.ok,
    code: input.code,
    cityId: input.cityId,
    venueModuleId: input.venueModuleId,
    ...(input.domainId ? { domainId: input.domainId } : {}),
    ...(input.auditId ? { auditId: input.auditId } : {}),
    ...(input.receiptId ? { receiptId: input.receiptId } : {}),
    ...(input.eventRef ? { eventRef: input.eventRef } : {}),
  };
}

export class DomainDispatchService {
  private readonly cityId: string;
  private readonly cityKeyId: string;
  private readonly privateKeyPem: string;
  private readonly publicKeyPem: string;
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly maxReceiptBytes: number;
  private readonly now: () => Date;
  private readonly nonce: () => string;
  private readonly pluginPlatform?: PluginPlatformHealthProvider;

  constructor(
    private readonly db: UrucDb,
    options: DomainDispatchServiceOptions,
  ) {
    const keyPair = options.privateKeyPem && options.publicKeyPem
      ? null
      : generateKeyPairSync('ed25519');
    this.cityId = options.cityId;
    this.cityKeyId = options.cityKeyId ?? 'city-dispatch-key-1';
    this.privateKeyPem = options.privateKeyPem
      ?? keyPair!.privateKey.export({ format: 'pem', type: 'pkcs8' }).toString();
    this.publicKeyPem = options.publicKeyPem
      ?? keyPair!.publicKey.export({ format: 'pem', type: 'spki' }).toString();
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 3_000;
    this.maxReceiptBytes = options.maxReceiptBytes ?? 32 * 1024;
    this.now = options.now ?? (() => new Date());
    this.nonce = options.nonce ?? (() => randomUUID());
    this.pluginPlatform = options.pluginPlatform;
  }

  isDomainVenueRequest(schema: CommandSchema): boolean {
    const pluginId = schema.pluginName;
    if (!pluginId || pluginId === 'core') return false;
    const plugin = this.pluginPlatform?.listPlugins().find((item) => item.name === pluginId);
    return plugin?.venue?.topology?.mode === 'domain';
  }

  async dispatchVenueRequest(input: DomainDispatchInput): Promise<DomainDispatchResult> {
    const pluginId = input.schema.pluginName;
    if (!pluginId || pluginId === 'core') return { status: 'skipped' };

    const plugin = this.pluginPlatform?.listPlugins().find((item) => item.name === pluginId);
    if (plugin?.venue?.topology?.mode !== 'domain') {
      return { status: 'skipped' };
    }

    const venueModuleId = input.schema.protocol?.venue?.moduleId ?? plugin?.venue?.moduleId ?? pluginId;
    const venueNamespace = plugin?.venue?.namespace ?? input.schema.protocol?.venue?.id ?? venueModuleId;
    const attachment = await this.findActiveAttachment(pluginId, venueModuleId);
    if (!attachment) {
      return plugin?.venue?.topology?.mode === 'domain'
        ? {
          status: 'failed',
          receipt: compactReceipt({
            ok: false,
            code: 'DOMAIN_ATTACHMENT_NOT_ACTIVE',
            cityId: this.cityId,
            venueModuleId,
          }),
        }
        : { status: 'skipped' };
    }
    if (!attachment.dispatchEndpoint) {
      return {
        status: 'failed',
        receipt: compactReceipt({
          ok: false,
          code: 'DOMAIN_DISPATCH_ENDPOINT_MISSING',
          cityId: this.cityId,
          venueModuleId,
          domainId: attachment.domainId,
        }),
      };
    }

    const requestType = input.schema.protocol?.request?.type ?? input.msg.type;
    const requiredCapabilities = input.schema.protocol?.request?.requiredCapabilities ?? [];
    const auditId = randomUUID();
    const envelopeBase = {
      schema: DOMAIN_DISPATCH_ENVELOPE_SCHEMA,
      audit: {
        id: auditId,
      },
      city: {
        id: this.cityId,
        keyId: this.cityKeyId,
        publicKeyPem: this.publicKeyPem,
      },
      domain: {
        id: attachment.domainId,
      },
      attachment: {
        id: attachment.id,
        documentUrl: attachment.documentUrl,
        documentHash: attachment.documentHash,
      },
      resident: {
        id: input.session.agentId,
      },
      venue: {
        pluginId,
        moduleId: attachment.venueModuleId,
        namespace: attachment.venueNamespace || venueNamespace,
      },
      request: {
        id: input.msg.id,
        command: input.msg.type,
        type: requestType,
        payload: input.msg.payload ?? null,
      },
      proofs: {
        requiredCapabilities,
        permissionCredentialRefs: input.permissionCredentials
          .filter((credential) => requiredCapabilities.some((capability) => credential.capabilities.includes(capability)))
          .map((credential) => credential.id)
          .sort(),
      },
      issuedAt: this.now().toISOString(),
      nonce: this.nonce(),
    };
    const envelopeHash = hashPayload(canonicalDomainDispatchEnvelopePayload(envelopeBase));
    const envelope = {
      ...envelopeBase,
      envelopeHash,
      proof: {
        type: 'ed25519-signature-2026',
        verificationMethod: this.cityKeyId,
        canonicalization: DOMAIN_DISPATCH_ENVELOPE_CANONICALIZATION,
        covered: [...DOMAIN_DISPATCH_ENVELOPE_SIGNED_FIELDS],
        signature: sign(null, canonicalDomainDispatchEnvelopePayload(envelopeBase), this.privateKeyPem).toString('base64'),
      },
    };

    await this.insertAudit({
      id: auditId,
      attachmentId: attachment.id,
      cityId: this.cityId,
      domainId: attachment.domainId,
      residentId: input.session.agentId,
      pluginId,
      venueModuleId: attachment.venueModuleId,
      venueNamespace: attachment.venueNamespace,
      command: input.msg.type,
      requestType,
      endpoint: attachment.dispatchEndpoint,
      envelopeHash,
      envelope,
    });

    try {
      const response = await this.fetchWithTimeout(attachment.dispatchEndpoint, {
        method: 'POST',
        headers: {
          accept: 'application/json',
          'content-type': 'application/json',
        },
        body: JSON.stringify(envelope),
      });
      requireJsonContentType(response, 'DOMAIN_DISPATCH_RECEIPT_CONTENT_TYPE_INVALID');
      const receipt = this.parseDispatchReceipt(
        parseJson(await readLimitedText(response, this.maxReceiptBytes), 'DOMAIN_DISPATCH_RECEIPT_JSON_INVALID'),
        attachment,
        envelopeHash,
        auditId,
        input.msg.id,
      );
      const delivered = response.ok && (receipt.status === 'accepted' || receipt.status === 'delivered');
      const result = compactReceipt({
        ok: delivered,
        code: receipt.code,
        cityId: this.cityId,
        venueModuleId: attachment.venueModuleId,
        domainId: attachment.domainId,
        auditId,
        receiptId: receipt.receiptId,
        eventRef: receipt.eventRef,
      });
      await this.updateAudit(auditId, {
        status: delivered ? 'delivered' : 'failed',
        receiptCode: receipt.code,
        receipt: result,
      });
      return {
        status: delivered ? 'delivered' : 'failed',
        receipt: result,
      };
    } catch (error) {
      const code = error instanceof DomainDocumentError ? error.code : 'DOMAIN_DISPATCH_FAILED';
      const result = compactReceipt({
        ok: false,
        code,
        cityId: this.cityId,
        venueModuleId: attachment.venueModuleId,
        domainId: attachment.domainId,
        auditId,
      });
      await this.updateAudit(auditId, {
        status: 'failed',
        receiptCode: code,
        receipt: result,
      });
      return { status: 'failed', receipt: result };
    }
  }

  private async findActiveAttachment(pluginId: string, venueModuleId: string) {
    const rows = await this.db.select()
      .from(schema.domainAttachments)
      .where(and(
        eq(schema.domainAttachments.pluginId, pluginId),
        eq(schema.domainAttachments.venueModuleId, venueModuleId),
        eq(schema.domainAttachments.status, 'attached'),
      ))
      .orderBy(desc(schema.domainAttachments.updatedAt));
    const now = this.now().getTime();
    return rows.find((row) => !row.validUntil || row.validUntil.getTime() > now);
  }

  private parseDispatchReceipt(
    raw: unknown,
    attachment: typeof schema.domainAttachments.$inferSelect,
    envelopeHash: string,
    auditId: string,
    requestId: string,
  ): {
    status: 'accepted' | 'rejected' | 'delivered' | 'failed';
    code: string;
    receiptId: string;
    eventRef?: string;
  } {
    if (!isRecord(raw)) throw new DomainDocumentError('DOMAIN_DISPATCH_RECEIPT_INVALID', 'Invalid dispatch receipt');
    requireExactKeys(
      raw,
      [...DOMAIN_DISPATCH_RECEIPT_SIGNED_FIELDS, 'proof'],
      'DOMAIN_DISPATCH_RECEIPT_INVALID',
      'receipt fields',
    );
    if (raw.schema !== DOMAIN_DISPATCH_RECEIPT_SCHEMA) {
      throw new DomainDocumentError('DOMAIN_DISPATCH_RECEIPT_INVALID', 'Invalid dispatch receipt schema');
    }
    if (raw.domainId !== attachment.domainId) {
      throw new DomainDocumentError('DOMAIN_DISPATCH_RECEIPT_DOMAIN_MISMATCH', 'Dispatch receipt domain mismatch');
    }
    if (raw.cityId !== this.cityId) {
      throw new DomainDocumentError('DOMAIN_DISPATCH_RECEIPT_CITY_MISMATCH', 'Dispatch receipt city mismatch');
    }
    if (raw.auditId !== auditId) {
      throw new DomainDocumentError('DOMAIN_DISPATCH_RECEIPT_AUDIT_MISMATCH', 'Dispatch receipt audit mismatch');
    }
    if (raw.requestId !== requestId) {
      throw new DomainDocumentError('DOMAIN_DISPATCH_RECEIPT_REQUEST_MISMATCH', 'Dispatch receipt request mismatch');
    }
    if (raw.status !== 'accepted' && raw.status !== 'rejected' && raw.status !== 'delivered' && raw.status !== 'failed') {
      throw new DomainDocumentError('DOMAIN_DISPATCH_RECEIPT_INVALID', 'Invalid dispatch receipt status');
    }
    const code = stringValue(raw.code);
    if (!code) {
      throw new DomainDocumentError('DOMAIN_DISPATCH_RECEIPT_INVALID', 'Invalid dispatch receipt code');
    }
    const receiptId = stringValue(raw.receiptId);
    if (!receiptId) {
      throw new DomainDocumentError('DOMAIN_DISPATCH_RECEIPT_INVALID', 'Invalid dispatch receipt id');
    }
    const eventRef = raw.eventRef === null ? undefined : stringValue(raw.eventRef);
    if (raw.eventRef !== null && !eventRef) {
      throw new DomainDocumentError('DOMAIN_DISPATCH_RECEIPT_INVALID', 'Invalid dispatch receipt eventRef');
    }
    requireIsoTimestamp(raw.issuedAt, 'DOMAIN_DISPATCH_RECEIPT_INVALID', 'receipt issuedAt');
    if (raw.envelopeHash !== envelopeHash) {
      throw new DomainDocumentError('DOMAIN_DISPATCH_RECEIPT_HASH_MISMATCH', 'Dispatch receipt envelope hash mismatch');
    }
    const proof = raw.proof;
    const covered = isRecord(proof) && Array.isArray(proof.covered) ? proof.covered : undefined;
    if (!isRecord(proof)
      || proof.type !== 'ed25519-signature-2026'
      || proof.canonicalization !== DOMAIN_DISPATCH_RECEIPT_CANONICALIZATION
      || typeof proof.verificationMethod !== 'string'
      || typeof proof.signature !== 'string'
      || JSON.stringify(covered) !== JSON.stringify(DOMAIN_DISPATCH_RECEIPT_SIGNED_FIELDS)) {
      throw new DomainDocumentError('DOMAIN_DISPATCH_RECEIPT_PROOF_INVALID', 'Invalid dispatch receipt proof');
    }
    const verificationKey = parsePublicKeys(attachment.publicKeys).find((key) => key.id === proof.verificationMethod);
    if (!verificationKey) {
      throw new DomainDocumentError('DOMAIN_DISPATCH_RECEIPT_PROOF_INVALID', 'Dispatch receipt proof key not found');
    }
    let valid = false;
    try {
      valid = verify(
        null,
        canonicalDomainDispatchReceiptPayload(raw),
        createPublicKey(verificationKey.publicKeyPem),
        Buffer.from(proof.signature, 'base64'),
      );
    } catch {
      throw new DomainDocumentError('DOMAIN_DISPATCH_RECEIPT_PROOF_INVALID', 'Dispatch receipt proof cannot be verified');
    }
    if (!valid) {
      throw new DomainDocumentError('DOMAIN_DISPATCH_RECEIPT_SIGNATURE_INVALID', 'Dispatch receipt signature invalid');
    }
    return {
      status: raw.status,
      code,
      receiptId,
      ...(eventRef ? { eventRef } : {}),
    };
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.timeoutMs);
    try {
      return await this.fetchImpl(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new DomainDocumentError('DOMAIN_REQUEST_TIMEOUT', 'Domain request timed out');
      }
      throw new DomainDocumentError('DOMAIN_DISPATCH_FAILED', 'Domain dispatch failed');
    } finally {
      clearTimeout(timer);
    }
  }

  private async insertAudit(input: {
    id: string;
    attachmentId: string;
    cityId: string;
    domainId: string;
    residentId: string;
    pluginId: string;
    venueModuleId: string;
    venueNamespace: string;
    command: string;
    requestType: string;
    endpoint: string;
    envelopeHash: string;
    envelope: unknown;
  }): Promise<void> {
    const now = this.now();
    await this.db.insert(schema.domainDispatchAudits).values({
      id: input.id,
      status: 'pending',
      attachmentId: input.attachmentId,
      cityId: input.cityId,
      domainId: input.domainId,
      residentId: input.residentId,
      pluginId: input.pluginId,
      venueModuleId: input.venueModuleId,
      venueNamespace: input.venueNamespace,
      command: input.command,
      requestType: input.requestType,
      endpoint: input.endpoint,
      envelopeHash: input.envelopeHash,
      envelope: JSON.stringify(input.envelope),
      receiptCode: 'PENDING',
      receipt: JSON.stringify({ ok: false, code: 'PENDING' }),
      createdAt: now,
      updatedAt: now,
    });
  }

  private async updateAudit(id: string, input: {
    status: 'delivered' | 'failed';
    receiptCode: string;
    receipt: unknown;
  }): Promise<void> {
    await this.db.update(schema.domainDispatchAudits)
      .set({
        status: input.status,
        receiptCode: input.receiptCode,
        receipt: JSON.stringify(input.receipt),
        updatedAt: this.now(),
      })
      .where(eq(schema.domainDispatchAudits.id, id));
  }
}
