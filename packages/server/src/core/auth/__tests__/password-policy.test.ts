import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../email.js', () => ({
  sendVerificationEmail: vi.fn(async () => undefined),
}));

import { createDb } from '../../database/index.js';
import { AuthService } from '../service.js';

describe('AuthService password policy', () => {
  let auth: AuthService;

  beforeEach(() => {
    auth = new AuthService(createDb(':memory:'));
  });

  it('rejects weak passwords during registration', async () => {
    await expect(auth.register('letters-only', 'letters@example.com', 'abcdefgh')).rejects.toThrow('密码必须包含至少一个数字');
    await expect(auth.register('digits-only', 'digits@example.com', '12345678')).rejects.toThrow('密码必须包含至少一个字母');
    await expect(auth.register('shorty', 'short@example.com', 'a1b2')).rejects.toThrow('密码长度不能少于 8 个字符');
  });

  it('rejects weak passwords during password change', async () => {
    const user = await auth.register('owner', 'owner@example.com', 'secret123');

    await expect(auth.changePassword(user.id, 'secret123', 'abcdefgh')).rejects.toThrow('密码必须包含至少一个数字');
    await expect(auth.changePassword(user.id, 'secret123', '12345678')).rejects.toThrow('密码必须包含至少一个字母');
    await expect(auth.changePassword(user.id, 'secret123', 'a1b2')).rejects.toThrow('密码长度不能少于 8 个字符');
  });
});
