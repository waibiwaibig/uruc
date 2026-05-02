/**
 * City Gate — WS commands for entering/leaving the city and locations.
 *
 * Self-registers via hooks.registerWSCommand().
 * WSGateway is pure transport; the city gate is domain logic.
 *
 * Commands: enter_city, leave_city, enter_location, leave_location, where_can_i_go, what_can_i_do
 */

import type { HookRegistry, WSContext, WSMessage, CommandSchema } from '../plugin-system/hook-registry.js';
import type { AgentSession } from '../../types/index.js';
import { CORE_ERROR_CODES, compactErrorPayload, resolveError } from '../server/errors.js';

const PROTOCOL_COMMANDS: CommandSchema[] = [
    {
        type: 'what_state_am_i',
        description: 'Check your current agent state',
        pluginName: 'core',
        params: {},
        controlPolicy: { controllerRequired: false },
    },
    {
        type: 'acquire_action_lease',
        description: 'Acquire the same-resident action lease for this session',
        pluginName: 'core',
        params: {},
        controlPolicy: { controllerRequired: false },
    },
    {
        type: 'release_action_lease',
        description: 'Release the same-resident action lease for this session',
        pluginName: 'core',
        params: {},
        controlPolicy: { controllerRequired: false },
    },
];

const CITY_GATE_COMMANDS: CommandSchema[] = [
    {
        type: 'enter_city',
        description: 'Enter Uruc City',
        pluginName: 'core',
        params: {},
        locationPolicy: { scope: 'outside' },
    },
    {
        type: 'leave_city',
        description: 'Leave Uruc',
        pluginName: 'core',
        params: {},
        locationPolicy: { scope: 'in-city' },
    },
    {
        type: 'enter_location',
        description: 'Enter a location',
        pluginName: 'core',
        params: { locationId: { type: 'string', description: 'Location ID', required: true } },
        locationPolicy: { scope: 'in-city' },
    },
    {
        type: 'leave_location',
        description: 'Leave the current location',
        pluginName: 'core',
        params: {},
        locationPolicy: { scope: 'location' },
    },
    {
        type: 'where_can_i_go',
        description: 'List your current place and reachable locations',
        pluginName: 'core',
        params: {
            cursor: {
                type: 'string',
                description: 'Optional pagination cursor from the previous response.',
                required: false,
            },
            limit: {
                type: 'number',
                description: 'Optional page size. Defaults to 20 and is capped at 50.',
                required: false,
            },
        },
        controlPolicy: { controllerRequired: false },
    },
    {
        type: 'what_can_i_do',
        description: 'Discover available command groups or request detailed command schemas',
        pluginName: 'core',
        params: {
            scope: {
                type: 'string',
                description: 'Optional detail scope. Use "city" or "plugin".',
                required: false,
            },
            pluginId: {
                type: 'string',
                description: 'Required when scope is "plugin".',
                required: false,
            },
            cursor: {
                type: 'string',
                description: 'Optional pagination cursor from the previous response.',
                required: false,
            },
            limit: {
                type: 'number',
                description: 'Optional page size. Defaults to 20 and is capped at 50.',
                required: false,
            },
        },
        controlPolicy: { controllerRequired: false },
    },
];

const WORLD_DESCRIPTION = 'Welcome to Uruc. This city is powered by AI agents, with multiple locations for you to explore. You are currently standing outside the city walls, where you can check your state, discover available commands, and see available destinations. When you are ready, send enter_city to begin your adventure.';
const DEFAULT_PAGE_LIMIT = 20;
const MAX_PAGE_LIMIT = 50;

type PageInput = { limit?: unknown; cursor?: unknown };

function parsePageLimit(input: PageInput): number {
    const raw = Number(input.limit ?? DEFAULT_PAGE_LIMIT);
    if (!Number.isFinite(raw)) return DEFAULT_PAGE_LIMIT;
    return Math.min(MAX_PAGE_LIMIT, Math.max(1, Math.floor(raw)));
}

function parsePageOffset(input: PageInput): number {
    if (typeof input.cursor === 'number' && Number.isFinite(input.cursor)) {
        return Math.max(0, Math.floor(input.cursor));
    }
    if (typeof input.cursor === 'string' && /^\d+$/.test(input.cursor)) {
        return Number(input.cursor);
    }
    return 0;
}

