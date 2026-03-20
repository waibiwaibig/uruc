import { afterEach, describe, expect, it, vi } from 'vitest';

const originalEnv = {
  JWT_SECRET: process.env.JWT_SECRET,
  NODE_ENV: process.env.NODE_ENV,
};

afterEach(() => {
  vi.restoreAllMocks();
  vi.resetModules();
  process.env.JWT_SECRET = originalEnv.JWT_SECRET;
  process.env.NODE_ENV = originalEnv.NODE_ENV;
});

describe('JWT runtime initialization', () => {
  it('does not warn when middleware is merely imported without JWT_SECRET', async () => {
    delete process.env.JWT_SECRET;
    delete process.env.NODE_ENV;
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

    await import('../middleware.js');

    expect(warnSpy).not.toHaveBeenCalled();
  });

  it('warns once when runtime starts without JWT_SECRET outside production', async () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'test';
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const { initializeJwtSecretRuntime } = await import('../middleware.js');

    initializeJwtSecretRuntime({ envPath: '/tmp/custom.env' });
    initializeJwtSecretRuntime({ envPath: '/tmp/custom.env' });

    expect(warnSpy).toHaveBeenCalledTimes(1);
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('/tmp/custom.env'));
  });

  it('fails clearly in production when runtime starts without JWT_SECRET', async () => {
    delete process.env.JWT_SECRET;
    process.env.NODE_ENV = 'production';
    const { initializeJwtSecretRuntime } = await import('../middleware.js');

    expect(() => initializeJwtSecretRuntime({ envPath: '/tmp/prod.env' })).toThrow(
      'JWT_SECRET must be set in production. Active env: /tmp/prod.env',
    );
  });
});
