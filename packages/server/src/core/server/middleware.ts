import { IncomingMessage, ServerResponse } from 'http';
import { randomBytes } from 'crypto';
import jwt from 'jsonwebtoken';

import { isHttpsRequest, setSecurityHeaders, setCorsHeaders, parseBodyLimited } from './security.js';

interface JwtSecretState {
  value: string;
  source: 'env' | 'ephemeral';
}

let jwtSecretState: JwtSecretState | null = null;
let jwtWarningEmitted = false;

function resolveJwtSecret(options: {
  runtime?: boolean;
  envPath?: string;
} = {}): string {
  const configuredSecret = process.env.JWT_SECRET?.trim();
  if (configuredSecret) {
    jwtSecretState = {
      value: configuredSecret,
      source: 'env',
    };
    return configuredSecret;
  }

  if (options.runtime && process.env.NODE_ENV === 'production') {
    throw new Error(`JWT_SECRET must be set in production. Active env: ${options.envPath ?? '(unknown env path)'}`);
  }

  if (!jwtSecretState || jwtSecretState.source !== 'ephemeral') {
    jwtSecretState = {
      value: randomBytes(32).toString('hex'),
      source: 'ephemeral',
    };
  }

  if (options.runtime && !jwtWarningEmitted) {
    console.warn(`[WARN] JWT_SECRET not set in ${options.envPath ?? 'the active env'}, generating an ephemeral secret. Set JWT_SECRET for stable sessions.`);
    jwtWarningEmitted = true;
  }

  return jwtSecretState.value;
}

export function initializeJwtSecretRuntime(options: { envPath?: string } = {}): void {
  resolveJwtSecret({
    runtime: true,
    envPath: options.envPath,
  });
}

function getJwtSecret(): string {
  return resolveJwtSecret();
}

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
  return jwt.sign({ userId, role }, getJwtSecret(), { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string; role: string } | null {
  try { return jwt.verify(token, getJwtSecret()) as any; }
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
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
}

export function sendError(
  res: ServerResponse, status: number,
  opts: {
    error: string;
    text?: string;
    code: string;
    retryable?: boolean;
    action?: string;
    nextAction?: string;
    details?: Record<string, unknown>;
  },
  req?: IncomingMessage,
) {
  const nextAction = opts.nextAction ?? opts.action;
  sendJson(res, status, {
    ...opts,
    text: opts.text ?? opts.error,
    ...(nextAction !== undefined ? { nextAction } : {}),
  }, req);
}

export function getAuthUser(req: IncomingMessage): { userId: string; role: string } | null {
  const auth = req.headers.authorization;
  if (auth?.startsWith('Bearer ')) {
    return verifyToken(auth.slice(7)) ?? getCookieAuthUser(req);
  }
  return getCookieAuthUser(req);
}

export function getBearerToken(req: IncomingMessage): string | null {
  const auth = req.headers.authorization;
  if (!auth?.startsWith('Bearer ')) return null;
  return auth.slice(7);
}
