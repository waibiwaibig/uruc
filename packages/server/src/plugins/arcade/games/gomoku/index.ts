import {
  ARCADE_GAME_API_VERSION,
  type ArcadeGameAction,
  type ArcadeGameActionReceipt,
  type ArcadeGameActionSchema,
  type ArcadeGameDefinition,
  type ArcadeGameHostContext,
  type ArcadeGameResult,
  type ArcadeGameSession,
  type ArcadeGameSessionContext,
  type ArcadeJoinResult,
  type ArcadeLeaveReason,
  type ArcadeLeaveResult,
  type ArcadePlayerIdentity,
  type ArcadeSessionResult,
  type ArcadeSessionResultItem,
  type ArcadeSessionState,
  type ArcadeSessionStatus,
  type ArcadeTimelineEvent,
} from '../../types.js';

type Stone = 'black' | 'white';
type Phase = 'waiting' | 'playing' | 'between_matches';
type PlayerStatus = 'joined' | 'ready' | 'playing' | 'won' | 'lost' | 'draw';

type BoardCell = Stone | null;

interface Move {
  x: number;
  y: number;
  stone: Stone;
  agentId: string;
  agentName: string;
}

interface PlayerState {
  info: ArcadePlayerIdentity;
  connected: boolean;
  ready: boolean;
  status: PlayerStatus;
  stone: Stone | null;
}

const BOARD_SIZE = 15;
const MAX_PLAYERS = 2;
const WIN_LENGTH = 5;
const DIRECTIONS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

function createBoard(): BoardCell[][] {
  return Array.from({ length: BOARD_SIZE }, () => Array.from({ length: BOARD_SIZE }, () => null));
}

function cloneBoard(board: BoardCell[][]): BoardCell[][] {
  return board.map((row) => [...row]);
}

function isInsideBoard(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_SIZE && y >= 0 && y < BOARD_SIZE;
}

function stoneLabel(stone: Stone): string {
  return stone === 'black' ? '黑' : '白';
}

function buildWinningLine(board: BoardCell[][], x: number, y: number, stone: Stone): Array<{ x: number; y: number }> | null {
  for (const [dx, dy] of DIRECTIONS) {
    const line = [{ x, y }];

    let cx = x - dx;
    let cy = y - dy;
    while (isInsideBoard(cx, cy) && board[cy][cx] === stone) {
      line.unshift({ x: cx, y: cy });
      cx -= dx;
      cy -= dy;
    }

    cx = x + dx;
    cy = y + dy;
    while (isInsideBoard(cx, cy) && board[cy][cx] === stone) {
      line.push({ x: cx, y: cy });
      cx += dx;
      cy += dy;
    }

    if (line.length >= WIN_LENGTH) return line;
  }

  return null;
}

function normalizeCoordinate(raw: unknown): number | null {
  if (typeof raw !== 'number' || !Number.isInteger(raw)) return null;
  return raw;
}

class GomokuSession implements ArcadeGameSession {
  private readonly ctx: ArcadeGameSessionContext;
  private readonly players = new Map<string, PlayerState>();
  private readonly seatOrder: string[] = [];
  private phase: Phase = 'waiting';
  private board = createBoard();
  private currentTurn: string | null = null;
  private drawOfferedBy: string | null = null;
  private lastMove: Move | null = null;
  private moveHistory: Move[] = [];
  private winner: string | null = null;
  private winningLine: Array<{ x: number; y: number }> | null = null;
  private recap: ArcadeSessionResult | null = null;
  private eventCounter = 0;
  private roundNumber = 0;

  constructor(ctx: ArcadeGameSessionContext) {
    this.ctx = ctx;
  }

  get status(): ArcadeSessionStatus {
    return this.phase === 'playing' ? 'playing' : 'waiting';
  }

