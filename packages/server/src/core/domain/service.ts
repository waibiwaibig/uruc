import { createHash, randomUUID } from 'crypto';
import { eq } from 'drizzle-orm';

import { type UrucDb, schema } from '../database/index.js';
import type { VenueModuleManifest } from '../plugin-platform/types.js';
import {
  DOMAIN_PROTOCOL_VERSION,
  DomainDocumentError,
  type DomainDocument,
  canonicalDomainDocumentPayload,
  parseDomainDocument,
} from './document.js';

export const DOMAIN_ATTACHMENT_REQUEST_SCHEMA = 'uruc.domain.attachment.request@v0';
export const DOMAIN_ATTACHMENT_RECEIPT_SCHEMA = 'uruc.domain.attachment.receipt@v0';

type FetchLike = typeof fetch;

export interface DomainAttachmentServiceOptions {
  fetch?: FetchLike;
  timeoutMs?: number;
  maxDocumentBytes?: number;
  maxReceiptBytes?: number;
  now?: () => Date;
}

export interface AttachVenueDomainInput {
  cityId: string;
  pluginId: string;
  venue: VenueModuleManifest;
}

export interface DomainAttachmentCompactReceipt {
  ok: boolean;
  code: string;
  cityId: string;
  venueModuleId: string;
  domainId?: string;
  attachmentId?: string;
}

export interface DomainAttachmentResult {
  status: 'attached' | 'failed' | 'skipped';
  receipt: DomainAttachmentCompactReceipt;
  document?: DomainDocument;
}

interface AttachmentReceipt {
  schema: typeof DOMAIN_ATTACHMENT_RECEIPT_SCHEMA;
  status: 'accepted' | 'rejected';
  code: string;
  receiptId?: string;
  validUntil?: Date;
  capabilities: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function asUrl(value: string, code: string): string {
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('unsupported protocol');
    return url.toString();
  } catch {
    throw new DomainDocumentError(code, `Invalid URL: ${value}`);
  }
}

function resolveDocumentUrl(domain: { endpoint?: string; document?: string } | undefined): string {
  if (!domain || typeof domain !== 'object') {
    throw new DomainDocumentError('DOMAIN_DOCUMENT_URL_REQUIRED', 'Domain topology requires endpoint or document metadata');
  }
  const record = domain as Record<string, unknown>;
  const document = stringValue(record.document);
  if (document) return asUrl(document, 'DOMAIN_DOCUMENT_URL_INVALID');
  const endpoint = stringValue(record.endpoint);
  if (!endpoint) {
    throw new DomainDocumentError('DOMAIN_DOCUMENT_URL_REQUIRED', 'Domain topology requires endpoint or document metadata');
  }
  return new URL('/.well-known/uruc-domain.json', asUrl(endpoint, 'DOMAIN_ENDPOINT_INVALID')).toString();
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

function parseJson(text: string, code: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    throw new DomainDocumentError(code, 'Domain response is not valid JSON');
  }
}

function requireJsonContentType(response: Response, code: string): void {
  const mediaType = (response.headers.get('content-type') ?? '').toLowerCase().split(';', 1)[0].trim();
  if (mediaType !== 'application/json' && !mediaType.endsWith('+json')) {
    throw new DomainDocumentError(code, 'Domain response content-type is not JSON');
  }
}

