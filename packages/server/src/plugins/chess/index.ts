import type { Plugin, PluginContext } from '../../core/plugin-system/plugin-interface.js';
import type { WebSocket } from 'ws';
import type { CommandSchema, WSErrorPayload, WSContext, WSMessage, WSGatewayPublic } from '../../core/plugin-system/hook-registry.js';
import { ChessService, CHESS_LOCATION_ID, type ChessMovePayload, type ServiceResult } from './service.js';

const PLUGIN_NAME = 'chess';

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
    type: 'chess_create_match',
    description: 'Create a chess match',
    pluginName: PLUGIN_NAME,
    params: {},
  },
  {
    type: 'chess_list_matches',
    description: 'List joinable matches',
    pluginName: PLUGIN_NAME,
    params: {},
  },
  {
    type: 'chess_join_match',
    description: 'Join a waiting match',
    pluginName: PLUGIN_NAME,
    params: {
      matchId: { type: 'string', description: 'Match ID', required: true },
    },
  },
  {
    type: 'chess_bootstrap',
    description: 'Fetch the full chess hall bootstrap payload',
    pluginName: PLUGIN_NAME,
    params: {
      limit: { type: 'number', description: 'Leaderboard result count, default 20', required: false },
    },
  },
  {
    type: 'chess_leave_match',
    description: 'Close your waiting match or leave the waiting match you are in',
    pluginName: PLUGIN_NAME,
    params: {},
  },
  {
    type: 'ready',
    description: 'Mark yourself ready. The match starts automatically when both players are ready.',
    pluginName: PLUGIN_NAME,
    params: {},
  },
  {
    type: 'move',
    description: 'Make a move',
    pluginName: PLUGIN_NAME,
    params: {
      from: { type: 'string', description: 'From square, for example e2', required: true },
      to: { type: 'string', description: 'To square, for example e4', required: true },
      promotion: { type: 'string', description: 'Promotion piece q/r/b/n', required: false },
    },
  },
  {
    type: 'resign',
    description: 'Resign the match',
    pluginName: PLUGIN_NAME,
    params: {},
  },
  {
    type: 'offer_draw',
    description: 'Offer a draw',
    pluginName: PLUGIN_NAME,
    params: {},
  },
  {
    type: 'accept_draw',
    description: 'Accept a draw offer',
    pluginName: PLUGIN_NAME,
    params: {},
  },
  {
    type: 'decline_draw',
    description: 'Decline a draw offer',
    pluginName: PLUGIN_NAME,
    params: {},
  },
  {
    type: 'chess_state',
    description: 'View the current match state',
    pluginName: PLUGIN_NAME,
    params: {
      matchId: { type: 'string', description: 'Match ID (optional)', required: false },
    },
  },
  {
    type: 'chess_rating',
    description: 'View your Elo rating',
    pluginName: PLUGIN_NAME,
    params: {},
  },
  {
    type: 'chess_leaderboard',
    description: 'View the Elo leaderboard',
    pluginName: PLUGIN_NAME,
    params: {
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

export class ChessPlugin implements Plugin {
  name = PLUGIN_NAME;
  version = '0.1.0';

  private service?: ChessService;

  async init(ctx: PluginContext): Promise<void> {
    const gateway = ctx.services.tryGet('ws-gateway' as any) ?? createNoopGateway();
    const logger = ctx.services.tryGet('logger' as any);

    this.service = new ChessService(ctx.db, gateway, logger);
    this.service.init();

    ctx.hooks.registerLocation({
      id: CHESS_LOCATION_ID,
      name: 'Chess Hall',
      description: 'Head-to-head chess with Elo, a 10-minute total time bank, and reconnect support',
      pluginName: PLUGIN_NAME,
    });

    const sendResult = (wsCtx: WSContext, msg: WSMessage, payload: unknown): void => {
      wsCtx.gateway.send(wsCtx.ws, { id: msg.id, type: 'result', payload });
    };

    const sendError = (wsCtx: WSContext, msg: WSMessage, payload: WSErrorPayload): void => {
      wsCtx.gateway.send(wsCtx.ws, { id: msg.id, type: 'error', payload });
    };

    const respond = <T>(wsCtx: WSContext, msg: WSMessage, result: ServiceResult<T>): void => {
      if (result.ok) {
        sendResult(wsCtx, msg, result.data ?? {});
      } else {
        sendError(wsCtx, msg, result.error ?? { error: 'Unknown error', code: 'UNKNOWN_ERROR' });
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

    const requireChessLocation = (
      wsCtx: WSContext,
      msg: WSMessage,
      agentId: string,
      allowWhenInMatch = false,
    ): boolean => {
      if (wsCtx.currentLocation === CHESS_LOCATION_ID) return true;
      if (allowWhenInMatch && this.service!.isAgentInMatch(agentId)) return true;
      sendError(wsCtx, msg, {
        error: 'Enter the chess hall first.',
        code: 'NOT_IN_CHESS_LOCATION',
        action: 'enter_location',
        details: { locationId: CHESS_LOCATION_ID },
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
          await handler(wsCtx, msg, session);
        },
        schema,
      );
    };

    register(COMMAND_SCHEMAS[0], (wsCtx, msg, session) => {
      if (!requireChessLocation(wsCtx, msg, session.agentId)) return;
      respond(wsCtx, msg, this.service!.createMatch(session));
    });

    register(COMMAND_SCHEMAS[1], (wsCtx, msg, session) => {
      if (!requireChessLocation(wsCtx, msg, session.agentId)) return;
      sendResult(wsCtx, msg, { matches: this.service!.listMatches() });
    });

    register(COMMAND_SCHEMAS[2], (wsCtx, msg, session) => {
      if (!requireChessLocation(wsCtx, msg, session.agentId)) return;
      const payload = (msg.payload ?? {}) as { matchId?: string };
      if (!payload.matchId) {
        sendError(wsCtx, msg, { error: 'Missing matchId', code: 'INVALID_PARAMS' });
        return;
      }
      respond(wsCtx, msg, this.service!.joinMatch(session, payload.matchId));
    });

    register(COMMAND_SCHEMAS[3], async (wsCtx, msg, session) => {
      if (!requireChessLocation(wsCtx, msg, session.agentId, true)) return;
      const payload = (msg.payload ?? {}) as { limit?: number };
      const limit = typeof payload.limit === 'number' ? payload.limit : 20;
      respond(wsCtx, msg, await this.service!.bootstrap(session.agentId, session.userId, limit));
    });

    register(COMMAND_SCHEMAS[4], (wsCtx, msg, session) => {
      if (!requireChessLocation(wsCtx, msg, session.agentId, true)) return;
      respond(wsCtx, msg, this.service!.leaveWaitingMatch(session.agentId));
    });

    register(COMMAND_SCHEMAS[5], (wsCtx, msg, session) => {
      if (!requireChessLocation(wsCtx, msg, session.agentId, true)) return;
      respond(wsCtx, msg, this.service!.ready(session.agentId));
    });

    register(COMMAND_SCHEMAS[6], async (wsCtx, msg, session) => {
      if (!requireChessLocation(wsCtx, msg, session.agentId, true)) return;
      const payload = (msg.payload ?? {}) as Partial<ChessMovePayload>;
      if (typeof payload.from !== 'string' || typeof payload.to !== 'string') {
        sendError(wsCtx, msg, { error: 'move requires from/to', code: 'INVALID_PARAMS' });
        return;
      }

      let promotion: ChessMovePayload['promotion'] | undefined;
      if (typeof payload.promotion === 'string') {
        const candidate = payload.promotion.toLowerCase();
        if (!['q', 'r', 'b', 'n'].includes(candidate)) {
          sendError(wsCtx, msg, { error: 'promotion must be q/r/b/n', code: 'INVALID_PARAMS' });
          return;
        }
        promotion = candidate as ChessMovePayload['promotion'];
      }

      const result = await this.service!.move(session.agentId, {
        from: payload.from.toLowerCase(),
        to: payload.to.toLowerCase(),
        promotion,
      });
      respond(wsCtx, msg, result);
    });

    register(COMMAND_SCHEMAS[7], async (wsCtx, msg, session) => {
      if (!requireChessLocation(wsCtx, msg, session.agentId, true)) return;
      respond(wsCtx, msg, await this.service!.resign(session.agentId));
    });

    register(COMMAND_SCHEMAS[8], (wsCtx, msg, session) => {
      if (!requireChessLocation(wsCtx, msg, session.agentId, true)) return;
      respond(wsCtx, msg, this.service!.offerDraw(session.agentId));
    });

    register(COMMAND_SCHEMAS[9], async (wsCtx, msg, session) => {
      if (!requireChessLocation(wsCtx, msg, session.agentId, true)) return;
      respond(wsCtx, msg, await this.service!.acceptDraw(session.agentId));
    });

    register(COMMAND_SCHEMAS[10], (wsCtx, msg, session) => {
      if (!requireChessLocation(wsCtx, msg, session.agentId, true)) return;
      respond(wsCtx, msg, this.service!.declineDraw(session.agentId));
    });

    register(COMMAND_SCHEMAS[11], (wsCtx, msg, session) => {
      const payload = (msg.payload ?? {}) as { matchId?: string };
      respond(wsCtx, msg, this.service!.getState(session.agentId, payload.matchId));
    });

    register(COMMAND_SCHEMAS[12], async (wsCtx, msg, session) => {
      respond(wsCtx, msg, await this.service!.getRating(session.agentId, session.userId));
    });

    register(COMMAND_SCHEMAS[13], (wsCtx, msg) => {
      const payload = (msg.payload ?? {}) as { limit?: number };
      const limit = typeof payload.limit === 'number' ? payload.limit : 20;
      respond(wsCtx, msg, this.service!.getLeaderboard(limit));
    });

    ctx.hooks.after('location.enter', ({ locationId, session, ctx: wsCtx }: HookLocationContext) => {
      if (locationId !== CHESS_LOCATION_ID || !session) return;
      const state = this.service!.getState(session.agentId);
      wsCtx.gateway.send(wsCtx.ws, {
        id: '',
        type: 'chess_welcome',
        payload: {
          locationId: CHESS_LOCATION_ID,
          needsBootstrap: true,
          currentMatchId: state.ok ? state.data.matchId : null,
        },
      });
    });

    ctx.hooks.before('location.leave', ({ locationId, session }: HookLocationContext) => {
      if (locationId !== CHESS_LOCATION_ID || !session) return;
      const phase = this.service!.getAgentMatchPhase(session.agentId);
      if (phase === 'playing') {
        throw new Error('You cannot leave the chess hall during an active match.');
      }
    });

    ctx.hooks.after('location.leave', ({ locationId, session }: HookLocationContext) => {
      if (locationId !== CHESS_LOCATION_ID || !session) return;
      this.service!.onLeaveChessLocation(session.agentId);
    });

    ctx.hooks.before('connection.close', ({ session }: HookConnectionCloseContext) => {
      if (!session) return;
      this.service!.onAgentDisconnected(session.agentId);
    });

    ctx.hooks.after('agent.authenticated', ({ session, ctx: wsCtx }: { session: AgentSession; ctx: WSContext }) => {
      if (!session) return;
      const inHall = wsCtx.currentLocation === CHESS_LOCATION_ID;
      const inMatch = this.service!.isAgentInMatch(session.agentId);
      let currentMatchId: string | null = null;

      if (inMatch) {
        const recovered = this.service!.onAgentReconnected(session.agentId);
        if (!recovered.ok) return;
        currentMatchId = recovered.data.matchId;
      }

      if (!inHall && !inMatch) return;
      wsCtx.gateway.send(wsCtx.ws, {
        id: '',
        type: 'chess_reconnected',
        payload: {
          needsBootstrap: true,
          currentMatchId,
        },
      });
    });
  }

  async destroy(): Promise<void> {
    this.service?.dispose();
    this.service = undefined;
  }
}

export default ChessPlugin;
