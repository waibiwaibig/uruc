import { createPublicKey, verify } from 'crypto';

export const DOMAIN_DOCUMENT_SCHEMA = 'uruc.domain.document@v0';
export const DOMAIN_PROTOCOL_VERSION = 'uruc-domain-v0';
export const DOMAIN_DOCUMENT_CANONICALIZATION = 'uruc-domain-document-v0-sorted-json-without-proof';
export const DOMAIN_DOCUMENT_SIGNED_FIELDS = [
  'capabilities',
  'domainId',
  'endpoints',
  'hints',
  'protocol',
  'publicKeys',
  'schema',
  'venue',
] as const;

export interface DomainDocument {
  schema: typeof DOMAIN_DOCUMENT_SCHEMA;
  domainId: string;
  venue: {
    moduleId: string;
    namespace: string;
  };
  protocol: {
    version: typeof DOMAIN_PROTOCOL_VERSION;
  };
  publicKeys: Array<{
    id: string;
    type: 'ed25519-pem';
    publicKeyPem: string;
  }>;
  endpoints: {
    attachment: string;
    dispatch?: string;
  };
  capabilities: string[];
  hints?: Record<string, unknown>;
  proof: {
    type: 'ed25519-signature-2026';
    verificationMethod: string;
    createdAt: string;
    canonicalization: typeof DOMAIN_DOCUMENT_CANONICALIZATION;
    covered: Array<(typeof DOMAIN_DOCUMENT_SIGNED_FIELDS)[number]>;
    signature: string;
  };
}

export interface DomainDocumentExpectations {
  expectedVenueModuleId: string;
  expectedVenueNamespace: string;
  expectedProtocolVersion?: string;
}

export class DomainDocumentError extends Error {
  constructor(
    public readonly code: string,
    message: string,
  ) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function requireString(value: unknown, code: string, label: string): string {
  if (typeof value !== 'string' || value.trim() === '') {
    throw new DomainDocumentError(code, `Invalid Domain Document ${label}`);
  }
  return value;
}

function requireUrl(value: unknown, code: string, label: string): string {
  const text = requireString(value, code, label);
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') {
      throw new Error('unsupported protocol');
    }
    return url.toString();
  } catch {
    throw new DomainDocumentError(code, `Invalid Domain Document ${label}`);
  }
}

function requireStringArray(value: unknown, code: string, label: string): string[] {
  if (!Array.isArray(value) || value.some((item) => typeof item !== 'string' || item.trim() === '')) {
    throw new DomainDocumentError(code, `Invalid Domain Document ${label}`);
  }
  return [...value];
}

function requireExactKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
  code: string,
  label: string,
): void {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length > 0) {
    throw new DomainDocumentError(code, `Invalid Domain Document ${label}`);
  }
}

