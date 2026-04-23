import { eq, and, or } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { randomInt } from 'crypto';
import bcrypt from 'bcryptjs';
import { type UrucDb, schema } from '../database/index.js';
import type { AgentSession } from '../../types/index.js';
import { sendVerificationEmail } from './email.js';
import type { Agent, IAuthService } from './interface.js';
import { assertPassword } from '../../utils/validate.js';
import { AppError, CORE_ERROR_CODES } from '../server/errors.js';

const BCRYPT_ROUNDS = 12;

declare module '../plugin-system/service-registry.js' {
    interface ServiceMap {
        'auth': AuthService;
    }
}

function generateCode(): string {
    return String(randomInt(100000, 1000000));
}

function parseAllowedLocations(raw: string | null | undefined): string[] {
    try {
        return JSON.parse(raw ?? '[]') as string[];
    } catch {
        return [];
    }
}

/**
 * AuthService — Core authentication and user/agent management.
 *
 * This is a CORE service, always present, not a plugin.
 * It implements both IAuthService (user auth + agent management)
 * and IAdminService (admin operations).
 */
export class AuthService implements IAuthService {
    constructor(private db: UrucDb) { }

    // === User Authentication ===

    async sendRegistrationCode(email: string) {
        await this.cleanupLegacyUnverifiedRegistrations(email);
        const [existingEmail] = await this.db.select()
            .from(schema.users).where(eq(schema.users.email, email));
        if (existingEmail) throw new AppError({ status: 400, code: CORE_ERROR_CODES.EMAIL_TAKEN, error: 'Email is already registered' });

        const code = generateCode();
        const now = new Date();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await this.upsertPendingRegistration(email, code, expiresAt, now);
        await sendVerificationEmail(email, code);
    }

    async register(username: string, email: string, password: string) {
        const [existingUser] = await this.db.select()
            .from(schema.users).where(eq(schema.users.username, username));
        if (existingUser) throw new AppError({ status: 400, code: CORE_ERROR_CODES.USERNAME_TAKEN, error: 'Username is already taken' });

        const [existingEmail] = await this.db.select()
            .from(schema.users).where(eq(schema.users.email, email));
        if (existingEmail) throw new AppError({ status: 400, code: CORE_ERROR_CODES.EMAIL_TAKEN, error: 'Email is already registered' });

        this.assertStrongPassword(password);
        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const id = nanoid();
        const now = new Date();
        const code = generateCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await this.db.insert(schema.users).values({
            id, username, email, passwordHash, role: 'user',
            emailVerified: false, verificationCode: code, verificationCodeExpiresAt: expiresAt,
            createdAt: now,
        });
        try {
            await sendVerificationEmail(email, code);
        } catch (err) {
            await this.db.delete(schema.users).where(eq(schema.users.id, id));
            throw err;
        }
        await this.getOrCreateShadowAgent(id);
        return { id, username, email };
    }

    async finalizeRegistration(username: string, email: string, password: string, code: string) {
        await this.cleanupLegacyUnverifiedRegistrations(email, username);

        const [existingUser] = await this.db.select()
            .from(schema.users).where(eq(schema.users.username, username));
        if (existingUser) throw new AppError({ status: 400, code: CORE_ERROR_CODES.USERNAME_TAKEN, error: 'Username is already taken' });

        const [existingEmail] = await this.db.select()
            .from(schema.users).where(eq(schema.users.email, email));
        if (existingEmail) throw new AppError({ status: 400, code: CORE_ERROR_CODES.EMAIL_TAKEN, error: 'Email is already registered' });

        this.assertStrongPassword(password);

        const [pending] = await this.db.select()
            .from(schema.pendingRegistrations).where(eq(schema.pendingRegistrations.email, email));
        if (!pending || pending.verificationCode !== code) {
            throw new AppError({ status: 400, code: CORE_ERROR_CODES.INVALID_VERIFICATION_CODE, error: 'Invalid verification code' });
        }
        if (pending.verificationCodeExpiresAt < new Date()) {
            throw new AppError({
                status: 400,
                code: CORE_ERROR_CODES.INVALID_VERIFICATION_CODE,
                error: 'Verification code has expired. Please request a new one.',
            });
        }

        const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
        const id = nanoid();
        const now = new Date();
        await this.db.insert(schema.users).values({
            id,
            username,
            email,
            passwordHash,
            role: 'user',
            emailVerified: true,
            verificationCode: null,
            verificationCodeExpiresAt: null,
            createdAt: now,
        });
        await this.db.delete(schema.pendingRegistrations).where(eq(schema.pendingRegistrations.email, email));
        await this.getOrCreateShadowAgent(id);
        return { id, username, email, role: 'user', emailVerified: true };
    }