  onJoin(player: ArcadePlayerIdentity): ArcadeJoinResult {
    const existing = this.players.get(player.agentId);
    if (existing) {
      existing.info = player;
      existing.connected = true;
      return { ok: true };
    }

    if (this.players.size >= MAX_PLAYERS) {
      return { ok: false, error: 'This Gomoku table supports only 2 seated players' };
    }

    this.players.set(player.agentId, {
      info: player,
      connected: true,
      ready: false,
      status: 'joined',
      stone: null,
    });
    this.seatOrder.push(player.agentId);
    this.recordEvent({
      kind: 'player_joined',
      actorId: player.agentId,
      actorName: player.agentName,
      message: `${player.agentName} 已入座五子棋桌`,
      detail: `当前共 ${this.players.size} / ${MAX_PLAYERS} 人`,
    });
    return { ok: true };
  }

  onLeave(player: ArcadePlayerIdentity, reason: ArcadeLeaveReason): ArcadeLeaveResult {
    const state = this.players.get(player.agentId);
    if (!state) return { keepSlot: false };

    if (reason === 'disconnect') {
      state.connected = false;
      this.recordEvent({
        kind: 'player_disconnected',
        actorId: player.agentId,
        actorName: player.agentName,
        message: `${player.agentName} 断线，等待重连`,
        detail: '保留席位，若超时未回则判负离桌',
      });
      return { keepSlot: true };
    }

    if (this.phase === 'playing') {
      const opponent = this.findOpponent(player.agentId);
      if (opponent) {
        void this.finishMatch({
          outcome: 'resignation',
          winnerAgentId: opponent.info.agentId,
          loserAgentId: player.agentId,
          detail: reason === 'timeout'
            ? `${player.agentName} 断线超时，${opponent.info.agentName} 获胜`
            : `${player.agentName} 离桌判负，${opponent.info.agentName} 获胜`,
        });
      }
    }

    this.removePlayer(player.agentId);
    return { keepSlot: false };
  }

  onReconnect(player: ArcadePlayerIdentity): { ok: boolean; error?: string } {
    const state = this.players.get(player.agentId);
    if (!state) return { ok: false, error: 'The seat is no longer valid' };
    state.connected = true;
    state.info = player;
    this.recordEvent({
      kind: 'player_reconnected',
      actorId: player.agentId,
      actorName: player.agentName,
      message: `${player.agentName} 已重回棋局`,
    });
    return { ok: true };
  }

  onAction(player: ArcadePlayerIdentity, action: ArcadeGameAction): ArcadeGameResult {
    const state = this.players.get(player.agentId);
    if (!state) {
      return { ok: false, error: 'You are not currently seated at this Gomoku table' };
    }

    switch (action.type) {
      case 'ready':
        return this.handleReady(state);
      case 'place_stone':
        return this.handlePlaceStone(state, action);
      case 'offer_draw':
        return this.handleOfferDraw(state);
      case 'accept_draw':
        return this.handleAcceptDraw(state);
      case 'decline_draw':
        return this.handleDeclineDraw(state);
      case 'resign':
        return this.handleResign(state);
      default:
        return { ok: false, error: `Unsupported Gomoku action: ${action.type}` };
    }
  }

  getState(viewer?: ArcadePlayerIdentity): ArcadeSessionState {
    const viewerState = viewer ? this.players.get(viewer.agentId) ?? null : null;
    return {
      status: this.status,
      phase: this.phase,
      prompt: this.buildPrompt(viewerState),
      needAction: this.viewerNeedsAction(viewerState),
      legalActions: [],
      players: this.seatOrder
        .map((agentId) => this.players.get(agentId))
        .filter((state): state is PlayerState => Boolean(state))
        .map((state) => ({
          agentId: state.info.agentId,
          agentName: state.info.agentName,
          isHost: !!state.info.isHost,
          status: state.status,
          connected: state.connected,
          readyForNextHand: state.ready,
          stone: state.stone,
        })),
      board: cloneBoard(this.board),
      size: BOARD_SIZE,
      turn: this.currentTurn,
      currentTurn: this.currentTurn,
      moveCount: this.moveHistory.length,
      lastMove: this.lastMove,
      winner: this.winner,
      winningLine: this.winningLine,
      drawOfferedBy: this.drawOfferedBy,
      roundNumber: this.roundNumber,
      result: this.recap,
    };
  }

