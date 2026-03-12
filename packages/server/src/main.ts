/**
 * Uruc City — Main Runtime
 *
 * Assumes environment variables are already loaded by the bootstrap entry.
 */

import { createDb } from './core/database/index.js';
import { ServiceRegistry } from './core/plugin-system/service-registry.js';
import { HookRegistry } from './core/plugin-system/hook-registry.js';
import { PluginDiscovery } from './core/plugin-system/discovery.js';
import { PluginLoader } from './core/plugin-system/loader.js';

import { AuthService } from './core/auth/service.js';
import { LogService } from './core/logger/service.js';
import { registerAuthRoutes } from './core/auth/auth-routes.js';
import { registerDashboardRoutes } from './core/auth/dashboard-routes.js';
import { registerAdminRoutes } from './core/admin/routes.js';
import { AdminService } from './core/admin/service.js';
import { registerCityCommands } from './core/city/commands.js';
import { WSGateway } from './core/server/ws-gateway.js';
import { createHttpServer } from './core/server/http-server.js';
import { seedAdmin } from './seed.js';
import { getDbPath, getPluginConfigPath } from './runtime-paths.js';

const HTTP_PORT = parseInt(process.env.PORT ?? '3000');
const WS_PORT = parseInt(process.env.WS_PORT ?? '3001');
const DB_PATH = getDbPath();

async function main() {
  console.log('🏙️  Uruc City starting...\n');

  const db = createDb(DB_PATH);
  const services = new ServiceRegistry();
  const hooks = new HookRegistry();

  // === Core services (always present, not plugins) ===

  const auth = new AuthService(db);
  const adminSvc = new AdminService(db);
  const logger = new LogService(db);
  services.register('auth', auth);
  services.register('admin', adminSvc);
  services.register('logger', logger);

  const gateway = new WSGateway({ port: WS_PORT }, hooks, services, auth);
  services.register('ws-gateway', gateway);

  console.log('✅ Core services initialized: auth, admin, logger, ws-gateway');

  // === Register core routes (before plugins, via hooks) ===

  registerAuthRoutes(hooks, auth);
  registerDashboardRoutes(hooks, auth, logger);
  registerAdminRoutes(hooks, adminSvc, logger, services);
  registerCityCommands(hooks);
  console.log('✅ Core routes registered: auth, dashboard, admin, city');

  // === Auto-discover and load all plugins ===

  const discovery = new PluginDiscovery(getPluginConfigPath());
  const loader = new PluginLoader(discovery);

  await loader.discoverAndLoadAll({ db, services, hooks });

  // === Seed data ===

  await seedAdmin(db);

  // === Start servers ===

  const httpServer = createHttpServer({ auth, hooks, services, loader });

  httpServer.listen(HTTP_PORT, () => {
    console.log(`🌐 HTTP API on port ${HTTP_PORT}`);
  });

  await gateway.start();
  console.log(`🔌 WebSocket on port ${WS_PORT}`);

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
      await loader.stopAll();
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

main().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
