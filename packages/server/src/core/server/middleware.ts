import { IncomingMessage, ServerResponse } from 'http';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';
import { isHttpsRequest, setSecurityHeaders, setCorsHeaders, parseBodyLimited } from './security.js';

// === JWT secret enforcement ===
if (!process.env.JWT_SECRET) {
  if (process.env.NODE_ENV === 'production') {
    console.error('[FATAL] JWT_SECRET must be set in production. Exiting.');
    process.exit(1);
  }
  console.warn('[WARN] JWT_SECRET not set, generating ephemeral secret. Set JWT_SECRET in .env for production.');
}
const JWT_SECRET = process.env.JWT_SECRET ?? randomBytes(32).toString('hex');
export const OWNER_SESSION_COOKIE = 'uruc_owner_session';
const OWNER_SESSION_TTL_SECONDS = 7 * 24 * 60 * 60;

function parseCookies(cookieHeader?: string): Record<string, string> {
  if (!cookieHeader) return {};
  return cookieHeader.split(';').reduce<Record<string, string>>((acc, part) => {
    const [rawName, ...rawValue] = part.trim().split('=');
    if (!rawName) return acc;
    acc[rawName] = decodeURIComponent(rawValue.join('='));
    return acc;
  }, {});
}

function buildSessionCookie(token: string, req?: IncomingMessage, maxAge = OWNER_SESSION_TTL_SECONDS): string {
  const parts = [
    `${OWNER_SESSION_COOKIE}=${encodeURIComponent(token)}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${maxAge}`,
  ];
  if (maxAge === 0) {
    parts.push('Expires=Thu, 01 Jan 1970 00:00:00 GMT');
  }
  if (isHttpsRequest(req)) {
    parts.push('Secure');
  }
  return parts.join('; ');
}

export function parseBody(req: IncomingMessage): Promise<any> {
  return parseBodyLimited(req);
}

export function signToken(userId: string, role: string): string {
  return jwt.sign({ userId, role }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string; role: string } | null {
  try { return jwt.verify(token, JWT_SECRET) as any; }
  catch { return null; }
}

export function getCookieAuthUser(req: IncomingMessage): { userId: string; role: string } | null {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[OWNER_SESSION_COOKIE];
  if (!token) return null;
  return verifyToken(token);
}

export function setAuthSessionCookie(res: ServerResponse, req: IncomingMessage, token: string): void {
  res.setHeader('Set-Cookie', buildSessionCookie(token, req));
}

export function clearAuthSessionCookie(res: ServerResponse, req?: IncomingMessage): void {
  res.setHeader('Set-Cookie', buildSessionCookie('', req, 0));
}

export function sendJson(res: ServerResponse, status: number, data: any, req?: IncomingMessage) {
  setSecurityHeaders(res, req);
  if (req) {
    setCorsHeaders(req, res);
  }
  // When req is not available, skip CORS headers — same-origin requests don't need them.
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

/**
 * Send a standardized error response with machine-readable code.
 * Use this for all HTTP error responses to ensure consistent format for agent clients.
 */
export function sendError(
  res: ServerResponse, status: number,
  opts: { error: string; code: string; retryable?: boolean; action?: string; details?: Record<string, unknown> },
  req?: IncomingMessage,
) {
  sendJson(res, status, opts, req);
}

export function getAuthUser(req: IncomingMessage): { userId: string; role: string } | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return verifyToken(auth.slice(7)) ?? getCookieAuthUser(req);
  }
  return getCookieAuthUser(req);
}
