/**
 * Admin HTTP Routes — self-registered via HookRegistry.
 *
 * Covers:
 * - Overview stats
 * - User management (list, ban)
 * - Agent management (list, freeze, kick)
 * - Log viewer
 */

import type { HookRegistry, HttpContext } from '../plugin-system/hook-registry.js';
import type { ServiceRegistry } from '../plugin-system/service-registry.js';
import type { AdminService } from './service.js';
import type { LogService } from '../logger/service.js';
import type { IGatewayAdmin } from '../server/ws-gateway.js';
import { parseBody, sendError, sendJson } from '../server/middleware.js';
import { CORE_ERROR_CODES, sendHttpError } from '../server/errors.js';
import { safeOffset } from '../../utils/validate.js';

/**
 * Register all admin HTTP routes into HookRegistry.
 * Called once during server startup, before plugins load.
 */
export function registerAdminRoutes(hooks: HookRegistry, admin: AdminService, logger: LogService, services: ServiceRegistry) {
    hooks.registerHttpRoute(async (ctx: HttpContext) => {
        const { path, method, req, res, session } = ctx;

        // Admin routes require /api/admin/ prefix and admin role
        if (!path.startsWith('/api/admin/')) return false;
        if (!session || session.role !== 'admin') {
            sendError(res, 403, { error: 'Admin access required.', code: CORE_ERROR_CODES.FORBIDDEN }, req);
            return true;
        }

        const url = new URL(req.url ?? '/', `http://${req.headers.host}`);

        // === Overview ===
        if (path === '/api/admin/overview' && method === 'GET') {
            try {
                const stats = await admin.getOverviewStats();
                sendJson(res, 200, stats, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 500, code: CORE_ERROR_CODES.INTERNAL_ERROR, error: 'Unable to load admin overview.' });
            }
            return true;
        }

        // === Users ===
        if (path === '/api/admin/users' && method === 'GET') {
            try {
                const search = url.searchParams.get('search') || undefined;
                const limit = parseInt(url.searchParams.get('limit') ?? '50');
                const offset = safeOffset(url.searchParams.get('offset'));
                const result = await admin.getAllUsers(search, limit, offset);
                sendJson(res, 200, result, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 500, code: CORE_ERROR_CODES.INTERNAL_ERROR, error: 'Unable to load users.' });
            }
            return true;
        }

        const userMatch = path.match(/^\/api\/admin\/users\/([\w-]+)$/);
        if (userMatch && method === 'PATCH') {
            try {
                const { banned } = await parseBody(req);
                await admin.banUser(userMatch[1], !!banned);
                sendJson(res, 200, { success: true }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to update user ban state.' });
            }
            return true;
        }

        // === Agents ===
        if (path === '/api/admin/agents' && method === 'GET') {
            try {
                const agents = await admin.getAllAgents();
                const gateway = services.tryGet('ws-gateway') as IGatewayAdmin | undefined;
                const onlineIds = gateway?.getOnlineAgentIds() ?? [];
                const enriched = agents.map(a => ({
                    ...a,
                    currentLocation: gateway?.getAgentCurrentLocation(a.id) ?? null,
                    isOnline: onlineIds.includes(a.id),
                }));
                sendJson(res, 200, { agents: enriched }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 500, code: CORE_ERROR_CODES.INTERNAL_ERROR, error: 'Unable to load agents.' });
            }
            return true;
        }

        const kickMatch = path.match(/^\/api\/admin\/agents\/([\w-]+)\/kick$/);
        if (kickMatch && method === 'POST') {
            const gateway = services.tryGet('ws-gateway') as IGatewayAdmin | undefined;
            gateway?.kickAgent(kickMatch[1]);
            sendJson(res, 200, { success: true }, req);
            return true;
        }

        const agentMatch = path.match(/^\/api\/admin\/agents\/([\w-]+)$/);
        if (agentMatch && method === 'PATCH') {
            try {
                const { frozen } = await parseBody(req);
                await admin.freezeAgent(agentMatch[1], !!frozen);
                sendJson(res, 200, { success: true }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to update agent freeze state.' });
            }
            return true;
        }

        // === Logs ===
        if (path === '/api/admin/logs' && method === 'GET') {
            try {
                const filter: Record<string, string | number | undefined> = {};
                if (url.searchParams.get('userId')) filter.userId = url.searchParams.get('userId')!;
                if (url.searchParams.get('agentId')) filter.agentId = url.searchParams.get('agentId')!;
                if (url.searchParams.get('locationId')) filter.locationId = url.searchParams.get('locationId')!;
                if (url.searchParams.get('actionType')) filter.actionType = url.searchParams.get('actionType')!;
                filter.limit = parseInt(url.searchParams.get('limit') ?? '100');
                filter.offset = safeOffset(url.searchParams.get('offset'));
                const logs = await logger.query(filter as any);
                sendJson(res, 200, { logs }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 500, code: CORE_ERROR_CODES.INTERNAL_ERROR, error: 'Unable to load logs.' });
            }
            return true;
        }

        return false;
    });
}
