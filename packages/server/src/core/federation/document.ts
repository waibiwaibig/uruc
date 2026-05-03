export const FEDERATION_DOCUMENT_SCHEMA = 'uruc.federation.document@v0';

export type FederationMemberRole = 'anchor' | 'member' | 'observer';
export type FederationTrustAnchorType = 'issuer' | 'city' | 'public-key';
export type FederationAssurance = 'low' | 'medium' | 'high';
export type FederationPolicyRefType = 'trust-policy' | 'conformance' | 'risk';
export type FederationRiskLevel = 'low' | 'medium' | 'high' | 'unknown';
export type FederationConformanceStatus = 'claimed' | 'verified' | 'revoked';

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
    digest?: string;
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
      ...(policyRef.digest !== undefined
        ? { digest: requireString(policyRef.digest, 'FEDERATION_DOCUMENT_POLICY_REFS_INVALID', 'policyRefs.digest') }
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
      status: requireEnum(badge.status, ['claimed', 'verified', 'revoked'], 'FEDERATION_DOCUMENT_CONFORMANCE_INVALID', 'conformance.badges.status'),
    };
  });

  const metadata = raw.metadata;
  if (metadata !== undefined && !isRecord(metadata)) {
    throw new FederationDocumentError('FEDERATION_DOCUMENT_METADATA_INVALID', 'Invalid Federation Document metadata');
  }

  return {
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
    ...(metadata
      ? {
        metadata: {
          ...(metadata.name !== undefined ? { name: requireString(metadata.name, 'FEDERATION_DOCUMENT_METADATA_INVALID', 'metadata.name') } : {}),
          ...(metadata.homepage !== undefined ? { homepage: optionalUrl(metadata.homepage, 'FEDERATION_DOCUMENT_METADATA_INVALID', 'metadata.homepage') } : {}),
          ...(metadata.updatedAt !== undefined ? { updatedAt: optionalIsoTimestamp(metadata.updatedAt, 'FEDERATION_DOCUMENT_METADATA_INVALID', 'metadata.updatedAt') } : {}),
        },
      }
      : {}),
  };
}
