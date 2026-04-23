/**
 * Public Auth HTTP Routes — self-registered via HookRegistry.
 *
 * Covers: send-registration-code, register, login, verify-email, resend-code, OAuth, change-password
 * No login required (except change-password).
 */

import type { IncomingMessage } from 'http';
import type { HookRegistry, HttpContext } from '../plugin-system/hook-registry.js';
import type { AuthService } from './service.js';
import { clearAuthSessionCookie, parseBody, sendError, sendJson, setAuthSessionCookie, signToken } from '../server/middleware.js';
import { CORE_ERROR_CODES, resolveError, sendHttpError } from '../server/errors.js';
import { getClientIp } from '../server/security.js';
import { getRedirectUrl, exchangeCode, verifyState } from './oauth.js';
import { assertEmail } from '../../utils/validate.js';

// Per-email+IP rate limiter for verification code resend (max 3 per 10 minutes)
const resendLimiter = new Map<string, number[]>();
const RESEND_MAX = 3;
const RESEND_WINDOW = 10 * 60 * 1000;

function checkResendLimit(key: string): boolean {
    const now = Date.now();
    let timestamps = resendLimiter.get(key);
    if (!timestamps) { timestamps = []; resendLimiter.set(key, timestamps); }
    while (timestamps.length > 0 && now - timestamps[0] > RESEND_WINDOW) timestamps.shift();
    if (timestamps.length >= RESEND_MAX) return false;
    timestamps.push(now);
    return true;
}

setInterval(() => {
    const now = Date.now();
    for (const [k, ts] of resendLimiter) {
        while (ts.length > 0 && now - ts[0] > RESEND_WINDOW) ts.shift();
        if (ts.length === 0) resendLimiter.delete(k);
    }
}, 600_000);

function redirectWithError(res: any, code: string, error: string): void {
    res.writeHead(302, { Location: `/login?error=${encodeURIComponent(error)}&code=${encodeURIComponent(code)}` });
    res.end();
}

/**
 * Register public auth HTTP routes.
 */