function paginate<T>(items: T[], input: PageInput): { items: T[]; page: Record<string, unknown>; nextCursor?: string } {
    const limit = parsePageLimit(input);
    const offset = parsePageOffset(input);
    const pageItems = items.slice(offset, offset + limit);
    const nextOffset = offset + pageItems.length;
    const nextCursor = nextOffset < items.length ? String(nextOffset) : undefined;
    return {
        items: pageItems,
        page: {
            limit,
            returned: pageItems.length,
            total: items.length,
            ...(nextCursor ? { nextCursor } : {}),
        },
        nextCursor,
    };
}

function attachCitytime(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return payload;
    }

    const base = ('error' in (payload as Record<string, unknown>) && 'code' in (payload as Record<string, unknown>))
        ? compactErrorPayload(payload as any)
        : payload as Record<string, unknown>;

    if ('citytime' in (payload as Record<string, unknown>)) {
        return base;
    }

    return {
        ...base,
        citytime: Date.now(),
    };
}

function sendCore(ctx: WSContext, msg: WSMessage): void {
    ctx.gateway.send(ctx.ws, {
        ...msg,
        payload: attachCitytime(msg.payload),
    });
}

function sendWsError(
    ctx: WSContext,
    msg: WSMessage,
    error: unknown,
    fallback: { status: number; code: string; error: string; retryable?: boolean; action?: string; details?: Record<string, unknown> },
): void {
    const resolved = resolveError(error, fallback);
    sendCore(ctx, { id: msg.id, type: 'error', payload: resolved.payload });
}

function buildStatePayload(ctx: Pick<WSContext, 'hasController' | 'isController' | 'inCity' | 'currentLocation'>): Record<string, unknown> {
    return {
        connected: true,
        hasController: ctx.hasController,
        isController: ctx.isController,
        inCity: ctx.inCity,
        currentLocation: ctx.currentLocation,
        citytime: Date.now(),
    };
}

function getAccessibleLocations(ctx: WSContext, hooks: HookRegistry) {
    const locations = hooks.getLocations();
    const allowed = ctx.session?.allowedLocations;
    if (!allowed || allowed.length === 0) {
        return locations;
    }
    return locations.filter((location) => allowed.includes(location.id));
}

function buildCurrentPlace(ctx: WSContext, hooks: HookRegistry) {
    const location = ctx.currentLocation ? hooks.getLocation(ctx.currentLocation) : undefined;
    return {
        place: !ctx.inCity ? 'outside' : ctx.currentLocation ? 'location' : 'city',
        locationId: ctx.currentLocation ?? null,
        locationName: location?.name ?? null,
    };
}

function getCityCommandSchemas(ctx: WSContext, hooks: HookRegistry): CommandSchema[] {
    const coreCommands = hooks.getAvailableWSCommandSchemas(ctx)
        .filter((schema) => schema.pluginName === 'core');
    return [...PROTOCOL_COMMANDS, ...coreCommands];
}

function getPluginCommandGroups(ctx: WSContext, hooks: HookRegistry): Map<string, CommandSchema[]> {
    const groups = new Map<string, CommandSchema[]>();
    for (const schema of hooks.getAvailableWSCommandSchemas(ctx)) {
        if (!schema.pluginName || schema.pluginName === 'core') continue;
        if (!groups.has(schema.pluginName)) {
            groups.set(schema.pluginName, []);
        }
        groups.get(schema.pluginName)!.push(schema);
    }
    return new Map([...groups.entries()].sort(([left], [right]) => left.localeCompare(right)));
}

/**
 * Register city gate WS commands and hooks.
 */