    async verifyEmail(email: string, code: string) {
        const [user] = await this.db.select()
            .from(schema.users).where(eq(schema.users.email, email));
        if (!user) throw new AppError({ status: 404, code: CORE_ERROR_CODES.NOT_FOUND, error: 'Email is not registered' });
        if (user.emailVerified) throw new AppError({ status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Email is already verified. Please log in directly.' });
        if (user.verificationCode !== code) throw new AppError({ status: 400, code: CORE_ERROR_CODES.INVALID_VERIFICATION_CODE, error: 'Invalid verification code' });
        if (!user.verificationCodeExpiresAt || user.verificationCodeExpiresAt < new Date()) {
            throw new AppError({
                status: 400,
                code: CORE_ERROR_CODES.INVALID_VERIFICATION_CODE,
                error: 'Verification code has expired. Please request a new one.',
            });
        }
        await this.db.update(schema.users).set({
            emailVerified: true, verificationCode: null, verificationCodeExpiresAt: null,
        }).where(eq(schema.users.id, user.id));
        await this.getOrCreateShadowAgent(user.id);
        return { id: user.id, username: user.username, email: user.email, role: user.role, emailVerified: true };
    }

    async resendCode(email: string) {
        const [pending] = await this.db.select()
            .from(schema.pendingRegistrations).where(eq(schema.pendingRegistrations.email, email));
        if (pending) {
            const code = generateCode();
            const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
            await this.db.update(schema.pendingRegistrations).set({
                verificationCode: code,
                verificationCodeExpiresAt: expiresAt,
            }).where(eq(schema.pendingRegistrations.email, email));
            await sendVerificationEmail(email, code);
            return;
        }

        const [user] = await this.db.select()
            .from(schema.users).where(eq(schema.users.email, email));
        if (!user || user.emailVerified) return;
        const code = generateCode();
        const expiresAt = new Date(Date.now() + 10 * 60 * 1000);
        await this.db.update(schema.users).set({
            verificationCode: code, verificationCodeExpiresAt: expiresAt,
        }).where(eq(schema.users.id, user.id));
        await sendVerificationEmail(email, code);
    }

    async shouldSendVerificationCode(email: string): Promise<boolean> {
        const [pending] = await this.db.select()
            .from(schema.pendingRegistrations).where(eq(schema.pendingRegistrations.email, email));
        if (pending) return true;
        const [user] = await this.db.select()
            .from(schema.users).where(eq(schema.users.email, email));
        return Boolean(user && !user.emailVerified);
    }

    async login(username: string, password: string) {
        const identifier = username.trim();
        let [user] = await this.db.select()
            .from(schema.users)
            .where(eq(schema.users.username, identifier));
        if (!user && identifier.includes('@')) {
            [user] = await this.db.select()
                .from(schema.users)
                .where(eq(schema.users.email, identifier));
        }
        if (!user) throw new AppError({ status: 401, code: CORE_ERROR_CODES.INVALID_CREDENTIALS, error: 'User not found' });
        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) throw new AppError({ status: 401, code: CORE_ERROR_CODES.INVALID_CREDENTIALS, error: 'Incorrect password' });
        if (user.banned) throw new AppError({ status: 401, code: 'USER_BANNED', error: 'Account is banned' });
        if (user.email && !user.emailVerified) {
            throw new AppError({ status: 401, code: CORE_ERROR_CODES.EMAIL_NOT_VERIFIED, error: 'Please verify your email first' });
        }
        await this.getOrCreateShadowAgent(user.id);
        return { id: user.id, username: user.username, email: user.email, role: user.role, emailVerified: user.emailVerified };
    }

    async findOrCreateOAuthUser(provider: 'google' | 'github', providerId: string, email: string, name: string) {
        const [existing] = await this.db.select()
            .from(schema.oauthAccounts)
            .where(and(eq(schema.oauthAccounts.provider, provider), eq(schema.oauthAccounts.providerId, providerId)));

        if (existing) {
            await this.getOrCreateShadowAgent(existing.userId);
            return this.getUserById(existing.userId);
        }

        const [userByEmail] = await this.db.select()
            .from(schema.users).where(eq(schema.users.email, email));

        let userId: string;
        if (userByEmail) {
            userId = userByEmail.id;
            if (!userByEmail.emailVerified) {
                await this.db.update(schema.users).set({ emailVerified: true }).where(eq(schema.users.id, userId));
            }
        } else {
            userId = nanoid();
            const now = new Date();
            const username = `${name}_${nanoid(6)}`;
            const passwordHash = await bcrypt.hash(nanoid(32), BCRYPT_ROUNDS);
            await this.db.insert(schema.users).values({
                id: userId, username, email, passwordHash, role: 'user',
                emailVerified: true, createdAt: now,
            });
        }

        await this.db.insert(schema.oauthAccounts).values({
            id: nanoid(), userId, provider, providerId, email, createdAt: new Date(),
        });

        await this.getOrCreateShadowAgent(userId);
        return this.getUserById(userId);
    }

    // === Agent Management ===

    async createAgent(userId: string, name: string) {
        await this.getUserById(userId);
        const id = nanoid();
        const token = `br_${nanoid(32)}`;
        const now = new Date();
        await this.db.insert(schema.agents).values({
            id, userId, name, token, trustMode: 'confirm',
            allowedLocations: '[]',
            isShadow: false, isOnline: false, createdAt: now,
        });
        return {
            id,
            userId,
            name,
            token,
            isShadow: false,
            trustMode: 'confirm' as const,
            allowedLocations: [],
            isOnline: false,
            createdAt: now,
        };
    }

    async getOrCreateShadowAgent(userId: string): Promise<Agent> {
        const [existing] = await this.db.select()
            .from(schema.agents)
            .where(and(eq(schema.agents.userId, userId), eq(schema.agents.isShadow, true)));
        if (existing) return this.mapAgent(existing);

        const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, userId));
        if (!user) throw new AppError({ status: 404, code: CORE_ERROR_CODES.NOT_FOUND, error: 'User not found' });

