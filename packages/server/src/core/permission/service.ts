import { and, eq } from 'drizzle-orm';
import { nanoid } from 'nanoid';

import { type UrucDb, schema } from '../database/index.js';
import type { CommandSchema, WSErrorPayload } from '../plugin-system/hook-registry.js';
import type { AgentSession } from '../../types/index.js';

const CITY_ISSUER_ID = 'uruc.city';
const BASIC_REGULAR_CAPABILITY = 'uruc.city.basic@v1';

declare module '../plugin-system/service-registry.js' {
  interface ServiceMap {
    'permission': PermissionCredentialService;
  }
}

export interface PermissionCredential {
  id: string;
  residentId: string;
  issuerId: string;
  status: 'active' | 'revoked';
  capabilities: string[];
  issuedAt: Date;
  validFrom: Date;
  validUntil: Date | null;
}

export type CanExecuteDecision =
  | { status: 'allow'; credentials: PermissionCredential[] }
  | { status: 'require_approval'; receipt: WSErrorPayload; missingCapabilities: string[] };

function parseCapabilities(raw: string): string[] {
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((capability): capability is string => typeof capability === 'string' && capability.length > 0);
  } catch {
    return [];
  }
}

function normalizeCapabilities(capabilities: string[]): string[] {
  return Array.from(new Set(capabilities.filter((capability) => capability.length > 0))).sort();
}

export class PermissionCredentialService {
  constructor(private db: UrucDb) {}

  async resolveActiveCityIssuedCredential(session: AgentSession): Promise<PermissionCredential> {
    const existing = await this.findActiveCityBasicCredential(session.agentId);
    if (existing) return existing;

    return this.issueCityCredential({
      residentId: session.agentId,
      capabilities: [BASIC_REGULAR_CAPABILITY],
    });
  }

  async issueCityCredential(input: {
    residentId: string;
    capabilities: string[];
    validFrom?: Date;
    validUntil?: Date | null;
  }): Promise<PermissionCredential> {
    return this.issueCredential({
      issuerId: CITY_ISSUER_ID,
      residentId: input.residentId,
      capabilities: input.capabilities,
      validFrom: input.validFrom,
      validUntil: input.validUntil,
    });
  }

  async issuePrincipalCredential(input: {
    issuerId: string;
    residentId: string;
    capabilities: string[];
    validFrom?: Date;
    validUntil?: Date | null;
  }): Promise<PermissionCredential> {
    const [backing] = await this.db.select()
      .from(schema.principalBackedResidents)
      .where(and(
        eq(schema.principalBackedResidents.residentId, input.residentId),
        eq(schema.principalBackedResidents.accountablePrincipalId, input.issuerId),
      ));
    if (!backing) {
      throw new Error('issuerId must be the resident accountablePrincipalId');
    }

    return this.issueCredential(input);
  }

  private async issueCredential(input: {
    issuerId: string;
    residentId: string;
    capabilities: string[];
    validFrom?: Date;
    validUntil?: Date | null;
  }): Promise<PermissionCredential> {
    const now = new Date();
    const credential = {
      id: `perm_${nanoid(16)}`,
      residentId: input.residentId,
      issuerId: input.issuerId,
      status: 'active' as const,
      capabilities: normalizeCapabilities(input.capabilities),
      issuedAt: now,
      validFrom: input.validFrom ?? now,
      validUntil: input.validUntil ?? null,
    };

    await this.db.insert(schema.permissionCredentials).values({
      id: credential.id,
      residentId: credential.residentId,
      issuerId: credential.issuerId,
      status: credential.status,
      capabilities: JSON.stringify(credential.capabilities),
      issuedAt: credential.issuedAt,
      validFrom: credential.validFrom,
      validUntil: credential.validUntil,
    });

    return credential;
  }

  async canExecute(session: AgentSession, schema: CommandSchema): Promise<CanExecuteDecision> {
    const requiredCapabilities = schema.protocol?.request?.requiredCapabilities ?? [];
    if (requiredCapabilities.length === 0) {
      return { status: 'allow', credentials: [] };
    }

    if (session.registrationType !== 'principal_backed') {
      await this.resolveActiveCityIssuedCredential(session);
    }
    const credentials = await this.resolveActiveCredentials(session);
    const grantedCapabilities = new Set(credentials.flatMap((credential) => credential.capabilities));
    const missingCapabilities = requiredCapabilities.filter((capability) => !grantedCapabilities.has(capability));

    if (missingCapabilities.length === 0) {
      return { status: 'allow', credentials };
    }

    const isPrincipalBacked = session.registrationType === 'principal_backed';
    return {
      status: 'require_approval',
      missingCapabilities,
      receipt: {
        error: isPrincipalBacked
          ? 'Principal-backed permission required for this request.'
          : 'Permission required for this request.',
        text: isPrincipalBacked
          ? 'Principal-backed permission required for this request.'
          : 'Permission required for this request.',
        code: 'PERMISSION_REQUIRED',
        action: isPrincipalBacked ? 'require_approval' : 'request_permission',
        nextAction: isPrincipalBacked ? 'require_approval' : 'request_permission',
        details: {
          requestType: schema.protocol?.request?.type ?? schema.type,
          ...(isPrincipalBacked ? { accountablePrincipalId: session.accountablePrincipalId } : {}),
          requiredCapabilities,
          missingCapabilities,
        },
      },
    };
  }

  private async resolveActiveCredentials(session: AgentSession): Promise<PermissionCredential[]> {
    const now = Date.now();
    const rows = await this.db.select()
      .from(schema.permissionCredentials)
      .where(and(
        eq(schema.permissionCredentials.residentId, session.agentId),
        eq(schema.permissionCredentials.status, 'active'),
      ));

    return rows
      .map((row) => this.mapCredential(row))
      .filter((credential) => {
        if (session.registrationType !== 'principal_backed') return true;
        return credential.issuerId === session.accountablePrincipalId;
      })
      .filter((credential) => credential.validFrom.getTime() <= now)
      .filter((credential) => !credential.validUntil || credential.validUntil.getTime() > now);
  }

  private async findActiveCityBasicCredential(residentId: string): Promise<PermissionCredential | null> {
    const now = Date.now();
    const rows = await this.db.select()
      .from(schema.permissionCredentials)
      .where(and(
        eq(schema.permissionCredentials.residentId, residentId),
        eq(schema.permissionCredentials.issuerId, CITY_ISSUER_ID),
        eq(schema.permissionCredentials.status, 'active'),
      ));

    return rows
      .map((row) => this.mapCredential(row))
      .find((credential) => (
        credential.validFrom.getTime() <= now
        && (!credential.validUntil || credential.validUntil.getTime() > now)
        && credential.capabilities.includes(BASIC_REGULAR_CAPABILITY)
      )) ?? null;
  }

  private mapCredential(row: typeof schema.permissionCredentials.$inferSelect): PermissionCredential {
    return {
      id: row.id,
      residentId: row.residentId,
      issuerId: row.issuerId,
      status: row.status as 'active' | 'revoked',
      capabilities: parseCapabilities(row.capabilities),
      issuedAt: row.issuedAt,
      validFrom: row.validFrom,
      validUntil: row.validUntil ?? null,
    };
  }
}
