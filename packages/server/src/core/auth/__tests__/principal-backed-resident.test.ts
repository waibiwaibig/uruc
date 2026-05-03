import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
}));

import { createDb } from '../../database/index.js';
import { AuthService } from '../service.js';

describe('AuthService principal-backed resident registration', () => {
  let auth: AuthService;

  beforeEach(() => {
    auth = new AuthService(createDb(':memory:'));
  });

  it('creates a principal-backed resident with exactly one accountable principal and independent session identity', async () => {
    const user = await auth.register('principal', 'principal@example.com', 'secret-123');
    const [principal] = await auth.getAgentsByUser(user.id);

    const resident = await auth.createPrincipalBackedResident({
      accountablePrincipalId: principal.id,
      name: 'principal-backed-worker',
    });
    const session = await auth.authenticateAgent(resident.token);
    const agents = await auth.getAgentsByUser(user.id);

    expect(resident).toMatchObject({
      name: 'principal-backed-worker',
      userId: user.id,
      isShadow: false,
      registrationType: 'principal_backed',
      accountablePrincipalId: principal.id,
    });
    expect(resident.id).not.toBe(principal.id);
    expect(session).toMatchObject({
      agentId: resident.id,
      userId: user.id,
      agentName: 'principal-backed-worker',
      registrationType: 'principal_backed',
      accountablePrincipalId: principal.id,
    });
    expect(session.agentId).not.toBe(principal.id);
    expect(agents.find((agent) => agent.id === resident.id)).toMatchObject({
      registrationType: 'principal_backed',
      accountablePrincipalId: principal.id,
    });
  });

  it('rejects missing, multiple, or non-regular accountable principals', async () => {
    const user = await auth.register('principal-rules', 'principal-rules@example.com', 'secret-123');
    const [principal] = await auth.getAgentsByUser(user.id);

    await expect(auth.createPrincipalBackedResident({
      accountablePrincipalId: '',
      name: 'missing-principal-worker',
    })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'accountablePrincipalId is required',
    });

    await expect(auth.createPrincipalBackedResident({
      accountablePrincipalId: [principal.id, principal.id] as any,
      name: 'multi-principal-worker',
    })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'accountablePrincipalId is required',
    });

    const backed = await auth.createPrincipalBackedResident({
      accountablePrincipalId: principal.id,
      name: 'first-backed-worker',
    });

    await expect(auth.createPrincipalBackedResident({
      accountablePrincipalId: backed.id,
      name: 'nested-backed-worker',
    })).rejects.toMatchObject({
      code: 'BAD_REQUEST',
      message: 'accountablePrincipalId must reference a regular resident',
    });
  });
});