  getActionSchema(viewer?: ArcadePlayerIdentity): ArcadeGameActionSchema[] {
    const viewerState = viewer ? this.players.get(viewer.agentId) ?? null : null;
    if (!viewerState) return [];

    if (this.phase !== 'playing') {
      if (!viewerState.ready) {
        return [{
          type: 'ready',
          label: '准备开局',
          description: '确认参加下一盘五子棋',
          style: 'primary',
          helperText: this.players.size < MAX_PLAYERS ? '等待第二位玩家入座' : '双方都准备后自动开始',
          params: {},
        }];
      }
      return [];
    }

    const actions: ArcadeGameActionSchema[] = [
      {
        type: 'resign',
        label: '认输',
        description: '立即结束本局并判负',
        style: 'danger',
        params: {},
      },
    ];

    if (this.drawOfferedBy && this.drawOfferedBy !== viewerState.info.agentId) {
      actions.unshift(
        {
          type: 'accept_draw',
          label: '接受和棋',
          description: '接受对方的和棋提议',
          style: 'primary',
          params: {},
        },
        {
          type: 'decline_draw',
          label: '拒绝和棋',
          description: '拒绝对方的和棋提议并继续',
          params: {},
        },
      );
      return actions;
    }

    if (!this.drawOfferedBy) {
      actions.push({
        type: 'offer_draw',
        label: '提议和棋',
        description: '向对手发起和棋提议',
        params: {},
      });
    }

    if (this.currentTurn === viewerState.info.agentId) {
      actions.unshift({
        type: 'place_stone',
        label: '落子',
        description: '在棋盘空位上落下一枚棋子',
        style: 'primary',
        params: {
          x: {
            type: 'number',
            description: '列坐标，从 0 到 14',
            required: true,
            min: 0,
            max: BOARD_SIZE - 1,
            step: 1,
          },
          y: {
            type: 'number',
            description: '行坐标，从 0 到 14',
            required: true,
            min: 0,
            max: BOARD_SIZE - 1,
            step: 1,
          },
        },
      });
    }

    return actions;
  }

  dispose(): void {}

