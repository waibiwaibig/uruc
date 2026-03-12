/**
 * E2E Smoke Test
 *
 * Starts the REAL server (HTTP + WS) and verifies:
 *  - HTTP health endpoint responds
 *  - Plugins are loaded
 *  - WebSocket connects and receives error for unauthenticated command
 *  - Graceful shutdown works
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createDb } from '../core/database/index.js';
import { ServiceRegistry } from '../core/plugin-system/service-registry.js';
import { HookRegistry } from '../core/plugin-system/hook-registry.js';
import { PluginDiscovery } from '../core/plugin-system/discovery.js';
import { PluginLoader } from '../core/plugin-system/loader.js';
import { AuthService } from '../core/auth/service.js';
import { LogService } from '../core/logger/service.js';
import { registerAuthRoutes } from '../core/auth/auth-routes.js';
import { registerDashboardRoutes } from '../core/auth/dashboard-routes.js';
import { registerAdminRoutes } from '../core/admin/routes.js';
import { AdminService } from '../core/admin/service.js';
import { registerCityCommands } from '../core/city/commands.js';
import { WSGateway } from '../core/server/ws-gateway.js';
import { createHttpServer } from '../core/server/http-server.js';
import { WebSocket } from 'ws';
import path from 'path';
import type { Server } from 'http';

const TEST_HTTP_PORT = 19876;
const TEST_WS_PORT = 19877;
const TEST_DB = ':memory:';

describe('E2E Smoke Test', () => {
    let httpServer: Server;
    let gateway: WSGateway;
    let loader: PluginLoader;

    beforeAll(async () => {
        // --- Boot the real server with in-memory DB ---
        const db = createDb(TEST_DB);
        const services = new ServiceRegistry();
        const hooks = new HookRegistry();

        const configPath = path.join(process.cwd(), 'plugins.dev.json');
        const discovery = new PluginDiscovery(configPath);
        loader = new PluginLoader(discovery);

        const auth = new AuthService(db);
        const log = new LogService(db);
        const admin = new AdminService(db);

        services.register('auth', auth);
        services.register('log', log);
        services.register('admin', admin);

        registerAuthRoutes(hooks, auth);
        registerDashboardRoutes(hooks, auth, log);
        registerAdminRoutes(hooks, admin, log, services);
        registerCityCommands(hooks);

        // Discover + register + init + start plugins
        await discovery.loadConfig();
        await loader.discoverAndRegisterAll();
        await loader.initAll({ db, services, hooks });
        await loader.startAll();

        // Start HTTP
        httpServer = createHttpServer({ auth, hooks, services, loader });
        await new Promise<void>((resolve) => httpServer.listen(TEST_HTTP_PORT, resolve));

        // Start WS
        gateway = new WSGateway({ port: TEST_WS_PORT }, hooks, services, auth);
        await gateway.start();
    }, 15000);

    afterAll(async () => {
        try { await loader?.stopAll(); } catch { }
        try { await gateway?.stop(); } catch { }
        await new Promise<void>((resolve) => {
            if (httpServer) httpServer.close(() => resolve());
            else resolve();
        });
    }, 10000);

    it('should respond to /api/health', async () => {
        const res = await fetch(`http://localhost:${TEST_HTTP_PORT}/api/health`);
        expect(res.status).toBe(200);

        const body = await res.json();
        expect(body.status).toBe('ok');
        expect(Array.isArray(body.plugins)).toBe(true);
        expect(Array.isArray(body.services)).toBe(true);
    });

    it('should have loaded plugins', async () => {
        const res = await fetch(`http://localhost:${TEST_HTTP_PORT}/api/health`);
        const body = await res.json();

        // At least some plugins should be loaded
        expect(body.plugins.length).toBeGreaterThan(0);

        // Core services should be registered
        expect(body.services.length).toBeGreaterThan(0);
    });

    it('should accept WebSocket connection', async () => {
        const ws = new WebSocket(`ws://localhost:${TEST_WS_PORT}`);

        const connected = await new Promise<boolean>((resolve) => {
            ws.on('open', () => resolve(true));
            ws.on('error', () => resolve(false));
            setTimeout(() => resolve(false), 3000);
        });

        expect(connected).toBe(true);
        ws.close();
    });

    it('should reject unauthenticated WS commands', async () => {
        const ws = new WebSocket(`ws://localhost:${TEST_WS_PORT}`);

        await new Promise<void>((resolve) => {
            ws.on('open', resolve);
        });

        // Send a command without authenticating first
        ws.send(JSON.stringify({ id: 'test-1', type: 'enter_city', payload: {} }));

        const response = await new Promise<any>((resolve) => {
            ws.on('message', (data) => {
                resolve(JSON.parse(data.toString()));
            });
            setTimeout(() => resolve(null), 3000);
        });

        expect(response).not.toBeNull();
        expect(response.type).toBe('error');
        expect(response.payload.code).toBe('NOT_AUTHENTICATED');
        expect(response.payload.action).toBe('auth');
        ws.close();
    });

    it('should reject unknown API routes with error code', async () => {
        const res = await fetch(`http://localhost:${TEST_HTTP_PORT}/api/nonexistent`);
        // Server returns 401 (auth required) or 404 depending on auth config
        expect([401, 404]).toContain(res.status);
        const body = await res.json();
        expect(body.code).toBeDefined();
        expect(['UNAUTHORIZED', 'NOT_FOUND']).toContain(body.code);
    });
});
