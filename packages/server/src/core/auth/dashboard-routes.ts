/**
 * Dashboard HTTP Routes — self-registered via HookRegistry.
 *
 * Covers: /api/dashboard/* — Agent CRUD, avatar upload, location admission, logs, me
 * All routes require login (session check).
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { IncomingMessage } from 'http';

import type { HookRegistry, HttpContext } from '../plugin-system/hook-registry.js';
import type { AuthService } from './service.js';
import type { LogService } from '../logger/service.js';
import { parseBody, sendError, sendJson } from '../server/middleware.js';
import { AppError, CORE_ERROR_CODES, sendHttpError } from '../server/errors.js';
import { getUploadsDir } from '../../runtime-paths.js';

/**
 * Register dashboard HTTP routes.
 */
export function registerDashboardRoutes(hooks: HookRegistry, auth: AuthService, logger: LogService) {
    const avatarDir = join(getUploadsDir(), 'avatars');
    hooks.registerHttpRoute(async (ctx: HttpContext) => {
        const { path, method, req, res, session } = ctx;

        // All dashboard routes need login
        if (!session || !path.startsWith('/api/dashboard')) return false;

        // === Me ===
        if (path === '/api/dashboard/me' && method === 'GET') {
            try {
                const user = await auth.getUserById(session.userId);
                sendJson(res, 200, { user }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to load dashboard profile.' });
            }
            return true;
        }

        // === Agents ===
        if (path === '/api/dashboard/agents' && method === 'GET') {
            const agents = await auth.getAgentsByUser(session.userId);
            sendJson(res, 200, { agents }, req);
            return true;
        }

        if (path === '/api/dashboard/agents' && method === 'POST') {
            const { name } = await parseBody(req);
            if (!name) {
                sendError(res, 400, { error: 'Please provide a name.', code: CORE_ERROR_CODES.BAD_REQUEST }, req);
                return true;
            }
            const agent = await auth.createAgent(session.userId, name);
            sendJson(res, 201, { agent }, req);
            return true;
        }

        if (path.match(/^\/api\/dashboard\/agents\/[\w-]+$/) && method === 'DELETE') {
            const agentId = path.split('/').pop()!;
            try {
                await auth.deleteAgent(agentId, session.userId);
                sendJson(res, 200, { success: true }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to delete agent.' });
            }
            return true;
        }

        if (path.match(/^\/api\/dashboard\/agents\/[\w-]+$/) && method === 'PATCH') {
            const agentId = path.split('/').pop()!;
            const body = await parseBody(req);
            try {
                if (body.trustMode) {
                    if (body.trustMode !== 'confirm' && body.trustMode !== 'full') {
                        sendError(res, 400, { error: 'trustMode must be confirm or full.', code: CORE_ERROR_CODES.BAD_REQUEST }, req);
                        return true;
                    }
                    await auth.updateAgentTrustMode(agentId, session.userId, body.trustMode);
                }
                const editFields: { name?: string; description?: string; searchable?: number } = {};
                if (body.name !== undefined) editFields.name = body.name;
                if (body.description !== undefined) editFields.description = body.description;
                if (body.searchable !== undefined) editFields.searchable = body.searchable ? 1 : 0;
                if (Object.keys(editFields).length > 0) {
                    await auth.updateAgent(agentId, session.userId, editFields);
                }
                sendJson(res, 200, { success: true }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to update agent.' });
            }
            return true;
        }

        // Avatar upload
        const avatarMatch = path.match(/^\/api\/dashboard\/agents\/([\w-]+)\/avatar$/);
        if (avatarMatch && method === 'POST') {
            const agentId = avatarMatch[1];
            try {
                const agents = await auth.getAgentsByUser(session.userId);
                if (!agents.find(a => a.id === agentId)) {
                    sendError(res, 403, { error: 'You do not have access to this agent.', code: CORE_ERROR_CODES.FORBIDDEN }, req);
                    return true;
                }
                const { data, ext } = await parseMultipartImage(req);
                await mkdir(avatarDir, { recursive: true });
                const filename = `${agentId}.${ext}`;
                await writeFile(join(avatarDir, filename), data);
                const avatarPath = `/uploads/avatars/${filename}`;
                await auth.updateAgent(agentId, session.userId, { avatarPath });
                sendJson(res, 200, { avatarPath }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to upload avatar.' });
            }
            return true;
        }

        // Location admission
        const locationMatch = path.match(/^\/api\/dashboard\/agents\/([\w-]+)\/locations$/);
        if (locationMatch && method === 'GET') {
            try {
                const locations = await auth.getAgentLocations(locationMatch[1], session.userId);
                sendJson(res, 200, { allowedLocations: locations }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to load allowed locations.' });
            }
            return true;
        }
        if (locationMatch && method === 'PATCH') {
            const { allowedLocations } = await parseBody(req);
            if (!Array.isArray(allowedLocations)) {
                sendError(res, 400, { error: 'allowedLocations must be an array.', code: CORE_ERROR_CODES.BAD_REQUEST }, req);
                return true;
            }
            try {
                await auth.updateAgentLocations(locationMatch[1], session.userId, allowedLocations);
                sendJson(res, 200, { success: true }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to update allowed locations.' });
            }
            return true;
        }

        // Logs
        if (path === '/api/dashboard/logs' && method === 'GET') {
            const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
            const agentId = url.searchParams.get('agentId') ?? undefined;
            const logs = await logger.query({ userId: session.userId, agentId, limit: 100 });
            sendJson(res, 200, { logs }, req);
            return true;
        }

        return false;
    });
}

// === Helpers ===

const ALLOWED_IMAGE_EXTS = new Set(['png', 'jpg', 'jpeg', 'gif', 'webp']);
const MAX_AVATAR_SIZE = 500 * 1024;

async function parseMultipartImage(req: IncomingMessage): Promise<{ data: Buffer; ext: string }> {
    const contentType = req.headers['content-type'] ?? '';
    if (!contentType.includes('multipart/form-data')) {
        throw new AppError({ status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Expected multipart/form-data' });
    }
    const boundaryMatch = contentType.match(/boundary=(.+)/);
    if (!boundaryMatch) throw new AppError({ status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Missing boundary' });
    const boundary = boundaryMatch[1];

    const chunks: Buffer[] = [];
    let totalSize = 0;
    for await (const chunk of req) {
        totalSize += (chunk as Buffer).length;
        if (totalSize > MAX_AVATAR_SIZE + 1024) {
            throw new AppError({ status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'File size exceeds 500KB' });
        }
        chunks.push(chunk as Buffer);
    }
    const body = Buffer.concat(chunks);
    const boundaryBuf = Buffer.from(`--${boundary}`);

    const boundaryIdx = body.indexOf(boundaryBuf);
    if (boundaryIdx === -1) throw new AppError({ status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Invalid upload data: missing boundary' });
    let start = boundaryIdx + boundaryBuf.length;
    const headerEnd = body.indexOf(Buffer.from('\r\n\r\n'), start);
    if (headerEnd === -1) throw new AppError({ status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Invalid upload data' });
    const headers = body.subarray(start, headerEnd).toString();

    const filenameMatch = headers.match(/filename="([^"]+)"/);
    if (!filenameMatch) throw new AppError({ status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Missing file' });
    const ext = filenameMatch[1].split('.').pop()?.toLowerCase() ?? '';
    if (!ALLOWED_IMAGE_EXTS.has(ext)) {
        throw new AppError({ status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Only png/jpg/jpeg/gif/webp files are supported' });
    }

    const dataStart = headerEnd + 4;
    const nextBoundary = body.indexOf(boundaryBuf, dataStart);
    const dataEnd = nextBoundary !== -1 ? nextBoundary - 2 : body.length;
    const data = body.subarray(dataStart, dataEnd);
    if (data.length > MAX_AVATAR_SIZE) {
        throw new AppError({ status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'File size exceeds 500KB' });
    }

    return { data, ext };
}
