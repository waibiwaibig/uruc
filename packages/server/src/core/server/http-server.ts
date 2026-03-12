/**
 * HTTP Server — Pure Framework.
 *
 * Responsibilities:
 * - Create HTTP server
 * - CORS, security headers
 * - Rate limiting (auth + API)
 * - Basic auth gate (SITE_PASSWORD)
 * - Static file serving (public dir, uploads, SPA fallback)
 * - Framework routes: /api/health
 * - Route delegation: ALL business routes handled via hooks.handleHttpRequest()
 *
 * This file has ZERO business routes.
 * Auth, Dashboard, Admin routes are registered by core/auth/routes.ts and core/admin/routes.ts.
 * Plugin routes are registered by each plugin.
 */

import { createServer, IncomingMessage, ServerResponse } from 'http';
import { timingSafeEqual } from 'crypto';
import { readFile } from 'fs/promises';
import { join, extname, resolve } from 'path';

import { sendJson, sendError, getAuthUser } from './middleware.js';
import { codeForStatus, isAppError, sendHttpError } from './errors.js';
import { getClientIp, isOperationalError, setSecurityHeaders, setCorsHeaders } from './security.js';
import { getPublicDir, getUploadsDir } from '../../runtime-paths.js';

import type { HookRegistry, HttpContext } from '../plugin-system/hook-registry.js';
import type { ServiceRegistry } from '../plugin-system/service-registry.js';
import type { PluginLoader } from '../plugin-system/loader.js';
import type { AuthService } from '../auth/service.js';

// === MIME types ===

const MIME_TYPES: Record<string, string> = {
  '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
  '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.gif': 'image/gif', '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf',
};

function normalizeAppBasePath(raw: string | undefined): string {
  const trimmed = raw?.trim() ?? '';
  if (trimmed === '' || trimmed === '/') return '';
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
  return withLeadingSlash.replace(/\/+$/, '');
}

function resolveStaticRequestPath(requestPath: string, appBasePath: string): string | null {
  if (appBasePath === '') return requestPath;
  if (requestPath === appBasePath || requestPath === `${appBasePath}/`) return '/';
  if (!requestPath.startsWith(`${appBasePath}/`)) return null;
  return requestPath.slice(appBasePath.length);
}

// === Rate limiter ===

const rateBuckets = new Map<string, number[]>();
const MAX_RATE_BUCKETS = 10000;

function checkRateLimit(key: string, maxPerMin: number): boolean {
  const now = Date.now();
  let timestamps = rateBuckets.get(key);
  if (!timestamps) {
    if (rateBuckets.size >= MAX_RATE_BUCKETS) {
      // Evict oldest entry instead of rejecting
      const oldest = rateBuckets.keys().next().value!;
      rateBuckets.delete(oldest);
    }
    timestamps = []; rateBuckets.set(key, timestamps);
  }
  while (timestamps.length > 0 && now - timestamps[0] > 60000) timestamps.shift();
  if (timestamps.length >= maxPerMin) return false;
  timestamps.push(now);
  return true;
}

setInterval(() => {
  const now = Date.now();
  for (const [key, timestamps] of rateBuckets) {
    while (timestamps.length > 0 && now - timestamps[0] > 60000) timestamps.shift();
    if (timestamps.length === 0) rateBuckets.delete(key);
  }
}, 300000);

// === Framework deps ===

interface FrameworkDeps {
  auth: AuthService;
  hooks: HookRegistry;
  services: ServiceRegistry;
  loader?: PluginLoader;
}

// === Server ===

export function createHttpServer(deps: FrameworkDeps) {
  const { hooks, services } = deps;
  const uploadsDir = getUploadsDir();
  const publicDir = getPublicDir();

  const server = createServer(async (req, res) => {
    if (req.method === 'OPTIONS') {
      setCorsHeaders(req, res);
      res.writeHead(204);
      res.end();
      return;
    }
    try {
      await handleRequest(req, res, deps, uploadsDir, publicDir);
    } catch (e: any) {
      const status = e?.status ?? e?.statusCode ?? 500;
      if (!isAppError(e) && !isOperationalError(e)) console.error('[HTTP] Unhandled error:', e);
      sendHttpError(res, req, e, {
        status,
        code: codeForStatus(status),
        error: status >= 500 ? 'Internal server error' : 'Request failed.',
      });
    }
  });
  return server;
}

