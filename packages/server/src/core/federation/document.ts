import { createHash, createPublicKey, verify } from 'crypto';

export const FEDERATION_DOCUMENT_SCHEMA = 'uruc.federation.document@v0';
export const FEDERATION_DOCUMENT_CANONICALIZATION = 'uruc-federation-document-v0-sorted-json-without-proof';
export const FEDERATION_DOCUMENT_SIGNED_FIELDS = [
  'conformance',
  'federationId',
  'members',
  'metadata',
  'policyRefs',
  'risk',
  'schema',
  'trustAnchors',
  'validFrom',
  'validUntil',
  'version',
] as const;

export type FederationMemberRole = 'anchor' | 'member' | 'observer';
export type FederationTrustAnchorType = 'issuer' | 'city' | 'public-key';
export type FederationAssurance = 'low' | 'medium' | 'high';
export type FederationPolicyRefType = 'trust-policy' | 'conformance' | 'risk';
export type FederationRiskLevel = 'low' | 'medium' | 'high' | 'unknown';
export type FederationConformanceStatus = 'acquired' | 'verified' | 'revoked';

export interface FederationDocument {
  schema: typeof FEDERATION_DOCUMENT_SCHEMA;
  federationId: string;
  version: number;
  members: Array<{
    cityId: string;
    role: FederationMemberRole;
    documentRef?: string;
  }>;
  trustAnchors: Array<{
    id: string;
    type: FederationTrustAnchorType;
    ref: string;
    assurance?: FederationAssurance;
  }>;
  policyRefs: Array<{
    id: string;
    type: FederationPolicyRefType;
    ref: string;
    version?: number;
    digest?: string;
    required?: boolean;
    validFrom?: string;
    validUntil?: string;
    federationId?: string;
  }>;
  risk: {
    defaultLevel: FederationRiskLevel;
    feeds?: Array<{
      id: string;
      ref: string;
    }>;
  };
  conformance: {
    badges: Array<{
      id: string;
      status: FederationConformanceStatus;
    }>;
  };
  metadata?: {
    name?: string;
    homepage?: string;
    updatedAt?: string;
  };
  validFrom: string;
  validUntil: string;
  proof: {
    type: 'ed25519-signature-2026';
    verificationMethod: string;
    createdAt: string;
    canonicalization: typeof FEDERATION_DOCUMENT_CANONICALIZATION;
    covered: Array<(typeof FEDERATION_DOCUMENT_SIGNED_FIELDS)[number]>;
    signature: string;
  };
}

