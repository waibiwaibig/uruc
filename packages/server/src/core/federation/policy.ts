import type { CityFederationSpec } from '../plugin-platform/types.js';
import type { FederationDocument, FederationRiskLevel } from './document.js';

export type TrustPolicyDecision = 'accept' | 'reject' | 'warn' | 'unknown';
export type TrustPolicyScope = 'city' | 'issuer' | 'resident' | 'domain';

export interface FederationPolicyResult {
  federationId: string;
  decision: TrustPolicyDecision;
  code: string;
  scope: TrustPolicyScope;
  reasons: string[];
}

export type TrustPolicySubject =
  | { kind: 'city'; cityId: string; riskLevel?: FederationRiskLevel; conformanceBadges?: string[] }
  | { kind: 'issuer'; issuerId: string; riskLevel?: FederationRiskLevel; conformanceBadges?: string[] }
  | { kind: 'resident'; residentId: string; riskLevel?: FederationRiskLevel; conformanceBadges?: string[] }
  | { kind: 'domain'; domainId: string; riskLevel?: FederationRiskLevel; conformanceBadges?: string[] };

export interface EvaluateTrustPolicyInput {
  document: FederationDocument;
  cityPolicy?: Pick<CityFederationSpec, 'federationId' | 'trustPolicy'>;
  subject: TrustPolicySubject;
}

function scopeFor(subject: TrustPolicySubject): TrustPolicyScope {
  return subject.kind;
}

function result(
  federationId: string,
  subject: TrustPolicySubject,
  decision: TrustPolicyDecision,
  code: string,
  reasons: string[],
): FederationPolicyResult {
  return {
    federationId,
    decision,
    code,
    scope: scopeFor(subject),
    reasons,
  };
}

function includes(value: string | undefined, items: string[] | undefined): boolean {
  return Boolean(value && items?.includes(value));
}

function conformanceMissing(subject: TrustPolicySubject, required: string[] | undefined): string[] {
  if (!required || required.length === 0) return [];
  if (subject.conformanceBadges === undefined) return [];
  const actual = new Set(subject.conformanceBadges ?? []);
  return required.filter((badge) => !actual.has(badge));
}

export function evaluateTrustPolicy(input: EvaluateTrustPolicyInput): FederationPolicyResult {
  const { document, cityPolicy, subject } = input;
  if (!cityPolicy || cityPolicy.federationId !== document.federationId) {
    return result(document.federationId, subject, 'unknown', 'FEDERATION_CITY_NOT_JOINED', [
      'city has not declared this federation policy context',
    ]);
  }

  const policy = cityPolicy.trustPolicy;
  if (subject.riskLevel && includes(subject.riskLevel, policy?.rejectRiskLevels)) {
    return result(document.federationId, subject, 'reject', 'FEDERATION_RISK_REJECTED', [
      'risk level matched city reject policy',
    ]);
  }
  if (subject.kind === 'issuer' && includes(subject.issuerId, policy?.rejectedIssuerIds)) {
    return result(document.federationId, subject, 'reject', 'FEDERATION_ISSUER_REJECTED', [
      'issuer matched city reject policy',
    ]);
  }

  const missingBadges = conformanceMissing(subject, policy?.requiredConformanceBadges);
  if (missingBadges.length > 0) {
    return result(document.federationId, subject, 'warn', 'FEDERATION_CONFORMANCE_MISSING', [
      `missing conformance badges: ${missingBadges.join(',')}`,
    ]);
  }
  if (subject.riskLevel && includes(subject.riskLevel, policy?.warnRiskLevels)) {
    return result(document.federationId, subject, 'warn', 'FEDERATION_RISK_WARN', [
      'risk level matched city warn policy',
    ]);
  }

  if (subject.kind === 'city') {
    const member = document.members.find((item) => item.cityId === subject.cityId);
    if (member) {
      return result(document.federationId, subject, 'accept', 'FEDERATION_MEMBER_ACCEPTED', [
        `city is federation ${member.role}`,
      ]);
    }
  }
  if (subject.kind === 'issuer') {
    const trusted = policy?.trustedIssuerIds?.includes(subject.issuerId)
      || document.trustAnchors.some((anchor) => anchor.type === 'issuer' && (anchor.id === subject.issuerId || anchor.ref === subject.issuerId));
    if (trusted) {
      return result(document.federationId, subject, 'accept', 'FEDERATION_ISSUER_ACCEPTED', [
        'issuer matched federation trust anchor or city trust policy',
      ]);
    }
  }

  return result(document.federationId, subject, 'unknown', 'FEDERATION_NO_MATCH', [
    'no skeleton policy rule matched this subject',
  ]);
}

export function attachFederationPolicyResult<T extends Record<string, unknown>>(
  verification: T,
  policyResult: FederationPolicyResult,
): T & { federationPolicy: FederationPolicyResult } {
  return {
    ...verification,
    federationPolicy: policyResult,
  };
}
