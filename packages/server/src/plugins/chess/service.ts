import { nanoid } from 'nanoid';
import { Chess } from 'chess.js';
import { sql } from 'drizzle-orm';

import type { UrucDb } from '../../core/database/index.js';
import type { LogService } from '../../core/logger/service.js';
import type { WSErrorPayload, WSMessage, WSGatewayPublic } from '../../core/plugin-system/hook-registry.js';

export const CHESS_LOCATION_ID = 'chess-club';

const INITIAL_RATING = 1500;
const K_FACTOR = 40;
const INITIAL_TIME_MS = 10 * 60 * 1000;
const RECONNECT_GRACE_MS = 60 * 1000;
const FINISHED_MATCH_TTL_MS = 10 * 60 * 1000;

type ChessColor = 'w' | 'b';
type MatchPhase = 'waiting' | 'playing' | 'finished';
type MatchResultType = 'white_win' | 'black_win' | 'draw';
type MatchEndReason =
  | 'checkmate'
  | 'timeout'
  | 'resignation'
  | 'draw_agreement'
  | 'stalemate'
  | 'threefold_repetition'
  | 'fifty_move_rule'
  | 'insufficient_material'
  | 'disconnect_timeout'
  | 'draw';

export interface ChessPlayerIdentity {
  agentId: string;
  userId: string;
  agentName: string;
}

export interface ChessMovePayload {
  from: string;
  to: string;
  promotion?: 'q' | 'r' | 'b' | 'n';
}

export interface ChessRating {
  agentId: string;
  userId: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  updatedAt: number;
}

export interface ChessMatchSummary {
  matchId: string;
  phase: MatchPhase;
  playerCount: number;
  seatsRemaining: number;
  readyCount: number;
  players: Array<{
    agentId: string;
    agentName: string;
    ready: boolean;
    connected: boolean;
  }>;
  createdAt: number;
}

export interface ChessMatchState {
  matchId: string;
  phase: MatchPhase;
  seq: number;
  serverTimestamp: number;
  moveCount: number;
  fen: string;
  pgn: string;
  turn: ChessColor | null;
  inCheck: boolean;
  clocks: {
    whiteMs: number;
    blackMs: number;
  };
  drawOfferBy: string | null;
  players: Array<{
    agentId: string;
    userId: string;
    agentName: string;
    color: ChessColor | null;
    ready: boolean;
    connected: boolean;
    disconnectDeadlineAt: number | null;
  }>;
  yourAgentId?: string;
  yourColor: ChessColor | null;
  result: ChessMatchResult | null;
}

export interface ChessMatchResult {
  result: MatchResultType;
  reason: MatchEndReason;
  winnerAgentId: string | null;
  ratingChanges: Record<string, number>;
  endedAt: number;
}

export interface ChessBootstrapPayload {
  currentMatch: ChessMatchState | null;
  joinableMatches: ChessMatchSummary[];
  lobbyVersion: number;
  rating: ChessRating;
  leaderboard: ChessRating[];
}

export type ChessLobbyDeltaKind = 'room_added' | 'room_updated' | 'room_removed';

export interface ChessLobbyDeltaPayload {
  kind: ChessLobbyDeltaKind;
  version: number;
  matchId: string;
  room?: ChessMatchSummary;
}

export type ChessMatchDeltaKind =
  | 'player_joined'
  | 'player_ready'
  | 'player_left_waiting'
  | 'player_disconnected'
  | 'player_reconnected'
  | 'game_started'
  | 'move_made'
  | 'draw_offered'
  | 'draw_declined'
  | 'game_finished';

export interface ChessMatchDeltaPayload {
  matchId: string;
  seq: number;
  kind: ChessMatchDeltaKind;
  serverTimestamp: number;
  player?: {
    agentId: string;
    userId: string;
    agentName: string;
    color: ChessColor | null;
    ready: boolean;
    connected: boolean;
    disconnectDeadlineAt: number | null;
  };
  agentId?: string;
  players?: Array<{
    agentId: string;
    color: ChessColor | null;
    ready: boolean;
    connected: boolean;
    disconnectDeadlineAt: number | null;
  }>;
  turn?: ChessColor | null;
  clocks?: {
    whiteMs: number;
    blackMs: number;
  };
  move?: {
    from: string;
    to: string;
    san: string;
    promotion: string | null;
  };
  inCheck?: boolean;
  drawOfferBy?: string | null;
  result?: ChessMatchResult;
  reconnectDeadlineAt?: number | null;
}

export type ServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: WSErrorPayload };

interface ChessPlayerSlot extends ChessPlayerIdentity {
  color: ChessColor | null;
  ready: boolean;
  connected: boolean;
  disconnectDeadlineAt: number | null;
  disconnectTimer?: ReturnType<typeof setTimeout>;
}

interface ChessMatch {
  id: string;
  phase: MatchPhase;
  seq: number;
  chess: Chess;
  players: Map<string, ChessPlayerSlot>;
  createdAt: number;
  turnStartedAt: number | null;
  remainingMs: Record<ChessColor, number>;
  drawOfferBy: string | null;
  result: ChessMatchResult | null;
  timeoutTimer?: ReturnType<typeof setTimeout>;
  cleanupTimer?: ReturnType<typeof setTimeout>;
}

interface ChessRatingRow {
  agentId: string;
  userId: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  updatedAt: number;
}

type ChessGateway = WSGatewayPublic & {
  getAgentCurrentLocation?: (agentId: string) => string | undefined;
};

export class ChessService {
  private matches = new Map<string, ChessMatch>();
  private agentToMatch = new Map<string, string>();
  private lobbyVersion = 0;

