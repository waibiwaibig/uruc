/**
 * Uruc City — Main Runtime
 *
 * Assumes environment variables are already loaded by the bootstrap entry.
 */

import { createDb } from './core/database/index.js';
import { ServiceRegistry } from './core/plugin-system/service-registry.js';
import { HookRegistry } from './core/plugin-system/hook-registry.js';
import { PluginPlatformHost } from './core/plugin-platform/host.js';

import { AuthService } from './core/auth/service.js';
import { PermissionCredentialService } from './core/permission/service.js';
import { LogService } from './core/logger/service.js';
import { registerAuthRoutes } from './core/auth/auth-routes.js';
import { registerDashboardRoutes } from './core/auth/dashboard-routes.js';
import { registerAdminRoutes } from './core/admin/routes.js';
import { AdminService } from './core/admin/service.js';
import { registerCityCommands } from './core/city/commands.js';
import { WSGateway } from './core/server/ws-gateway.js';
import { createHttpServer } from './core/server/http-server.js';
import { initializeJwtSecretRuntime } from './core/server/middleware.js';
import { seedAdmin } from './seed.js';
import {
  getActiveEnvPath,
  getCityConfigPath,
  getCityLockPath,
  getDbPath,
  getPackageRoot,
  getPluginStoreDir,
} from './runtime-paths.js';

export async function runMain() {
  const httpPort = parseInt(process.env.PORT ?? '3000');
  const wsPort = parseInt(process.env.WS_PORT ?? '3001');
  const bindHost = process.env.BIND_HOST ?? '127.0.0.1';
  const dbPath = getDbPath();
  initializeJwtSecretRuntime({ envPath: getActiveEnvPath() });

  console.log('🏙️  Uruc City starting...\n');

  const db = createDb(dbPath);
  const services = new ServiceRegistry();
  const hooks = new HookRegistry();

  // === Core services (always present, not plugins) ===

  const auth = new AuthService(db);
  const permission = new PermissionCredentialService(db);
  const adminSvc = new AdminService(db);
  const logger = new LogService(db);
  services.register('auth', auth);
  services.register('permission', permission);
  services.register('admin', adminSvc);
  services.register('logger', logger);

  const gateway = new WSGateway({ port: wsPort, host: bindHost }, hooks, services, auth);
  services.register('ws-gateway', gateway);

  console.log('✅ Core services initialized: auth, permission, admin, logger, ws-gateway');

  // === Register core routes (before plugins, via hooks) ===

  registerAuthRoutes(hooks, auth);
  registerDashboardRoutes(hooks, auth, logger);
  registerAdminRoutes(hooks, adminSvc, logger, services);
  registerCityCommands(hooks);
  console.log('✅ Core routes registered: auth, dashboard, admin, city');

  // === Auto-discover and load all plugins ===

  const loader = new PluginPlatformHost({
    configPath: getCityConfigPath(),
    lockPath: getCityLockPath(),
    packageRoot: getPackageRoot(),
    pluginStoreDir: getPluginStoreDir(),
  });

  await loader.startAll({ db, services, hooks });

  const failedPlugins = loader.getPluginDiagnostics().filter((plugin) => plugin.state === 'failed');
  if (failedPlugins.length > 0) {
    console.warn('Plugin startup completed with failures:');
    for (const plugin of failedPlugins) {
      console.warn(`- ${plugin.pluginId}: ${plugin.lastError ?? 'unknown error'}`);
    }
  }

  // === Seed data ===

  await seedAdmin(db);

  // === Start servers ===

  const httpServer = createHttpServer({ auth, hooks, services, loader });

  httpServer.listen(httpPort, bindHost, () => {
    console.log(`🌐 HTTP API on ${bindHost}:${httpPort}`);
  });

  await gateway.start();
  console.log(`🔌 WebSocket on ${bindHost}:${wsPort}`);

  // === Graceful shutdown ===

  let shuttingDown = false;

  const shutdown = async () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log('\n🛑 Shutting down...');

    // Force exit if cleanup hangs.
    const forceTimer = setTimeout(() => {
      console.error('Shutdown timed out, forcing exit');
      process.exit(1);
    }, 2500);
    forceTimer.unref();

    try {
      await loader.destroyAll();
      await gateway.stop();
      await new Promise<void>((resolve, reject) => {
        httpServer.close((err) => {
          if (err) {
            reject(err);
            return;
          }
          resolve();
        });
        httpServer.closeIdleConnections?.();
        const forceCloseTimer = setTimeout(() => {
          httpServer.closeAllConnections?.();
        }, 150);
        forceCloseTimer.unref();
      });
      clearTimeout(forceTimer);
      console.log('✓ Shutdown complete');
      process.exit(0);
    } catch (err) {
      clearTimeout(forceTimer);
      console.error('Error during shutdown:', err);
      process.exit(1);
    }
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
}
