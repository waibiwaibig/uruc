import { beforeEach, describe, expect, it, vi } from 'vitest';
import bcrypt from 'bcryptjs';
import { eq, and } from 'drizzle-orm';

vi.mock('../email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
}));

import { createDb, schema } from '../../database/index.js';
import { AuthService } from '../service.js';

describe('AuthService shadow agent support', () => {
  let auth: AuthService;
  let db: ReturnType<typeof createDb>;

  beforeEach(() => {
    db = createDb(':memory:');
    auth = new AuthService(db);
  });

  it('creates a shadow agent during registration', async () => {
    const user = await auth.register('gilgamesh', 'gilgamesh@example.com', 'secret-123');

    const agents = await auth.getAgentsByUser(user.id);

    expect(agents).toHaveLength(1);
    expect(agents[0].isShadow).toBe(true);
    expect(agents[0].name).toBe('gilgamesh');
    expect(agents[0].trustMode).toBe('full');
    expect(agents[0].allowedLocations).toEqual([]);
  });

  it('backfills exactly one shadow agent for legacy users', async () => {
    const passwordHash = await bcrypt.hash('secret-123', 10);
    await db.insert(schema.users).values({
      id: 'legacy-user',
      username: 'enkidu',
      email: 'enkidu@example.com',
      passwordHash,
      emailVerified: true,
      role: 'user',
      createdAt: new Date(),
    });

    const first = await auth.getAgentsByUser('legacy-user');
    const second = await auth.getAgentsByUser('legacy-user');
    const rows = await db.select().from(schema.agents)
      .where(and(eq(schema.agents.userId, 'legacy-user'), eq(schema.agents.isShadow, true)));

    expect(first).toHaveLength(1);
    expect(first[0].isShadow).toBe(true);
    expect(second).toHaveLength(1);
    expect(rows).toHaveLength(1);
  });

  it('keeps the shadow agent first and still authenticates regular agent tokens', async () => {
    const user = await auth.register('ishtar', 'ishtar@example.com', 'secret-123');
    const regularAgent = await auth.createAgent(user.id, 'ishtar-alt');

    const agents = await auth.getAgentsByUser(user.id);
    const regularSession = await auth.authenticateAgent(regularAgent.token);

    expect(agents).toHaveLength(2);
    expect(agents[0].isShadow).toBe(true);
    expect(agents[1].isShadow).toBe(false);
    expect(regularSession.agentId).toBe(regularAgent.id);
    expect(regularSession.role).toBe('agent');
  });

  it('maps a user to a shadow agent session', async () => {
    const user = await auth.register('sargon', 'sargon@example.com', 'secret-123');

    const session = await auth.authenticateShadowAgent(user.id);

    expect(session.userId).toBe(user.id);
    expect(session.role).toBe('agent');
    expect(session.trustMode).toBe('full');
    expect(session.allowedLocations).toEqual([]);
  });

  it('does not map banned users into a shadow agent session', async () => {
    const user = await auth.register('nabu', 'nabu@example.com', 'secret-123');
    await db.update(schema.users).set({ banned: 1 }).where(eq(schema.users.id, user.id));

    await expect(auth.authenticateShadowAgent(user.id)).rejects.toMatchObject({
      code: 'USER_BANNED',
      message: 'Account is banned',
    });
  });

  it('blocks destructive shadow agent mutations but allows profile edits', async () => {
    const user = await auth.register('ninurta', 'ninurta@example.com', 'secret-123');
    const [shadow] = await auth.getAgentsByUser(user.id);

    await expect(auth.deleteAgent(shadow.id, user.id)).rejects.toThrow('Shadow agents cannot be deleted');
    await expect(auth.updateAgentTrustMode(shadow.id, user.id, 'confirm')).rejects.toThrow('Shadow agents cannot change trust mode');
    await expect(auth.updateAgentLocations(shadow.id, user.id, ['uruc.chess.chess-club'])).rejects.toThrow('Shadow agents cannot change location access');

    await auth.updateAgent(shadow.id, user.id, {
      name: 'ninurta-prime',
      description: 'main persona',
      searchable: 0,
    });

    const [updated] = await auth.getAgentsByUser(user.id);
    expect(updated.name).toBe('ninurta-prime');
    expect(updated.description).toBe('main persona');
    expect(updated.searchable).toBe(0);
  });
});
