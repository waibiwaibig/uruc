import { mkdtemp, rm, writeFile } from 'fs/promises';
import { createHash, generateKeyPairSync, sign } from 'crypto';
import os from 'os';
import path from 'path';
import { afterEach, describe, expect, it } from 'vitest';

import { readCityConfig } from '../../plugin-platform/config.js';
import type { CityFederationSpec } from '../../plugin-platform/types.js';
import {
  attachFederationPolicyResult,
  canonicalFederationDocumentPayload,
  evaluateVerifiedFeedEntry,
  FederationFeedService,
  evaluateTrustPolicy,
  FederationDocumentService,
  FederationPolicyMaterialService,
  parseFederationDocument,
  evaluateTrustPolicyWithVerifiedPolicyRefs,
  verifyFederationPolicyRef,
} from '../index.js';

const tempDirs: string[] = [];

afterEach(async () => {
  await Promise.all(tempDirs.splice(0).map((dir) => rm(dir, { recursive: true, force: true })));
});

function federationDocument(overrides: Record<string, unknown> = {}) {
  const extraTrustAnchors = Array.isArray(overrides.extraTrustAnchors) ? overrides.extraTrustAnchors : [];
  const { extraTrustAnchors: _extraTrustAnchors, ...documentOverrides } = overrides;
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
      ...extraTrustAnchors,
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
    ...documentOverrides,
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

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (!value || typeof value !== 'object') return value;
  return Object.fromEntries(
    Object.keys(value as Record<string, unknown>)
      .sort()
      .map((key) => [key, stableValue((value as Record<string, unknown>)[key])]),
  );
}

function policyMaterial(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'uruc.federation.policy-material@v0',
    federationId: 'fed.public-alpha',
    policyRefId: 'fed.public-alpha.baseline',
    version: 1,
    issuedAt: '2026-05-03T00:00:00.000Z',
    expiresAt: '2026-05-03T00:05:00.000Z',
    policy: {
      mode: 'observe',
    },
    ...overrides,
  };
}

function policyDigest(material: unknown): string {
  return `sha256:${createHash('sha256').update(JSON.stringify(stableValue(material))).digest('hex')}`;
}

function feedBatch(overrides: Record<string, unknown> = {}) {
  return {
    schema: 'uruc.federation.feed-batch@v0',
    federationId: 'fed.public-alpha',
    feedRefId: 'fed.public-alpha.risk-feed',
    kind: 'risk',
    version: 1,
    issuerId: 'issuer.alpha.registry',
    issuedAt: '2026-05-03T00:00:00.000Z',
    expiresAt: '2026-05-03T00:05:00.000Z',
    entries: [{
      id: 'risk-1',
      federationId: 'fed.public-alpha',
      kind: 'risk',
      issuerId: 'issuer.alpha.registry',
      subject: { kind: 'resident', residentId: 'uruc:resident:city.alpha:z6M' },
      riskLevel: 'medium',
      conformanceBadges: ['uruc.intercity.v0'],
      issuedAt: '2026-05-03T00:00:00.000Z',
      expiresAt: '2026-05-03T00:05:00.000Z',
    }],
    ...overrides,
  };
}

