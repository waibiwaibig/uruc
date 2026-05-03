import { mkdtemp, rm, writeFile } from 'fs/promises';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { readCityConfig } from '../../plugin-platform/config.js';
import type { CityFederationSpec } from '../../plugin-platform/types.js';
import {
  attachFederationPolicyResult,
  evaluateTrustPolicy,
  parseFederationDocument,
} from '../index.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function federationDocument(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'uruc.federation.document@v0',
    federationId: 'fed.public-alpha',
    version: 1,
    members: [
      {
        cityId: 'city.alpha',
        role: 'anchor',
        documentRef: 'https://city.alpha.example/.well-known/uruc-city.json',
      },
      {
        cityId: 'city.beta',
        role: 'member',
      },
    ],
    trustAnchors: [
      {
        id: 'issuer.alpha.registry',
        type: 'issuer',
        ref: 'did:web:issuer.alpha.example',
        assurance: 'medium',
      },
    ],
    policyRefs: [
      {
        id: 'fed.public-alpha.baseline',
        type: 'trust-policy',
        ref: 'https://fed.example/policies/baseline.json',
      },
    ],
    risk: {
      defaultLevel: 'unknown',
      feeds: [
        {
          id: 'fed.public-alpha.risk-feed',
          ref: 'https://fed.example/risk-feed.json',
        },
      ],
    },
    conformance: {
      badges: [
        {
          id: 'uruc.intercity.v0',
          status: 'verified',
        },
      ],
    },
    metadata: {
      updatedAt: '2026-05-03T00:00:00.000Z',
    },
    ...overrides,
  };
}

describe('Federation policy skeleton', () => {
  it('parses a compact Federation Document v0 with members, trust anchors, policy refs, risk, and conformance metadata', () => {
    const document = parseFederationDocument(federationDocument());

    expect(document).toMatchObject({
      schema: 'uruc.federation.document@v0',
      federationId: 'fed.public-alpha',
      version: 1,
      members: [
        { cityId: 'city.alpha', role: 'anchor' },
        { cityId: 'city.beta', role: 'member' },
      ],
      trustAnchors: [
        { id: 'issuer.alpha.registry', type: 'issuer', assurance: 'medium' },
      ],
      policyRefs: [
        { id: 'fed.public-alpha.baseline', type: 'trust-policy' },
      ],
      risk: {
        defaultLevel: 'unknown',
      },
      conformance: {
        badges: [
          { id: 'uruc.intercity.v0', status: 'verified' },
        ],
      },
    });
  });

  it('rejects invalid Federation Document fields with stable codes', () => {
    expect(() => parseFederationDocument(federationDocument({
      federationId: '',
    }))).toThrow(expect.objectContaining({ code: 'FEDERATION_DOCUMENT_ID_INVALID' }));

    expect(() => parseFederationDocument(federationDocument({
      members: [],
    }))).toThrow(expect.objectContaining({ code: 'FEDERATION_DOCUMENT_MEMBERS_INVALID' }));

    expect(() => parseFederationDocument(federationDocument({
      trustAnchors: [{ id: 'issuer-a', type: 'legal-entity', ref: 'did:web:issuer.example' }],
    }))).toThrow(expect.objectContaining({ code: 'FEDERATION_DOCUMENT_TRUST_ANCHORS_INVALID' }));
  });

  it('lets city config declare federation membership and a local trust-policy skeleton', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'uruc-federation-config-'));
    tempDirs.push(tempRoot);
    const configPath = path.join(tempRoot, 'uruc.city.json');
    await writeFile(configPath, JSON.stringify({
      apiVersion: 2,
      approvedPublishers: [],
      sources: [],
      plugins: {},
      federations: {
        'fed.public-alpha': {
          federationId: 'fed.public-alpha',
          document: 'https://fed.example/.well-known/uruc-federation.json',
          trustPolicy: {
            mode: 'observe',
            trustedIssuerIds: ['issuer.alpha.registry'],
            warnRiskLevels: ['medium'],
            rejectRiskLevels: ['high'],
            requiredConformanceBadges: ['uruc.intercity.v0'],
          },
        },
      },
    }), 'utf8');

    await expect(readCityConfig(configPath)).resolves.toMatchObject({
      federations: {
        'fed.public-alpha': {
          federationId: 'fed.public-alpha',
          document: 'https://fed.example/.well-known/uruc-federation.json',
          trustPolicy: {
            mode: 'observe',
            trustedIssuerIds: ['issuer.alpha.registry'],
            warnRiskLevels: ['medium'],
            rejectRiskLevels: ['high'],
            requiredConformanceBadges: ['uruc.intercity.v0'],
          },
        },
      },
    });
  });

  it('evaluates accept, reject, warn, and unknown without making global legal decisions', () => {
    const document = parseFederationDocument(federationDocument());
    const cityPolicy: CityFederationSpec = {
      federationId: 'fed.public-alpha',
      trustPolicy: {
        mode: 'observe' as const,
        trustedIssuerIds: ['issuer.alpha.registry'],
        rejectedIssuerIds: ['issuer.blocked'],
        warnRiskLevels: ['medium'],
        rejectRiskLevels: ['high'],
        requiredConformanceBadges: ['uruc.intercity.v0'],
      },
    };

    expect(evaluateTrustPolicy({
      document,
      cityPolicy,
      subject: { kind: 'city', cityId: 'city.beta' },
    })).toMatchObject({ decision: 'accept', code: 'FEDERATION_MEMBER_ACCEPTED' });

    expect(evaluateTrustPolicy({
      document,
      cityPolicy,
      subject: { kind: 'issuer', issuerId: 'issuer.blocked' },
    })).toMatchObject({ decision: 'reject', code: 'FEDERATION_ISSUER_REJECTED' });

    expect(evaluateTrustPolicy({
      document,
      cityPolicy,
      subject: { kind: 'resident', residentId: 'resident-risky', riskLevel: 'medium' },
    })).toMatchObject({ decision: 'warn', code: 'FEDERATION_RISK_WARN' });

    expect(evaluateTrustPolicy({
      document,
      cityPolicy,
      subject: { kind: 'domain', domainId: 'domain.unclassified' },
    })).toMatchObject({ decision: 'unknown', code: 'FEDERATION_NO_MATCH' });
  });

  it('attaches federation policy results to verification output without deleting or rewriting resident identity', () => {
    const result = attachFederationPolicyResult(
      {
        residentId: 'uruc:resident:city.alpha:z6M',
        verification: 'registration-active',
      },
      {
        federationId: 'fed.public-alpha',
        decision: 'warn',
        code: 'FEDERATION_RISK_WARN',
        scope: 'resident',
        reasons: ['risk level matched city warn policy'],
      },
    );

    expect(result).toEqual({
      residentId: 'uruc:resident:city.alpha:z6M',
      verification: 'registration-active',
      federationPolicy: {
        federationId: 'fed.public-alpha',
        decision: 'warn',
        code: 'FEDERATION_RISK_WARN',
        scope: 'resident',
        reasons: ['risk level matched city warn policy'],
      },
    });
  });

  it('returns unknown for a city that has not joined the federation policy context', () => {
    const document = parseFederationDocument(federationDocument());

    expect(evaluateTrustPolicy({
      document,
      subject: { kind: 'issuer', issuerId: 'issuer.alpha.registry' },
    })).toMatchObject({
      decision: 'unknown',
      code: 'FEDERATION_CITY_NOT_JOINED',
    });
  });
});