        const id = nanoid();
        const token = `br_${nanoid(32)}`;
        const now = new Date();

        try {
            await this.db.insert(schema.agents).values({
                id,
                userId,
                name: user.username,
                token,
                isShadow: true,
                trustMode: 'full',
                allowedLocations: '[]',
                isOnline: false,
                searchable: 1,
                createdAt: now,
            });
        } catch {
            const [concurrent] = await this.db.select()
                .from(schema.agents)
                .where(and(eq(schema.agents.userId, userId), eq(schema.agents.isShadow, true)));
            if (concurrent) return this.mapAgent(concurrent);
            throw new AppError({ status: 500, code: CORE_ERROR_CODES.INTERNAL_ERROR, error: 'Failed to create shadow agent' });
        }

        return {
            id,
            userId,
            name: user.username,
            token,
            isShadow: true,
            trustMode: 'full' as const,
            allowedLocations: [],
            isOnline: false,
            searchable: 1,
            createdAt: now,
        };
    }

    async authenticateAgent(token: string): Promise<AgentSession> {
        const [agent] = await this.db.select()
            .from(schema.agents)
            .where(eq(schema.agents.token, token));
        if (!agent) throw new AppError({ status: 401, code: 'INVALID_TOKEN', error: 'Invalid agent token' });
        return this.createAgentSession(this.mapAgent(agent));
    }

    async authenticateShadowAgent(userId: string): Promise<AgentSession> {
        const user = await this.getUserById(userId);
        if (user.banned) throw new AppError({ status: 403, code: 'USER_BANNED', error: 'Account is banned' });
        const agent = await this.getOrCreateShadowAgent(userId);
        return this.createAgentSession(agent);
    }

    async getAgentsByUser(userId: string) {
        await this.getOrCreateShadowAgent(userId);
        const rows = await this.db.select().from(schema.agents).where(eq(schema.agents.userId, userId));
        return rows
            .map((row) => this.mapAgent(row))
            .sort((a, b) => Number(b.isShadow) - Number(a.isShadow) || new Date(b.createdAt ?? 0).getTime() - new Date(a.createdAt ?? 0).getTime());
    }

    async deleteAgent(agentId: string, userId: string) {
        const agent = await this.requireOwnedAgent(agentId, userId);
        if (agent.isShadow) throw new AppError({ status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Shadow agents cannot be deleted' });
        await this.db.delete(schema.agents).where(eq(schema.agents.id, agentId));
    }

    async updateAgentTrustMode(agentId: string, userId: string, trustMode: 'confirm' | 'full') {
        const agent = await this.requireOwnedAgent(agentId, userId);
        if (agent.isShadow) throw new AppError({ status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Shadow agents cannot change trust mode' });
        await this.db.update(schema.agents).set({ trustMode }).where(eq(schema.agents.id, agentId));
    }

    async updateAgent(agentId: string, userId: string, fields: { name?: string; description?: string; avatarPath?: string; searchable?: number }) {
        await this.requireOwnedAgent(agentId, userId);
        const update: Record<string, unknown> = {};
        if (fields.name !== undefined) update.name = fields.name;
        if (fields.description !== undefined) update.description = fields.description;
        if (fields.avatarPath !== undefined) update.avatarPath = fields.avatarPath;
        if (fields.searchable !== undefined) update.searchable = fields.searchable;
        if (Object.keys(update).length > 0) {
            await this.db.update(schema.agents).set(update).where(eq(schema.agents.id, agentId));
        }
    }

    async getUserById(userId: string) {
        const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, userId));
        if (!user) throw new AppError({ status: 404, code: CORE_ERROR_CODES.NOT_FOUND, error: 'User not found' });
        return { id: user.id, username: user.username, email: user.email, role: user.role, emailVerified: user.emailVerified, banned: !!user.banned };
    }

    async getAgentLocations(agentId: string, userId: string): Promise<string[]> {
        const agent = await this.requireOwnedAgent(agentId, userId);
        return parseAllowedLocations(agent.allowedLocations);
    }

    async updateAgentLocations(agentId: string, userId: string, locations: string[]) {
        const agent = await this.requireOwnedAgent(agentId, userId);
        if (agent.isShadow) throw new AppError({ status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Shadow agents cannot change location access' });
        await this.db.update(schema.agents).set({ allowedLocations: JSON.stringify(locations) }).where(eq(schema.agents.id, agentId));
    }

    async setAgentOnline(agentId: string, isOnline: boolean) {
        await this.db.update(schema.agents).set({ isOnline }).where(eq(schema.agents.id, agentId));
    }

    // === Password ===

    async changePassword(userId: string, oldPassword: string, newPassword: string) {
        const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, userId));
        if (!user) throw new AppError({ status: 404, code: CORE_ERROR_CODES.NOT_FOUND, error: 'User not found' });
        const valid = await bcrypt.compare(oldPassword, user.passwordHash);
        if (!valid) throw new AppError({ status: 400, code: CORE_ERROR_CODES.INVALID_CREDENTIALS, error: 'Incorrect current password' });
        this.assertStrongPassword(newPassword);
        const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);
        await this.db.update(schema.users).set({ passwordHash }).where(eq(schema.users.id, userId));
    }

    private async requireOwnedAgent(agentId: string, userId: string) {
        const [agent] = await this.db.select().from(schema.agents).where(eq(schema.agents.id, agentId));
        if (!agent || agent.userId !== userId) {
            throw new AppError({ status: 404, code: CORE_ERROR_CODES.NOT_FOUND, error: 'Agent not found' });
        }
        return agent;
    }

    private async upsertPendingRegistration(email: string, code: string, expiresAt: Date, now: Date) {
        const [existingPending] = await this.db.select()
            .from(schema.pendingRegistrations).where(eq(schema.pendingRegistrations.email, email));
        if (existingPending) {
            await this.db.update(schema.pendingRegistrations).set({
                verificationCode: code,
                verificationCodeExpiresAt: expiresAt,
                createdAt: now,
            }).where(eq(schema.pendingRegistrations.email, email));
            return;
        }
        await this.db.insert(schema.pendingRegistrations).values({
            email,
            verificationCode: code,
            verificationCodeExpiresAt: expiresAt,
            createdAt: now,
        });
    }

    private async cleanupLegacyUnverifiedRegistrations(email: string, username?: string) {
        const conditions = username
            ? or(eq(schema.users.email, email), eq(schema.users.username, username))
            : eq(schema.users.email, email);
        const rows = await this.db.select()
            .from(schema.users)
            .where(conditions);

        for (const row of rows) {
            if (row.emailVerified) continue;
            await this.db.delete(schema.agents).where(eq(schema.agents.userId, row.id));
            await this.db.delete(schema.oauthAccounts).where(eq(schema.oauthAccounts.userId, row.id));
            await this.db.delete(schema.users).where(eq(schema.users.id, row.id));
        }
    }

    private assertStrongPassword(password: string): void {
        try {
            assertPassword(password);
        } catch (error) {
            throw new AppError({
                status: 400,
                code: CORE_ERROR_CODES.WEAK_PASSWORD,
                error: error instanceof Error ? error.message : 'Weak password',
            });
        }
    }

    private mapAgent(row: typeof schema.agents.$inferSelect): Agent {
        return {
            ...row,
            isShadow: Boolean(row.isShadow),
            trustMode: row.trustMode as 'confirm' | 'full',
            allowedLocations: parseAllowedLocations(row.allowedLocations),
        };
    }

    private createAgentSession(agent: Agent): AgentSession {
        return {
            agentId: agent.id,
            userId: agent.userId,
            agentName: agent.name,
            trustMode: agent.trustMode ?? 'confirm',
            allowedLocations: agent.allowedLocations ?? [],
            role: 'agent',
        };
    }
}
