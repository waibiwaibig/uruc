import { describe, expect, it } from 'vitest';
import { generateKeyPairSync, sign } from 'crypto';
import { createServer, type Server } from 'http';
import { AddressInfo } from 'net';

import { createDb, schema } from '../../database/index.js';
import { canonicalDomainDocumentPayload, parseDomainDocument } from '../document.js';
import { DomainAttachmentService } from '../service.js';

function signedDocument(overrides: Record<string, unknown> = {}) {
  const { publicKey, privateKey } = generateKeyPairSync('ed25519');
  const publicKeyPem = publicKey.export({ format: 'pem', type: 'spki' }).toString();
  const unsigned = {
    schema: 'uruc.domain.document@v0',
    domainId: 'domain.acme.social',
    venue: {
      moduleId: 'acme.social',
      namespace: 'acme.social',
    },
    protocol: {
      version: 'uruc-domain-v0',
    },
    publicKeys: [{
      id: 'domain-key-1',
      type: 'ed25519-pem',
      publicKeyPem,
    }],
    endpoints: {
      attachment: 'https://domain.example/uruc/attach',
    },
    capabilities: ['social.thread.read'],
    hints: {
      retention: '30d',
    },
    ...overrides,
  };
  return {
    ...unsigned,
    proof: {
      type: 'ed25519-signature-2026',
      verificationMethod: 'domain-key-1',
      createdAt: '2026-05-03T00:00:00.000Z',
      canonicalization: 'uruc-domain-document-v0-sorted-json-without-proof',
      covered: [
        'capabilities',
        'domainId',
        'endpoints',
        'hints',
        'protocol',
        'publicKeys',
        'schema',
        'venue',
      ],
      signature: sign(null, canonicalDomainDocumentPayload(unsigned), privateKey).toString('base64'),
    },
  };
}

describe('Domain Document', () => {
  it('parses and verifies a signed domain document for one venue module', () => {
    const document = parseDomainDocument(signedDocument(), {
      expectedVenueModuleId: 'acme.social',
      expectedVenueNamespace: 'acme.social',
      expectedProtocolVersion: 'uruc-domain-v0',
    });

    expect(document).toMatchObject({
      domainId: 'domain.acme.social',
      venue: {
        moduleId: 'acme.social',
        namespace: 'acme.social',
      },
      protocol: {
        version: 'uruc-domain-v0',
      },
      endpoints: {
        attachment: 'https://domain.example/uruc/attach',
      },
      capabilities: ['social.thread.read'],
      hints: {
        retention: '30d',
      },
    });
  });

  it('returns stable validation codes for invalid document fields', () => {
    expect(() => parseDomainDocument(signedDocument({
      domainId: '',
    }), {
      expectedVenueModuleId: 'acme.social',
      expectedVenueNamespace: 'acme.social',
    })).toThrow(expect.objectContaining({
      code: 'DOMAIN_DOCUMENT_DOMAIN_INVALID',
    }));

    expect(() => parseDomainDocument(signedDocument({
      endpoints: {
        attachment: 'not-a-url',
      },
    }), {
      expectedVenueModuleId: 'acme.social',
      expectedVenueNamespace: 'acme.social',
    })).toThrow(expect.objectContaining({
      code: 'DOMAIN_DOCUMENT_ENDPOINT_INVALID',
    }));
  });

  it('rejects documents with extra fields or ambiguous proof coverage', () => {
    expect(() => parseDomainDocument(signedDocument({
      dispatch: {
        endpoint: 'https://domain.example/dispatch',
      },
    }), {
      expectedVenueModuleId: 'acme.social',
      expectedVenueNamespace: 'acme.social',
    })).toThrow(expect.objectContaining({
      code: 'DOMAIN_DOCUMENT_FIELD_INVALID',
    }));

    const document = signedDocument();
    (document.proof.covered as string[]).pop();
    expect(() => parseDomainDocument(document, {
      expectedVenueModuleId: 'acme.social',
      expectedVenueNamespace: 'acme.social',
    })).toThrow(expect.objectContaining({
      code: 'DOMAIN_DOCUMENT_PROOF_INVALID',
    }));
  });
});

