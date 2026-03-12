import { eq, and, desc, lt } from 'drizzle-orm';
import { nanoid } from 'nanoid';
import { type UrucDb, schema } from '../database/index.js';
import type { LogEntry } from '../../types/index.js';

declare module '../plugin-system/service-registry.js' {
    interface ServiceMap {
        'logger': LogService;
    }
}

export interface LogQuery {
    userId?: string;
    agentId?: string;
    locationId?: string;
    actionType?: string;
    limit?: number;
    offset?: number;
}

/**
 * LogService — Core action logging service.
 *
 * This is a CORE service, always present, not a plugin.
 * All agent/user actions are recorded for audit and security.
 */
export class LogService {
    constructor(private db: UrucDb) { }

    async log(entry: LogEntry) {
        await this.db.insert(schema.actionLogs).values({
            id: nanoid(),
            userId: entry.userId,
            agentId: entry.agentId,
            locationId: entry.locationId,
            actionType: entry.actionType,
            payload: JSON.stringify(entry.payload),
            result: entry.result,
            detail: entry.detail ?? null,
            createdAt: new Date(entry.timestamp ?? Date.now()),
        });
    }

    async query(filter: LogQuery) {
        const conditions = [];
        if (filter.userId) conditions.push(eq(schema.actionLogs.userId, filter.userId));
        if (filter.agentId) conditions.push(eq(schema.actionLogs.agentId, filter.agentId));
        if (filter.locationId) conditions.push(eq(schema.actionLogs.locationId, filter.locationId));
        if (filter.actionType) conditions.push(eq(schema.actionLogs.actionType, filter.actionType));

        return this.db.select()
            .from(schema.actionLogs)
            .where(conditions.length > 0 ? and(...conditions) : undefined)
            .orderBy(desc(schema.actionLogs.createdAt))
            .limit(filter.limit ?? 100)
            .offset(filter.offset ?? 0);
    }

    async cleanup(retentionDays: number) {
        const cutoff = new Date(Date.now() - retentionDays * 86400000);
        await this.db.delete(schema.actionLogs).where(lt(schema.actionLogs.createdAt, cutoff));
    }
}
