/**
 * AdminService — Admin-only operations.
 *
 * Separated from AuthService to follow the single-responsibility principle.
 * Handles: user listing, banning, agent listing, freezing, stats.
 */

import { eq, like, or, desc, count } from 'drizzle-orm';
import { type UrucDb, schema } from '../database/index.js';
import { escapeLike } from '../../utils/validate.js';
import { AppError, CORE_ERROR_CODES } from '../server/errors.js';

declare module '../plugin-system/service-registry.js' {
    interface ServiceMap {
        'admin': AdminService;
    }
}

export class AdminService {
    constructor(private db: UrucDb) { }

    async getAllUsers(search?: string, limit = 50, offset = 0) {
        const conditions = search
            ? (() => { const s = escapeLike(search); return or(like(schema.users.username, `%${s}%`), like(schema.users.email, `%${s}%`)); })()
            : undefined;
        const rows = await this.db.select({
            id: schema.users.id, username: schema.users.username, email: schema.users.email,
            role: schema.users.role,
            banned: schema.users.banned, emailVerified: schema.users.emailVerified, createdAt: schema.users.createdAt,
        }).from(schema.users).where(conditions).orderBy(desc(schema.users.createdAt)).limit(limit).offset(offset);
        const [{ total }] = await this.db.select({ total: count() }).from(schema.users).where(conditions);
        return { users: rows, total };
    }

    async banUser(userId: string, banned: boolean) {
        const [user] = await this.db.select().from(schema.users).where(eq(schema.users.id, userId));
        if (!user) throw new AppError({ status: 404, code: CORE_ERROR_CODES.NOT_FOUND, error: 'User not found' });
        if (user.role === 'admin') throw new AppError({ status: 403, code: CORE_ERROR_CODES.FORBIDDEN, error: 'Admin users cannot be banned' });
        await this.db.update(schema.users).set({ banned: banned ? 1 : 0 }).where(eq(schema.users.id, userId));
    }

    async getAllAgents() {
        const rows = await this.db.select({
            id: schema.agents.id, userId: schema.agents.userId, name: schema.agents.name,
            isShadow: schema.agents.isShadow,
            isOnline: schema.agents.isOnline, frozen: schema.agents.frozen,
            description: schema.agents.description, createdAt: schema.agents.createdAt,
            ownerName: schema.users.username,
        }).from(schema.agents)
            .leftJoin(schema.users, eq(schema.agents.userId, schema.users.id))
            .orderBy(desc(schema.agents.createdAt));
        return rows;
    }

    async getAllAgentsBasic() {
        return this.db.select({ id: schema.agents.id, name: schema.agents.name }).from(schema.agents);
    }

    async freezeAgent(agentId: string, frozen: boolean) {
        const [agent] = await this.db.select().from(schema.agents).where(eq(schema.agents.id, agentId));
        if (!agent) throw new AppError({ status: 404, code: CORE_ERROR_CODES.NOT_FOUND, error: 'Agent not found' });
        await this.db.update(schema.agents).set({ frozen: frozen ? 1 : 0 }).where(eq(schema.agents.id, agentId));
    }

    async getOverviewStats() {
        const [{ userCount }] = await this.db.select({ userCount: count() }).from(schema.users);
        const [{ agentCount }] = await this.db.select({ agentCount: count() }).from(schema.agents);
        const [{ onlineAgents }] = await this.db.select({ onlineAgents: count() }).from(schema.agents).where(eq(schema.agents.isOnline, true));
        return { userCount, agentCount, onlineAgents };
    }
}