function signedFeedBatch(
  batch: Record<string, unknown>,
  privateKey: ReturnType<typeof generateKeyPairSync>['privateKey'],
  verificationMethod = 'fed.public-alpha.feed-key',
) {
  return {
    ...batch,
    proof: {
      type: 'ed25519-signature-2026',
      verificationMethod,
      createdAt: '2026-05-03T00:00:01.000Z',
      canonicalization: 'uruc-federation-feed-batch-v0-sorted-json-without-proof',
      covered: [
        'entries',
        'expiresAt',
        'feedRefId',
        'federationId',
        'issuedAt',
        'issuerId',
        'kind',
        'schema',
        'version',
      ],
      signature: sign(null, Buffer.from(JSON.stringify(stableValue(batch)), 'utf8'), privateKey).toString('base64'),
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

  it('parses policy refs with integrity, media type, and cache/degradation hints', () => {
    const document = parseFederationDocument(federationDocument({
      policyRefs: [
        {
          id: 'fed.public-alpha.baseline',
          type: 'trust-policy',
          ref: 'https://fed.example/policies/baseline.json',
          version: 1,
          digest: 'sha256:' + 'b'.repeat(64),
          integrity: 'sha256:' + 'b'.repeat(64),
          mediaType: 'application/json',
          required: false,
          federationId: 'fed.public-alpha',
          validFrom: '2026-05-03T00:00:00.000Z',
          validUntil: '2099-08-03T00:00:00.000Z',
          cache: {
            maxAgeSeconds: 300,
            stale: 'warn',
          },
          onFailure: 'unknown',
        },
      ],
    }));

    expect(document.policyRefs[0]).toMatchObject({
      digest: 'sha256:' + 'b'.repeat(64),
      integrity: 'sha256:' + 'b'.repeat(64),
      mediaType: 'application/json',
      cache: {
        maxAgeSeconds: 300,
        stale: 'warn',
      },
      onFailure: 'unknown',
    });
  });

  it('parses federation risk and conformance feed refs with verification limits', () => {
    const document = parseFederationDocument(federationDocument({
      risk: {
        defaultLevel: 'unknown',
        feeds: [{
          id: 'fed.public-alpha.risk-feed',
          ref: 'https://fed.example/feeds/risk.json',
          version: 1,
          integrity: 'sha256:' + 'c'.repeat(64),
          mediaType: 'application/json',
          required: true,
          federationId: 'fed.public-alpha',
          validFrom: '2026-05-03T00:00:00.000Z',
          validUntil: '2099-08-03T00:00:00.000Z',
          maxEntries: 50,
          maxBodyBytes: 32768,
        }],
      },
      conformance: {
        badges: [{ id: 'uruc.intercity.v0', status: 'verified' }],
        feeds: [{
          id: 'fed.public-alpha.conformance-feed',
          ref: 'https://fed.example/feeds/conformance.json',
          version: 1,
          digest: 'sha256:' + 'd'.repeat(64),
          mediaType: 'application/json',
          required: false,
          federationId: 'fed.public-alpha',
          validFrom: '2026-05-03T00:00:00.000Z',
          validUntil: '2099-08-03T00:00:00.000Z',
          maxEntries: 25,
          maxBodyBytes: 16384,
          onFailure: 'unknown',
        }],
      },
    }));

    expect(document.risk.feeds?.[0]).toMatchObject({
      id: 'fed.public-alpha.risk-feed',
      integrity: 'sha256:' + 'c'.repeat(64),
      maxEntries: 50,
      maxBodyBytes: 32768,
    });
    expect(document.conformance.feeds?.[0]).toMatchObject({
      id: 'fed.public-alpha.conformance-feed',
      digest: 'sha256:' + 'd'.repeat(64),
      onFailure: 'unknown',
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

    const integrityOnlyDocument = parseFederationDocument(federationDocument({
      policyRefs: [{
        id: 'fed.public-alpha.baseline',
        type: 'trust-policy',
        ref: 'https://fed.example/policies/baseline.json',
        version: 1,
        integrity: 'sha256:806590ab21efef30b2888bfb0ed048e9984379e8803c010749147a085fec7042',
        required: true,
        federationId: 'fed.public-alpha',
        validFrom: '2026-05-03T00:00:00.000Z',
        validUntil: '2099-08-03T00:00:00.000Z',
      }],
    }));
    expect(verifyFederationPolicyRef({
      document: integrityOnlyDocument,
      policyRefId: 'fed.public-alpha.baseline',
      body: { mode: 'tampered' },
      now: new Date('2026-05-03T00:00:02.000Z'),
    })).toEqual({ ok: false, code: 'FEDERATION_POLICY_REF_HASH_MISMATCH' });

    const missingIntegrityDocument = parseFederationDocument(federationDocument({
      policyRefs: [{
        id: 'fed.public-alpha.baseline',
        type: 'trust-policy',
        ref: 'https://fed.example/policies/baseline.json',
        version: 1,
        required: true,
        federationId: 'fed.public-alpha',
        validFrom: '2026-05-03T00:00:00.000Z',
        validUntil: '2099-08-03T00:00:00.000Z',
      }],
    }));
    expect(verifyFederationPolicyRef({
      document: missingIntegrityDocument,
      policyRefId: 'fed.public-alpha.baseline',
      body: { mode: 'observe' },
      now: new Date('2026-05-03T00:00:02.000Z'),
    })).toEqual({ ok: false, code: 'FEDERATION_POLICY_REF_INTEGRITY_REQUIRED' });

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

  it('verifies remote policy material before trust evaluation and reuses verified cache', async () => {
    const material = policyMaterial();
    const document = parseFederationDocument(federationDocument({
      policyRefs: [{
        id: 'fed.public-alpha.baseline',
        type: 'trust-policy',
        ref: 'https://fed.example/policies/baseline.json',
        version: 1,
        digest: policyDigest(material),
        integrity: policyDigest(material),
        mediaType: 'application/json',
        required: true,
        federationId: 'fed.public-alpha',
        validFrom: '2026-05-03T00:00:00.000Z',
        validUntil: '2099-08-03T00:00:00.000Z',
        cache: { maxAgeSeconds: 300, stale: 'reject' },
      }],
    }));
    let fetchCount = 0;
    const materialService = new FederationPolicyMaterialService({
      now: () => new Date('2026-05-03T00:00:02.000Z'),
      fetch: async () => {
        fetchCount += 1;
        return new Response(JSON.stringify(material), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const cityPolicy: CityFederationSpec = {
      federationId: 'fed.public-alpha',
      trustPolicy: {
        mode: 'observe' as const,
        trustedIssuerIds: ['issuer.alpha.registry'],
        policyRefs: ['fed.public-alpha.baseline'],
      },
    };

    const first = await evaluateTrustPolicyWithVerifiedPolicyRefs({
      document,
      cityPolicy,
      materialService,
      subject: { kind: 'issuer', issuerId: 'issuer.alpha.registry' },
    });
    const second = await evaluateTrustPolicyWithVerifiedPolicyRefs({
      document,
      cityPolicy,
      materialService,
      subject: { kind: 'issuer', issuerId: 'issuer.alpha.registry' },
    });

    expect(fetchCount).toBe(1);
    expect(first).toMatchObject({
      decision: 'accept',
      code: 'FEDERATION_ISSUER_ACCEPTED',
      policyRefs: [{
        policyRefId: 'fed.public-alpha.baseline',
        decision: 'accept',
        code: 'FEDERATION_POLICY_REF_VERIFIED',
        source: 'network',
        digest: policyDigest(material),
        expiresAt: '2026-05-03T00:05:00.000Z',
      }],
    });
    expect(second.policyRefs?.[0]).toMatchObject({
      decision: 'accept',
      code: 'FEDERATION_POLICY_REF_CACHE_HIT',
      source: 'cache',
      digest: policyDigest(material),
    });
  });

  it.each([
    {
      name: 'digest mismatch',
      response: () => new Response(JSON.stringify(policyMaterial()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      digestMaterial: policyMaterial({ policy: { mode: 'different' } }),
      onFailure: 'warn' as const,
      expectedDecision: 'warn',
      expectedCode: 'FEDERATION_POLICY_REF_HASH_MISMATCH',
    },
    {
      name: 'invalid content-type',
      response: () => new Response(JSON.stringify(policyMaterial()), {
        status: 200,
        headers: { 'content-type': 'text/plain' },
      }),
      onFailure: 'unknown' as const,
      expectedDecision: 'unknown',
      expectedCode: 'FEDERATION_POLICY_REF_CONTENT_TYPE_INVALID',
    },
    {
      name: 'oversized body',
      response: () => new Response(JSON.stringify(policyMaterial()), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      maxPolicyBytes: 4,
      onFailure: 'warn' as const,
      expectedDecision: 'warn',
      expectedCode: 'FEDERATION_POLICY_REF_RESPONSE_TOO_LARGE',
    },
    {
      name: 'invalid JSON',
      response: () => new Response('{bad json', {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
      onFailure: 'unknown' as const,
      expectedDecision: 'unknown',
      expectedCode: 'FEDERATION_POLICY_REF_JSON_INVALID',
    },
  ])('returns a stable compact result for policy material $name before trust evaluation', async (fixture) => {
    const material = policyMaterial();
    const document = parseFederationDocument(federationDocument({
      policyRefs: [{
        id: 'fed.public-alpha.baseline',
        type: 'trust-policy',
        ref: 'https://fed.example/policies/baseline.json',
        version: 1,
        digest: policyDigest(fixture.digestMaterial ?? material),
        mediaType: 'application/json',
        required: false,
        federationId: 'fed.public-alpha',
        validFrom: '2026-05-03T00:00:00.000Z',
        validUntil: '2099-08-03T00:00:00.000Z',
        onFailure: fixture.onFailure,
      }],
    }));
    const materialService = new FederationPolicyMaterialService({
      now: () => new Date('2026-05-03T00:00:02.000Z'),
      maxPolicyBytes: fixture.maxPolicyBytes,
      fetch: async () => fixture.response(),
    });

    await expect(evaluateTrustPolicyWithVerifiedPolicyRefs({
      document,
      cityPolicy: {
        federationId: 'fed.public-alpha',
        trustPolicy: {
          mode: 'observe' as const,
          trustedIssuerIds: ['issuer.alpha.registry'],
          policyRefs: ['fed.public-alpha.baseline'],
        },
      },
      materialService,
      subject: { kind: 'issuer', issuerId: 'issuer.alpha.registry' },
    })).resolves.toMatchObject({
      decision: fixture.expectedDecision,
      code: fixture.expectedCode,
      policyRefs: [{
        decision: fixture.expectedDecision,
        code: fixture.expectedCode,
      }],
    });
  });

  it('returns a stable compact result for policy material fetch timeout before trust evaluation', async () => {
    const material = policyMaterial();
    const document = parseFederationDocument(federationDocument({
      policyRefs: [{
        id: 'fed.public-alpha.baseline',
        type: 'trust-policy',
        ref: 'https://fed.example/policies/baseline.json',
        version: 1,
        digest: policyDigest(material),
        mediaType: 'application/json',
        required: false,
        federationId: 'fed.public-alpha',
        validFrom: '2026-05-03T00:00:00.000Z',
        validUntil: '2099-08-03T00:00:00.000Z',
        onFailure: 'unknown',
      }],
    }));
    const materialService = new FederationPolicyMaterialService({
      now: () => new Date('2026-05-03T00:00:02.000Z'),
      timeoutMs: 1,
      fetch: async () => new Promise<Response>(() => undefined),
    });

    await expect(evaluateTrustPolicyWithVerifiedPolicyRefs({
      document,
      cityPolicy: {
        federationId: 'fed.public-alpha',
        trustPolicy: {
          mode: 'observe' as const,
          trustedIssuerIds: ['issuer.alpha.registry'],
          policyRefs: ['fed.public-alpha.baseline'],
        },
      },
      materialService,
      subject: { kind: 'issuer', issuerId: 'issuer.alpha.registry' },
    })).resolves.toMatchObject({
      decision: 'unknown',
      code: 'FEDERATION_POLICY_REF_FETCH_TIMEOUT',
      policyRefs: [{
        decision: 'unknown',
        code: 'FEDERATION_POLICY_REF_FETCH_TIMEOUT',
      }],
    });
  });

  it('rejects required policy ref verification failures even when an optional degradation hint is present', async () => {
    const material = policyMaterial();
    const document = parseFederationDocument(federationDocument({
      policyRefs: [{
        id: 'fed.public-alpha.baseline',
        type: 'trust-policy',
        ref: 'https://fed.example/policies/baseline.json',
        version: 1,
        digest: policyDigest(policyMaterial({ policy: { mode: 'different' } })),
        mediaType: 'application/json',
        required: true,
        federationId: 'fed.public-alpha',
        validFrom: '2026-05-03T00:00:00.000Z',
        validUntil: '2099-08-03T00:00:00.000Z',
        onFailure: 'warn',
      }],
    }));
    const materialService = new FederationPolicyMaterialService({
      now: () => new Date('2026-05-03T00:00:02.000Z'),
      fetch: async () => new Response(JSON.stringify(material), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    });

    await expect(evaluateTrustPolicyWithVerifiedPolicyRefs({
      document,
      cityPolicy: {
        federationId: 'fed.public-alpha',
        trustPolicy: {
          mode: 'observe' as const,
          trustedIssuerIds: ['issuer.alpha.registry'],
          policyRefs: ['fed.public-alpha.baseline'],
        },
      },
      materialService,
      subject: { kind: 'issuer', issuerId: 'issuer.alpha.registry' },
    })).resolves.toMatchObject({
      decision: 'reject',
      code: 'FEDERATION_POLICY_REF_HASH_MISMATCH',
    });
  });

  it('does not pretend expired cached policy material is valid', async () => {
    let now = new Date('2026-05-03T00:00:02.000Z');
    const material = policyMaterial({
      expiresAt: '2026-05-03T00:00:03.000Z',
    });
    const document = parseFederationDocument(federationDocument({
      policyRefs: [{
        id: 'fed.public-alpha.baseline',
        type: 'trust-policy',
        ref: 'https://fed.example/policies/baseline.json',
        version: 1,
        digest: policyDigest(material),
        mediaType: 'application/json',
        required: false,
        federationId: 'fed.public-alpha',
        validFrom: '2026-05-03T00:00:00.000Z',
        validUntil: '2099-08-03T00:00:00.000Z',
        cache: { maxAgeSeconds: 1, stale: 'warn' },
        onFailure: 'unknown',
      }],
    }));
    let fetchCount = 0;
    const materialService = new FederationPolicyMaterialService({
      now: () => now,
      fetch: async () => {
        fetchCount += 1;
        if (fetchCount > 1) throw new Error('network unavailable');
        return new Response(JSON.stringify(material), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });
    const input = {
      document,
      cityPolicy: {
        federationId: 'fed.public-alpha',
        trustPolicy: {
          mode: 'observe' as const,
          trustedIssuerIds: ['issuer.alpha.registry'],
          policyRefs: ['fed.public-alpha.baseline'],
        },
      },
      materialService,
      subject: { kind: 'issuer' as const, issuerId: 'issuer.alpha.registry' },
    };

    await expect(evaluateTrustPolicyWithVerifiedPolicyRefs(input)).resolves.toMatchObject({
      decision: 'accept',
      policyRefs: [{ code: 'FEDERATION_POLICY_REF_VERIFIED' }],
    });
    now = new Date('2026-05-03T00:00:04.000Z');
    await expect(evaluateTrustPolicyWithVerifiedPolicyRefs(input)).resolves.toMatchObject({
      decision: 'warn',
      code: 'FEDERATION_POLICY_REF_CACHE_EXPIRED',
      policyRefs: [{
        decision: 'warn',
        code: 'FEDERATION_POLICY_REF_CACHE_EXPIRED',
        source: 'cache',
      }],
    });
  });

  it('does not fetch or apply federation policy refs for a city that has not joined the federation', async () => {
    const material = policyMaterial();
    const document = parseFederationDocument(federationDocument({
      policyRefs: [{
        id: 'fed.public-alpha.baseline',
        type: 'trust-policy',
        ref: 'https://fed.example/policies/baseline.json',
        version: 1,
        digest: policyDigest(material),
        mediaType: 'application/json',
        required: true,
        federationId: 'fed.public-alpha',
        validFrom: '2026-05-03T00:00:00.000Z',
        validUntil: '2099-08-03T00:00:00.000Z',
      }],
    }));
    let fetchCount = 0;
    const materialService = new FederationPolicyMaterialService({
      fetch: async () => {
        fetchCount += 1;
        return new Response(JSON.stringify(material), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });

    await expect(evaluateTrustPolicyWithVerifiedPolicyRefs({
      document,
      materialService,
      subject: { kind: 'issuer', issuerId: 'issuer.alpha.registry' },
    })).resolves.toMatchObject({
      decision: 'unknown',
      code: 'FEDERATION_CITY_NOT_JOINED',
    });
    expect(fetchCount).toBe(0);
  });

  it('fetches and verifies a risk feed batch before mapping entries to compact trust results', async () => {
    const batch = feedBatch();
    const document = parseFederationDocument(federationDocument({
      risk: {
        defaultLevel: 'unknown',
        feeds: [{
          id: 'fed.public-alpha.risk-feed',
          ref: 'https://fed.example/feeds/risk.json',
          version: 1,
          integrity: policyDigest(batch),
          mediaType: 'application/json',
          required: true,
          federationId: 'fed.public-alpha',
          validFrom: '2026-05-03T00:00:00.000Z',
          validUntil: '2099-08-03T00:00:00.000Z',
          maxEntries: 10,
          maxBodyBytes: 32768,
        }],
      },
    }));
    const service = new FederationFeedService({
      now: () => new Date('2026-05-03T00:00:02.000Z'),
      fetch: async () => new Response(JSON.stringify(batch), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    });

    await expect(service.verifyFeedRef({
      document,
      cityPolicy: {
        federationId: 'fed.public-alpha',
        trustPolicy: {
          mode: 'observe' as const,
          warnRiskLevels: ['medium'],
          requiredConformanceBadges: ['uruc.intercity.v0'],
        },
      },
      feedRefId: 'fed.public-alpha.risk-feed',
      kind: 'risk',
    })).resolves.toMatchObject({
      decision: 'warn',
      code: 'FEDERATION_FEED_VERIFIED',
      source: 'network',
      digest: policyDigest(batch),
      entries: [{
        decision: 'warn',
        code: 'FEDERATION_RISK_WARN',
        scope: 'resident',
      }],
    });
  });

  it('verifies signed feed batches and can map entries to accept, reject, warn, and unknown results', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const batch = signedFeedBatch(feedBatch({
      entries: [
        {
          ...feedBatch().entries[0],
          id: 'risk-accept',
          subject: { kind: 'city', cityId: 'city.beta' },
          riskLevel: undefined,
        },
        {
          ...feedBatch().entries[0],
          id: 'risk-reject',
          riskLevel: 'high',
        },
        {
          ...feedBatch().entries[0],
          id: 'risk-warn',
          riskLevel: 'medium',
        },
        {
          ...feedBatch().entries[0],
          id: 'risk-unknown',
          subject: { kind: 'domain', domainId: 'domain.unclassified' },
          riskLevel: undefined,
        },
      ],
    }), privateKey);
    const document = parseFederationDocument(federationDocument({
      extraTrustAnchors: [{
        id: 'fed.public-alpha.feed-key',
        type: 'public-key',
        ref: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
        assurance: 'high',
      }],
      risk: {
        defaultLevel: 'unknown',
        feeds: [{
          id: 'fed.public-alpha.risk-feed',
          ref: 'https://fed.example/feeds/risk.json',
          version: 1,
          mediaType: 'application/json',
          required: true,
          federationId: 'fed.public-alpha',
          maxEntries: 10,
        }],
      },
    }));
    const service = new FederationFeedService({
      now: () => new Date('2026-05-03T00:00:02.000Z'),
      fetch: async () => new Response(JSON.stringify(batch), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    });

    const result = await service.verifyFeedRef({
      document,
      cityPolicy: {
        federationId: 'fed.public-alpha',
        trustPolicy: {
          mode: 'observe' as const,
          warnRiskLevels: ['medium'],
          rejectRiskLevels: ['high'],
          requiredConformanceBadges: ['uruc.intercity.v0'],
        },
      },
      feedRefId: 'fed.public-alpha.risk-feed',
      kind: 'risk',
    });

    expect(result).toMatchObject({
      decision: 'reject',
      code: 'FEDERATION_FEED_VERIFIED',
      entries: [
        { decision: 'accept', code: 'FEDERATION_MEMBER_ACCEPTED' },
        { decision: 'reject', code: 'FEDERATION_RISK_REJECTED' },
        { decision: 'warn', code: 'FEDERATION_RISK_WARN' },
        { decision: 'unknown', code: 'FEDERATION_NO_MATCH' },
      ],
    });
  });

  it('rejects signed feed batches that do not declare the exact covered fields', async () => {
    const { publicKey, privateKey } = generateKeyPairSync('ed25519');
    const signed = signedFeedBatch(feedBatch(), privateKey);
    const batch = {
      ...signed,
      proof: {
        ...signed.proof,
        covered: ['schema', 'federationId'],
      },
    };
    const document = parseFederationDocument(federationDocument({
      extraTrustAnchors: [{
        id: 'fed.public-alpha.feed-key',
        type: 'public-key',
        ref: publicKey.export({ format: 'pem', type: 'spki' }).toString(),
        assurance: 'high',
      }],
      risk: {
        defaultLevel: 'unknown',
        feeds: [{
          id: 'fed.public-alpha.risk-feed',
          ref: 'https://fed.example/feeds/risk.json',
          version: 1,
          mediaType: 'application/json',
          required: true,
          federationId: 'fed.public-alpha',
          maxEntries: 10,
        }],
      },
    }));
    const service = new FederationFeedService({
      now: () => new Date('2026-05-03T00:00:02.000Z'),
      fetch: async () => new Response(JSON.stringify(batch), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    });

    await expect(service.verifyFeedRef({
      document,
      cityPolicy: {
        federationId: 'fed.public-alpha',
        trustPolicy: { mode: 'observe' as const },
      },
      feedRefId: 'fed.public-alpha.risk-feed',
      kind: 'risk',
    })).resolves.toMatchObject({
      decision: 'reject',
      code: 'FEDERATION_FEED_SIGNATURE_INVALID',
    });
  });

  it('fetches and verifies a conformance feed batch from conformance feed refs', async () => {
    const batch = feedBatch({
      feedRefId: 'fed.public-alpha.conformance-feed',
      kind: 'conformance',
      entries: [{
        ...feedBatch().entries[0],
        id: 'conformance-1',
        kind: 'conformance',
        subject: { kind: 'issuer', issuerId: 'issuer.alpha.registry' },
        riskLevel: undefined,
        conformanceBadges: ['uruc.intercity.v0'],
      }],
    });
    const document = parseFederationDocument(federationDocument({
      conformance: {
        badges: [{ id: 'uruc.intercity.v0', status: 'verified' }],
        feeds: [{
          id: 'fed.public-alpha.conformance-feed',
          ref: 'https://fed.example/feeds/conformance.json',
          version: 1,
          integrity: policyDigest(batch),
          mediaType: 'application/json',
          required: true,
          federationId: 'fed.public-alpha',
          maxEntries: 10,
        }],
      },
    }));
    const service = new FederationFeedService({
      now: () => new Date('2026-05-03T00:00:02.000Z'),
      fetch: async () => new Response(JSON.stringify(batch), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    });

    await expect(service.verifyFeedRef({
      document,
      cityPolicy: {
        federationId: 'fed.public-alpha',
        trustPolicy: {
          mode: 'observe' as const,
          trustedIssuerIds: ['issuer.alpha.registry'],
          requiredConformanceBadges: ['uruc.intercity.v0'],
        },
      },
      feedRefId: 'fed.public-alpha.conformance-feed',
      kind: 'conformance',
    })).resolves.toMatchObject({
      decision: 'accept',
      code: 'FEDERATION_FEED_VERIFIED',
      entries: [{
        decision: 'accept',
        code: 'FEDERATION_ISSUER_ACCEPTED',
      }],
    });
  });

  it.each([
    {
      name: 'digest mismatch',
      batch: () => feedBatch(),
      digestBatch: () => feedBatch({ entries: [] }),
      maxFeedBytes: undefined,
      expectedDecision: 'unknown',
      expectedCode: 'FEDERATION_FEED_HASH_MISMATCH',
    },
    {
      name: 'invalid signature',
      batch: () => {
        const { privateKey } = generateKeyPairSync('ed25519');
        const signed = signedFeedBatch(feedBatch(), privateKey);
        return {
          ...signed,
          proof: {
            ...signed.proof,
            signature: 'bad',
          },
        };
      },
      noDigest: true,
      expectedDecision: 'unknown',
      expectedCode: 'FEDERATION_FEED_SIGNATURE_INVALID',
    },
    {
      name: 'oversized body',
      batch: () => feedBatch(),
      maxFeedBytes: 4,
      expectedDecision: 'warn',
      expectedCode: 'FEDERATION_FEED_RESPONSE_TOO_LARGE',
    },
    {
      name: 'invalid content-type',
      batch: () => feedBatch(),
      contentType: 'text/plain',
      expectedDecision: 'unknown',
      expectedCode: 'FEDERATION_FEED_CONTENT_TYPE_INVALID',
    },
    {
      name: 'invalid JSON',
      batch: () => '{bad json',
      rawResponse: true,
      expectedDecision: 'unknown',
      expectedCode: 'FEDERATION_FEED_JSON_INVALID',
    },
    {
      name: 'stale feed',
      batch: () => feedBatch({ expiresAt: '2026-05-03T00:00:01.000Z' }),
      expectedDecision: 'unknown',
      expectedCode: 'FEDERATION_FEED_EXPIRED',
    },
    {
      name: 'wrong federation',
      batch: () => feedBatch({ federationId: 'fed.other' }),
      expectedDecision: 'unknown',
      expectedCode: 'FEDERATION_FEED_MISMATCH',
    },
    {
      name: 'untrusted issuer',
      batch: () => feedBatch({ issuerId: 'issuer.unknown' }),
      expectedDecision: 'unknown',
      expectedCode: 'FEDERATION_FEED_ISSUER_UNTRUSTED',
    },
    {
      name: 'too many entries',
      batch: () => feedBatch({
        entries: [
          feedBatch().entries[0],
          { ...feedBatch().entries[0], id: 'risk-2' },
        ],
      }),
      maxEntries: 1,
      expectedDecision: 'unknown',
      expectedCode: 'FEDERATION_FEED_ENTRY_COUNT_EXCEEDED',
    },
  ])('returns a stable compact result for invalid feed batch $name', async (fixture) => {
    const batch = fixture.batch();
    const document = parseFederationDocument(federationDocument({
      risk: {
        defaultLevel: 'unknown',
        feeds: [{
          id: 'fed.public-alpha.risk-feed',
          ref: 'https://fed.example/feeds/risk.json',
          version: 1,
          ...(fixture.noDigest ? {} : { digest: policyDigest(fixture.digestBatch?.() ?? batch) }),
          mediaType: 'application/json',
          required: false,
          federationId: 'fed.public-alpha',
          validFrom: '2026-05-03T00:00:00.000Z',
          validUntil: '2099-08-03T00:00:00.000Z',
          maxEntries: fixture.maxEntries ?? 10,
          onFailure: fixture.expectedDecision,
        }],
      },
    }));
    const service = new FederationFeedService({
      now: () => new Date('2026-05-03T00:00:02.000Z'),
      maxFeedBytes: fixture.maxFeedBytes,
      fetch: async () => new Response(fixture.rawResponse ? String(batch) : JSON.stringify(batch), {
        status: 200,
        headers: { 'content-type': fixture.contentType ?? 'application/json' },
      }),
    });

    const result = await service.verifyFeedRef({
      document,
      cityPolicy: {
        federationId: 'fed.public-alpha',
        trustPolicy: { mode: 'observe' as const },
      },
      feedRefId: 'fed.public-alpha.risk-feed',
      kind: 'risk',
    });
    expect(result).toMatchObject({
      decision: fixture.expectedDecision,
      code: fixture.expectedCode,
    });
    expect(result).not.toHaveProperty('entries');
  });

  it('returns a stable compact result for feed fetch timeout', async () => {
    const batch = feedBatch();
    const document = parseFederationDocument(federationDocument({
      risk: {
        defaultLevel: 'unknown',
        feeds: [{
          id: 'fed.public-alpha.risk-feed',
          ref: 'https://fed.example/feeds/risk.json',
          digest: policyDigest(batch),
          required: false,
          federationId: 'fed.public-alpha',
          onFailure: 'unknown',
        }],
      },
    }));
    const service = new FederationFeedService({
      now: () => new Date('2026-05-03T00:00:02.000Z'),
      timeoutMs: 1,
      fetch: async () => new Promise<Response>(() => undefined),
    });

    await expect(service.verifyFeedRef({
      document,
      cityPolicy: {
        federationId: 'fed.public-alpha',
        trustPolicy: { mode: 'observe' as const },
      },
      feedRefId: 'fed.public-alpha.risk-feed',
      kind: 'risk',
    })).resolves.toMatchObject({
      decision: 'unknown',
      code: 'FEDERATION_FEED_FETCH_TIMEOUT',
    });
  });

  it('does not fetch or apply federation feed refs for a city that has not joined the federation', async () => {
    const batch = feedBatch();
    const document = parseFederationDocument(federationDocument({
      risk: {
        defaultLevel: 'unknown',
        feeds: [{
          id: 'fed.public-alpha.risk-feed',
          ref: 'https://fed.example/feeds/risk.json',
          digest: policyDigest(batch),
          federationId: 'fed.public-alpha',
        }],
      },
    }));
    let fetchCount = 0;
    const service = new FederationFeedService({
      fetch: async () => {
        fetchCount += 1;
        return new Response(JSON.stringify(batch), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        });
      },
    });

    await expect(service.verifyFeedRef({
      document,
      feedRefId: 'fed.public-alpha.risk-feed',
      kind: 'risk',
    })).resolves.toMatchObject({
      decision: 'unknown',
      code: 'FEDERATION_CITY_NOT_JOINED',
      source: 'none',
    });
    expect(fetchCount).toBe(0);
  });
});
