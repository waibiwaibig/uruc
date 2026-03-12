/**
 * City Gate — WS commands for entering/leaving the city and locations.
 *
 * Self-registers via hooks.registerWSCommand().
 * WSGateway is pure transport; the city gate is domain logic.
 *
 * Commands: enter_city, leave_city, enter_location, leave_location, what_location, what_commands
 */

import type { HookRegistry, WSContext, WSMessage, CommandSchema } from '../plugin-system/hook-registry.js';
import type { AgentSession } from '../../types/index.js';
import { CORE_ERROR_CODES, resolveError } from '../server/errors.js';

const CITY_GATE_COMMANDS: CommandSchema[] = [
    { type: 'enter_city', description: 'Enter Uruc City', pluginName: 'core', params: {} },
    { type: 'leave_city', description: 'Leave Uruc', pluginName: 'core', params: {} },
    {
        type: 'enter_location', description: 'Enter a location', pluginName: 'core',
        params: { locationId: { type: 'string', description: 'Location ID', required: true } },
    },
    { type: 'leave_location', description: 'Leave the current location', pluginName: 'core', params: {} },
    { type: 'what_location', description: 'Check your current location', pluginName: 'core', params: {} },
    { type: 'what_time', description: 'Get the current server time (millisecond timestamp)', pluginName: 'core', params: {} },
    { type: 'what_commands', description: 'List currently available commands and locations', pluginName: 'core', params: {} },
];

const WORLD_DESCRIPTION = 'Welcome to Uruc. This city is powered by AI agents, with multiple locations for you to explore. You are currently standing outside the city walls, where you can check the time, your location, and available commands. When you are ready, send enter_city to begin your adventure.';

function sendWsError(
    ctx: WSContext,
    msg: WSMessage,
    error: unknown,
    fallback: { status: number; code: string; error: string; retryable?: boolean; action?: string; details?: Record<string, unknown> },
): void {
    const resolved = resolveError(error, fallback);
    ctx.gateway.send(ctx.ws, { id: msg.id, type: 'error', payload: resolved.payload });
}

function buildSessionPayload(ctx: WSContext, hooks: HookRegistry): Record<string, unknown> {
    return {
        connected: true,
        hasController: ctx.hasController,
        isController: ctx.isController,
        inCity: ctx.inCity,
        currentLocation: ctx.currentLocation,
        serverTimestamp: Date.now(),
        availableCommands: hooks.getWSCommandSchemas(),
        availableLocations: hooks.getLocations(),
    };
}

/**
 * Register city gate WS commands and hooks.
 */
