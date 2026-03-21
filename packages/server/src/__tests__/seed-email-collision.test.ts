import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  eq: vi.fn((left: unknown, right: unknown) => ({ left, right })),
}));

vi.mock('../core/database/index.js', () => ({
  schema: {
    users: {
      id: 'id',
      username: 'username',
      email: 'email',
      role: 'role',
    },
  },
}));

vi.mock('drizzle-orm', () => ({
  eq: mocks.eq,
}));

function resolvedQuery<T>(rows: T[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
    }),
  };
}

const originalEnv = { ...process.env };

describe('seedAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    vi.restoreAllMocks();
    process.env = { ...originalEnv };
  });

  it('skips seeding when the configured admin email already belongs to another user', async () => {
    const insertValues = vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed: users.email'));
    const db = {
      select: vi.fn()
        .mockImplementationOnce(() => resolvedQuery([]))
        .mockImplementationOnce(() => resolvedQuery([
          { id: 'user-1', username: 'existing-user', role: 'user' },
        ])),
      insert: vi.fn().mockReturnValue({
        values: insertValues,
      }),
    };

    process.env.ADMIN_USERNAME = 'admin';
    process.env.ADMIN_PASSWORD = 'secret-password';
    process.env.ADMIN_EMAIL = 'admin@localhost';
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

    const { seedAdmin } = await import('../seed.js');
    await expect(seedAdmin(db as any)).resolves.toBeUndefined();

    expect(insertValues).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    expect(warn.mock.calls[0]?.[0]).toContain('ADMIN_EMAIL');
  });
});
