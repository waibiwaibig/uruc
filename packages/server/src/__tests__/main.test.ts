import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  createDb: vi.fn(() => ({})),
  register: vi.fn(),
  list: vi.fn(() => []),
  startAll: vi.fn().mockResolvedValue(undefined),
  getPluginDiagnostics: vi.fn(() => []),
  destroyAll: vi.fn().mockResolvedValue(undefined),
  gatewayStart: vi.fn().mockResolvedValue(undefined),
  gatewayStop: vi.fn().mockResolvedValue(undefined),
  listen: vi.fn((_port: number, _host: string, callback?: () => void) => callback?.()),
  close: vi.fn((callback?: (error?: Error | null) => void) => callback?.(null)),
  closeIdleConnections: vi.fn(),
  closeAllConnections: vi.fn(),
  seedAdmin: vi.fn().mockResolvedValue(undefined),
  initializeJwtSecretRuntime: vi.fn(),
  getActiveEnvPath: vi.fn(() => '/tmp/custom.env'),
  getCityConfigPath: vi.fn(() => '/tmp/uruc.city.json'),
  getCityLockPath: vi.fn(() => '/tmp/uruc.city.lock.json'),
  getDbPath: vi.fn(() => '/tmp/uruc.local.db'),
  getPackageRoot: vi.fn(() => '/tmp/package-root'),
  getPluginStoreDir: vi.fn(() => '/tmp/plugin-store'),
}));

vi.mock('../core/database/index.js', () => ({
  createDb: mocks.createDb,
}));

vi.mock('../core/plugin-system/service-registry.js', () => ({
  ServiceRegistry: vi.fn().mockImplementation(() => ({
    register: mocks.register,
    list: mocks.list,
  })),
}));

vi.mock('../core/plugin-system/hook-registry.js', () => ({
  HookRegistry: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../core/plugin-platform/host.js', () => ({
  PluginPlatformHost: vi.fn().mockImplementation(() => ({
    startAll: mocks.startAll,
    getPluginDiagnostics: mocks.getPluginDiagnostics,
    destroyAll: mocks.destroyAll,
  })),
}));

vi.mock('../core/auth/service.js', () => ({
  AuthService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../core/logger/service.js', () => ({
  LogService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../core/auth/auth-routes.js', () => ({
  registerAuthRoutes: vi.fn(),
}));

vi.mock('../core/auth/dashboard-routes.js', () => ({
  registerDashboardRoutes: vi.fn(),
}));

vi.mock('../core/admin/routes.js', () => ({
  registerAdminRoutes: vi.fn(),
}));

vi.mock('../core/admin/service.js', () => ({
  AdminService: vi.fn().mockImplementation(() => ({})),
}));

vi.mock('../core/city/commands.js', () => ({
  registerCityCommands: vi.fn(),
}));

vi.mock('../core/server/ws-gateway.js', () => ({
  WSGateway: vi.fn().mockImplementation(() => ({
    start: mocks.gatewayStart,
    stop: mocks.gatewayStop,
  })),
}));

vi.mock('../core/server/http-server.js', () => ({
  createHttpServer: vi.fn(() => ({
    listen: mocks.listen,
    close: mocks.close,
    closeIdleConnections: mocks.closeIdleConnections,
    closeAllConnections: mocks.closeAllConnections,
  })),
}));

vi.mock('../core/server/middleware.js', () => ({
  initializeJwtSecretRuntime: mocks.initializeJwtSecretRuntime,
}));

vi.mock('../seed.js', () => ({
  seedAdmin: mocks.seedAdmin,
}));

vi.mock('../runtime-paths.js', () => ({
  getActiveEnvPath: mocks.getActiveEnvPath,
  getCityConfigPath: mocks.getCityConfigPath,
  getCityLockPath: mocks.getCityLockPath,
  getDbPath: mocks.getDbPath,
  getPackageRoot: mocks.getPackageRoot,
  getPluginStoreDir: mocks.getPluginStoreDir,
}));

describe('runMain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.PORT = '3000';
    process.env.WS_PORT = '3001';
    process.env.BIND_HOST = '127.0.0.1';
  });

  it('initializes JWT runtime with the active env path before startup', async () => {
    const { runMain } = await import('../main.js');

    await runMain();

    expect(mocks.initializeJwtSecretRuntime).toHaveBeenCalledWith({ envPath: '/tmp/custom.env' });
  });

  it('fails before opening the database when JWT runtime initialization throws', async () => {
    mocks.initializeJwtSecretRuntime.mockImplementationOnce(() => {
      throw new Error('JWT_SECRET must be set in production. Active env: /tmp/custom.env');
    });
    const { runMain } = await import('../main.js');

    await expect(runMain()).rejects.toThrow('JWT_SECRET must be set in production. Active env: /tmp/custom.env');
    expect(mocks.createDb).not.toHaveBeenCalled();
  });
});