function parseAttachmentReceipt(raw: unknown): AttachmentReceipt {
  if (!isRecord(raw)) {
    throw new DomainDocumentError('DOMAIN_ATTACHMENT_RECEIPT_INVALID', 'Invalid attachment receipt');
  }
  if (raw.schema !== DOMAIN_ATTACHMENT_RECEIPT_SCHEMA) {
    throw new DomainDocumentError('DOMAIN_ATTACHMENT_RECEIPT_INVALID', 'Invalid attachment receipt schema');
  }
  if (raw.status !== 'accepted' && raw.status !== 'rejected') {
    throw new DomainDocumentError('DOMAIN_ATTACHMENT_RECEIPT_INVALID', 'Invalid attachment receipt status');
  }
  const code = stringValue(raw.code);
  if (!code) {
    throw new DomainDocumentError('DOMAIN_ATTACHMENT_RECEIPT_INVALID', 'Invalid attachment receipt code');
  }
  const capabilities = raw.capabilities === undefined
    ? []
    : Array.isArray(raw.capabilities) && raw.capabilities.every((item) => typeof item === 'string' && item.trim() !== '')
      ? raw.capabilities
      : undefined;
  if (!capabilities) {
    throw new DomainDocumentError('DOMAIN_ATTACHMENT_RECEIPT_INVALID', 'Invalid attachment receipt capabilities');
  }
  const validUntilValue = stringValue(raw.validUntil);
  const validUntil = validUntilValue ? new Date(validUntilValue) : undefined;
  if (validUntil && Number.isNaN(validUntil.getTime())) {
    throw new DomainDocumentError('DOMAIN_ATTACHMENT_RECEIPT_INVALID', 'Invalid attachment receipt validUntil');
  }
  if (raw.status === 'accepted' && !validUntil) {
    throw new DomainDocumentError('DOMAIN_ATTACHMENT_RECEIPT_INVALID', 'Accepted attachment receipt requires validUntil');
  }
  return {
    schema: DOMAIN_ATTACHMENT_RECEIPT_SCHEMA,
    status: raw.status,
    code,
    receiptId: stringValue(raw.receiptId),
    ...(validUntil ? { validUntil } : {}),
    capabilities,
  };
}

export class DomainAttachmentService {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly maxDocumentBytes: number;
  private readonly maxReceiptBytes: number;
  private readonly now: () => Date;

  constructor(
    private readonly db: UrucDb,
    options: DomainAttachmentServiceOptions = {},
  ) {
    this.fetchImpl = options.fetch ?? fetch;
    this.timeoutMs = options.timeoutMs ?? 3_000;
    this.maxDocumentBytes = options.maxDocumentBytes ?? 64 * 1024;
    this.maxReceiptBytes = options.maxReceiptBytes ?? 32 * 1024;
    this.now = options.now ?? (() => new Date());
  }

  async attachVenueDomain(input: AttachVenueDomainInput): Promise<DomainAttachmentResult> {
    if (input.venue.topology?.mode !== 'domain') {
      return {
        status: 'skipped',
        receipt: {
          ok: true,
          code: 'LOCAL_TOPOLOGY',
          cityId: input.cityId,
          venueModuleId: input.venue.moduleId,
        },
      };
    }

    let document: DomainDocument | undefined;
    let attachmentId: string | undefined;
    try {
      const documentUrl = resolveDocumentUrl(input.venue.topology.domain);
      document = await this.fetchDomainDocument(documentUrl, input);
      attachmentId = await this.insertAttachment({
        status: 'pending',
        input,
        document,
        documentUrl,
        receiptCode: 'PENDING',
        receipt: { ok: false, code: 'PENDING' },
        capabilities: document.capabilities,
      });

      const attachmentReceipt = await this.requestAttachment(document, input);
      if (attachmentReceipt.status === 'accepted' && attachmentReceipt.validUntil && attachmentReceipt.validUntil <= this.now()) {
        throw new DomainDocumentError('DOMAIN_ATTACHMENT_EXPIRED', 'Domain attachment receipt is expired');
      }
      const status = attachmentReceipt.status === 'accepted' ? 'attached' : 'failed';
      const compact = {
        ok: status === 'attached',
        code: attachmentReceipt.code,
        cityId: input.cityId,
        venueModuleId: input.venue.moduleId,
        domainId: document.domainId,
        attachmentId,
      };
      await this.updateAttachment(attachmentId, {
        status,
        receiptCode: attachmentReceipt.code,
        receipt: compact,
        capabilities: attachmentReceipt.capabilities.length > 0 ? attachmentReceipt.capabilities : document.capabilities,
        validUntil: attachmentReceipt.validUntil,
      });
      return {
        status,
        receipt: compact,
        document,
      };
    } catch (error) {
      const code = error instanceof DomainDocumentError ? error.code : 'DOMAIN_ATTACHMENT_FAILED';
      const compact = {
        ok: false,
        code,
        cityId: input.cityId,
        venueModuleId: input.venue.moduleId,
        ...(document ? { domainId: document.domainId } : {}),
        ...(attachmentId ? { attachmentId } : {}),
      };
      if (attachmentId) {
        await this.updateAttachment(attachmentId, {
          status: 'failed',
          receiptCode: code,
          receipt: compact,
          capabilities: document?.capabilities ?? [],
        });
      }
      return {
        status: 'failed',
        receipt: compact,
        ...(document ? { document } : {}),
      };
    }
  }

