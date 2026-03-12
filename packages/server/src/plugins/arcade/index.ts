import type { Plugin, PluginContext } from '../../core/plugin-system/plugin-interface.js';
import type {
  CommandSchema,
  WSErrorPayload,
  WSContext,
  WSMessage,
  WSGatewayPublic,
} from '../../core/plugin-system/hook-registry.js';
import type { WebSocket } from 'ws';

import {
  ArcadeService,
  ARCADE_LOCATION_ID,
  type ArcadeServiceResult,
} from './service.js';
import { ARCADE_PLUGIN_NAME } from './types.js';

type AgentSession = {
  userId: string;
  agentId: string;
  agentName: string;
  role: 'owner' | 'agent';
};

type HookLocationContext = {
  locationId: string;
  session: AgentSession | null;
  ctx: WSContext;
};

type HookConnectionCloseContext = {
  session?: AgentSession;
};

const COMMAND_SCHEMAS: CommandSchema[] = [
  {
    type: 'arcade_lobby',
    description: 'View arcade lobby information',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {},
  },
  {
    type: 'arcade_games',
    description: 'View loaded arcade games',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {},
  },
  {
    type: 'arcade_wallet',
    description: 'View your arcade chip balance',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {},
  },
  {
    type: 'arcade_claim_chips',
    description: 'Claim arcade chips after going broke',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {},
  },
  {
    type: 'arcade_create_table',
    description: 'Create a new game table',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {
      gameId: { type: 'string', description: 'Game ID', required: true },
      name: { type: 'string', description: 'Table name', required: false },
      private: { type: 'boolean', description: 'Whether the table is private', required: false },
      whitelistAgentIds: { type: 'array<string>', description: 'Private table whitelist', required: false },
    },
  },
  {
    type: 'arcade_list_tables',
    description: 'List currently visible tables',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {
      gameId: { type: 'string', description: 'Filter by game', required: false },
    },
  },
  {
    type: 'arcade_table_state',
    description: 'View table details and current state',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {
      tableId: { type: 'string', description: 'Table ID', required: false },
    },
  },
  {
    type: 'arcade_table_history',
    description: 'View recent table state history',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {
      tableId: { type: 'string', description: 'Table ID', required: false },
    },
  },
  {
    type: 'arcade_join_table',
    description: 'Join a table as a player',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {
      tableId: { type: 'string', description: 'Table ID', required: true },
    },
  },
  {
    type: 'arcade_leave_table',
    description: 'Leave the current table and return to the lobby',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {},
  },
  {
    type: 'arcade_watch_table',
    description: 'Spectate a table',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {
      tableId: { type: 'string', description: 'Table ID', required: true },
    },
  },
  {
    type: 'arcade_unwatch_table',
    description: 'Stop spectating and return to the lobby',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {},
  },
  {
    type: 'arcade_close_table',
    description: 'Close a table you created',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {
      tableId: { type: 'string', description: 'Table ID', required: true },
    },
  },
  {
    type: 'arcade_kick_player',
    description: 'Table host removes a player from the table',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {
      targetAgentId: { type: 'string', description: 'Target player agentId', required: true },
    },
  },
  {
    type: 'arcade_game_action',
    description: 'Send an action to the current table game instance',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {
      tableId: { type: 'string', description: 'Table ID', required: true },
      action: { type: 'object', description: 'Game action object. Must include type.', required: true },
    },
  },
  {
    type: 'arcade_my_stats',
    description: 'View your arcade record',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {
      gameId: { type: 'string', description: 'Filter by game', required: false },
    },
  },
  {
    type: 'arcade_leaderboard',
    description: 'View the arcade leaderboard',
    pluginName: ARCADE_PLUGIN_NAME,
    params: {
      gameId: { type: 'string', description: 'Filter by game', required: false },
      limit: { type: 'number', description: 'Number of results to return, default 20', required: false },
    },
  },
];

function createNoopGateway(): WSGatewayPublic {
  return {
    send(_ws: WebSocket, _msg: WSMessage): void {},
    broadcast(_msg: WSMessage): void {},
    sendToAgent(_agentId: string, _msg: WSMessage): void {},
    pushToOwner(_userId: string, _msg: WSMessage): void {},
    getOnlineAgentIds(): string[] {
      return [];
    },
  };
}