export class FederationDocumentError extends Error {
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

function stringValue(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() !== '' ? value : undefined;
}

function requireString(value: unknown, code: string, label: string): string {
  const text = stringValue(value);
  if (!text) throw new FederationDocumentError(code, `Invalid Federation Document ${label}`);
  return text;
}

function requireUrl(value: unknown, code: string, label: string): string {
  const text = requireString(value, code, label);
  try {
    const url = new URL(text);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') throw new Error('unsupported protocol');
    return url.toString();
  } catch {
    throw new FederationDocumentError(code, `Invalid Federation Document ${label}`);
  }
}

function optionalUrl(value: unknown, code: string, label: string): string | undefined {
  if (value === undefined) return undefined;
  return requireUrl(value, code, label);
}

function requireEnum<T extends string>(value: unknown, allowed: readonly T[], code: string, label: string): T {
  if (typeof value !== 'string' || !allowed.includes(value as T)) {
    throw new FederationDocumentError(code, `Invalid Federation Document ${label}`);
  }
  return value as T;
}

function optionalIsoTimestamp(value: unknown, code: string, label: string): string | undefined {
  if (value === undefined) return undefined;
  const text = requireString(value, code, label);
  const time = Date.parse(text);
  if (Number.isNaN(time) || new Date(time).toISOString() !== text) {
    throw new FederationDocumentError(code, `Invalid Federation Document ${label}`);
  }
  return text;
}

function requireIsoTimestamp(value: unknown, code: string, label: string): string {
  const text = requireString(value, code, label);
  const time = Date.parse(text);
  if (Number.isNaN(time) || new Date(time).toISOString() !== text) {
    throw new FederationDocumentError(code, `Invalid Federation Document ${label}`);
  }
  return text;
}

function requireExactKeys(value: Record<string, unknown>, allowed: readonly string[], code: string, label: string): void {
  const extra = Object.keys(value).filter((key) => !allowed.includes(key));
  if (extra.length > 0) {
    throw new FederationDocumentError(code, `Invalid Federation Document ${label}`);
  }
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

export function canonicalFederationDocumentPayload(document: Record<string, unknown>): Buffer {
  const { proof: _proof, ...unsigned } = document;
  return Buffer.from(JSON.stringify(stableValue(unsigned)), 'utf8');
}

export function federationDocumentDigest(document: Record<string, unknown>): string {
  return `sha256:${createHash('sha256').update(canonicalFederationDocumentPayload(document)).digest('hex')}`;
}

function requireArray(value: unknown, code: string, label: string): unknown[] {
  if (!Array.isArray(value) || value.length === 0) {
    throw new FederationDocumentError(code, `Invalid Federation Document ${label}`);
  }
  return value;
}

export function parseFederationDocument(raw: unknown): FederationDocument {
  if (!isRecord(raw)) {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_INVALID', 'Invalid Federation Document');
  }
  requireExactKeys(raw, [...FEDERATION_DOCUMENT_SIGNED_FIELDS, 'proof'], 'FEDERATION_DOCUMENT_FIELD_INVALID', 'top-level fields');
  if (raw.schema !== FEDERATION_DOCUMENT_SCHEMA) {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_SCHEMA_INVALID', 'Unsupported Federation Document schema');
  }
  const version = raw.version;
  if (typeof version !== 'number' || !Number.isInteger(version) || version < 1) {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_VERSION_INVALID', 'Invalid Federation Document version');
  }

  const members = requireArray(raw.members, 'FEDERATION_DOCUMENT_MEMBERS_INVALID', 'members').map((member) => {
    if (!isRecord(member)) {
      throw new FederationDocumentError('FEDERATION_DOCUMENT_MEMBERS_INVALID', 'Invalid Federation Document members');
    }
    return {
      cityId: requireString(member.cityId, 'FEDERATION_DOCUMENT_MEMBERS_INVALID', 'members.cityId'),
      role: requireEnum(member.role, ['anchor', 'member', 'observer'], 'FEDERATION_DOCUMENT_MEMBERS_INVALID', 'members.role'),
      ...(member.documentRef !== undefined
        ? { documentRef: requireUrl(member.documentRef, 'FEDERATION_DOCUMENT_MEMBERS_INVALID', 'members.documentRef') }
        : {}),
    };
  });

  const trustAnchors = requireArray(raw.trustAnchors, 'FEDERATION_DOCUMENT_TRUST_ANCHORS_INVALID', 'trustAnchors').map((anchor) => {
    if (!isRecord(anchor)) {
      throw new FederationDocumentError('FEDERATION_DOCUMENT_TRUST_ANCHORS_INVALID', 'Invalid Federation Document trustAnchors');
    }
    return {
      id: requireString(anchor.id, 'FEDERATION_DOCUMENT_TRUST_ANCHORS_INVALID', 'trustAnchors.id'),
      type: requireEnum(anchor.type, ['issuer', 'city', 'public-key'], 'FEDERATION_DOCUMENT_TRUST_ANCHORS_INVALID', 'trustAnchors.type'),
      ref: requireString(anchor.ref, 'FEDERATION_DOCUMENT_TRUST_ANCHORS_INVALID', 'trustAnchors.ref'),
      ...(anchor.assurance !== undefined
        ? { assurance: requireEnum(anchor.assurance, ['low', 'medium', 'high'], 'FEDERATION_DOCUMENT_TRUST_ANCHORS_INVALID', 'trustAnchors.assurance') }
        : {}),
    };
  });

  const policyRefs = requireArray(raw.policyRefs, 'FEDERATION_DOCUMENT_POLICY_REFS_INVALID', 'policyRefs').map((policyRef) => {
    if (!isRecord(policyRef)) {
      throw new FederationDocumentError('FEDERATION_DOCUMENT_POLICY_REFS_INVALID', 'Invalid Federation Document policyRefs');
    }
    return {
      id: requireString(policyRef.id, 'FEDERATION_DOCUMENT_POLICY_REFS_INVALID', 'policyRefs.id'),
      type: requireEnum(policyRef.type, ['trust-policy', 'conformance', 'risk'], 'FEDERATION_DOCUMENT_POLICY_REFS_INVALID', 'policyRefs.type'),
      ref: requireUrl(policyRef.ref, 'FEDERATION_DOCUMENT_POLICY_REFS_INVALID', 'policyRefs.ref'),
      ...(policyRef.version !== undefined && typeof policyRef.version === 'number' && Number.isInteger(policyRef.version) && policyRef.version > 0
        ? { version: policyRef.version }
        : policyRef.version !== undefined
          ? (() => { throw new FederationDocumentError('FEDERATION_DOCUMENT_POLICY_REFS_INVALID', 'Invalid Federation Document policyRefs.version'); })()
          : {}),
      ...(policyRef.digest !== undefined
        ? { digest: requireString(policyRef.digest, 'FEDERATION_DOCUMENT_POLICY_REFS_INVALID', 'policyRefs.digest') }
        : {}),
      ...(policyRef.required !== undefined
        ? { required: typeof policyRef.required === 'boolean' ? policyRef.required : (() => { throw new FederationDocumentError('FEDERATION_DOCUMENT_POLICY_REFS_INVALID', 'Invalid Federation Document policyRefs.required'); })() }
        : {}),
      ...(policyRef.validFrom !== undefined
        ? { validFrom: requireIsoTimestamp(policyRef.validFrom, 'FEDERATION_DOCUMENT_POLICY_REFS_INVALID', 'policyRefs.validFrom') }
        : {}),
      ...(policyRef.validUntil !== undefined
        ? { validUntil: requireIsoTimestamp(policyRef.validUntil, 'FEDERATION_DOCUMENT_POLICY_REFS_INVALID', 'policyRefs.validUntil') }
        : {}),
      ...(policyRef.federationId !== undefined
        ? { federationId: requireString(policyRef.federationId, 'FEDERATION_DOCUMENT_POLICY_REFS_INVALID', 'policyRefs.federationId') }
        : {}),
    };
  });

  const risk = raw.risk;
  if (!isRecord(risk)) throw new FederationDocumentError('FEDERATION_DOCUMENT_RISK_INVALID', 'Invalid Federation Document risk');
  const feeds = risk.feeds === undefined ? undefined : requireArray(risk.feeds, 'FEDERATION_DOCUMENT_RISK_INVALID', 'risk.feeds').map((feed) => {
    if (!isRecord(feed)) throw new FederationDocumentError('FEDERATION_DOCUMENT_RISK_INVALID', 'Invalid Federation Document risk.feeds');
    return {
      id: requireString(feed.id, 'FEDERATION_DOCUMENT_RISK_INVALID', 'risk.feeds.id'),
      ref: requireUrl(feed.ref, 'FEDERATION_DOCUMENT_RISK_INVALID', 'risk.feeds.ref'),
    };
  });

  const conformance = raw.conformance;
  if (!isRecord(conformance)) {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_CONFORMANCE_INVALID', 'Invalid Federation Document conformance');
  }
  const badges = requireArray(conformance.badges, 'FEDERATION_DOCUMENT_CONFORMANCE_INVALID', 'conformance.badges').map((badge) => {
    if (!isRecord(badge)) {
      throw new FederationDocumentError('FEDERATION_DOCUMENT_CONFORMANCE_INVALID', 'Invalid Federation Document conformance.badges');
    }
    return {
      id: requireString(badge.id, 'FEDERATION_DOCUMENT_CONFORMANCE_INVALID', 'conformance.badges.id'),
      status: requireEnum(badge.status, ['acquired', 'verified', 'revoked'], 'FEDERATION_DOCUMENT_CONFORMANCE_INVALID', 'conformance.badges.status'),
    };
  });

  const metadata = raw.metadata;
  if (metadata !== undefined && !isRecord(metadata)) {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_METADATA_INVALID', 'Invalid Federation Document metadata');
  }
  const validFrom = requireIsoTimestamp(raw.validFrom, 'FEDERATION_DOCUMENT_VALIDITY_INVALID', 'validFrom');
  const validUntil = requireIsoTimestamp(raw.validUntil, 'FEDERATION_DOCUMENT_VALIDITY_INVALID', 'validUntil');
  if (Date.parse(validFrom) >= Date.parse(validUntil)) {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_VALIDITY_INVALID', 'Invalid Federation Document validity window');
  }
  if (Date.parse(validUntil) <= Date.now()) {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_EXPIRED', 'Federation Document is expired');
  }
  const proof = raw.proof;
  if (!isRecord(proof)) {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_PROOF_INVALID', 'Invalid Federation Document proof');
  }
  requireExactKeys(proof, ['type', 'verificationMethod', 'createdAt', 'canonicalization', 'covered', 'signature'], 'FEDERATION_DOCUMENT_PROOF_INVALID', 'proof fields');
  const proofType = requireString(proof.type, 'FEDERATION_DOCUMENT_PROOF_INVALID', 'proof.type');
  if (proofType !== 'ed25519-signature-2026') {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_PROOF_INVALID', 'Invalid Federation Document proof.type');
  }
  const verificationMethod = requireString(proof.verificationMethod, 'FEDERATION_DOCUMENT_PROOF_INVALID', 'proof.verificationMethod');
  const proofCanonicalization = requireString(proof.canonicalization, 'FEDERATION_DOCUMENT_PROOF_INVALID', 'proof.canonicalization');
  if (proofCanonicalization !== FEDERATION_DOCUMENT_CANONICALIZATION) {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_PROOF_INVALID', 'Invalid Federation Document proof.canonicalization');
  }
  if (!Array.isArray(proof.covered) || JSON.stringify(proof.covered) !== JSON.stringify(FEDERATION_DOCUMENT_SIGNED_FIELDS)) {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_PROOF_INVALID', 'Invalid Federation Document proof.covered');
  }

  const document = {
    schema: FEDERATION_DOCUMENT_SCHEMA,
    federationId: requireString(raw.federationId, 'FEDERATION_DOCUMENT_ID_INVALID', 'federationId'),
    version,
    members,
    trustAnchors,
    policyRefs,
    risk: {
      defaultLevel: requireEnum(risk.defaultLevel, ['low', 'medium', 'high', 'unknown'], 'FEDERATION_DOCUMENT_RISK_INVALID', 'risk.defaultLevel'),
      ...(feeds ? { feeds } : {}),
    },
    conformance: {
      badges,
    },
    validFrom,
    validUntil,
    ...(metadata
      ? {
        metadata: {
          ...(metadata.name !== undefined ? { name: requireString(metadata.name, 'FEDERATION_DOCUMENT_METADATA_INVALID', 'metadata.name') } : {}),
          ...(metadata.homepage !== undefined ? { homepage: optionalUrl(metadata.homepage, 'FEDERATION_DOCUMENT_METADATA_INVALID', 'metadata.homepage') } : {}),
          ...(metadata.updatedAt !== undefined ? { updatedAt: optionalIsoTimestamp(metadata.updatedAt, 'FEDERATION_DOCUMENT_METADATA_INVALID', 'metadata.updatedAt') } : {}),
        },
      }
      : {}),
    proof: {
      type: proofType,
      verificationMethod,
      createdAt: requireIsoTimestamp(proof.createdAt, 'FEDERATION_DOCUMENT_PROOF_INVALID', 'proof.createdAt'),
      canonicalization: FEDERATION_DOCUMENT_CANONICALIZATION,
      covered: [...FEDERATION_DOCUMENT_SIGNED_FIELDS],
      signature: requireString(proof.signature, 'FEDERATION_DOCUMENT_PROOF_INVALID', 'proof.signature'),
    },
  } satisfies FederationDocument;

  const proofAnchor = document.trustAnchors.find((anchor) => anchor.type === 'public-key' && anchor.id === verificationMethod);
  if (!proofAnchor) {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_PROOF_INVALID', 'Federation Document proof key not found');
  }
  let valid = false;
  try {
    valid = verify(
      null,
      canonicalFederationDocumentPayload(document as unknown as Record<string, unknown>),
      createPublicKey(proofAnchor.ref),
      Buffer.from(document.proof.signature, 'base64'),
    );
  } catch {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_PROOF_INVALID', 'Federation Document proof cannot be verified');
  }
  if (!valid) {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_SIGNATURE_INVALID', 'Federation Document signature invalid');
  }
  return document;
}