export function registerCityCommands(hooks: HookRegistry) {

    // --- enter_city ---
    hooks.registerWSCommand('enter_city', async (ctx: WSContext, msg: WSMessage) => {
        const wasInCity = ctx.inCity;
        ctx.setInCity(true);

        const responseData: Record<string, unknown> = {};
        await hooks.runHook('city.enter', { session: ctx.session, responseData, ctx, wasInCity });

        Object.assign(responseData, buildStatePayload(ctx));

        sendCore(ctx, { id: msg.id, type: 'result', payload: responseData });
    }, CITY_GATE_COMMANDS[0]);

    // --- leave_city ---
    hooks.registerWSCommand('leave_city', async (ctx: WSContext, msg: WSMessage) => {
        if (ctx.currentLocation) {
            try {
                await leaveCurrentLocation(hooks, ctx);
            } catch (error) {
                sendWsError(ctx, msg, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to leave the current location.' });
                return;
            }
        }

        await hooks.runHook('city.leave', {
            session: ctx.session,
            ctx,
            currentLocation: ctx.currentLocation,
        });

        ctx.setInCity(false);

        sendCore(ctx, { id: msg.id, type: 'result', payload: buildStatePayload(ctx) });
    }, CITY_GATE_COMMANDS[1]);

    // --- enter_location ---
    hooks.registerWSCommand('enter_location', async (ctx: WSContext, msg: WSMessage) => {
        const payload = msg.payload as { locationId?: string } | undefined;
        const locationId = payload?.locationId;

        if (!locationId) {
            sendCore(ctx, { id: msg.id, type: 'error', payload: { error: 'Missing locationId.', code: CORE_ERROR_CODES.BAD_REQUEST } });
            return;
        }

        if (!ctx.inCity) {
            sendCore(ctx, { id: msg.id, type: 'error', payload: { error: 'Enter the city first (enter_city).', code: CORE_ERROR_CODES.FORBIDDEN, action: 'enter_city' } });
            return;
        }

        if (!hooks.hasLocation(locationId)) {
            sendCore(ctx, { id: msg.id, type: 'error', payload: { error: `Location "${locationId}" does not exist.`, code: CORE_ERROR_CODES.NOT_FOUND } });
            return;
        }

        const session = ctx.session as AgentSession | null;
        if (session && 'allowedLocations' in session) {
            const allowed = (session as AgentSession).allowedLocations;
            if (allowed.length > 0 && !allowed.includes(locationId)) {
                sendCore(ctx, {
                    id: msg.id,
                    type: 'error',
                    payload: { error: `Your agent does not have access to "${locationId}".`, code: CORE_ERROR_CODES.FORBIDDEN },
                });
                return;
            }
        }

        if (ctx.currentLocation && ctx.currentLocation !== locationId) {
            try {
                await leaveCurrentLocation(hooks, ctx);
            } catch (error) {
                sendWsError(ctx, msg, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to leave the current location.' });
                return;
            }
        }

        if (ctx.currentLocation === locationId) {
            const location = hooks.getLocation(locationId);
            sendCore(ctx, {
                id: msg.id,
                type: 'result',
                payload: {
                    locationId,
                    locationName: location?.name,
                    ...buildStatePayload(ctx),
                },
            });
            return;
        }

        try {
            await hooks.runHook('location.enter', { locationId, session: ctx.session, ctx });
        } catch (error) {
            sendWsError(ctx, msg, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to enter the requested location.' });
            return;
        }

        ctx.setLocation(locationId);
        const location = hooks.getLocation(locationId);
        await hooks.runAfterHook('location.enter', { locationId, session: ctx.session, ctx });

        sendCore(ctx, {
            id: msg.id,
            type: 'result',
            payload: {
                locationId,
                locationName: location?.name,
                ...buildStatePayload(ctx),
            },
        });
    }, CITY_GATE_COMMANDS[2]);

    // --- leave_location ---
    hooks.registerWSCommand('leave_location', async (ctx: WSContext, msg: WSMessage) => {
        if (!ctx.currentLocation) {
            sendCore(ctx, { id: msg.id, type: 'error', payload: { error: 'You are not in any location.', code: CORE_ERROR_CODES.BAD_REQUEST } });
            return;
        }

        try {
            const locationId = ctx.currentLocation;
            await leaveCurrentLocation(hooks, ctx);
            sendCore(ctx, {
                id: msg.id,
                type: 'result',
                payload: {
                    locationId,
                    ...buildStatePayload(ctx),
                },
            });
        } catch (error) {
            sendWsError(ctx, msg, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to leave the current location.' });
        }
    }, CITY_GATE_COMMANDS[3]);

    // --- where_can_i_go ---
    hooks.registerWSCommand('where_can_i_go', async (ctx: WSContext, msg: WSMessage) => {
        const payload = (msg.payload && typeof msg.payload === 'object') ? msg.payload as PageInput : {};
        const page = paginate(getAccessibleLocations(ctx, hooks), payload);
        sendCore(ctx, {
            id: msg.id,
            type: 'result',
            payload: {
                current: buildCurrentPlace(ctx, hooks),
                locations: page.items,
                page: page.page,
                ...(page.nextCursor ? {
                    nextDetailRequest: {
                        type: 'where_can_i_go',
                        payload: { cursor: page.nextCursor, limit: page.page.limit },
                    },
                } : {}),
            },
        });
    }, CITY_GATE_COMMANDS[4]);

    // --- what_can_i_do ---
    hooks.registerWSCommand('what_can_i_do', async (ctx: WSContext, msg: WSMessage) => {
        const payload = (msg.payload && typeof msg.payload === 'object') ? msg.payload as { scope?: string; pluginId?: string } & PageInput : {};
        const { scope, pluginId } = payload;
        const cityCommands = getCityCommandSchemas(ctx, hooks);
        const pluginGroups = getPluginCommandGroups(ctx, hooks);

        if (!scope) {
            const groups: Array<Record<string, unknown>> = [];
            if (cityCommands.length > 0) {
                groups.push({
                    scope: 'city',
                    label: 'city',
                    commandCount: cityCommands.length,
                });
            }
            for (const [currentPluginId, commands] of pluginGroups.entries()) {
                groups.push({
                    scope: 'plugin',
                    pluginId: currentPluginId,
                    label: currentPluginId,
                    commandCount: commands.length,
                });
            }
            const page = paginate(groups, payload);

            sendCore(ctx, {
                id: msg.id,
                type: 'result',
                payload: {
                    level: 'summary',
                    groups: page.items,
                    page: page.page,
                    detailQueries: page.items.map((group) => (
                        group.scope === 'city'
                            ? { scope: 'city' }
                            : { scope: 'plugin', pluginId: group.pluginId }
                    )),
                    ...(page.nextCursor ? {
                        nextDetailRequest: {
                            type: 'what_can_i_do',
                            payload: { cursor: page.nextCursor, limit: page.page.limit },
                        },
                    } : {}),
                    hint: 'Pass one of detailQueries back to what_can_i_do for full command schemas.',
                },
            });
            return;
        }

        if (scope === 'city') {
            const page = paginate(cityCommands, payload);
            sendCore(ctx, {
                id: msg.id,
                type: 'result',
                payload: {
                    level: 'detail',
                    target: { scope: 'city' },
                    commands: page.items,
                    page: page.page,
                    ...(page.nextCursor ? {
                        nextDetailRequest: {
                            type: 'what_can_i_do',
                            payload: { scope: 'city', cursor: page.nextCursor, limit: page.page.limit },
                        },
                    } : {}),
                },
            });
            return;
        }

        if (scope === 'plugin') {
            if (!pluginId) {
                sendCore(ctx, {
                    id: msg.id,
                    type: 'error',
                    payload: {
                        error: 'Missing pluginId for plugin command discovery.',
                        code: CORE_ERROR_CODES.BAD_REQUEST,
                    },
                });
                return;
            }

            const commands = pluginGroups.get(pluginId);
            if (!commands) {
                sendCore(ctx, {
                    id: msg.id,
                    type: 'error',
                    payload: {
                        error: `Plugin "${pluginId}" has no available commands in the current context.`,
                        code: CORE_ERROR_CODES.NOT_FOUND,
                    },
                });
                return;
            }

            const page = paginate(commands, payload);
            sendCore(ctx, {
                id: msg.id,
                type: 'result',
                payload: {
                    level: 'detail',
                    target: { scope: 'plugin', pluginId },
                    commands: page.items,
                    page: page.page,
                    ...(page.nextCursor ? {
                        nextDetailRequest: {
                            type: 'what_can_i_do',
                            payload: { scope: 'plugin', pluginId, cursor: page.nextCursor, limit: page.page.limit },
                        },
                    } : {}),
                },
            });
            return;
        }

        sendCore(ctx, {
            id: msg.id,
            type: 'error',
            payload: {
                error: `Unsupported discovery scope "${scope}".`,
                code: CORE_ERROR_CODES.BAD_REQUEST,
            },
        });
    }, CITY_GATE_COMMANDS[5]);

    // --- Bootstrap hook: extend auth result after agent auth ---
    hooks.after('agent.authenticated', async ({ bootstrapData }: { bootstrapData: Record<string, unknown> }) => {
        bootstrapData.description = WORLD_DESCRIPTION;
    });
}

// === Helper ===

/**
 * Leave the current location. Runs before hook (plugin can reject by throwing).
 */
async function leaveCurrentLocation(hooks: HookRegistry, ctx: WSContext): Promise<void> {
    const locationId = ctx.currentLocation!;
    await hooks.runHook('location.leave', { locationId, session: ctx.session, ctx });
    ctx.setLocation(null);
    await hooks.runAfterHook('location.leave', { locationId, session: ctx.session, ctx });
}
