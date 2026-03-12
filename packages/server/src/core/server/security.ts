import { IncomingMessage, ServerResponse } from 'http';
import type { TLSSocket } from 'tls';

// === Security response headers ===

const SECURITY_HEADERS: Record<string, string> = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0',
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self' ws: wss:; font-src 'self'; object-src 'none'; frame-ancestors 'none'",
};
const HSTS_HEADER = 'max-age=31536000; includeSubDomains';

export function isHttpsRequest(req?: IncomingMessage): boolean {
  if (!req) return false;
  const forwardedProto = req.headers['x-forwarded-proto']?.toString().split(',')[0]?.trim().toLowerCase();
  if (forwardedProto === 'https') return true;
  return (req.socket as TLSSocket).encrypted === true;
}

export function setSecurityHeaders(res: ServerResponse, req?: IncomingMessage) {
  for (const [k, v] of Object.entries(SECURITY_HEADERS)) {
    res.setHeader(k, v);
  }
  if (process.env.ENABLE_HSTS === 'true' && isHttpsRequest(req)) {
    res.setHeader('Strict-Transport-Security', HSTS_HEADER);
  }
}

// === Dynamic CORS ===

const allowedOrigins: Set<string> = new Set(
  (process.env.ALLOWED_ORIGINS || 'http://localhost:5173,http://localhost:3000')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean)
);

export function setCorsHeaders(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  if (origin && allowedOrigins.has(origin)) {
    res.setHeader('Access-Control-Allow-Origin', origin);
    res.setHeader('Vary', 'Origin');
  }
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PATCH, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export function getClientIp(req: IncomingMessage): string {
  const trustProxy = process.env.TRUST_PROXY !== 'false';
  const forwarded = trustProxy ? req.headers['x-forwarded-for']?.toString().split(',')[0]?.trim() : undefined;
  return forwarded || req.socket.remoteAddress || 'unknown';
}

// === Request body size limiter ===

const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB

export function parseBodyLimited(req: IncomingMessage, maxSize = MAX_BODY_SIZE): Promise<any> {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    req.on('data', (chunk: Buffer | string) => {
      size += typeof chunk === 'string' ? Buffer.byteLength(chunk) : chunk.length;
      if (size > maxSize) {
        req.destroy();
        return reject(Object.assign(new Error('Request body is too large'), { statusCode: 413 }));
      }
      body += chunk;
    });
    req.on('end', () => {
      try { resolve(body ? JSON.parse(body) : {}); }
      catch { reject(Object.assign(new Error('Invalid JSON'), { statusCode: 400 })); }
    });
    req.on('error', reject);
  });
}

// === Banned user guard with TTL cache ===

interface BanCacheEntry { banned: boolean; ts: number }
const banCache = new Map<string, BanCacheEntry>();
const BAN_CACHE_TTL = 60_000; // 60s

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [k, v] of banCache) {
    if (now - v.ts > BAN_CACHE_TTL) banCache.delete(k);
  }
}, 300_000);

type BanChecker = (userId: string) => Promise<boolean>;

export function createBannedUserGuard(checkBanned: BanChecker) {
  return async function isBanned(userId: string): Promise<boolean> {
    const cached = banCache.get(userId);
    if (cached && Date.now() - cached.ts < BAN_CACHE_TTL) return cached.banned;
    const banned = await checkBanned(userId);
    banCache.set(userId, { banned, ts: Date.now() });
    return banned;
  };
}


// === Operational error detection ===

const KNOWN_ERROR_PREFIXES = [
  'User', 'Username', 'Password', 'Email', 'Verification', 'Please', 'This', 'Only',
  'Invalid', 'Missing', 'Expected', 'File', 'Allowed', 'Access', 'Request',
  'Location', 'Agent', 'Account', 'Current', 'Admin', 'Too many', 'Your',
  '用户', '密码', '邮箱', '验证码', '请先', '该', '不能', '无效', '需要',
  '场所', '地点', '账号', '操作', '请填写', '仅支持', '文件', '允许', '超过', '缺少', '无权',
];

export function isOperationalError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const msg = err.message;
  return KNOWN_ERROR_PREFIXES.some(p => msg.startsWith(p)) || msg.length < 80;
}