  private async fetchDomainDocument(documentUrl: string, input: AttachVenueDomainInput): Promise<DomainDocument> {
    const response = await this.fetchWithTimeout(documentUrl, {
      method: 'GET',
      headers: { accept: 'application/json' },
    });
    requireJsonContentType(response, 'DOMAIN_DOCUMENT_CONTENT_TYPE_INVALID');
    if (!response.ok) {
      throw new DomainDocumentError('DOMAIN_DOCUMENT_FETCH_FAILED', `Domain Document fetch failed with HTTP ${response.status}`);
    }
    return parseDomainDocument(parseJson(await readLimitedText(response, this.maxDocumentBytes), 'DOMAIN_DOCUMENT_JSON_INVALID'), {
      expectedVenueModuleId: input.venue.moduleId,
      expectedVenueNamespace: input.venue.namespace,
      expectedProtocolVersion: DOMAIN_PROTOCOL_VERSION,
    });
  }

  private async requestAttachment(document: DomainDocument, input: AttachVenueDomainInput): Promise<AttachmentReceipt> {
    const response = await this.fetchWithTimeout(document.endpoints.attachment, {
      method: 'POST',
      headers: {
        accept: 'application/json',
        'content-type': 'application/json',
      },
      body: JSON.stringify({
        schema: DOMAIN_ATTACHMENT_REQUEST_SCHEMA,
        cityId: input.cityId,
        domainId: document.domainId,
        pluginId: input.pluginId,
        venue: document.venue,
        protocolVersion: document.protocol.version,
        requestedCapabilities: document.capabilities,
      }),
    });
    requireJsonContentType(response, 'DOMAIN_ATTACHMENT_RECEIPT_CONTENT_TYPE_INVALID');
    const receipt = parseAttachmentReceipt(parseJson(await readLimitedText(response, this.maxReceiptBytes), 'DOMAIN_ATTACHMENT_RECEIPT_JSON_INVALID'));
    if (!response.ok && receipt.status !== 'rejected') {
      throw new DomainDocumentError(receipt.code, `Domain attachment failed with HTTP ${response.status}`);
    }
    return receipt;
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
      throw new DomainDocumentError('DOMAIN_REQUEST_FAILED', 'Domain request failed');
    } finally {
      clearTimeout(timer);
    }
  }

  private async insertAttachment(input: {
    status: 'pending' | 'attached' | 'failed';
    input: AttachVenueDomainInput;
    document: DomainDocument;
    documentUrl: string;
    receiptCode: string;
    receipt: unknown;
    capabilities: string[];
  }): Promise<string> {
    const id = randomUUID();
    const now = this.now();
    await this.db.insert(schema.domainAttachments).values({
      id,
      status: input.status,
      domainId: input.document.domainId,
      cityId: input.input.cityId,
      pluginId: input.input.pluginId,
      venueModuleId: input.input.venue.moduleId,
      venueNamespace: input.input.venue.namespace,
      protocolVersion: input.document.protocol.version,
      endpoint: input.document.endpoints.attachment,
      dispatchEndpoint: input.document.endpoints.dispatch ?? null,
      documentUrl: input.documentUrl,
      documentHash: createHash('sha256')
        .update(canonicalDomainDocumentPayload(input.document as unknown as Record<string, unknown>))
        .digest('hex'),
      publicKeys: JSON.stringify(input.document.publicKeys),
      capabilities: JSON.stringify(input.capabilities),
      receiptCode: input.receiptCode,
      receipt: JSON.stringify(input.receipt),
      createdAt: now,
      updatedAt: now,
    });
    return id;
  }

  private async updateAttachment(id: string, input: {
    status: 'attached' | 'failed' | 'detached';
    receiptCode: string;
    receipt: unknown;
    capabilities: string[];
    validUntil?: Date;
  }): Promise<void> {
    await this.db.update(schema.domainAttachments)
      .set({
        status: input.status,
        capabilities: JSON.stringify(input.capabilities),
        receiptCode: input.receiptCode,
        receipt: JSON.stringify(input.receipt),
        issuedAt: input.status === 'attached' ? this.now() : null,
        validUntil: input.validUntil ?? null,
        updatedAt: this.now(),
      })
      .where(eq(schema.domainAttachments.id, id));
  }
}