export class ArcadePlugin implements Plugin {
  name = ARCADE_PLUGIN_NAME;
  version = '0.1.0';

  private service?: ArcadeService;

  async init(ctx: PluginContext): Promise<void> {
    const gateway = ctx.services.tryGet('ws-gateway' as never) ?? createNoopGateway();
    const logger = ctx.services.tryGet('logger' as never);

    this.service = new ArcadeService(ctx.db, gateway, logger);
    this.service.init();
    await this.service.loadGames();

    ctx.hooks.registerLocation({
      id: ARCADE_LOCATION_ID,
      name: 'Arcade',
      description: 'Browse games, create tables, sit down to play, and spectate from the arcade lobby',
      pluginName: ARCADE_PLUGIN_NAME,
    });

    const sendResult = (wsCtx: WSContext, msg: WSMessage, payload: unknown): void => {
      wsCtx.gateway.send(wsCtx.ws, {
        id: msg.id,
        type: 'result',
        payload,
      });
    };

    const sendError = (wsCtx: WSContext, msg: WSMessage, payload: WSErrorPayload): void => {
      wsCtx.gateway.send(wsCtx.ws, {
        id: msg.id,
        type: 'error',
        payload,
      });
    };

    const respond = <T>(wsCtx: WSContext, msg: WSMessage, result: ArcadeServiceResult<T>): void => {
      if (result.ok) {
        sendResult(wsCtx, msg, result.data);
      } else {
        sendError(wsCtx, msg, result.error);
      }
    };

    const requireSession = (wsCtx: WSContext, msg: WSMessage): AgentSession | null => {
      if (!wsCtx.session) {
        sendError(wsCtx, msg, {
          error: 'Authenticate your agent first.',
          code: 'NOT_AUTHENTICATED',
          action: 'auth',
        });
        return null;
      }
      return wsCtx.session;
    };

    const requireArcadeLocation = (wsCtx: WSContext, msg: WSMessage): boolean => {
      if (wsCtx.currentLocation === ARCADE_LOCATION_ID) return true;
      sendError(wsCtx, msg, {
        error: 'Enter the arcade first.',
        code: 'NOT_IN_ARCADE_LOCATION',
        action: 'enter_location',
        details: { locationId: ARCADE_LOCATION_ID },
      });
      return false;
    };

    const register = (
      schema: CommandSchema,
      handler: (wsCtx: WSContext, msg: WSMessage, session: AgentSession) => Promise<void> | void,
    ): void => {
      ctx.hooks.registerWSCommand(
        schema.type,
        async (wsCtx, msg) => {
          const session = requireSession(wsCtx, msg);
          if (!session) return;
          if (!requireArcadeLocation(wsCtx, msg)) return;
          await handler(wsCtx, msg, session);
        },
        schema,
      );
    };

    register(COMMAND_SCHEMAS[0], async (wsCtx, msg, session) => {
      await this.service!.enterArcade(session);
      sendResult(wsCtx, msg, this.service!.getLobbyState(session.agentId));
    });

    register(COMMAND_SCHEMAS[1], async (wsCtx, msg, session) => {
      await this.service!.enterArcade(session);
      sendResult(wsCtx, msg, {
        games: this.service!.listGames(),
        diagnostics: this.service!.getDiagnostics(),
      });
    });

    register(COMMAND_SCHEMAS[2], async (wsCtx, msg, session) => {
      const entered = await this.service!.enterArcade(session);
      sendResult(wsCtx, msg, { wallet: entered.wallet });
    });

    register(COMMAND_SCHEMAS[3], async (wsCtx, msg, session) => {
      respond(wsCtx, msg, await this.service!.claimChips(session));
    });

    register(COMMAND_SCHEMAS[4], async (wsCtx, msg, session) => {
      const payload = (msg.payload ?? {}) as {
        gameId?: string;
        name?: string;
        private?: boolean;
        whitelistAgentIds?: string[];
      };
      if (typeof payload.gameId !== 'string' || payload.gameId.trim() === '') {
        sendError(wsCtx, msg, { error: 'Missing gameId', code: 'INVALID_PARAMS' });
        return;
      }

      respond(wsCtx, msg, await this.service!.createTable(session, {
        gameId: payload.gameId,
        name: typeof payload.name === 'string' ? payload.name : undefined,
        isPrivate: payload.private === true,
        whitelistAgentIds: Array.isArray(payload.whitelistAgentIds)
          ? payload.whitelistAgentIds.filter((item): item is string => typeof item === 'string')
          : undefined,
      }));
    });

    register(COMMAND_SCHEMAS[5], (wsCtx, msg, session) => {
      const payload = (msg.payload ?? {}) as { gameId?: string };
      sendResult(wsCtx, msg, {
        tables: this.service!.listTables(session.agentId, payload.gameId),
      });
    });

    register(COMMAND_SCHEMAS[6], (wsCtx, msg, session) => {
      const payload = (msg.payload ?? {}) as { tableId?: string };
      let tableId = payload.tableId;
      if (!tableId) {
        const location = this.service!.getLocation(session.agentId);
        if (location.place === 'table' || location.place === 'watching' || location.place === 'disconnected') {
          tableId = location.tableId;
        }
      }

      if (!tableId) {
        sendError(wsCtx, msg, { error: 'Missing tableId', code: 'INVALID_PARAMS' });
        return;
      }

      respond(wsCtx, msg, this.service!.getTableState(tableId, session.agentId));
    });

    register(COMMAND_SCHEMAS[7], (wsCtx, msg, session) => {
      const payload = (msg.payload ?? {}) as { tableId?: string };
      let tableId = payload.tableId;
      if (!tableId) {
        const location = this.service!.getLocation(session.agentId);
        if (location.place === 'table' || location.place === 'watching' || location.place === 'disconnected') {
          tableId = location.tableId;
        }
      }

      if (!tableId) {
        sendError(wsCtx, msg, { error: 'Missing tableId', code: 'INVALID_PARAMS' });
        return;
      }

      respond(wsCtx, msg, this.service!.getTableHistory(tableId, session.agentId));
    });

    register(COMMAND_SCHEMAS[8], async (wsCtx, msg, session) => {
      const payload = (msg.payload ?? {}) as { tableId?: string };
      if (typeof payload.tableId !== 'string' || payload.tableId.trim() === '') {
        sendError(wsCtx, msg, { error: 'Missing tableId', code: 'INVALID_PARAMS' });
        return;
      }

      respond(wsCtx, msg, await this.service!.joinTable(session, payload.tableId));
    });

    register(COMMAND_SCHEMAS[9], async (wsCtx, msg, session) => {
      respond(wsCtx, msg, await this.service!.leaveTable(session));
    });

    register(COMMAND_SCHEMAS[10], (wsCtx, msg, session) => {
      const payload = (msg.payload ?? {}) as { tableId?: string };
      if (typeof payload.tableId !== 'string' || payload.tableId.trim() === '') {
        sendError(wsCtx, msg, { error: 'Missing tableId', code: 'INVALID_PARAMS' });
        return;
      }

      respond(wsCtx, msg, this.service!.watchTable(session, payload.tableId));
    });

    register(COMMAND_SCHEMAS[11], async (wsCtx, msg, session) => {
      respond(wsCtx, msg, await this.service!.unwatchTable(session.agentId));
    });

    register(COMMAND_SCHEMAS[12], async (wsCtx, msg, session) => {
      const payload = (msg.payload ?? {}) as { tableId?: string };
      if (typeof payload.tableId !== 'string' || payload.tableId.trim() === '') {
        sendError(wsCtx, msg, { error: 'Missing tableId', code: 'INVALID_PARAMS' });
        return;
      }

      respond(wsCtx, msg, await this.service!.closeTable(payload.tableId, session.agentId));
    });

    register(COMMAND_SCHEMAS[13], (wsCtx, msg, session) => {
      const payload = (msg.payload ?? {}) as { targetAgentId?: string };
      if (typeof payload.targetAgentId !== 'string' || payload.targetAgentId.trim() === '') {
        sendError(wsCtx, msg, { error: 'Missing targetAgentId', code: 'INVALID_PARAMS' });
        return;
      }

      respond(wsCtx, msg, this.service!.kickPlayer(session.agentId, payload.targetAgentId));
    });

    register(COMMAND_SCHEMAS[14], async (wsCtx, msg, session) => {
      const payload = (msg.payload ?? {}) as { tableId?: string; action?: { type?: string } };
      if (typeof payload.tableId !== 'string' || payload.tableId.trim() === '') {
        sendError(wsCtx, msg, { error: 'Missing tableId', code: 'INVALID_PARAMS' });
        return;
      }
      if (!payload.action || typeof payload.action !== 'object' || typeof payload.action.type !== 'string') {
        sendError(wsCtx, msg, { error: 'Missing action.type', code: 'INVALID_PARAMS' });
        return;
      }
      const action = payload.action as { type: string } & Record<string, unknown>;

      respond(wsCtx, msg, await this.service!.handleGameAction(session, payload.tableId, action));
    });

    register(COMMAND_SCHEMAS[15], (wsCtx, msg, session) => {
      const payload = (msg.payload ?? {}) as { gameId?: string };
      sendResult(wsCtx, msg, {
        stats: this.service!.getPlayerStats(session.agentId, payload.gameId),
      });
    });

    register(COMMAND_SCHEMAS[16], (wsCtx, msg) => {
      const payload = (msg.payload ?? {}) as { limit?: number; gameId?: string };
      const limit = typeof payload.limit === 'number' && payload.limit > 0 ? payload.limit : 20;
      sendResult(wsCtx, msg, {
        leaderboard: this.service!.getLeaderboard(limit, payload.gameId),
      });
    });

    ctx.hooks.after('location.enter', async ({ locationId, session, ctx: wsCtx }: HookLocationContext) => {
      if (locationId !== ARCADE_LOCATION_ID) return;

      if (!session) {
        wsCtx.gateway.send(wsCtx.ws, {
          id: '',
          type: 'arcade_welcome',
          payload: {
            message: 'Welcome to the arcade. Authenticate to view your wallet, create tables, and play games.',
            games: this.service!.listGames(),
            diagnostics: this.service!.getDiagnostics(),
          },
        });
        return;
      }

      const entered = await this.service!.enterArcade(session);
      wsCtx.gateway.send(wsCtx.ws, {
        id: '',
        type: 'arcade_welcome',
        payload: {
          message: entered.reconnected ? 'Your arcade table state has been restored.' : 'Welcome to the arcade.',
          lobby: this.service!.getLobbyState(session.agentId),
          currentTableId: entered.currentTableId ?? null,
        },
      });
    });

    ctx.hooks.before('location.leave', ({ locationId, session }: HookLocationContext) => {
      if (locationId !== ARCADE_LOCATION_ID || !session) return;
      const location = this.service!.getLocation(session.agentId);
      if (location.place !== 'lobby') {
        throw new Error('You are still seated or spectating. Return to the arcade lobby first.');
      }
    });

    ctx.hooks.after('location.leave', ({ locationId, session }: HookLocationContext) => {
      if (locationId !== ARCADE_LOCATION_ID || !session) return;
      this.service!.onLeaveLocation(session.agentId);
    });

    ctx.hooks.before('connection.close', ({ session }: HookConnectionCloseContext) => {
      if (!session) return;
      this.service!.onConnectionClosed(session.agentId);
    });

    ctx.hooks.after('agent.authenticated', async ({ session, ctx: wsCtx }: { session: AgentSession; ctx: WSContext }) => {
      if (!session) return;
      if (wsCtx.currentLocation !== ARCADE_LOCATION_ID && this.service!.getLocation(session.agentId).place !== 'disconnected') {
        return;
      }

      const entered = await this.service!.enterArcade(session);
      if (!entered.reconnected && wsCtx.currentLocation !== ARCADE_LOCATION_ID) return;

      wsCtx.gateway.send(wsCtx.ws, {
        id: '',
        type: 'arcade_reconnected',
        payload: {
          lobby: this.service!.getLobbyState(session.agentId),
          currentTableId: entered.currentTableId ?? null,
        },
      });
    });
  }

  async destroy(): Promise<void> {
    await this.service?.dispose();
    this.service = undefined;
  }
}

export default ArcadePlugin;
