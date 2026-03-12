import { nanoid } from 'nanoid';

function env() {
    return {
        GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID ?? '',
        GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET ?? '',
        GITHUB_CLIENT_ID: process.env.GITHUB_CLIENT_ID ?? '',
        GITHUB_CLIENT_SECRET: process.env.GITHUB_CLIENT_SECRET ?? '',
        BASE_URL: process.env.BASE_URL ?? 'http://localhost:3000',
    };
}

interface OAuthUserInfo {
    provider: 'google' | 'github';
    providerId: string;
    email: string;
    name: string;
}

// === CSRF state store (TTL 10 minutes, max 1000 entries) ===
const stateStore = new Map<string, number>();
const STATE_TTL = 10 * 60 * 1000;
const MAX_STATE_STORE = 1000;

setInterval(() => {
    const now = Date.now();
    for (const [k, ts] of stateStore) {
        if (now - ts > STATE_TTL) stateStore.delete(k);
    }
}, 60_000);

function generateState(): string {
    if (stateStore.size >= MAX_STATE_STORE) {
        // Evict oldest entry
        const oldest = stateStore.keys().next().value!;
        stateStore.delete(oldest);
    }
    const state = nanoid(32);
    stateStore.set(state, Date.now());
    return state;
}

export function verifyState(state: string | null): boolean {
    if (!state) return false;
    const ts = stateStore.get(state);
    if (!ts) return false;
    stateStore.delete(state);
    return Date.now() - ts < STATE_TTL;
}

export function getRedirectUrl(provider: 'google' | 'github'): string {
    const e = env();
    const state = generateState();
    if (provider === 'google') {
        const params = new URLSearchParams({
            client_id: e.GOOGLE_CLIENT_ID,
            redirect_uri: `${e.BASE_URL}/api/auth/callback/google`,
            response_type: 'code',
            scope: 'openid email profile',
            state,
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${params}`;
    }
    const params = new URLSearchParams({
        client_id: e.GITHUB_CLIENT_ID,
        redirect_uri: `${e.BASE_URL}/api/auth/callback/github`,
        scope: 'user:email',
        state,
    });
    return `https://github.com/login/oauth/authorize?${params}`;
}

export async function exchangeCode(provider: 'google' | 'github', code: string): Promise<OAuthUserInfo> {
    if (provider === 'google') return exchangeGoogle(code);
    return exchangeGithub(code);
}

async function exchangeGoogle(code: string): Promise<OAuthUserInfo> {
    const e = env();
    const tokenRes = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            code,
            client_id: e.GOOGLE_CLIENT_ID,
            client_secret: e.GOOGLE_CLIENT_SECRET,
            redirect_uri: `${e.BASE_URL}/api/auth/callback/google`,
            grant_type: 'authorization_code',
        }),
    });
    if (!tokenRes.ok) throw new Error('Google token exchange failed');
    const { access_token } = await tokenRes.json() as { access_token: string };

    const userRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
        headers: { Authorization: `Bearer ${access_token}` },
    });
    if (!userRes.ok) throw new Error('Google userinfo failed');
    const profile = await userRes.json() as { id: string; email: string; name: string };
    return { provider: 'google', providerId: profile.id, email: profile.email, name: profile.name };
}

async function exchangeGithub(code: string): Promise<OAuthUserInfo> {
    const e = env();
    const tokenRes = await fetch('https://github.com/login/oauth/access_token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({
            code,
            client_id: e.GITHUB_CLIENT_ID,
            client_secret: e.GITHUB_CLIENT_SECRET,
        }),
    });
    if (!tokenRes.ok) throw new Error('GitHub token exchange failed');
    const { access_token } = await tokenRes.json() as { access_token: string };

    const userRes = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': 'Uruc' },
    });
    if (!userRes.ok) throw new Error('GitHub user fetch failed');
    const profile = await userRes.json() as { id: number; login: string; email: string | null };

    let email = profile.email;
    if (!email) {
        const emailRes = await fetch('https://api.github.com/user/emails', {
            headers: { Authorization: `Bearer ${access_token}`, 'User-Agent': 'Uruc' },
        });
        if (emailRes.ok) {
            const emails = await emailRes.json() as Array<{ email: string; primary: boolean }>;
            email = emails.find(e => e.primary)?.email ?? emails[0]?.email ?? null;
        }
    }
    if (!email) throw new Error('GitHub account does not have an available email address');

    return { provider: 'github', providerId: String(profile.id), email, name: profile.login };
}