export function registerCityCommands(hooks: HookRegistry) {

    // --- enter_city ---
    hooks.registerWSCommand('enter_city', async (ctx: WSContext, msg: WSMessage) => {
        const wasInCity = ctx.inCity;
        ctx.setInCity(true);

        // Let plugins enrich the response (location list, etc.)
        const responseData: Record<string, unknown> = {};
        await hooks.runHook('city.enter', { session: ctx.session, responseData, ctx, wasInCity });

        Object.assign(responseData, buildSessionPayload(ctx, hooks));

        ctx.gateway.send(ctx.ws, { id: msg.id, type: 'result', payload: responseData });
    }, CITY_GATE_COMMANDS[0]);

    // --- leave_city ---
    hooks.registerWSCommand('leave_city', async (ctx: WSContext, msg: WSMessage) => {
        // If at a location, leave it first
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

        ctx.gateway.send(ctx.ws, { id: msg.id, type: 'result', payload: { success: true, ...buildSessionPayload(ctx, hooks) } });
    }, CITY_GATE_COMMANDS[1]);

    // --- enter_location ---
    hooks.registerWSCommand('enter_location', async (ctx: WSContext, msg: WSMessage) => {
        const payload = msg.payload as { locationId?: string } | undefined;
        const locationId = payload?.locationId;

        if (!locationId) {
            ctx.gateway.send(ctx.ws, { id: msg.id, type: 'error', payload: { error: 'Missing locationId.', code: CORE_ERROR_CODES.BAD_REQUEST } });
            return;
        }

        // Must be in city
        if (!ctx.inCity) {
            ctx.gateway.send(ctx.ws, { id: msg.id, type: 'error', payload: { error: 'Enter the city first (enter_city).', code: CORE_ERROR_CODES.FORBIDDEN, action: 'enter_city' } });
            return;
        }

        // Location must be registered
        if (!hooks.hasLocation(locationId)) {
            ctx.gateway.send(ctx.ws, { id: msg.id, type: 'error', payload: { error: `Location "${locationId}" does not exist.`, code: CORE_ERROR_CODES.NOT_FOUND } });
            return;
        }

        // Check allowedLocations
        const session = ctx.session as AgentSession | null;
        if (session && 'allowedLocations' in session) {
            const allowed = (session as AgentSession).allowedLocations;
            if (allowed.length > 0 && !allowed.includes(locationId)) {
                ctx.gateway.send(ctx.ws, {
                    id: msg.id,
                    type: 'error',
                    payload: { error: `Your agent does not have access to "${locationId}".`, code: CORE_ERROR_CODES.FORBIDDEN }
                });
                return;
            }
        }

        // If already at another location, leave first
        if (ctx.currentLocation && ctx.currentLocation !== locationId) {
            try {
                await leaveCurrentLocation(hooks, ctx);
            } catch (error) {
                sendWsError(ctx, msg, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to leave the current location.' });
                return;
            }
        }

        // Already here
        if (ctx.currentLocation === locationId) {
            const loc = hooks.getLocation(locationId);
            ctx.gateway.send(ctx.ws, {
                id: msg.id,
                type: 'result',
                payload: {
                    success: true,
                    locationId,
                    locationName: loc?.name,
                    message: `You are already at ${loc?.name ?? locationId}.`,
                    ...buildSessionPayload(ctx, hooks),
                }
            });
            return;
        }

        // Before hook — plugin can reject (throw to reject)
        try {
            await hooks.runHook('location.enter', { locationId, session: ctx.session, ctx });
        } catch (error) {
            sendWsError(ctx, msg, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to enter the requested location.' });
            return;
        }

        // Update location
        ctx.setLocation(locationId);
        const loc = hooks.getLocation(locationId);

        // After hook — plugin can initialize state
        await hooks.runAfterHook('location.enter', { locationId, session: ctx.session, ctx });

        ctx.gateway.send(ctx.ws, {
            id: msg.id, type: 'result', payload: {
                success: true,
                locationId,
                locationName: loc?.name,
                message: `Entered ${loc?.name ?? locationId}.`,
                ...buildSessionPayload(ctx, hooks),
            }
        });
    }, CITY_GATE_COMMANDS[2]);

    // --- leave_location ---
    hooks.registerWSCommand('leave_location', async (ctx: WSContext, msg: WSMessage) => {
        if (!ctx.currentLocation) {
            ctx.gateway.send(ctx.ws, { id: msg.id, type: 'error', payload: { error: 'You are not in any location.', code: CORE_ERROR_CODES.BAD_REQUEST } });
            return;
        }

        try {
            const locationId = ctx.currentLocation;
            await leaveCurrentLocation(hooks, ctx);
            ctx.gateway.send(ctx.ws, {
                id: msg.id,
                type: 'result',
                payload: { success: true, message: `Left ${locationId}.`, ...buildSessionPayload(ctx, hooks) }
            });
        } catch (error) {
            sendWsError(ctx, msg, error, { status: 400, code: CORE_ERROR_CODES.BAD_REQUEST, error: 'Unable to leave the current location.' });
        }
    }, CITY_GATE_COMMANDS[3]);

    // --- what_location ---
    hooks.registerWSCommand('what_location', async (ctx: WSContext, msg: WSMessage) => {
        const loc = ctx.currentLocation ? hooks.getLocation(ctx.currentLocation) : undefined;
        ctx.gateway.send(ctx.ws, {
            id: msg.id, type: 'result', payload: {
                ...buildSessionPayload(ctx, hooks),
                inCity: ctx.inCity,
                currentLocation: ctx.currentLocation ?? null,
                currentLocationName: loc?.name ?? null,
                place: !ctx.inCity ? 'outside' : ctx.currentLocation ? `location:${ctx.currentLocation}` : 'city',
            }
        });
    }, CITY_GATE_COMMANDS[4]);

    // --- what_time ---
    hooks.registerWSCommand('what_time', async (ctx: WSContext, msg: WSMessage) => {
        const timestamp = Date.now();
        ctx.gateway.send(ctx.ws, {
            id: msg.id,
            type: 'result',
            payload: {
                timestamp,
                serverTimestamp: timestamp,
            },
        });
    }, CITY_GATE_COMMANDS[5]);

    // --- what_commands ---
    hooks.registerWSCommand('what_commands', async (ctx: WSContext, msg: WSMessage) => {
        ctx.gateway.send(ctx.ws, {
            id: msg.id, type: 'result', payload: {
                ...buildSessionPayload(ctx, hooks),
                commands: hooks.getWSCommandSchemas(),
                locations: hooks.getLocations(),
            }
        });
    }, CITY_GATE_COMMANDS[6]);

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
    // Before hook — plugin can reject (throw)
    await hooks.runHook('location.leave', { locationId, session: ctx.session, ctx });
    ctx.setLocation(null);
    // After hook — plugin cleanup
    await hooks.runAfterHook('location.leave', { locationId, session: ctx.session, ctx });
}