function requireIsoTimestamp(value: unknown, code: string, label: string): string {
  const text = requireString(value, code, label);
  const time = Date.parse(text);
  if (Number.isNaN(time) || new Date(time).toISOString() !== text) {
    throw new DomainDocumentError(code, `Invalid Domain Document ${label}`);
  }
  return text;
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

export function canonicalDomainDocumentPayload(document: Record<string, unknown>): Buffer {
  const { proof: _proof, ...unsigned } = document;
  return Buffer.from(JSON.stringify(stableValue(unsigned)), 'utf8');
}

function parseDomainDocumentShape(raw: unknown): DomainDocument {
  if (!isRecord(raw)) {
    throw new DomainDocumentError('DOMAIN_DOCUMENT_INVALID', 'Invalid Domain Document');
  }
  requireExactKeys(raw, [...DOMAIN_DOCUMENT_SIGNED_FIELDS, 'proof'], 'DOMAIN_DOCUMENT_FIELD_INVALID', 'top-level fields');
  const venue = raw.venue;
  const protocol = raw.protocol;
  const endpoints = raw.endpoints;
  const proof = raw.proof;
  if (!isRecord(venue)) throw new DomainDocumentError('DOMAIN_DOCUMENT_VENUE_INVALID', 'Invalid Domain Document venue');
  if (!isRecord(protocol)) throw new DomainDocumentError('DOMAIN_DOCUMENT_PROTOCOL_INVALID', 'Invalid Domain Document protocol');
  if (!isRecord(endpoints)) throw new DomainDocumentError('DOMAIN_DOCUMENT_ENDPOINT_INVALID', 'Invalid Domain Document endpoints');
  if (!isRecord(proof)) throw new DomainDocumentError('DOMAIN_DOCUMENT_PROOF_INVALID', 'Invalid Domain Document proof');
  requireExactKeys(venue, ['moduleId', 'namespace'], 'DOMAIN_DOCUMENT_VENUE_INVALID', 'venue fields');
  requireExactKeys(protocol, ['version'], 'DOMAIN_DOCUMENT_PROTOCOL_INVALID', 'protocol fields');
  requireExactKeys(endpoints, ['attachment', 'dispatch'], 'DOMAIN_DOCUMENT_ENDPOINT_INVALID', 'endpoint fields');
  requireExactKeys(proof, ['type', 'verificationMethod', 'createdAt', 'canonicalization', 'covered', 'signature'], 'DOMAIN_DOCUMENT_PROOF_INVALID', 'proof fields');

  const publicKeysValue = raw.publicKeys;
  if (!Array.isArray(publicKeysValue) || publicKeysValue.length === 0) {
    throw new DomainDocumentError('DOMAIN_DOCUMENT_KEYS_INVALID', 'Invalid Domain Document publicKeys');
  }
  const publicKeys = publicKeysValue.map((key) => {
    if (!isRecord(key)) throw new DomainDocumentError('DOMAIN_DOCUMENT_KEYS_INVALID', 'Invalid Domain Document publicKeys');
    requireExactKeys(key, ['id', 'type', 'publicKeyPem'], 'DOMAIN_DOCUMENT_KEYS_INVALID', 'publicKeys fields');
    const type = requireString(key.type, 'DOMAIN_DOCUMENT_KEYS_INVALID', 'publicKeys.type');
    if (type !== 'ed25519-pem') {
      throw new DomainDocumentError('DOMAIN_DOCUMENT_KEYS_INVALID', 'Invalid Domain Document publicKeys.type');
    }
    return {
      id: requireString(key.id, 'DOMAIN_DOCUMENT_KEYS_INVALID', 'publicKeys.id'),
      type: 'ed25519-pem' as const,
      publicKeyPem: requireString(key.publicKeyPem, 'DOMAIN_DOCUMENT_KEYS_INVALID', 'publicKeys.publicKeyPem'),
    };
  });

  const proofType = requireString(proof.type, 'DOMAIN_DOCUMENT_PROOF_INVALID', 'proof.type');
  if (proofType !== 'ed25519-signature-2026') {
    throw new DomainDocumentError('DOMAIN_DOCUMENT_PROOF_INVALID', 'Invalid Domain Document proof.type');
  }
  const canonicalization = requireString(proof.canonicalization, 'DOMAIN_DOCUMENT_PROOF_INVALID', 'proof.canonicalization');
  if (canonicalization !== DOMAIN_DOCUMENT_CANONICALIZATION) {
    throw new DomainDocumentError('DOMAIN_DOCUMENT_PROOF_INVALID', 'Invalid Domain Document proof.canonicalization');
  }
  const covered = requireStringArray(proof.covered, 'DOMAIN_DOCUMENT_PROOF_INVALID', 'proof.covered');
  if (JSON.stringify(covered) !== JSON.stringify(DOMAIN_DOCUMENT_SIGNED_FIELDS)) {
    throw new DomainDocumentError('DOMAIN_DOCUMENT_PROOF_INVALID', 'Invalid Domain Document proof.covered');
  }

  const hints = raw.hints;
  if (hints !== undefined && !isRecord(hints)) {
    throw new DomainDocumentError('DOMAIN_DOCUMENT_HINTS_INVALID', 'Invalid Domain Document hints');
  }

  return {
    schema: requireString(raw.schema, 'DOMAIN_DOCUMENT_SCHEMA_INVALID', 'schema') as typeof DOMAIN_DOCUMENT_SCHEMA,
    domainId: requireString(raw.domainId, 'DOMAIN_DOCUMENT_DOMAIN_INVALID', 'domainId'),
    venue: {
      moduleId: requireString(venue.moduleId, 'DOMAIN_DOCUMENT_VENUE_INVALID', 'venue.moduleId'),
      namespace: requireString(venue.namespace, 'DOMAIN_DOCUMENT_VENUE_INVALID', 'venue.namespace'),
    },
    protocol: {
      version: requireString(protocol.version, 'DOMAIN_DOCUMENT_PROTOCOL_INVALID', 'protocol.version') as typeof DOMAIN_PROTOCOL_VERSION,
    },
    publicKeys,
    endpoints: {
      attachment: requireUrl(endpoints.attachment, 'DOMAIN_DOCUMENT_ENDPOINT_INVALID', 'endpoints.attachment'),
      ...(endpoints.dispatch !== undefined
        ? { dispatch: requireUrl(endpoints.dispatch, 'DOMAIN_DOCUMENT_ENDPOINT_INVALID', 'endpoints.dispatch') }
        : {}),
    },
    capabilities: requireStringArray(raw.capabilities, 'DOMAIN_DOCUMENT_CAPABILITIES_INVALID', 'capabilities'),
    ...(hints ? { hints } : {}),
    proof: {
      type: proofType,
      verificationMethod: requireString(proof.verificationMethod, 'DOMAIN_DOCUMENT_PROOF_INVALID', 'proof.verificationMethod'),
      createdAt: requireIsoTimestamp(proof.createdAt, 'DOMAIN_DOCUMENT_PROOF_INVALID', 'proof.createdAt'),
      canonicalization: DOMAIN_DOCUMENT_CANONICALIZATION,
      covered: [...DOMAIN_DOCUMENT_SIGNED_FIELDS],
      signature: requireString(proof.signature, 'DOMAIN_DOCUMENT_PROOF_INVALID', 'proof.signature'),
    },
  };
}

export function parseDomainDocument(raw: unknown, expectations: DomainDocumentExpectations): DomainDocument {
  const document = parseDomainDocumentShape(raw);
  if (document.schema !== DOMAIN_DOCUMENT_SCHEMA) {
    throw new DomainDocumentError('DOMAIN_DOCUMENT_SCHEMA_INVALID', 'Unsupported Domain Document schema');
  }
  if (document.protocol.version !== (expectations.expectedProtocolVersion ?? DOMAIN_PROTOCOL_VERSION)) {
    throw new DomainDocumentError('DOMAIN_DOCUMENT_PROTOCOL_MISMATCH', 'Domain Document protocol version mismatch');
  }
  if (document.venue.moduleId !== expectations.expectedVenueModuleId) {
    throw new DomainDocumentError('DOMAIN_DOCUMENT_VENUE_MISMATCH', 'Domain Document venue module mismatch');
  }
  if (document.venue.namespace !== expectations.expectedVenueNamespace) {
    throw new DomainDocumentError('DOMAIN_DOCUMENT_NAMESPACE_MISMATCH', 'Domain Document venue namespace mismatch');
  }

  const verificationKey = document.publicKeys.find((key) => key.id === document.proof.verificationMethod);
  if (!verificationKey) {
    throw new DomainDocumentError('DOMAIN_DOCUMENT_PROOF_INVALID', 'Domain Document proof key not found');
  }
  let valid = false;
  try {
    const signature = Buffer.from(document.proof.signature, 'base64');
    if (signature.length === 0) {
      throw new Error('empty signature');
    }
    valid = verify(
      null,
      canonicalDomainDocumentPayload(document as unknown as Record<string, unknown>),
      createPublicKey(verificationKey.publicKeyPem),
      signature,
    );
  } catch {
    throw new DomainDocumentError('DOMAIN_DOCUMENT_PROOF_INVALID', 'Domain Document proof cannot be verified');
  }
  if (!valid) {
    throw new DomainDocumentError('DOMAIN_DOCUMENT_SIGNATURE_INVALID', 'Domain Document signature invalid');
  }

  return document;
}