// === Request handler ===

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  deps: FrameworkDeps,
  uploadsDir: string,
  publicDir: string,
) {
  const { hooks, services, auth } = deps;
  const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
  const path = url.pathname;
  const method = req.method ?? 'GET';
  const appBasePath = normalizeAppBasePath(process.env.APP_BASE_PATH);
  const staticRequestPath = resolveStaticRequestPath(path, appBasePath);

  // === Basic Auth gate for non-API routes (site password) ===
  const sitePassword = process.env.SITE_PASSWORD;
  if (sitePassword && !path.startsWith('/api')) {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Basic ')) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Uruc"', 'Content-Type': 'text/plain' });
      res.end('Unauthorized');
      return;
    }
    const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
    const colonIdx = decoded.indexOf(':');
    const pwd = colonIdx === -1 ? '' : decoded.slice(colonIdx + 1);
    const pwdBuf = Buffer.from(pwd);
    const expectedBuf = Buffer.from(sitePassword);
    if (pwdBuf.length !== expectedBuf.length || !timingSafeEqual(pwdBuf, expectedBuf)) {
      res.writeHead(401, { 'WWW-Authenticate': 'Basic realm="Uruc"', 'Content-Type': 'text/plain' });
      res.end('Unauthorized');
      return;
    }
  }

  // === Auth rate limit ===
  // Default: trust x-forwarded-for (nginx reverse proxy is the standard deployment).
  // Set TRUST_PROXY=false only when the server is directly exposed without a reverse proxy.
  const clientIp = getClientIp(req);
  if (path.startsWith('/api/auth/')) {
    if (!checkRateLimit(`auth:${clientIp}`, 10)) {
      return sendError(res, 429, { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED', retryable: true }, req);
    }
  }

  // === Framework: Health ===
  if (path === '/api/health' && method === 'GET') {
    return sendJson(res, 200, {
      status: 'ok',
      plugins: deps.loader?.listPlugins().map(p => ({ name: p.name, version: p.version, started: p.started })) ?? [],
      pluginDiagnostics: deps.loader?.getPluginDiagnostics() ?? [],
      services: services.list(),
    }, req);
  }

  // === Static uploads serving ===
  if (path.startsWith('/uploads/')) {
    const filePath = resolve(uploadsDir, path.replace('/uploads/', ''));
    if (!filePath.startsWith(uploadsDir)) return sendError(res, 403, { error: 'Forbidden', code: 'FORBIDDEN' }, req);
    try {
      const data = await readFile(filePath);
      const ext = extname(filePath);
      setSecurityHeaders(res, req);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream', 'Cache-Control': 'public, max-age=86400' });
      res.end(data);
      return;
    } catch {
      return sendError(res, 404, { error: 'File not found', code: 'NOT_FOUND' }, req);
    }
  }

  // === Static file serving + SPA fallback ===
  if (!path.startsWith('/api')) {
    if (appBasePath !== '' && path === '/') {
      setSecurityHeaders(res, req);
      res.writeHead(302, { Location: appBasePath });
      res.end();
      return;
    }
    if (staticRequestPath === null) {
      return sendError(res, 404, { error: 'Page not found', code: 'NOT_FOUND' }, req);
    }
    if (staticRequestPath === '/favicon.ico') {
      setSecurityHeaders(res, req);
      res.writeHead(204);
      res.end();
      return;
    }
    const filePath = resolve(publicDir, (staticRequestPath === '/' ? 'index.html' : staticRequestPath).replace(/^\//, ''));
    if (!filePath.startsWith(publicDir)) return sendError(res, 403, { error: 'Forbidden', code: 'FORBIDDEN' }, req);
    try {
      const data = await readFile(filePath);
      setSecurityHeaders(res, req);
      res.writeHead(200, { 'Content-Type': MIME_TYPES[extname(filePath)] || 'application/octet-stream' });
      res.end(data);
      return;
    } catch {
      try {
        const indexData = await readFile(join(publicDir, 'index.html'));
        setSecurityHeaders(res, req);
        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end(indexData);
        return;
      } catch { /* No static files available */ }
    }
  }

  // === Try public routes (before auth gate) ===
  {
    const httpCtx = createHttpCtx(req, res, path, method, services);
    const handled = await hooks.handleHttpRequest(httpCtx);
    if (handled) return;
  }

  // === Auth gate — everything below requires login ===
  const user = getAuthUser(req);
  if (!user) return sendError(res, 401, { error: 'Please log in first.', code: 'UNAUTHORIZED', action: 'login' }, req);

  let persistedUser: Awaited<ReturnType<AuthService['getUserById']>>;
  try {
    persistedUser = await auth.getUserById(user.userId);
  } catch {
    return sendError(res, 401, { error: 'Your session has expired. Please log in again.', code: 'UNAUTHORIZED', action: 'login' }, req);
  }

  if (persistedUser.banned) {
    return sendError(res, 403, { error: 'Your account has been banned.', code: 'USER_BANNED' }, req);
  }

  if (!checkRateLimit(`api:${persistedUser.id}`, 120)) {
    return sendError(res, 429, { error: 'Too many requests. Please try again later.', code: 'RATE_LIMITED', retryable: true }, req);
  }

  // === Try authenticated routes (after auth gate) ===
  {
    const httpCtx = createHttpCtx(req, res, path, method, services, {
      userId: persistedUser.id,
      role: persistedUser.role,
    });
    const handled = await hooks.handleHttpRequest(httpCtx);
    if (handled) return;
  }

  sendError(res, 404, { error: 'Page not found', code: 'NOT_FOUND' }, req);
}

// === Helpers ===

function createHttpCtx(
  req: IncomingMessage,
  res: ServerResponse,
  path: string,
  method: string,
  services: ServiceRegistry,
  session?: { userId: string; role: string },
): HttpContext {
  return {
    req,
    res,
    path,
    method,
    session: session ? { userId: session.userId, role: session.role as 'owner' | 'agent' } : undefined,
    services: {
      tryGet: <T = unknown>(key: string) => services.tryGet(key as any) as T | undefined,
    },
  };
}
