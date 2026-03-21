import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createDb: vi.fn(),
  loadServerEnv: vi.fn(),
  resolveFromPackageRoot: vi.fn((value?: string) => value),
  eq: vi.fn((left: unknown, right: unknown) => ({ left, right })),
  and: vi.fn((...args: unknown[]) => args),
  asc: vi.fn((value: unknown) => value),
  or: vi.fn((...args: unknown[]) => args),
}));

vi.mock('../../core/database/index.js', () => ({
  createDb: mocks.createDb,
  schema: {
    users: {
      id: 'id',
      username: 'username',
      email: 'email',
      role: 'role',
      passwordHash: 'password_hash',
      banned: 'banned',
      createdAt: 'created_at',
    },
    agents: {
      id: 'id',
      name: 'name',
      userId: 'user_id',
    },
  },
}));

vi.mock('../lib/env.js', () => ({
  loadServerEnv: mocks.loadServerEnv,
}));

vi.mock('../../runtime-paths.js', () => ({
  resolveFromPackageRoot: mocks.resolveFromPackageRoot,
}));

vi.mock('drizzle-orm', () => ({
  eq: mocks.eq,
  and: mocks.and,
  asc: mocks.asc,
  or: mocks.or,
}));

function resolvedQuery<T>(rows: T[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue(rows),
      orderBy: vi.fn().mockResolvedValue(rows),
    }),
  };
}

describe('createAdmin', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a friendly error when another account already owns the requested admin email', async () => {
    const insertValues = vi.fn().mockRejectedValue(new Error('UNIQUE constraint failed: users.email'));
    mocks.createDb.mockReturnValue({
      select: vi.fn()
        .mockImplementationOnce(() => resolvedQuery([]))
        .mockImplementationOnce(() => resolvedQuery([
          { id: 'user-1', username: 'existing-user', role: 'user' },
        ])),
      insert: vi.fn().mockReturnValue({
        values: insertValues,
      }),
    });

    const { createAdmin } = await import('../lib/admin.js');
    await expect(createAdmin('fresh-admin', 'another-secret', 'admin@example.com', './data/custom.db')).resolves.toEqual({
      created: false,
      reason: '邮箱已被用户 existing-user 占用',
    });
    expect(mocks.resolveFromPackageRoot).toHaveBeenCalledWith('./data/custom.db');
    expect(insertValues).not.toHaveBeenCalled();
  });
});