  constructor(
    private readonly db: UrucDb,
    private readonly gateway: ChessGateway,
    private readonly logger?: LogService,
  ) {}

  init(): void {
    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS chess_ratings (
        agent_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        rating INTEGER NOT NULL DEFAULT 1500,
        games_played INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        draws INTEGER NOT NULL DEFAULT 0,
        updated_at INTEGER NOT NULL
      )
    `);

    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS chess_games (
        id TEXT PRIMARY KEY,
        match_id TEXT NOT NULL,
        white_agent_id TEXT NOT NULL,
        black_agent_id TEXT NOT NULL,
        winner_agent_id TEXT,
        result TEXT NOT NULL,
        reason TEXT NOT NULL,
        pgn TEXT NOT NULL,
        final_fen TEXT NOT NULL,
        played_at INTEGER NOT NULL
      )
    `);

    this.db.run(sql`CREATE INDEX IF NOT EXISTS chess_ratings_rating_idx ON chess_ratings(rating DESC)`);
    this.db.run(sql`CREATE INDEX IF NOT EXISTS chess_games_played_at_idx ON chess_games(played_at DESC)`);
  }

  dispose(): void {
    for (const match of this.matches.values()) {
      this.clearMatchTimers(match);
      for (const player of match.players.values()) {
        this.clearDisconnectTimer(player);
      }
    }
    this.matches.clear();
    this.agentToMatch.clear();
    this.lobbyVersion = 0;
  }

  isAgentInMatch(agentId: string): boolean {
    return this.getActiveMatchByAgent(agentId) !== undefined;
  }

  getAgentMatchPhase(agentId: string): MatchPhase | null {
    const match = this.getActiveMatchByAgent(agentId);
    return match?.phase ?? null;
  }

  createMatch(player: ChessPlayerIdentity): ServiceResult<{ matchId: string; state: ChessMatchState }> {
    const blocked = this.ensureAgentAvailable(player.agentId);
    if (blocked) return { ok: false, error: blocked };

    const matchId = nanoid(10);
    const match: ChessMatch = {
      id: matchId,
      phase: 'waiting',
      seq: 0,
      chess: new Chess(),
      players: new Map(),
      createdAt: Date.now(),
      turnStartedAt: null,
      remainingMs: { w: INITIAL_TIME_MS, b: INITIAL_TIME_MS },
      drawOfferBy: null,
      result: null,
    };

    match.players.set(player.agentId, {
      ...player,
      color: null,
      ready: false,
      connected: true,
      disconnectDeadlineAt: null,
    });

    this.matches.set(matchId, match);
    this.agentToMatch.set(player.agentId, matchId);
    this.log(player, 'chess_create_match', { matchId }, 'success');
    this.emitLobbyChange(null, match);

    return {
      ok: true,
      data: {
        matchId,
        state: this.buildState(match, player.agentId),
      },
    };
  }

  listMatches(): ChessMatchSummary[] {
    return Array.from(this.matches.values())
      .map((match) => this.getJoinableSummary(match))
      .filter((match): match is ChessMatchSummary => match !== null);
  }

  async bootstrap(
    agentId: string,
    userId: string,
    leaderboardLimit = 20,
  ): Promise<ServiceResult<ChessBootstrapPayload>> {
    const rating = await this.getOrCreateRating(agentId, userId);
    const leaderboard = this.getLeaderboard(leaderboardLimit);
    const currentMatch = this.getActiveMatchByAgent(agentId);

    return {
      ok: true,
      data: {
        currentMatch: currentMatch ? this.buildState(currentMatch, agentId) : null,
        joinableMatches: this.listMatches(),
        lobbyVersion: this.lobbyVersion,
        rating,
        leaderboard: leaderboard.ok ? leaderboard.data : [],
      },
    };
  }

  joinMatch(player: ChessPlayerIdentity, matchId: string): ServiceResult<{ state: ChessMatchState }> {
    const blocked = this.ensureAgentAvailable(player.agentId);
    if (blocked) return { ok: false, error: blocked };

    const match = this.matches.get(matchId);
    if (!match) {
      return { ok: false, error: this.error('Match not found', 'MATCH_NOT_FOUND') };
    }
    if (match.phase !== 'waiting') {
      return { ok: false, error: this.error('The match has already started and can no longer be joined.', 'MATCH_ALREADY_STARTED') };
    }
    if (match.players.size >= 2) {
      return { ok: false, error: this.error('The match is full', 'MATCH_FULL') };
    }
    if (match.players.has(player.agentId)) {
      return { ok: false, error: this.error('You are already in this match', 'ALREADY_IN_MATCH') };
    }

    const previousLobbySummary = this.getJoinableSummary(match);
    match.players.set(player.agentId, {
      ...player,
      color: null,
      ready: false,
      connected: true,
      disconnectDeadlineAt: null,
    });
    this.agentToMatch.set(player.agentId, match.id);

    this.log(player, 'chess_join_match', { matchId }, 'success');
    this.emitMatchDelta(match, 'player_joined', {
      player: this.serializePlayer(match.players.get(player.agentId)!),
    });
    this.emitLobbyChange(previousLobbySummary, match);

    return { ok: true, data: { state: this.buildState(match, player.agentId) } };
  }

  leaveWaitingMatch(agentId: string): ServiceResult<{ removedMatchId: string; matches: ChessMatchSummary[] }> {
    const context = this.requirePlayerInMatch(agentId);
    if (!context.ok) return { ok: false, error: context.error };

    const { match } = context.data;
    if (match.phase !== 'waiting') {
      return { ok: false, error: this.error('The current match is not in the waiting phase, so it cannot be closed or left.', 'MATCH_NOT_WAITING') };
    }

    this.removeWaitingPlayer(match, agentId);
    return {
      ok: true,
      data: {
        removedMatchId: match.id,
        matches: this.listMatches(),
      },
    };
  }

  ready(agentId: string): ServiceResult<{ state: ChessMatchState; started: boolean }> {
    const context = this.requirePlayerInMatch(agentId);
    if (!context.ok) return { ok: false, error: context.error };

    const { match, player } = context.data;
    if (match.phase !== 'waiting') {
      return { ok: false, error: this.error('You cannot ready up in the current phase.', 'MATCH_NOT_WAITING') };
    }

    const previousLobbySummary = this.getJoinableSummary(match);
    player.ready = true;
    this.log(player, 'chess_ready', { matchId: match.id }, 'success');

    let started = false;
    if (match.players.size === 2 && Array.from(match.players.values()).every((p) => p.ready)) {
      this.startMatch(match);
      started = true;
    } else {
      this.emitMatchDelta(match, 'player_ready', {
        agentId: player.agentId,
      });
      this.emitLobbyChange(previousLobbySummary, match);
    }

    return {
      ok: true,
      data: {
        state: this.buildState(match, player.agentId),
        started,
      },
    };
  }

  async move(agentId: string, payload: ChessMovePayload): Promise<ServiceResult<{ state: ChessMatchState }>> {
    const context = this.requirePlayerInMatch(agentId);
    if (!context.ok) return { ok: false, error: context.error };

    const { match, player } = context.data;
    if (match.phase !== 'playing') {
      return { ok: false, error: this.error('The match is not currently in the playing phase.', 'MATCH_NOT_PLAYING') };
    }
    if (!player.color) {
      return { ok: false, error: this.error('You have not been assigned a color yet.', 'COLOR_NOT_ASSIGNED') };
    }

    const currentTurn = this.currentTurnColor(match);
    if (currentTurn !== player.color) {
      return { ok: false, error: this.error('It is not your turn yet.', 'NOT_YOUR_TURN') };
    }

    const timing = this.consumeTurnTime(match, Date.now());
    if (timing.timedOut && timing.loserColor) {
      await this.finishTimeout(match, timing.loserColor);
      return { ok: false, error: this.error('You ran out of time and lost the game.', 'TIMEOUT_LOSS', 'chess_state') };
    }

    if (!this.isSquare(payload.from) || !this.isSquare(payload.to)) {
      return { ok: false, error: this.error('Invalid square format. Use values like e2 and e4.', 'INVALID_MOVE_FORMAT') };
    }

    try {
      const move = match.chess.move({
        from: payload.from,
        to: payload.to,
        promotion: payload.promotion,
      }) as { from: string; to: string; san: string; promotion?: string } | null;

      if (!move) {
        return { ok: false, error: this.error('Illegal move', 'INVALID_MOVE') };
      }

      this.log(player, 'chess_move', { matchId: match.id, move }, 'success');
      match.drawOfferBy = null;

      if (this.isGameOver(match.chess)) {
        await this.finishByBoardState(match);
      } else {
        match.turnStartedAt = Date.now();
        this.scheduleTurnTimeout(match);
        this.emitMatchDelta(match, 'move_made', {
          move: {
            from: move.from,
            to: move.to,
            san: move.san,
            promotion: move.promotion ?? null,
          },
          turn: this.currentTurnColor(match),
          clocks: this.buildClockPayload(match),
          inCheck: this.isInCheck(match.chess),
          drawOfferBy: null,
        });
      }

      return {
        ok: true,
        data: {
          state: this.buildState(match, player.agentId),
        },
      };
    } catch {
      return { ok: false, error: this.error('Illegal move', 'INVALID_MOVE') };
    }
  }

  async resign(agentId: string): Promise<ServiceResult<{ state: ChessMatchState }>> {
    const context = this.requirePlayerInMatch(agentId);
    if (!context.ok) return { ok: false, error: context.error };

    const { match, player } = context.data;
    if (match.phase !== 'playing') {
      return { ok: false, error: this.error('The match is not currently in the playing phase.', 'MATCH_NOT_PLAYING') };
    }
    if (!player.color) {
      return { ok: false, error: this.error('You have not been assigned a color yet.', 'COLOR_NOT_ASSIGNED') };
    }

    const winnerColor = this.oppositeColor(player.color);
    await this.finishMatch(
      match,
      winnerColor === 'w' ? 'white_win' : 'black_win',
      'resignation',
    );
    this.log(player, 'chess_resign', { matchId: match.id }, 'success');

    return {
      ok: true,
      data: {
        state: this.buildState(match, agentId),
      },
    };
  }

  offerDraw(agentId: string): ServiceResult<{ state: ChessMatchState }> {
    const context = this.requirePlayerInMatch(agentId);
    if (!context.ok) return { ok: false, error: context.error };

    const { match, player } = context.data;
    if (match.phase !== 'playing') {
      return { ok: false, error: this.error('The match is not currently in the playing phase.', 'MATCH_NOT_PLAYING') };
    }

    if (match.drawOfferBy === agentId) {
      return { ok: false, error: this.error('You have already offered a draw.', 'DRAW_ALREADY_OFFERED') };
    }
    if (match.drawOfferBy) {
      return { ok: false, error: this.error('Your opponent has already offered a draw. Resolve it first.', 'DRAW_OFFER_PENDING') };
    }

    match.drawOfferBy = agentId;
    this.log(player, 'chess_offer_draw', { matchId: match.id }, 'success');
    this.emitMatchDelta(match, 'draw_offered', {
      drawOfferBy: agentId,
    });

    return { ok: true, data: { state: this.buildState(match, agentId) } };
  }

  async acceptDraw(agentId: string): Promise<ServiceResult<{ state: ChessMatchState }>> {
    const context = this.requirePlayerInMatch(agentId);
    if (!context.ok) return { ok: false, error: context.error };

    const { match, player } = context.data;
    if (match.phase !== 'playing') {
      return { ok: false, error: this.error('The match is not currently in the playing phase.', 'MATCH_NOT_PLAYING') };
    }
    if (!match.drawOfferBy) {
      return { ok: false, error: this.error('There is no active draw offer.', 'DRAW_NOT_OFFERED') };
    }
    if (match.drawOfferBy === agentId) {
      return { ok: false, error: this.error('You cannot accept your own draw offer.', 'INVALID_DRAW_ACCEPT') };
    }

    this.log(player, 'chess_accept_draw', { matchId: match.id }, 'success');
    await this.finishMatch(match, 'draw', 'draw_agreement');

    return { ok: true, data: { state: this.buildState(match, agentId) } };
  }

  declineDraw(agentId: string): ServiceResult<{ state: ChessMatchState }> {
    const context = this.requirePlayerInMatch(agentId);
    if (!context.ok) return { ok: false, error: context.error };

    const { match, player } = context.data;
    if (match.phase !== 'playing') {
      return { ok: false, error: this.error('The match is not currently in the playing phase.', 'MATCH_NOT_PLAYING') };
    }
    if (!match.drawOfferBy) {
      return { ok: false, error: this.error('There is no active draw offer.', 'DRAW_NOT_OFFERED') };
    }
    if (match.drawOfferBy === agentId) {
      return { ok: false, error: this.error('You cannot decline your own draw offer.', 'INVALID_DRAW_DECLINE') };
    }

    match.drawOfferBy = null;
    this.log(player, 'chess_decline_draw', { matchId: match.id }, 'success');
    this.emitMatchDelta(match, 'draw_declined', {
      agentId,
      drawOfferBy: null,
    });

    return { ok: true, data: { state: this.buildState(match, agentId) } };
  }

  getState(agentId: string, matchId?: string): ServiceResult<ChessMatchState> {
    if (matchId) {
      const match = this.matches.get(matchId);
      if (!match) {
        return { ok: false, error: this.error('Match not found', 'MATCH_NOT_FOUND') };
      }
      return { ok: true, data: this.buildState(match, agentId) };
    }

    const match = this.getActiveMatchByAgent(agentId);
    if (!match) {
      return { ok: false, error: this.error('You are not currently in any match.', 'MATCH_NOT_FOUND') };
    }
    return { ok: true, data: this.buildState(match, agentId) };
  }

  async getRating(agentId: string, userId: string): Promise<ServiceResult<ChessRating>> {
    const row = await this.getOrCreateRating(agentId, userId);
    return { ok: true, data: row };
  }

  getLeaderboard(limit: number): ServiceResult<ChessRating[]> {
    const normalizedLimit = Number.isFinite(limit) ? Math.min(Math.max(Math.floor(limit), 1), 100) : 20;
    const rows = this.db.all(sql<ChessRatingRow>`
      SELECT
        agent_id AS agentId,
        user_id AS userId,
        rating AS rating,
        games_played AS gamesPlayed,
        wins AS wins,
        losses AS losses,
        draws AS draws,
        updated_at AS updatedAt
      FROM chess_ratings
      ORDER BY rating DESC, games_played DESC
      LIMIT ${normalizedLimit}
    `) as ChessRatingRow[];
    return { ok: true, data: rows };
  }

  onAgentDisconnected(agentId: string): void {
    const match = this.getActiveMatchByAgent(agentId);
    if (!match) return;

    const player = match.players.get(agentId);
    if (!player) return;

    if (match.phase === 'waiting') {
      const previousLobbySummary = this.getJoinableSummary(match);
      player.connected = false;
      player.disconnectDeadlineAt = Date.now() + RECONNECT_GRACE_MS;
      this.clearDisconnectTimer(player);
      player.disconnectTimer = setTimeout(() => {
        this.handleWaitingDisconnectTimeout(match.id, agentId);
      }, RECONNECT_GRACE_MS);
      this.emitMatchDelta(match, 'player_disconnected', {
        agentId,
        reconnectDeadlineAt: player.disconnectDeadlineAt,
      });
      this.emitLobbyChange(previousLobbySummary, match);
      return;
    }
    if (match.phase !== 'playing') return;

    player.connected = false;
    player.disconnectDeadlineAt = Date.now() + RECONNECT_GRACE_MS;
    this.clearDisconnectTimer(player);

    player.disconnectTimer = setTimeout(() => {
      void this.handleDisconnectTimeout(match.id, agentId);
    }, RECONNECT_GRACE_MS);

    this.emitMatchDelta(match, 'player_disconnected', {
      agentId,
      reconnectDeadlineAt: player.disconnectDeadlineAt,
    });
  }

  onAgentReconnected(agentId: string): ServiceResult<ChessMatchState> {
    const context = this.requirePlayerInMatch(agentId);
    if (!context.ok) return { ok: false, error: context.error };

    const { match, player } = context.data;
    const previousLobbySummary = match.phase === 'waiting' ? this.getJoinableSummary(match) : null;
    player.connected = true;
    player.disconnectDeadlineAt = null;
    this.clearDisconnectTimer(player);

    this.emitMatchDelta(match, 'player_reconnected', { agentId });
    if (match.phase === 'waiting') {
      this.emitLobbyChange(previousLobbySummary, match);
    }
    return { ok: true, data: this.buildState(match, agentId) };
  }

  onLeaveChessLocation(agentId: string): void {
    const match = this.getActiveMatchByAgent(agentId);
    if (!match) return;
    if (match.phase !== 'waiting') return;
    this.removeWaitingPlayer(match, agentId);
  }

  private startMatch(match: ChessMatch): void {
    const players = Array.from(match.players.values());
    if (players.length !== 2) return;

    const whiteFirst = Math.random() < 0.5;
    const white = whiteFirst ? players[0] : players[1];
    const black = whiteFirst ? players[1] : players[0];

    white.color = 'w';
    black.color = 'b';
    white.ready = true;
    black.ready = true;
    white.connected = true;
    black.connected = true;
    white.disconnectDeadlineAt = null;
    black.disconnectDeadlineAt = null;

    match.phase = 'playing';
    match.chess = new Chess();
    match.turnStartedAt = Date.now();
    match.remainingMs = { w: INITIAL_TIME_MS, b: INITIAL_TIME_MS };
    match.drawOfferBy = null;
    match.result = null;

    this.scheduleTurnTimeout(match);
    this.emitMatchDelta(match, 'game_started', {
      players: [
        {
          agentId: white.agentId,
          color: 'w',
          ready: white.ready,
          connected: white.connected,
          disconnectDeadlineAt: white.disconnectDeadlineAt,
        },
        {
          agentId: black.agentId,
          color: 'b',
          ready: black.ready,
          connected: black.connected,
          disconnectDeadlineAt: black.disconnectDeadlineAt,
        },
      ],
      turn: 'w',
      clocks: this.buildClockPayload(match),
      inCheck: false,
      drawOfferBy: null,
    });

    this.log(white, 'chess_start', { matchId: match.id, color: 'w' }, 'success');
    this.log(black, 'chess_start', { matchId: match.id, color: 'b' }, 'success');
  }

  private async finishByBoardState(match: ChessMatch): Promise<void> {
    if (this.isCheckmate(match.chess)) {
      const winnerColor = this.oppositeColor(this.currentTurnColor(match));
      await this.finishMatch(
        match,
        winnerColor === 'w' ? 'white_win' : 'black_win',
        'checkmate',
      );
      return;
    }

    const drawReason = this.getDrawReason(match.chess);
    await this.finishMatch(match, 'draw', drawReason);
  }

  private async finishTimeout(match: ChessMatch, loserColor: ChessColor): Promise<void> {
    const winnerColor = this.oppositeColor(loserColor);
    await this.finishMatch(
      match,
      winnerColor === 'w' ? 'white_win' : 'black_win',
      'timeout',
    );
  }

  private async finishMatch(
    match: ChessMatch,
    result: MatchResultType,
    reason: MatchEndReason,
  ): Promise<void> {
    if (match.phase === 'finished') return;

    this.consumeTurnTime(match, Date.now());
    match.phase = 'finished';
    match.turnStartedAt = null;
    match.drawOfferBy = null;
    this.clearMatchTimers(match);

    for (const player of match.players.values()) {
      player.connected = true;
      player.disconnectDeadlineAt = null;
      this.clearDisconnectTimer(player);
    }

    const winnerAgentId = this.resolveWinnerAgentId(match, result);
    const ratingChanges = await this.applyEloResult(match, result);
    const endedAt = Date.now();

    match.result = {
      result,
      reason,
      winnerAgentId,
      ratingChanges,
      endedAt,
    };

    await this.saveFinishedGame(match);
    this.emitMatchDelta(match, 'game_finished', { result: match.result });

    for (const player of match.players.values()) {
      this.agentToMatch.delete(player.agentId);
    }

    this.scheduleFinishedCleanup(match);
  }

  private resolveWinnerAgentId(match: ChessMatch, result: MatchResultType): string | null {
    if (result === 'draw') return null;
    const winnerColor: ChessColor = result === 'white_win' ? 'w' : 'b';
    return this.getPlayerByColor(match, winnerColor)?.agentId ?? null;
  }

  private async applyEloResult(
    match: ChessMatch,
    result: MatchResultType,
  ): Promise<Record<string, number>> {
    const white = this.getPlayerByColor(match, 'w');
    const black = this.getPlayerByColor(match, 'b');
    if (!white || !black) return {};

    const whiteRating = await this.getOrCreateRating(white.agentId, white.userId);
    const blackRating = await this.getOrCreateRating(black.agentId, black.userId);

    const whiteScore = result === 'white_win' ? 1 : result === 'draw' ? 0.5 : 0;
    const blackScore = result === 'black_win' ? 1 : result === 'draw' ? 0.5 : 0;

    const expectedWhite = 1 / (1 + 10 ** ((blackRating.rating - whiteRating.rating) / 400));
    const expectedBlack = 1 / (1 + 10 ** ((whiteRating.rating - blackRating.rating) / 400));

    const whiteDelta = Math.round(K_FACTOR * (whiteScore - expectedWhite));
    const blackDelta = Math.round(K_FACTOR * (blackScore - expectedBlack));

    const now = Date.now();
    await this.updateRating(whiteRating, whiteDelta, whiteScore, now);
    await this.updateRating(blackRating, blackDelta, blackScore, now);

    return {
      [white.agentId]: whiteDelta,
      [black.agentId]: blackDelta,
    };
  }

  private async updateRating(
    row: ChessRatingRow,
    delta: number,
    score: number,
    updatedAt: number,
  ): Promise<void> {
    const wins = row.wins + (score === 1 ? 1 : 0);
    const losses = row.losses + (score === 0 ? 1 : 0);
    const draws = row.draws + (score === 0.5 ? 1 : 0);
    const gamesPlayed = row.gamesPlayed + 1;
    const rating = row.rating + delta;

    this.db.run(sql`
      UPDATE chess_ratings
      SET
        rating = ${rating},
        games_played = ${gamesPlayed},
        wins = ${wins},
        losses = ${losses},
        draws = ${draws},
        updated_at = ${updatedAt}
      WHERE agent_id = ${row.agentId}
    `);
  }

  private async getOrCreateRating(agentId: string, userId: string): Promise<ChessRatingRow> {
    const existing = this.db.get(sql<ChessRatingRow>`
      SELECT
        agent_id AS agentId,
        user_id AS userId,
        rating AS rating,
        games_played AS gamesPlayed,
        wins AS wins,
        losses AS losses,
        draws AS draws,
        updated_at AS updatedAt
      FROM chess_ratings
      WHERE agent_id = ${agentId}
    `) as ChessRatingRow | undefined;

    if (existing) return existing;

    const now = Date.now();
    this.db.run(sql`
      INSERT INTO chess_ratings (
        agent_id,
        user_id,
        rating,
        games_played,
        wins,
        losses,
        draws,
        updated_at
      ) VALUES (
        ${agentId},
        ${userId},
        ${INITIAL_RATING},
        0,
        0,
        0,
        0,
        ${now}
      )
    `);

    return {
      agentId,
      userId,
      rating: INITIAL_RATING,
      gamesPlayed: 0,
      wins: 0,
      losses: 0,
      draws: 0,
      updatedAt: now,
    };
  }

  private async saveFinishedGame(match: ChessMatch): Promise<void> {
    if (!match.result) return;
    const white = this.getPlayerByColor(match, 'w');
    const black = this.getPlayerByColor(match, 'b');
    if (!white || !black) return;

    this.db.run(sql`
      INSERT INTO chess_games (
        id,
        match_id,
        white_agent_id,
        black_agent_id,
        winner_agent_id,
        result,
        reason,
        pgn,
        final_fen,
        played_at
      ) VALUES (
        ${nanoid()},
        ${match.id},
        ${white.agentId},
        ${black.agentId},
        ${match.result.winnerAgentId},
        ${match.result.result},
        ${match.result.reason},
        ${match.chess.pgn()},
        ${match.chess.fen()},
        ${match.result.endedAt}
      )
    `);
  }

  private handleDisconnectTimeout(matchId: string, agentId: string): Promise<void> {
    const match = this.matches.get(matchId);
    if (!match || match.phase !== 'playing') return Promise.resolve();

    const player = match.players.get(agentId);
    if (!player || player.connected || !player.color) return Promise.resolve();

    return this.finishMatch(
      match,
      this.oppositeColor(player.color) === 'w' ? 'white_win' : 'black_win',
      'disconnect_timeout',
    );
  }

  private handleWaitingDisconnectTimeout(matchId: string, agentId: string): void {
    const match = this.matches.get(matchId);
    if (!match || match.phase !== 'waiting') return;
    const player = match.players.get(agentId);
    if (!player || player.connected) return;
    this.removeWaitingPlayer(match, agentId);
  }

  private scheduleTurnTimeout(match: ChessMatch): void {
    this.clearTurnTimer(match);
    if (match.phase !== 'playing') return;

    const turnColor = this.currentTurnColor(match);
    const remaining = this.getRemainingMs(match, turnColor, Date.now());
    if (remaining <= 0) {
      void this.finishTimeout(match, turnColor);
      return;
    }

    match.timeoutTimer = setTimeout(() => {
      const timing = this.consumeTurnTime(match, Date.now());
      if (timing.timedOut && timing.loserColor) {
        void this.finishTimeout(match, timing.loserColor);
      } else {
        this.scheduleTurnTimeout(match);
      }
    }, remaining + 10);
  }

  private consumeTurnTime(
    match: ChessMatch,
    now: number,
  ): { timedOut: boolean; loserColor?: ChessColor } {
    if (match.phase !== 'playing' || match.turnStartedAt === null) {
      return { timedOut: false };
    }

    const turnColor = this.currentTurnColor(match);
    const elapsed = Math.max(0, now - match.turnStartedAt);
    match.remainingMs[turnColor] = Math.max(0, match.remainingMs[turnColor] - elapsed);
    match.turnStartedAt = now;

    if (match.remainingMs[turnColor] <= 0) {
      return { timedOut: true, loserColor: turnColor };
    }
    return { timedOut: false };
  }

  private getRemainingMs(match: ChessMatch, color: ChessColor, now: number): number {
    let remaining = match.remainingMs[color];
    if (
      match.phase === 'playing' &&
      match.turnStartedAt !== null &&
      this.currentTurnColor(match) === color
    ) {
      remaining -= Math.max(0, now - match.turnStartedAt);
    }
    return Math.max(0, Math.floor(remaining));
  }

  private currentTurnColor(match: ChessMatch): ChessColor {
    return match.chess.turn() as ChessColor;
  }

  private getPlayerByColor(match: ChessMatch, color: ChessColor): ChessPlayerSlot | undefined {
    for (const player of match.players.values()) {
      if (player.color === color) return player;
    }
    return undefined;
  }

  private emitMatchDelta(
    match: ChessMatch,
    kind: ChessMatchDeltaKind,
    payload: Omit<ChessMatchDeltaPayload, 'matchId' | 'seq' | 'kind' | 'serverTimestamp'> = {},
  ): void {
    const delta: ChessMatchDeltaPayload = {
      matchId: match.id,
      seq: ++match.seq,
      kind,
      serverTimestamp: Date.now(),
      ...payload,
    };

    for (const player of match.players.values()) {
      this.gateway.sendToAgent(player.agentId, {
        id: '',
        type: 'chess_match_delta',
        payload: delta,
      });
    }
  }

  private emitLobbyChange(previous: ChessMatchSummary | null, match: ChessMatch | null): void {
    const next = match ? this.getJoinableSummary(match) : null;

    if (!previous && !next) return;

    let kind: ChessLobbyDeltaKind;
    let room: ChessMatchSummary | undefined;
    let matchId: string;

    if (!previous && next) {
      kind = 'room_added';
      room = next;
      matchId = next.matchId;
    } else if (previous && !next) {
      kind = 'room_removed';
      matchId = previous.matchId;
    } else if (previous && next) {
      kind = 'room_updated';
      room = next;
      matchId = next.matchId;
    } else {
      return;
    }

    const version = ++this.lobbyVersion;
    const payload: ChessLobbyDeltaPayload = { kind, version, matchId, room };
    this.sendToChessHall({ id: '', type: 'chess_lobby_delta', payload });
  }

  private sendToChessHall(msg: WSMessage): void {
    if (typeof this.gateway.getAgentCurrentLocation !== 'function') return;

    for (const agentId of this.gateway.getOnlineAgentIds()) {
      if (this.gateway.getAgentCurrentLocation(agentId) !== CHESS_LOCATION_ID) continue;
      this.gateway.sendToAgent(agentId, msg);
    }
  }

  private buildState(match: ChessMatch, viewerAgentId?: string): ChessMatchState {
    const now = Date.now();
    const whiteMs = this.getRemainingMs(match, 'w', now);
    const blackMs = this.getRemainingMs(match, 'b', now);
    const viewer = viewerAgentId ? match.players.get(viewerAgentId) : undefined;

    return {
      matchId: match.id,
      phase: match.phase,
      seq: match.seq,
      serverTimestamp: now,
      moveCount: match.chess.history().length,
      fen: match.chess.fen(),
      pgn: match.chess.pgn(),
      turn: match.phase === 'playing' ? this.currentTurnColor(match) : null,
      inCheck: match.phase === 'playing' ? this.isInCheck(match.chess) : false,
      clocks: {
        whiteMs,
        blackMs,
      },
      drawOfferBy: match.drawOfferBy,
      players: Array.from(match.players.values()).map((player) => ({
        agentId: player.agentId,
        userId: player.userId,
        agentName: player.agentName,
        color: player.color,
        ready: player.ready,
        connected: player.connected,
        disconnectDeadlineAt: player.disconnectDeadlineAt,
      })),
      yourAgentId: viewerAgentId,
      yourColor: viewer?.color ?? null,
      result: match.result,
    };
  }

  private buildClockPayload(match: ChessMatch): { whiteMs: number; blackMs: number } {
    const now = Date.now();
    return {
      whiteMs: this.getRemainingMs(match, 'w', now),
      blackMs: this.getRemainingMs(match, 'b', now),
    };
  }

  private buildSummary(match: ChessMatch): ChessMatchSummary {
    return {
      matchId: match.id,
      phase: match.phase,
      playerCount: match.players.size,
      seatsRemaining: Math.max(0, 2 - match.players.size),
      readyCount: Array.from(match.players.values()).filter((p) => p.ready).length,
      players: Array.from(match.players.values()).map((player) => ({
        agentId: player.agentId,
        agentName: player.agentName,
        ready: player.ready,
        connected: player.connected,
      })),
      createdAt: match.createdAt,
    };
  }

  private getJoinableSummary(match: ChessMatch): ChessMatchSummary | null {
    if (match.phase !== 'waiting' || match.players.size >= 2) return null;
    return this.buildSummary(match);
  }

  private serializePlayer(player: ChessPlayerSlot): ChessMatchDeltaPayload['player'] {
    return {
      agentId: player.agentId,
      userId: player.userId,
      agentName: player.agentName,
      color: player.color,
      ready: player.ready,
      connected: player.connected,
      disconnectDeadlineAt: player.disconnectDeadlineAt,
    };
  }

  private requirePlayerInMatch(
    agentId: string,
  ): ServiceResult<{ match: ChessMatch; player: ChessPlayerSlot }> {
    const match = this.getActiveMatchByAgent(agentId);
    if (!match) {
      return { ok: false, error: this.error('You are not currently in any match.', 'MATCH_NOT_FOUND', 'chess_create_match') };
    }
    const player = match.players.get(agentId);
    if (!player) {
      this.agentToMatch.delete(agentId);
      return { ok: false, error: this.error('Player state is inconsistent for this match. Please rejoin.', 'PLAYER_NOT_IN_MATCH') };
    }
    return { ok: true, data: { match, player } };
  }

  private getActiveMatchByAgent(agentId: string): ChessMatch | undefined {
    const matchId = this.agentToMatch.get(agentId);
    if (!matchId) return undefined;
    const match = this.matches.get(matchId);
    if (!match) {
      this.agentToMatch.delete(agentId);
      return undefined;
    }
    return match;
  }

  private ensureAgentAvailable(agentId: string): WSErrorPayload | null {
    const match = this.getActiveMatchByAgent(agentId);
    if (!match) return null;

    if (match.phase === 'finished') {
      this.agentToMatch.delete(agentId);
      return null;
    }
    return this.error('You are already in an active match.', 'ALREADY_IN_MATCH', 'chess_state');
  }

  private removeWaitingPlayer(match: ChessMatch, agentId: string): void {
    const player = match.players.get(agentId);
    if (!player) return;

    const previousLobbySummary = this.getJoinableSummary(match);
    this.clearDisconnectTimer(player);
    match.players.delete(agentId);
    this.agentToMatch.delete(agentId);
    this.log(player, 'chess_leave_waiting', { matchId: match.id }, 'success');

    if (match.players.size === 0) {
      this.emitLobbyChange(previousLobbySummary, null);
      this.clearMatchTimers(match);
      this.matches.delete(match.id);
      return;
    }

    this.emitMatchDelta(match, 'player_left_waiting', { agentId });
    this.emitLobbyChange(previousLobbySummary, match);
  }

  private scheduleFinishedCleanup(match: ChessMatch): void {
    if (match.cleanupTimer) clearTimeout(match.cleanupTimer);
    match.cleanupTimer = setTimeout(() => {
      const current = this.matches.get(match.id);
      if (!current || current.phase !== 'finished') return;
      this.clearMatchTimers(current);
      this.matches.delete(match.id);
    }, FINISHED_MATCH_TTL_MS);
  }

  private clearMatchTimers(match: ChessMatch): void {
    this.clearTurnTimer(match);
    if (match.cleanupTimer) {
      clearTimeout(match.cleanupTimer);
      match.cleanupTimer = undefined;
    }
  }

  private clearTurnTimer(match: ChessMatch): void {
    if (match.timeoutTimer) {
      clearTimeout(match.timeoutTimer);
      match.timeoutTimer = undefined;
    }
  }

  private clearDisconnectTimer(player: ChessPlayerSlot): void {
    if (player.disconnectTimer) {
      clearTimeout(player.disconnectTimer);
      player.disconnectTimer = undefined;
    }
  }

  private oppositeColor(color: ChessColor): ChessColor {
    return color === 'w' ? 'b' : 'w';
  }

  private isSquare(value: string): boolean {
    return /^[a-h][1-8]$/.test(value);
  }

  private isGameOver(chess: Chess): boolean {
    const c = chess as unknown as {
      isGameOver?: () => boolean;
      game_over?: () => boolean;
    };
    if (typeof c.isGameOver === 'function') return c.isGameOver();
    if (typeof c.game_over === 'function') return c.game_over();
    return false;
  }

  private isCheckmate(chess: Chess): boolean {
    const c = chess as unknown as {
      isCheckmate?: () => boolean;
      in_checkmate?: () => boolean;
    };
    if (typeof c.isCheckmate === 'function') return c.isCheckmate();
    if (typeof c.in_checkmate === 'function') return c.in_checkmate();
    return false;
  }

  private isInCheck(chess: Chess): boolean {
    const c = chess as unknown as {
      isCheck?: () => boolean;
      inCheck?: () => boolean;
      in_check?: () => boolean;
    };
    if (typeof c.isCheck === 'function') return c.isCheck();
    if (typeof c.inCheck === 'function') return c.inCheck();
    if (typeof c.in_check === 'function') return c.in_check();
    return false;
  }

  private getDrawReason(chess: Chess): MatchEndReason {
    const c = chess as unknown as {
      isStalemate?: () => boolean;
      in_stalemate?: () => boolean;
      isThreefoldRepetition?: () => boolean;
      in_threefold_repetition?: () => boolean;
      isDrawByFiftyMoves?: () => boolean;
      in_draw?: () => boolean;
      isInsufficientMaterial?: () => boolean;
      insufficient_material?: () => boolean;
      isDraw?: () => boolean;
    };

    if (typeof c.isStalemate === 'function' && c.isStalemate()) return 'stalemate';
    if (typeof c.in_stalemate === 'function' && c.in_stalemate()) return 'stalemate';

    if (typeof c.isThreefoldRepetition === 'function' && c.isThreefoldRepetition()) {
      return 'threefold_repetition';
    }
    if (typeof c.in_threefold_repetition === 'function' && c.in_threefold_repetition()) {
      return 'threefold_repetition';
    }

    if (typeof c.isDrawByFiftyMoves === 'function' && c.isDrawByFiftyMoves()) {
      return 'fifty_move_rule';
    }

    if (typeof c.isInsufficientMaterial === 'function' && c.isInsufficientMaterial()) {
      return 'insufficient_material';
    }
    if (typeof c.insufficient_material === 'function' && c.insufficient_material()) {
      return 'insufficient_material';
    }

    if (typeof c.in_draw === 'function' && c.in_draw()) return 'draw';
    if (typeof c.isDraw === 'function' && c.isDraw()) return 'draw';
    return 'draw';
  }

  private error(
    error: string,
    code: string,
    action?: string,
    retryable?: boolean,
  ): WSErrorPayload {
    const payload: WSErrorPayload = { error, code };
    if (action) payload.action = action;
    if (typeof retryable === 'boolean') payload.retryable = retryable;
    return payload;
  }

  private log(
    player: ChessPlayerIdentity,
    actionType: string,
    payload: unknown,
    result: 'success' | 'failure',
    detail?: string,
  ): void {
    if (!this.logger) return;
    void this.logger.log({
      userId: player.userId,
      agentId: player.agentId,
      locationId: CHESS_LOCATION_ID,
      actionType,
      payload,
      result,
      detail,
    });
  }
}
