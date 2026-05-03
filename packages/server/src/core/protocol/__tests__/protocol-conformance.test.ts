import { readFile } from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import { describe, expect, it } from 'vitest';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../../..');

async function readRepoFile(relativePath: string): Promise<string> {
  return readFile(path.join(repoRoot, relativePath), 'utf8');
}

describe('Uruc Protocol v1 conformance', () => {
  it('does not expose legacy public action-lease command names', async () => {
    const gateway = await readRepoFile('packages/server/src/core/server/ws-gateway.ts');
    const cityCommands = await readRepoFile('packages/server/src/core/city/commands.ts');

    expect(`${gateway}\n${cityCommands}`).not.toMatch(/claim_control|release_control|control_replaced/);
    expect(cityCommands).toContain("type: 'acquire_action_lease'");
    expect(cityCommands).toContain("type: 'release_action_lease'");
  });

  it('uses action lease state fields on resident-facing runtime surfaces', async () => {
    const serverSession = await readRepoFile('packages/server/src/core/server/agent-session-service.ts');
    const webTypes = await readRepoFile('packages/web/src/lib/types.ts');
    const skillRuntime = await readRepoFile('skills/uruc-skill/scripts/lib/common.mjs');

    for (const source of [serverSession, webTypes, skillRuntime]) {
      expect(source).toContain('hasActionLease');
      expect(source).toContain('isActionLeaseHolder');
      expect(source).not.toMatch(/hasController|isController/);
    }
  });

  it('keeps resident identity separate from accountable-principal authority', async () => {
    const authDoc = await readRepoFile('docs/uruc-city-protocol.md');
    const permissionService = await readRepoFile('packages/server/src/core/permission/service.ts');

    expect(authDoc).toContain('No Resident Operates Another Resident');
    expect(authDoc).toContain('It may not use that resident');
    expect(permissionService).toContain('issuerId must be the resident accountablePrincipalId');
    expect(permissionService).not.toMatch(/operate another resident|take over another resident/i);
  });

  it('requires permission-needed receipts to be compact and approval-shaped', async () => {
    const permissionService = await readRepoFile('packages/server/src/core/permission/service.ts');
    const gatewayPermissionTest = await readRepoFile('packages/server/src/core/server/__tests__/ws-gateway-permission.test.ts');

    expect(permissionService).toContain("code: 'PERMISSION_REQUIRED'");
    expect(permissionService).toContain("nextAction: 'require_approval'");
    expect(gatewayPermissionTest).toContain('returns a stable require_approval receipt');
  });

  it('hardens domain dispatch boundaries without Venue business interpretation', async () => {
    const dispatch = await readRepoFile('packages/server/src/core/domain/dispatch.ts');

    expect(dispatch).toContain('DOMAIN_DISPATCH_ENVELOPE_SIGNED_FIELDS');
    expect(dispatch).toContain('payloadHash');
    expect(dispatch).toContain('DOMAIN_DISPATCH_RECEIPT_EXPIRED');
    expect(dispatch).toContain('DOMAIN_DISPATCH_RECEIPT_HASH_MISMATCH');
    expect(dispatch).not.toMatch(/social|market|chess/i);
  });

  it('keeps Federation separate from Domain Service and verifies trust metadata', async () => {
    const federation = await readRepoFile('packages/server/src/core/federation/service.ts');
    const docs = await readRepoFile('docs/uruc-city-protocol.md');

    expect(federation).toContain('FederationDocumentService');
    expect(federation).toContain('verifyFederationPolicyRef');
    expect(federation).toContain('evaluateVerifiedFeedEntry');
    expect(docs).toContain('A federation is not a domain service');
    expect(docs).toContain('It must not delete a resident id');
  });
});