  private handleReady(state: PlayerState): ArcadeGameResult {
    if (this.phase === 'playing') {
      return { ok: false, error: 'A round is already in progress, you cannot ready up again' };
    }

    state.ready = true;
    state.status = 'ready';
    const event = this.recordEvent({
      kind: 'ready',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} 已准备好开局`,
      detail: `当前已有 ${this.readyPlayers().length} / ${MAX_PLAYERS} 位玩家准备`,
    });

    if (this.players.size === MAX_PLAYERS && this.readyPlayers().length === MAX_PLAYERS) {
      this.startMatch();
    }

    return this.okFromEvent(event);
  }

  private handlePlaceStone(state: PlayerState, action: ArcadeGameAction): ArcadeGameResult {
    if (this.phase !== 'playing') {
      return { ok: false, error: 'You are not currently in a round' };
    }
    if (this.currentTurn !== state.info.agentId) {
      return { ok: false, error: 'It is not your turn to place a stone yet' };
    }

    const x = normalizeCoordinate(action.x);
    const y = normalizeCoordinate(action.y);
    if (x === null || y === null || !isInsideBoard(x, y)) {
      return { ok: false, error: 'Provide valid coordinates between 0 and 14' };
    }
    if (this.board[y][x] !== null) {
      return { ok: false, error: 'That position is already occupied' };
    }

    const stone = state.stone;
    if (!stone) {
      return { ok: false, error: 'The current player stone color has not been initialized' };
    }

    this.board[y][x] = stone;
    const move: Move = {
      x,
      y,
      stone,
      agentId: state.info.agentId,
      agentName: state.info.agentName,
    };
    this.lastMove = move;
    this.moveHistory.push(move);
    this.drawOfferedBy = null;

    const winLine = buildWinningLine(this.board, x, y, stone);
    if (winLine) {
      void this.finishMatch({
        outcome: 'victory',
        winnerAgentId: state.info.agentId,
        loserAgentId: this.findOpponent(state.info.agentId)?.info.agentId ?? null,
        detail: `${state.info.agentName} 执${stoneLabel(stone)}在 (${x}, ${y}) 形成五连`,
        winningLine: winLine,
      });
      const event = this.recordEvent({
        kind: 'stone_placed',
        actorId: state.info.agentId,
        actorName: state.info.agentName,
        message: `${state.info.agentName} 落子 ${stoneLabel(stone)} (${x}, ${y})`,
        detail: '形成五连，当前对局结束',
      });
      return this.okFromEvent(event);
    }

    if (this.moveHistory.length >= BOARD_SIZE * BOARD_SIZE) {
      void this.finishMatch({
        outcome: 'draw',
        winnerAgentId: null,
        loserAgentId: null,
        detail: '棋盘已满，本局和棋',
      });
      const event = this.recordEvent({
        kind: 'stone_placed',
        actorId: state.info.agentId,
        actorName: state.info.agentName,
        message: `${state.info.agentName} 落子 ${stoneLabel(stone)} (${x}, ${y})`,
        detail: '棋盘已满，判定和棋',
      });
      return this.okFromEvent(event);
    }

    this.currentTurn = this.findOpponent(state.info.agentId)?.info.agentId ?? null;
    state.status = 'playing';
    const opponent = this.findOpponent(state.info.agentId);
    if (opponent) opponent.status = 'playing';
    const event = this.recordEvent({
      kind: 'stone_placed',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} 落子 ${stoneLabel(stone)} (${x}, ${y})`,
      detail: this.currentTurn ? `轮到 ${this.players.get(this.currentTurn)?.info.agentName ?? '对手'} 行动` : undefined,
    });
    return this.okFromEvent(event);
  }

  private handleOfferDraw(state: PlayerState): ArcadeGameResult {
    if (this.phase !== 'playing') {
      return { ok: false, error: 'You are not currently in a round' };
    }
    if (this.drawOfferedBy) {
      return { ok: false, error: 'There is already a pending draw offer' };
    }

    this.drawOfferedBy = state.info.agentId;
    const event = this.recordEvent({
      kind: 'draw_offered',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} 提议和棋`,
      detail: '等待对手接受或拒绝',
    });
    return this.okFromEvent(event);
  }

  private handleAcceptDraw(state: PlayerState): ArcadeGameResult {
    if (this.phase !== 'playing' || !this.drawOfferedBy) {
      return { ok: false, error: 'There is no pending draw offer to resolve' };
    }
    if (this.drawOfferedBy === state.info.agentId) {
      return { ok: false, error: 'You cannot accept your own draw offer' };
    }

    void this.finishMatch({
      outcome: 'draw',
      winnerAgentId: null,
      loserAgentId: null,
      detail: `${state.info.agentName} 接受了和棋提议`,
    });
    const event = this.recordEvent({
      kind: 'draw_accepted',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} 接受和棋，当前对局结束`,
    });
    return this.okFromEvent(event);
  }

  private handleDeclineDraw(state: PlayerState): ArcadeGameResult {
    if (this.phase !== 'playing' || !this.drawOfferedBy) {
      return { ok: false, error: 'There is no pending draw offer to resolve' };
    }
    if (this.drawOfferedBy === state.info.agentId) {
      return { ok: false, error: 'You cannot decline your own draw offer' };
    }

    this.drawOfferedBy = null;
    const event = this.recordEvent({
      kind: 'draw_declined',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} 拒绝和棋提议`,
      detail: '对局继续进行',
    });
    return this.okFromEvent(event);
  }

  private handleResign(state: PlayerState): ArcadeGameResult {
    if (this.phase !== 'playing') {
      return { ok: false, error: 'You are not currently in a round' };
    }

    const opponent = this.findOpponent(state.info.agentId);
    void this.finishMatch({
      outcome: 'resignation',
      winnerAgentId: opponent?.info.agentId ?? null,
      loserAgentId: state.info.agentId,
      detail: `${state.info.agentName} 认输`,
    });
    const event = this.recordEvent({
      kind: 'resigned',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} 认输`,
      detail: opponent ? `${opponent.info.agentName} 获胜` : '当前对局结束',
    });
    return this.okFromEvent(event);
  }

  private startMatch(): void {
    const activePlayers = this.seatOrder
      .map((agentId) => this.players.get(agentId))
      .filter((state): state is PlayerState => Boolean(state))
      .slice(0, MAX_PLAYERS);

    if (activePlayers.length !== MAX_PLAYERS) return;

    this.phase = 'playing';
    this.roundNumber += 1;
    this.board = createBoard();
    this.currentTurn = activePlayers[0].info.agentId;
    this.drawOfferedBy = null;
    this.lastMove = null;
    this.moveHistory = [];
    this.winner = null;
    this.winningLine = null;
    this.recap = null;

    for (const [index, state] of activePlayers.entries()) {
      state.ready = false;
      state.status = 'playing';
      state.stone = index === 0 ? 'black' : 'white';
    }

    this.recordEvent({
      kind: 'match_started',
      message: `第 ${this.roundNumber} 局五子棋开始`,
      detail: `${activePlayers[0].info.agentName} 执黑先行，${activePlayers[1].info.agentName} 执白`,
    });
  }

  private async finishMatch(input: {
    outcome: 'victory' | 'resignation' | 'draw';
    winnerAgentId: string | null;
    loserAgentId: string | null;
    detail: string;
    winningLine?: Array<{ x: number; y: number }> | null;
  }): Promise<void> {
    if (this.phase !== 'playing') return;

    this.phase = 'between_matches';
    this.currentTurn = null;
    this.drawOfferedBy = null;
    this.winner = input.winnerAgentId;
    this.winningLine = input.winningLine ?? null;

    const items: ArcadeSessionResultItem[] = [];

    for (const state of this.players.values()) {
      state.ready = false;
      if (input.outcome === 'draw') {
        state.status = 'draw';
        items.push({
          agentId: state.info.agentId,
          agentName: state.info.agentName,
          outcome: '和棋',
          summary: '双方同意和棋或棋盘已满',
          label: state.stone ? `${stoneLabel(state.stone)}方` : undefined,
        });
        await this.ctx.stats.recordResult(state.info.agentId, 'gomoku', 'draw', 0, 0);
        continue;
      }

      if (input.winnerAgentId === state.info.agentId) {
        state.status = 'won';
        items.push({
          agentId: state.info.agentId,
          agentName: state.info.agentName,
          outcome: '获胜',
          summary: input.detail,
          label: state.stone ? `${stoneLabel(state.stone)}方` : undefined,
        });
        await this.ctx.stats.recordResult(state.info.agentId, 'gomoku', 'win', 0, 0);
      } else {
        state.status = 'lost';
        items.push({
          agentId: state.info.agentId,
          agentName: state.info.agentName,
          outcome: '失利',
          summary: input.detail,
          label: state.stone ? `${stoneLabel(state.stone)}方` : undefined,
        });
        await this.ctx.stats.recordResult(state.info.agentId, 'gomoku', 'loss', 0, 0);
      }
    }

    this.recap = {
      title: `第 ${this.roundNumber} 局结束`,
      summary: input.outcome === 'draw'
        ? '本局和棋'
        : `${this.players.get(input.winnerAgentId ?? '')?.info.agentName ?? '对手'} 获胜`,
      detail: input.detail,
      items,
    };

    this.recordEvent({
      kind: 'game_over',
      message: this.recap.summary,
      detail: input.detail,
    });
  }

  private buildPrompt(viewerState: PlayerState | null): string {
    if (!viewerState) {
      if (this.phase === 'playing') return '观战中，等待当前对局推进';
      return `等待两位玩家准备开局（当前 ${this.players.size} / ${MAX_PLAYERS} 人）`;
    }

    if (this.phase !== 'playing') {
      if (this.recap) {
        if (!viewerState.ready) return `${this.recap.summary}。点击准备可开始下一局`;
        return `${this.recap.summary}。等待另一位玩家准备`;
      }
      if (viewerState.ready) return '已准备，等待另一位玩家';
      if (this.players.size < MAX_PLAYERS) return '等待另一位玩家入座后准备开局';
      return '点击准备，双方准备后自动开局';
    }

    if (this.drawOfferedBy && this.drawOfferedBy !== viewerState.info.agentId) {
      return `${this.players.get(this.drawOfferedBy)?.info.agentName ?? '对手'} 提议和棋，你可以接受或拒绝`;
    }
    if (this.currentTurn === viewerState.info.agentId) {
      return `轮到你落子，当前执${stoneLabel(viewerState.stone ?? 'black')}`;
    }
    if (viewerState.stone) {
      return `等待对手落子，你当前执${stoneLabel(viewerState.stone)}`;
    }
    return '当前对局进行中';
  }

  private viewerNeedsAction(viewerState: PlayerState | null): boolean {
    if (!viewerState) return false;
    if (this.phase !== 'playing') return !viewerState.ready;
    if (this.drawOfferedBy && this.drawOfferedBy !== viewerState.info.agentId) return true;
    return this.currentTurn === viewerState.info.agentId;
  }

  private readyPlayers(): PlayerState[] {
    return Array.from(this.players.values()).filter((state) => state.ready);
  }

  private findOpponent(agentId: string): PlayerState | null {
    for (const state of this.players.values()) {
      if (state.info.agentId !== agentId) return state;
    }
    return null;
  }

  private removePlayer(agentId: string): void {
    this.players.delete(agentId);
    const seatIndex = this.seatOrder.indexOf(agentId);
    if (seatIndex >= 0) this.seatOrder.splice(seatIndex, 1);
    if (this.phase !== 'playing') {
      if (this.players.size === 0) {
        this.recap = null;
      }
      return;
    }
    if (this.currentTurn === agentId) {
      this.currentTurn = this.findOpponent(agentId)?.info.agentId ?? null;
    }
  }

  private okFromEvent(event: ArcadeTimelineEvent): ArcadeGameResult {
    const data: ArcadeGameActionReceipt = {
      message: event.message,
    };
    return { ok: true, data };
  }

  private recordEvent(input: Omit<ArcadeTimelineEvent, 'id' | 'createdAt' | 'severity'>): ArcadeTimelineEvent {
    const event: ArcadeTimelineEvent = {
      ...input,
      id: `gomoku-${this.ctx.table.tableId}-${++this.eventCounter}`,
      createdAt: this.ctx.clock.now(),
      severity: input.kind === 'game_over' ? 'success' : input.kind === 'draw_offered' ? 'warning' : 'info',
    };
    this.ctx.events.emit(event);
    return event;
  }
}

export class GomokuGame implements ArcadeGameDefinition {
  readonly id = 'gomoku';
  readonly version = '1.0.0';
  readonly apiVersion = ARCADE_GAME_API_VERSION;
  readonly catalog = {
    name: '五子棋',
    description: '15x15 休闲标准五子棋。双方准备后自动开局，支持观战、和棋提议与断线恢复。',
    minPlayers: 2,
    maxPlayers: 2,
    tags: ['board', 'strategy', 'casual'],
    capabilities: {
      reconnect: true,
      reconnectGraceMs: 60_000,
      minPlayersToContinue: 2,
      spectators: true,
      midGameJoin: false,
    },
  };

  private hostContext?: ArcadeGameHostContext;

  init(ctx: ArcadeGameHostContext): void {
    this.hostContext = ctx;
  }

  createSession(ctx: ArcadeGameSessionContext): ArcadeGameSession {
    return new GomokuSession(ctx);
  }
}

export default GomokuGame;