export function registerAuthRoutes(hooks: HookRegistry, auth: AuthService) {
    hooks.registerHttpRoute(async (ctx: HttpContext) => {
        const { path, method, req, res, session } = ctx;

        if (path === '/api/auth/send-registration-code' && method === 'POST') {
            if (process.env.ALLOW_REGISTER !== 'true') {
                sendError(res, 403, { error: 'Registration is disabled. Contact an administrator.', code: CORE_ERROR_CODES.FORBIDDEN }, req);
                return true;
            }
            const { email } = await parseBody(req);
            if (!email) {
                sendError(res, 400, { error: 'Please provide email.', code: CORE_ERROR_CODES.BAD_REQUEST }, req);
                return true;
            }
            try {
                const validatedEmail = assertEmail(email);
                const limitKey = `${validatedEmail}:${getClientIp(req)}`;
                if (checkResendLimit(limitKey)) {
                    await auth.sendRegistrationCode(validatedEmail);
                }
                sendJson(res, 200, { success: true }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to send registration code.' });
            }
            return true;
        }

        if (path === '/api/auth/register' && method === 'POST') {
            if (process.env.ALLOW_REGISTER !== 'true') {
                sendError(res, 403, { error: 'Registration is disabled. Contact an administrator.', code: CORE_ERROR_CODES.FORBIDDEN }, req);
                return true;
            }
            const { username, email, password, code } = await parseBody(req);
            if (!username || !email || !password || !code) {
                sendError(res, 400, { error: 'Please provide username, email, password, and verification code.', code: CORE_ERROR_CODES.BAD_REQUEST }, req);
                return true;
            }
            try {
                const user = await auth.finalizeRegistration(username, email, password, code);
                const token = signToken(user.id, user.role);
                setAuthSessionCookie(res, req, token);
                sendJson(res, 201, { user }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Registration failed.' });
            }
            return true;
        }

        if (path === '/api/auth/verify-email' && method === 'POST') {
            const { email, code } = await parseBody(req);
            if (!email || !code) {
                sendError(res, 400, { error: 'Please provide email and verification code.', code: CORE_ERROR_CODES.BAD_REQUEST }, req);
                return true;
            }
            try {
                const user = await auth.verifyEmail(email, code);
                const token = signToken(user.id, user.role);
                setAuthSessionCookie(res, req, token);
                sendJson(res, 200, { user }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Email verification failed.' });
            }
            return true;
        }

        if (path === '/api/auth/resend-code' && method === 'POST') {
            const { email } = await parseBody(req);
            if (!email) {
                sendError(res, 400, { error: 'Please provide email.', code: CORE_ERROR_CODES.BAD_REQUEST }, req);
                return true;
            }
            let validatedEmail: string;
            try {
                validatedEmail = assertEmail(email);
            } catch (error) {
                sendHttpError(res, req, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Please provide a valid email address.' });
                return true;
            }

            try {
                const shouldSend = await auth.shouldSendVerificationCode(validatedEmail);
                if (!shouldSend) {
                    sendJson(res, 200, { success: true }, req);
                    return true;
                }

                const limitKey = `${validatedEmail}:${getClientIp(req)}`;
                if (checkResendLimit(limitKey)) {
                    await auth.resendCode(validatedEmail);
                }
                sendJson(res, 200, { success: true }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to resend verification code.' });
            }
            return true;
        }

        if (path === '/api/auth/login' && method === 'POST') {
            const { username, password } = await parseBody(req);
            if (!username || !password) {
                sendError(res, 400, { error: 'Please provide username and password.', code: CORE_ERROR_CODES.BAD_REQUEST }, req);
                return true;
            }
            try {
                const user = await auth.login(username, password);
                const token = signToken(user.id, user.role);
                setAuthSessionCookie(res, req, token);
                sendJson(res, 200, { user }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 401, code: CORE_ERROR_CODES.INVALID_CREDENTIALS, error: 'Authentication failed.' });
            }
            return true;
        }

        if (path === '/api/auth/logout' && method === 'POST') {
            clearAuthSessionCookie(res, req);
            sendJson(res, 200, { success: true }, req);
            return true;
        }

        if (path === '/api/auth/change-password' && method === 'POST') {
            if (!session) {
                sendError(res, 401, { error: 'Please log in first.', code: CORE_ERROR_CODES.UNAUTHORIZED, action: 'login' }, req);
                return true;
            }
            const { oldPassword, newPassword } = await parseBody(req);
            if (!oldPassword || !newPassword) {
                sendError(res, 400, { error: 'Please provide your current password and new password.', code: CORE_ERROR_CODES.BAD_REQUEST }, req);
                return true;
            }
            try {
                await auth.changePassword(session.userId, oldPassword, newPassword);
                sendJson(res, 200, { success: true }, req);
            } catch (error) {
                sendHttpError(res, req, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to change password.' });
            }
            return true;
        }

        // === OAuth ===

        if (path === '/api/auth/oauth/google' && method === 'GET') {
            res.writeHead(302, { Location: getRedirectUrl('google') });
            res.end();
            return true;
        }
        if (path === '/api/auth/oauth/github' && method === 'GET') {
            res.writeHead(302, { Location: getRedirectUrl('github') });
            res.end();
            return true;
        }
        if (path === '/api/auth/callback/google' && method === 'GET') {
            return handleOAuthCallback(req, res, auth, 'google');
        }
        if (path === '/api/auth/callback/github' && method === 'GET') {
            return handleOAuthCallback(req, res, auth, 'github');
        }

        return false;
    });
}

// === OAuth callback helper ===

async function handleOAuthCallback(req: IncomingMessage, res: any, auth: AuthService, provider: 'google' | 'github'): Promise<true> {
    const url = new URL(req.url ?? '/', `http://${req.headers.host}`);
    const code = url.searchParams.get('code');
    const state = url.searchParams.get('state');
    if (!code) {
        sendError(res, 400, { error: 'Missing authorization code.', code: CORE_ERROR_CODES.BAD_REQUEST }, req);
        return true;
    }
    if (!verifyState(state)) {
        redirectWithError(res, CORE_ERROR_CODES.OAUTH_STATE_INVALID, 'Invalid OAuth state parameter.');
        return true;
    }
    try {
        const info = await exchangeCode(provider, code);
        const user = await auth.findOrCreateOAuthUser(info.provider, info.providerId, info.email, info.name);
        const token = signToken(user.id, user.role);
        setAuthSessionCookie(res, req, token);
        res.writeHead(302, { Location: '/auth/callback' });
        res.end();
    } catch (error) {
        const resolved = resolveError(error, {
            status: 502,
            code: CORE_ERROR_CODES.OAUTH_EXCHANGE_FAILED,
            error: 'OAuth sign-in failed.',
        });
        redirectWithError(res, resolved.payload.code, resolved.payload.error);
    }
    return true;
}
