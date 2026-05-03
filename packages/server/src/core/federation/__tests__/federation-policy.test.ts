import { mkdtemp, rm, writeFile } from 'fs/promises';
import { generateKeyPairSync, sign } from 'crypto';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { readCityConfig } from '../../plugin-platform/config.js';
import type { CityFederationSpec } from '../../plugin-platform/types.js';
import {
  attachFederationPolicyResult,
  canonicalFederationDocumentPayload,
  evaluateVerifiedFeedEntry,
  evaluateTrustPolicy,
  FederationDocumentService,
  parseFederationDocument,
  verifyFederationPolicyRef,
} from '../index.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function federationDocument(overrides: Record<string, unknown> = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const unsigned = {
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
        id: 'fed.public-alpha.document-key',
        type: 'public-key',
        ref: publicKeyPem,
        assurance: 'high',
      },
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
        version: 1,
        digest: 'sha256:' + 'a'.repeat(64),
        required: true,
        federationId: 'fed.public-alpha',
        validFrom: '2026-05-03T00:00:00.000Z',
        validUntil: '2099-08-03T00:00:00.000Z',
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
    validFrom: '2026-05-03T00:00:00.000Z',
    validUntil: '2099-08-03T00:00:00.000Z',
    ...overrides,
  };
  return {
    ...unsigned,
    proof: {
      type: 'ed25519-signature-2026',
      verificationMethod: 'fed.public-alpha.document-key',
      createdAt: '2026-05-03T00:00:01.000Z',
      canonicalization: 'uruc-federation-document-v0-sorted-json-without-proof',
      covered: [
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
      ],
      signature: sign(null, canonicalFederationDocumentPayload(unsigned), privateKey).toString('base64'),
    },
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
      trustAnchors: expect.arrayContaining([
        expect.objectContaining({ id: 'fed.public-alpha.document-key', type: 'public-key', assurance: 'high' }),
        expect.objectContaining({ id: 'issuer.alpha.registry', type: 'issuer', assurance: 'medium' }),
      ]),
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

    const badProof = federationDocument();
    (badProof.proof as any).signature = 'bad';
    expect(() => parseFederationDocument(badProof)).toThrow(expect.objectContaining({ code: 'FEDERATION_DOCUMENT_SIGNATURE_INVALID' }));

    expect(() => parseFederationDocument(federationDocument({
      validFrom: '2026-01-01T00:00:00.000Z',
      validUntil: '2026-02-01T00:00:00.000Z',
    }))).toThrow(expect.objectContaining({ code: 'FEDERATION_DOCUMENT_EXPIRED' }));
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

  it('warns when city policy requires conformance badges and the subject does not present them', () => {
    const document = parseFederationDocument(federationDocument());
    const cityPolicy: CityFederationSpec = {
      federationId: 'fed.public-alpha',
      trustPolicy: {
        mode: 'observe' as const,
        requiredConformanceBadges: ['uruc.intercity.v0'],
      },
    };

    expect(evaluateTrustPolicy({
      document,
      cityPolicy,
      subject: { kind: 'resident', residentId: 'resident-without-conformance' },
    })).toMatchObject({
      decision: 'warn',
      code: 'FEDERATION_CONFORMANCE_MISSING',
      reasons: ['missing conformance badges: uruc.intercity.v0'],
    });
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

  it('fetches signed Federation Documents with bounded cache diagnostics', async () => {
    const raw = federationDocument();
    let fetchCount = 0;
    const service = new FederationDocumentService({
      now: () => new Date('2026-05-03T00:00:02.000Z'),
      fetch: async () => {
        fetchCount += 1;
        return new Response(JSON.stringify(raw), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });

    const first = await service.fetchDocument({
      federationId: 'fed.public-alpha',
      document: 'https://fed.example/.well-known/uruc-federation.json',
    });
    const second = await service.fetchDocument({
      federationId: 'fed.public-alpha',
      document: 'https://fed.example/.well-known/uruc-federation.json',
    });

    expect(fetchCount).toBe(1);
    expect(first.status).toMatchObject({ status: 'valid', code: 'FEDERATION_DOCUMENT_FETCHED' });
    expect(second.status).toMatchObject({ status: 'valid', code: 'FEDERATION_DOCUMENT_CACHE_HIT' });
    expect(first.status.digest).toMatch(/^sha256:/);
  });

  it('evaluates fetched Federation Document expiry against the service clock', async () => {
    const raw = federationDocument({
      validFrom: '2026-05-03T00:00:00.000Z',
      validUntil: '2026-05-04T00:00:00.000Z',
    });
    const service = new FederationDocumentService({
      now: () => new Date('2026-05-03T00:00:02.000Z'),
      fetch: async () => new Response(JSON.stringify(raw), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    });

    await expect(service.fetchDocument({
      federationId: 'fed.public-alpha',
      document: 'https://fed.example/.well-known/uruc-federation.json',
    })).resolves.toMatchObject({
      status: {
        status: 'valid',
        code: 'FEDERATION_DOCUMENT_FETCHED',
        validUntil: '2026-05-04T00:00:00.000Z',
      },
    });
  });

  it('verifies federation policy refs and feed entries into compact trust results', () => {
    const document = parseFederationDocument(federationDocument({
      policyRefs: [{
        id: 'fed.public-alpha.baseline',
        type: 'trust-policy',
        ref: 'https://fed.example/policies/baseline.json',
        version: 1,
        digest: 'sha256:806590ab21efef30b2888bfb0ed048e9984379e8803c010749147a085fec7042',
        required: true,
        federationId: 'fed.public-alpha',
        validFrom: '2026-05-03T00:00:00.000Z',
        validUntil: '2099-08-03T00:00:00.000Z',
      }],
    }));

    expect(verifyFederationPolicyRef({
      document,
      policyRefId: 'fed.public-alpha.baseline',
      body: { mode: 'observe' },
      now: new Date('2026-05-03T00:00:02.000Z'),
    })).toEqual({ ok: true, digest: 'sha256:806590ab21efef30b2888bfb0ed048e9984379e8803c010749147a085fec7042' });
    expect(verifyFederationPolicyRef({
      document,
      policyRefId: 'missing',
      body: {},
      now: new Date('2026-05-03T00:00:02.000Z'),
    })).toEqual({ ok: false, code: 'FEDERATION_POLICY_REF_MISSING' });

    const cityPolicy: CityFederationSpec = {
      federationId: 'fed.public-alpha',
      trustPolicy: {
        mode: 'observe' as const,
        warnRiskLevels: ['medium'],
        requiredConformanceBadges: ['uruc.intercity.v0'],
      },
    };
    expect(evaluateVerifiedFeedEntry({
      document,
      cityPolicy,
      now: new Date('2026-05-03T00:00:02.000Z'),
      entry: {
        id: 'risk-1',
        federationId: 'fed.public-alpha',
        kind: 'risk',
        issuerId: 'issuer.alpha.registry',
        subject: { kind: 'resident', residentId: 'resident-risky' },
        riskLevel: 'medium',
        conformanceBadges: ['uruc.intercity.v0'],
        issuedAt: '2026-05-03T00:00:00.000Z',
        expiresAt: '2026-05-04T00:00:00.000Z',
      },
    })).toMatchObject({ decision: 'warn', code: 'FEDERATION_RISK_WARN' });
    expect(evaluateVerifiedFeedEntry({
      document,
      cityPolicy,
      now: new Date('2026-05-03T00:00:02.000Z'),
      entry: {
        id: 'risk-2',
        federationId: 'fed.public-alpha',
        kind: 'risk',
        issuerId: 'issuer.unknown',
        subject: { kind: 'resident', residentId: 'resident-risky' },
        riskLevel: 'medium',
        issuedAt: '2026-05-03T00:00:00.000Z',
        expiresAt: '2026-05-04T00:00:00.000Z',
      },
    })).toMatchObject({ decision: 'unknown', code: 'FEDERATION_FEED_ISSUER_UNTRUSTED' });
  });
});