function listen(server: Server): Promise<string> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address() as AddressInfo;
      resolve(`http://127.0.0.1:${address.port}`);
    });
  });
}

function close(server: Server): Promise<void> {
  return new Promise((resolve) => server.close(() => resolve()));
}

describe('Domain attachment handshake', () => {
  it('fetches a Domain Document, performs attachment, and stores an accepted attachment record', async () => {
    const db = createDb(':memory:');
    let baseUrl = '';
    const server = createServer((req, res) => {
      if (req.url === '/.well-known/uruc-domain.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(signedDocument({
          endpoints: {
            attachment: `${baseUrl}/uruc/attach`,
          },
        })));
        return;
      }
      if (req.url === '/uruc/attach' && req.method === 'POST') {
        let body = '';
        req.on('data', (chunk) => {
          body += chunk;
        });
        req.on('end', () => {
          expect(JSON.parse(body)).toMatchObject({
            schema: 'uruc.domain.attachment.request@v0',
            cityId: 'city.alpha',
            domainId: 'domain.acme.social',
            pluginId: 'acme.social',
            venue: {
              moduleId: 'acme.social',
              namespace: 'acme.social',
            },
            protocolVersion: 'uruc-domain-v0',
          });
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({
            schema: 'uruc.domain.attachment.receipt@v0',
            status: 'accepted',
            code: 'ATTACHED',
            receiptId: 'receipt-1',
            validUntil: '2026-06-03T00:00:00.000Z',
            capabilities: ['social.thread.read'],
          }));
        });
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    baseUrl = await listen(server);

    try {
      const service = new DomainAttachmentService(db);
      const result = await service.attachVenueDomain({
        cityId: 'city.alpha',
        pluginId: 'acme.social',
        venue: {
          moduleId: 'acme.social',
          namespace: 'acme.social',
          topology: {
            declaration: 'domain_required',
            mode: 'domain',
            domain: {
              endpoint: baseUrl,
            },
          },
        },
      });

      expect(result).toMatchObject({
        status: 'attached',
        receipt: {
          ok: true,
          code: 'ATTACHED',
          domainId: 'domain.acme.social',
          cityId: 'city.alpha',
          venueModuleId: 'acme.social',
        },
      });

      const rows = await db.select().from(schema.domainAttachments);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        status: 'attached',
        domainId: 'domain.acme.social',
        cityId: 'city.alpha',
        pluginId: 'acme.social',
        venueModuleId: 'acme.social',
        venueNamespace: 'acme.social',
        protocolVersion: 'uruc-domain-v0',
        receiptCode: 'ATTACHED',
      });
      expect(rows[0]?.documentHash).toMatch(/^[a-f0-9]{64}$/);
      expect(rows[0]?.validUntil?.toISOString()).toBe('2026-06-03T00:00:00.000Z');
    } finally {
      await close(server);
    }
  });

  it('stores a failed attachment record and compact receipt when the domain rejects attachment', async () => {
    const db = createDb(':memory:');
    let baseUrl = '';
    const server = createServer((req, res) => {
      if (req.url === '/.well-known/uruc-domain.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(signedDocument({
          endpoints: {
            attachment: `${baseUrl}/uruc/attach`,
          },
        })));
        return;
      }
      if (req.url === '/uruc/attach' && req.method === 'POST') {
        res.statusCode = 409;
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
          schema: 'uruc.domain.attachment.receipt@v0',
          status: 'rejected',
          code: 'CITY_NOT_ALLOWED',
          receiptId: 'reject-1',
        }));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    baseUrl = await listen(server);

    try {
      const service = new DomainAttachmentService(db);
      const result = await service.attachVenueDomain({
        cityId: 'city.alpha',
        pluginId: 'acme.social',
        venue: {
          moduleId: 'acme.social',
          namespace: 'acme.social',
          topology: {
            declaration: 'domain_optional',
            mode: 'domain',
            domain: {
              document: `${baseUrl}/.well-known/uruc-domain.json`,
            },
          },
        },
      });

      expect(result).toMatchObject({
        status: 'failed',
        receipt: {
          ok: false,
          code: 'CITY_NOT_ALLOWED',
          domainId: 'domain.acme.social',
          cityId: 'city.alpha',
          venueModuleId: 'acme.social',
        },
      });
      const rows = await db.select().from(schema.domainAttachments);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        status: 'failed',
        receiptCode: 'CITY_NOT_ALLOWED',
      });
    } finally {
      await close(server);
    }
  });

  it('does not fetch or create attachment records for local topology', async () => {
    const db = createDb(':memory:');
    const service = new DomainAttachmentService(db, {
      fetch: async () => {
        throw new Error('local topology should not fetch');
      },
    });

    const result = await service.attachVenueDomain({
      cityId: 'city.alpha',
      pluginId: 'acme.local',
      venue: {
        moduleId: 'acme.local',
        namespace: 'acme.local',
        topology: {
          declaration: 'local',
          mode: 'local',
        },
      },
    });

    expect(result).toEqual({
      status: 'skipped',
      receipt: {
        ok: true,
        code: 'LOCAL_TOPOLOGY',
        cityId: 'city.alpha',
        venueModuleId: 'acme.local',
      },
    });
    expect(await db.select().from(schema.domainAttachments)).toHaveLength(0);
  });

  it('returns a stable compact receipt when Domain Document fetch exceeds the size limit', async () => {
    const db = createDb(':memory:');
    const server = createServer((_req, res) => {
      res.setHeader('content-type', 'application/json');
      res.end(JSON.stringify({
        schema: 'uruc.domain.document@v0',
        padding: 'x'.repeat(256),
      }));
    });
    const baseUrl = await listen(server);

    try {
      const service = new DomainAttachmentService(db, { maxDocumentBytes: 64 });
      const result = await service.attachVenueDomain({
        cityId: 'city.alpha',
        pluginId: 'acme.social',
        venue: {
          moduleId: 'acme.social',
          namespace: 'acme.social',
          topology: {
            declaration: 'domain_required',
            mode: 'domain',
            domain: {
              document: `${baseUrl}/.well-known/uruc-domain.json`,
            },
          },
        },
      });

      expect(result).toEqual({
        status: 'failed',
        receipt: {
          ok: false,
          code: 'DOMAIN_RESPONSE_TOO_LARGE',
          cityId: 'city.alpha',
          venueModuleId: 'acme.social',
        },
      });
      expect(await db.select().from(schema.domainAttachments)).toHaveLength(0);
    } finally {
      await close(server);
    }
  });

  it('returns a stable compact receipt when Domain Document content-type is not JSON', async () => {
    const db = createDb(':memory:');
    const server = createServer((_req, res) => {
      res.setHeader('content-type', 'text/plain');
      res.end(JSON.stringify(signedDocument()));
    });
    const baseUrl = await listen(server);

    try {
      const service = new DomainAttachmentService(db);
      const result = await service.attachVenueDomain({
        cityId: 'city.alpha',
        pluginId: 'acme.social',
        venue: {
          moduleId: 'acme.social',
          namespace: 'acme.social',
          topology: {
            declaration: 'domain_required',
            mode: 'domain',
            domain: {
              document: `${baseUrl}/.well-known/uruc-domain.json`,
            },
          },
        },
      });

      expect(result).toEqual({
        status: 'failed',
        receipt: {
          ok: false,
          code: 'DOMAIN_DOCUMENT_CONTENT_TYPE_INVALID',
          cityId: 'city.alpha',
          venueModuleId: 'acme.social',
        },
      });
      expect(await db.select().from(schema.domainAttachments)).toHaveLength(0);
    } finally {
      await close(server);
    }
  });

  it('returns a stable compact receipt when Domain Document fetch times out', async () => {
    const db = createDb(':memory:');
    const service = new DomainAttachmentService(db, {
      timeoutMs: 1,
      fetch: async (_url, init) => new Promise<Response>((_resolve, reject) => {
        init?.signal?.addEventListener('abort', () => {
          reject(Object.assign(new Error('aborted'), { name: 'AbortError' }));
        });
      }),
    });

    const result = await service.attachVenueDomain({
      cityId: 'city.alpha',
      pluginId: 'acme.social',
      venue: {
        moduleId: 'acme.social',
        namespace: 'acme.social',
        topology: {
          declaration: 'domain_required',
          mode: 'domain',
          domain: {
            document: 'https://domain.example/.well-known/uruc-domain.json',
          },
        },
      },
    });

    expect(result).toEqual({
      status: 'failed',
      receipt: {
        ok: false,
        code: 'DOMAIN_REQUEST_TIMEOUT',
        cityId: 'city.alpha',
        venueModuleId: 'acme.social',
      },
    });
    expect(await db.select().from(schema.domainAttachments)).toHaveLength(0);
  });

  it('marks accepted but expired attachment receipts as failed', async () => {
    const db = createDb(':memory:');
    let baseUrl = '';
    const server = createServer((req, res) => {
      if (req.url === '/.well-known/uruc-domain.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(signedDocument({
          endpoints: {
            attachment: `${baseUrl}/uruc/attach`,
          },
        })));
        return;
      }
      if (req.url === '/uruc/attach' && req.method === 'POST') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify({
          schema: 'uruc.domain.attachment.receipt@v0',
          status: 'accepted',
          code: 'ATTACHED',
          receiptId: 'receipt-expired',
          validUntil: '2026-05-02T00:00:00.000Z',
        }));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    baseUrl = await listen(server);

    try {
      const service = new DomainAttachmentService(db, {
        now: () => new Date('2026-05-03T00:00:00.000Z'),
      });
      const result = await service.attachVenueDomain({
        cityId: 'city.alpha',
        pluginId: 'acme.social',
        venue: {
          moduleId: 'acme.social',
          namespace: 'acme.social',
          topology: {
            declaration: 'domain_required',
            mode: 'domain',
            domain: {
              endpoint: baseUrl,
            },
          },
        },
      });

      expect(result).toMatchObject({
        status: 'failed',
        receipt: {
          ok: false,
          code: 'DOMAIN_ATTACHMENT_EXPIRED',
          cityId: 'city.alpha',
          venueModuleId: 'acme.social',
          domainId: 'domain.acme.social',
        },
      });
      const rows = await db.select().from(schema.domainAttachments);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        status: 'failed',
        receiptCode: 'DOMAIN_ATTACHMENT_EXPIRED',
      });
    } finally {
      await close(server);
    }
  });

  it('keeps the attachment failed when the receipt content-type is not JSON', async () => {
    const db = createDb(':memory:');
    let baseUrl = '';
    const server = createServer((req, res) => {
      if (req.url === '/.well-known/uruc-domain.json') {
        res.setHeader('content-type', 'application/json');
        res.end(JSON.stringify(signedDocument({
          endpoints: {
            attachment: `${baseUrl}/uruc/attach`,
          },
        })));
        return;
      }
      if (req.url === '/uruc/attach' && req.method === 'POST') {
        res.setHeader('content-type', 'text/plain');
        res.end(JSON.stringify({
          schema: 'uruc.domain.attachment.receipt@v0',
          status: 'accepted',
          code: 'ATTACHED',
          receiptId: 'receipt-plain',
          validUntil: '2026-06-03T00:00:00.000Z',
        }));
        return;
      }
      res.statusCode = 404;
      res.end();
    });
    baseUrl = await listen(server);

    try {
      const service = new DomainAttachmentService(db);
      const result = await service.attachVenueDomain({
        cityId: 'city.alpha',
        pluginId: 'acme.social',
        venue: {
          moduleId: 'acme.social',
          namespace: 'acme.social',
          topology: {
            declaration: 'domain_required',
            mode: 'domain',
            domain: {
              endpoint: baseUrl,
            },
          },
        },
      });

      expect(result).toMatchObject({
        status: 'failed',
        receipt: {
          ok: false,
          code: 'DOMAIN_ATTACHMENT_RECEIPT_CONTENT_TYPE_INVALID',
          cityId: 'city.alpha',
          venueModuleId: 'acme.social',
          domainId: 'domain.acme.social',
        },
      });
      const rows = await db.select().from(schema.domainAttachments);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({
        status: 'failed',
        receiptCode: 'DOMAIN_ATTACHMENT_RECEIPT_CONTENT_TYPE_INVALID',
      });
    } finally {
      await close(server);
    }
  });
});
