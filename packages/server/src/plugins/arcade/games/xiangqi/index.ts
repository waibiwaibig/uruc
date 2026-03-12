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

type XiangqiColor = 'red' | 'black';
type PieceKind = 'rook' | 'horse' | 'elephant' | 'advisor' | 'general' | 'cannon' | 'soldier';
type Phase = 'waiting' | 'playing' | 'between_matches';
type PlayerStatus = 'joined' | 'ready' | 'playing' | 'won' | 'lost' | 'draw';

interface Piece {
  color: XiangqiColor;
  kind: PieceKind;
}

interface XiangqiMove {
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  piece: Piece;
  captured?: Piece | null;
  notation: string;
}

interface PlayerState {
  info: ArcadePlayerIdentity;
  connected: boolean;
  ready: boolean;
  status: PlayerStatus;
  color: XiangqiColor | null;
}

type BoardCell = Piece | null;
type Board = BoardCell[][];

const BOARD_WIDTH = 9;
const BOARD_HEIGHT = 10;
const PALACE_FILES = [3, 4, 5];
const RED_PALACE_RANKS = [7, 8, 9];
const BLACK_PALACE_RANKS = [0, 1, 2];

function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_HEIGHT }, () => Array.from({ length: BOARD_WIDTH }, () => null));
}

function cloneBoard(board: Board): Board {
  return board.map((row) => row.map((cell) => (cell ? { ...cell } : null)));
}

function initialBoard(): Board {
  const board = createEmptyBoard();

  const place = (x: number, y: number, color: XiangqiColor, kind: PieceKind) => {
    board[y][x] = { color, kind };
  };

  const backRank: PieceKind[] = ['rook', 'horse', 'elephant', 'advisor', 'general', 'advisor', 'elephant', 'horse', 'rook'];
  for (let x = 0; x < BOARD_WIDTH; x += 1) {
    place(x, 0, 'black', backRank[x]);
    place(x, 9, 'red', backRank[x]);
  }

  place(1, 2, 'black', 'cannon');
  place(7, 2, 'black', 'cannon');
  place(1, 7, 'red', 'cannon');
  place(7, 7, 'red', 'cannon');

  for (const x of [0, 2, 4, 6, 8]) {
    place(x, 3, 'black', 'soldier');
    place(x, 6, 'red', 'soldier');
  }

  return board;
}

function isInside(x: number, y: number): boolean {
  return x >= 0 && x < BOARD_WIDTH && y >= 0 && y < BOARD_HEIGHT;
}

function opposite(color: XiangqiColor): XiangqiColor {
  return color === 'red' ? 'black' : 'red';
}

function pieceLabel(piece: Piece): string {
  const red: Record<PieceKind, string> = {
    rook: '车',
    horse: '马',
    elephant: '相',
    advisor: '仕',
    general: '帅',
    cannon: '炮',
    soldier: '兵',
  };
  const black: Record<PieceKind, string> = {
    rook: '车',
    horse: '马',
    elephant: '象',
    advisor: '士',
    general: '将',
    cannon: '炮',
    soldier: '卒',
  };
  return piece.color === 'red' ? red[piece.kind] : black[piece.kind];
}

function palaceContains(color: XiangqiColor, x: number, y: number): boolean {
  const ranks = color === 'red' ? RED_PALACE_RANKS : BLACK_PALACE_RANKS;
  return PALACE_FILES.includes(x) && ranks.includes(y);
}

function hasCrossedRiver(color: XiangqiColor, y: number): boolean {
  return color === 'red' ? y <= 4 : y >= 5;
}

function serializeBoard(board: Board, sideToMove: XiangqiColor): string {
  return `${sideToMove}|${board.map((row) => row.map((piece) => (
    piece ? `${piece.color[0]}${piece.kind[0]}` : '--'
  )).join(',')).join('/')}`;
}

function locateGeneral(board: Board, color: XiangqiColor): { x: number; y: number } | null {
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const piece = board[y][x];
      if (piece?.color === color && piece.kind === 'general') return { x, y };
    }
  }
  return null;
}

function piecesBetween(board: Board, fromX: number, fromY: number, toX: number, toY: number): number {
  let count = 0;
  const dx = Math.sign(toX - fromX);
  const dy = Math.sign(toY - fromY);
  let x = fromX + dx;
  let y = fromY + dy;
  while (x !== toX || y !== toY) {
    if (!isInside(x, y)) return count;
    if (board[y][x]) count += 1;
    x += dx;
    y += dy;
  }
  return count;
}

function generalsFacing(board: Board): boolean {
  const red = locateGeneral(board, 'red');
  const black = locateGeneral(board, 'black');
  if (!red || !black || red.x !== black.x) return false;
  return piecesBetween(board, red.x, red.y, black.x, black.y) === 0;
}

function canAttack(board: Board, fromX: number, fromY: number, toX: number, toY: number): boolean {
  const piece = board[fromY][fromX];
  if (!piece) return false;
  const dx = toX - fromX;
  const dy = toY - fromY;
  const absX = Math.abs(dx);
  const absY = Math.abs(dy);

  switch (piece.kind) {
    case 'rook':
      return (dx === 0 || dy === 0) && piecesBetween(board, fromX, fromY, toX, toY) === 0;
    case 'cannon': {
      const target = board[toY][toX];
      const between = piecesBetween(board, fromX, fromY, toX, toY);
      if (!target) return (dx === 0 || dy === 0) && between === 0;
      return (dx === 0 || dy === 0) && between === 1;
    }
    case 'horse': {
      if (!((absX === 2 && absY === 1) || (absX === 1 && absY === 2))) return false;
      const legX = absX === 2 ? fromX + dx / 2 : fromX;
      const legY = absY === 2 ? fromY + dy / 2 : fromY;
      return board[legY][legX] === null;
    }
    case 'elephant': {
      if (absX !== 2 || absY !== 2) return false;
      const eyeX = fromX + dx / 2;
      const eyeY = fromY + dy / 2;
      if (board[eyeY][eyeX]) return false;
      if (piece.color === 'red' && toY < 5) return false;
      if (piece.color === 'black' && toY > 4) return false;
      return true;
    }
    case 'advisor':
      return absX === 1 && absY === 1 && palaceContains(piece.color, toX, toY);
    case 'general':
      if (fromX === toX) {
        const target = board[toY][toX];
        if (target?.kind === 'general' && target.color !== piece.color) {
          return piecesBetween(board, fromX, fromY, toX, toY) === 0;
        }
      }
      return absX + absY === 1 && palaceContains(piece.color, toX, toY);
    case 'soldier': {
      const forward = piece.color === 'red' ? -1 : 1;
      if (dy === forward && dx === 0) return true;
      return hasCrossedRiver(piece.color, fromY) && dy === 0 && absX === 1;
    }
    default:
      return false;
  }
}

function isInCheck(board: Board, color: XiangqiColor): boolean {
  const general = locateGeneral(board, color);
  if (!general) return true;
  for (let y = 0; y < BOARD_HEIGHT; y += 1) {
    for (let x = 0; x < BOARD_WIDTH; x += 1) {
      const piece = board[y][x];
      if (!piece || piece.color === color) continue;
      if (canAttack(board, x, y, general.x, general.y)) return true;
    }
  }
  return false;
}

function normalizeCoordinate(value: unknown): number | null {
  return typeof value === 'number' && Number.isInteger(value) ? value : null;
}

function applyMove(board: Board, move: XiangqiMove): Board {
  const next = cloneBoard(board);
  next[move.toY][move.toX] = { ...move.piece };
  next[move.fromY][move.fromX] = null;
  return next;
}

function isLegalMove(board: Board, color: XiangqiColor, fromX: number, fromY: number, toX: number, toY: number): boolean {
  if (!isInside(fromX, fromY) || !isInside(toX, toY)) return false;
  const piece = board[fromY][fromX];
  if (!piece || piece.color !== color) return false;
  const target = board[toY][toX];
  if (target?.color === color) return false;
  if (!canAttack(board, fromX, fromY, toX, toY)) return false;
  const next = applyMove(board, {
    fromX,
    fromY,
    toX,
    toY,
    piece,
    captured: target,
    notation: '',
  });
  if (generalsFacing(next)) return false;
  return !isInCheck(next, color);
}

function hasAnyLegalMove(board: Board, color: XiangqiColor): boolean {
  for (let fromY = 0; fromY < BOARD_HEIGHT; fromY += 1) {
    for (let fromX = 0; fromX < BOARD_WIDTH; fromX += 1) {
      const piece = board[fromY][fromX];
      if (!piece || piece.color !== color) continue;
      for (let toY = 0; toY < BOARD_HEIGHT; toY += 1) {
        for (let toX = 0; toX < BOARD_WIDTH; toX += 1) {
          if (isLegalMove(board, color, fromX, fromY, toX, toY)) return true;
        }
      }
    }
  }
  return false;
}

class XiangqiSession implements ArcadeGameSession {
  private readonly ctx: ArcadeGameSessionContext;
  private readonly players = new Map<string, PlayerState>();
  private readonly seatOrder: string[] = [];
  private phase: Phase = 'waiting';
  private board: Board = initialBoard();
  private sideToMove: XiangqiColor = 'red';
  private currentTurn: string | null = null;
  private drawOfferedBy: string | null = null;
  private lastMove: XiangqiMove | null = null;
  private moveHistory: XiangqiMove[] = [];
  private repetition = new Map<string, number>();
  private recap: ArcadeSessionResult | null = null;
  private resultReason: string | null = null;
  private roundNumber = 0;
  private eventCounter = 0;

  constructor(ctx: ArcadeGameSessionContext) {
    this.ctx = ctx;
  }

  get status(): ArcadeSessionStatus {
    return this.phase === 'playing' ? 'playing' : 'waiting';
  }

  onJoin(player: ArcadePlayerIdentity): ArcadeJoinResult {
    const existing = this.players.get(player.agentId);
    if (existing) {
      existing.connected = true;
      existing.info = player;
      return { ok: true };
    }
    if (this.players.size >= 2) {
      return { ok: false, error: 'This Xiangqi table supports only 2 players' };
    }
    this.players.set(player.agentId, {
      info: player,
      connected: true,
      ready: false,
      status: 'joined',
      color: null,
    });
    this.seatOrder.push(player.agentId);
    this.recordEvent({
      kind: 'player_joined',
      actorId: player.agentId,
      actorName: player.agentName,
      message: `${player.agentName} 已入座中国象棋桌`,
      detail: `当前共 ${this.players.size} / 2 人`,
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
      });
      return { keepSlot: true };
    }

    if (this.phase === 'playing') {
      const winner = this.findOpponent(player.agentId);
      if (winner) {
        void this.finishMatch({
          winnerAgentId: winner.info.agentId,
          loserAgentId: player.agentId,
          reason: reason === 'timeout'
            ? `${player.agentName} 断线超时判负`
            : `${player.agentName} 离桌判负`,
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
      message: `${player.agentName} 已返回棋桌`,
    });
    return { ok: true };
  }

  async onAction(player: ArcadePlayerIdentity, action: ArcadeGameAction): Promise<ArcadeGameResult> {
    const state = this.players.get(player.agentId);
    if (!state) return { ok: false, error: 'You are not currently seated at this Xiangqi table' };

    switch (action.type) {
      case 'ready':
        return this.handleReady(state);
      case 'move':
        return this.handleMove(state, action);
      case 'resign':
        return this.handleResign(state);
      case 'offer_draw':
        return this.handleOfferDraw(state);
      case 'accept_draw':
        return this.handleAcceptDraw(state);
      case 'decline_draw':
        return this.handleDeclineDraw(state);
      default:
        return { ok: false, error: `Unsupported Xiangqi action: ${action.type}` };
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
          color: state.color,
        })),
      board: cloneBoard(this.board),
      sideToMove: this.sideToMove,
      currentTurn: this.currentTurn,
      lastMove: this.lastMove,
      moveHistory: this.moveHistory.map((move) => move.notation),
      inCheck: isInCheck(this.board, this.sideToMove),
      drawOfferedBy: this.drawOfferedBy,
      resultReason: this.resultReason,
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
          description: '确认参加本局中国象棋',
          style: 'primary',
          helperText: this.players.size < 2 ? '等待第二位玩家入座' : '双方都准备后自动开局',
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
          description: '接受对手的和棋提议',
          style: 'primary',
          params: {},
        },
        {
          type: 'decline_draw',
          label: '拒绝和棋',
          description: '拒绝对手的和棋提议',
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
        type: 'move',
        label: '走子',
        description: '输入起点与终点坐标完成走子',
        style: 'primary',
        params: {
          fromX: { type: 'number', description: '起点列 0-8', required: true, min: 0, max: 8, step: 1 },
          fromY: { type: 'number', description: '起点行 0-9', required: true, min: 0, max: 9, step: 1 },
          toX: { type: 'number', description: '终点列 0-8', required: true, min: 0, max: 8, step: 1 },
          toY: { type: 'number', description: '终点行 0-9', required: true, min: 0, max: 9, step: 1 },
        },
      });
    }

    return actions;
  }

  dispose(): void {}

  private handleReady(state: PlayerState): ArcadeGameResult {
    if (this.phase === 'playing') return { ok: false, error: 'A round is already in progress, you cannot ready up again' };
    state.ready = true;
    state.status = 'ready';
    const event = this.recordEvent({
      kind: 'ready',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} 已准备开局`,
      detail: `当前已有 ${this.readyPlayers().length} / 2 名棋手准备`,
    });
    if (this.players.size === 2 && this.readyPlayers().length === 2) {
      this.startMatch();
    }
    return this.okFromEvent(event);
  }

  private handleMove(state: PlayerState, action: ArcadeGameAction): ArcadeGameResult {
    if (this.phase !== 'playing') return { ok: false, error: 'You are not currently in a round' };
    if (this.currentTurn !== state.info.agentId) return { ok: false, error: 'It is not your turn to move yet' };
    if (state.color !== this.sideToMove) return { ok: false, error: 'The active color does not match the current player identity' };

    const fromX = normalizeCoordinate(action.fromX);
    const fromY = normalizeCoordinate(action.fromY);
    const toX = normalizeCoordinate(action.toX);
    const toY = normalizeCoordinate(action.toY);
    if (fromX === null || fromY === null || toX === null || toY === null) {
      return { ok: false, error: 'Provide valid origin and destination coordinates' };
    }
    if (!isLegalMove(this.board, state.color, fromX, fromY, toX, toY)) {
      return { ok: false, error: 'That move is not legal' };
    }

    const piece = this.board[fromY][fromX];
    if (!piece) return { ok: false, error: 'There is no piece at the origin square' };
    const captured = this.board[toY][toX];
    const notation = `${pieceLabel(piece)} ${fromX},${fromY} -> ${toX},${toY}${captured ? ` 吃 ${pieceLabel(captured)}` : ''}`;
    const move: XiangqiMove = { fromX, fromY, toX, toY, piece, captured, notation };
    this.board = applyMove(this.board, move);
    this.lastMove = move;
    this.moveHistory.push(move);
    this.drawOfferedBy = null;
    this.sideToMove = opposite(this.sideToMove);
    this.currentTurn = this.findPlayerByColor(this.sideToMove)?.info.agentId ?? null;

    const repetitionKey = serializeBoard(this.board, this.sideToMove);
    this.repetition.set(repetitionKey, (this.repetition.get(repetitionKey) ?? 0) + 1);

    const event = this.recordEvent({
      kind: 'move',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} ${notation}`,
      detail: isInCheck(this.board, this.sideToMove) ? `${this.playerNameByColor(this.sideToMove)} 被将军` : undefined,
    });

    void this.resolvePostMove();
    return this.okFromEvent(event);
  }

  private handleResign(state: PlayerState): ArcadeGameResult {
    if (this.phase !== 'playing') return { ok: false, error: 'You are not currently in a round' };
    const winner = this.findOpponent(state.info.agentId);
    if (!winner) return { ok: false, error: 'There is no opponent available to determine a winner' };
    void this.finishMatch({
      winnerAgentId: winner.info.agentId,
      loserAgentId: state.info.agentId,
      reason: `${state.info.agentName} 认输，${winner.info.agentName} 获胜`,
    });
    const event = this.recordEvent({
      kind: 'resigned',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} 认输`,
      detail: `${winner.info.agentName} 获胜`,
    });
    return this.okFromEvent(event);
  }

  private handleOfferDraw(state: PlayerState): ArcadeGameResult {
    if (this.phase !== 'playing') return { ok: false, error: 'You are not currently in a round' };
    if (this.drawOfferedBy) return { ok: false, error: 'There is already a pending draw offer' };
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
    if (!this.drawOfferedBy || this.drawOfferedBy === state.info.agentId) {
      return { ok: false, error: 'There is no draw offer you can accept right now' };
    }
    void this.finishDraw(`${state.info.agentName} 接受和棋提议`);
    const event = this.recordEvent({
      kind: 'draw_accepted',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} 接受和棋`,
    });
    return this.okFromEvent(event);
  }

  private handleDeclineDraw(state: PlayerState): ArcadeGameResult {
    if (!this.drawOfferedBy || this.drawOfferedBy === state.info.agentId) {
      return { ok: false, error: 'There is no draw offer you can decline right now' };
    }
    this.drawOfferedBy = null;
    const event = this.recordEvent({
      kind: 'draw_declined',
      actorId: state.info.agentId,
      actorName: state.info.agentName,
      message: `${state.info.agentName} 拒绝和棋提议`,
      detail: '对局继续',
    });
    return this.okFromEvent(event);
  }

  private startMatch(): void {
    const first = this.players.get(this.seatOrder[0] ?? '');
    const second = this.players.get(this.seatOrder[1] ?? '');
    if (!first || !second) return;

    this.phase = 'playing';
    this.roundNumber += 1;
    this.board = initialBoard();
    this.sideToMove = 'red';
    this.currentTurn = first.info.agentId;
    this.drawOfferedBy = null;
    this.lastMove = null;
    this.moveHistory = [];
    this.repetition = new Map([[serializeBoard(this.board, this.sideToMove), 1]]);
    this.recap = null;
    this.resultReason = null;

    first.ready = false;
    second.ready = false;
    first.status = 'playing';
    second.status = 'playing';
    first.color = 'red';
    second.color = 'black';

    this.recordEvent({
      kind: 'match_started',
      message: `第 ${this.roundNumber} 局中国象棋开始`,
      detail: `${first.info.agentName} 执红先行，${second.info.agentName} 执黑`,
    });
  }

  private async resolvePostMove(): Promise<void> {
    const repetitionKey = serializeBoard(this.board, this.sideToMove);
    if ((this.repetition.get(repetitionKey) ?? 0) >= 3) {
      await this.finishDraw('同一局面三次重复，按休闲规则判和');
      return;
    }

    const hasMove = hasAnyLegalMove(this.board, this.sideToMove);
    if (hasMove) return;

    const checked = isInCheck(this.board, this.sideToMove);
    const loser = this.findPlayerByColor(this.sideToMove);
    const winner = this.findPlayerByColor(opposite(this.sideToMove));
    if (!loser || !winner) return;

    await this.finishMatch({
      winnerAgentId: winner.info.agentId,
      loserAgentId: loser.info.agentId,
      reason: checked
        ? `${winner.info.agentName} 将死 ${loser.info.agentName}`
        : `${winner.info.agentName} 困毙 ${loser.info.agentName}`,
    });
  }

  private async finishDraw(reason: string): Promise<void> {
    if (this.phase !== 'playing') return;
    this.phase = 'between_matches';
    this.currentTurn = null;
    this.drawOfferedBy = null;
    this.resultReason = reason;
    const items: ArcadeSessionResultItem[] = [];
    for (const state of this.players.values()) {
      state.ready = false;
      state.status = 'draw';
      items.push({
        agentId: state.info.agentId,
        agentName: state.info.agentName,
        outcome: '和棋',
        summary: reason,
        label: state.color === 'red' ? '红方' : '黑方',
      });
      await this.ctx.stats.recordResult(state.info.agentId, 'xiangqi', 'draw', 0, 0);
    }
    this.recap = {
      title: `第 ${this.roundNumber} 局结束`,
      summary: '本局和棋',
      detail: reason,
      items,
    };
    this.recordEvent({
      kind: 'game_over',
      message: '本局和棋',
      detail: reason,
    });
  }

  private async finishMatch(input: { winnerAgentId: string; loserAgentId: string; reason: string }): Promise<void> {
    if (this.phase !== 'playing') return;
    this.phase = 'between_matches';
    this.currentTurn = null;
    this.drawOfferedBy = null;
    this.resultReason = input.reason;
    const items: ArcadeSessionResultItem[] = [];
    for (const state of this.players.values()) {
      const winner = state.info.agentId === input.winnerAgentId;
      state.ready = false;
      state.status = winner ? 'won' : 'lost';
      items.push({
        agentId: state.info.agentId,
        agentName: state.info.agentName,
        outcome: winner ? '获胜' : '失利',
        summary: input.reason,
        label: state.color === 'red' ? '红方' : '黑方',
      });
      await this.ctx.stats.recordResult(state.info.agentId, 'xiangqi', winner ? 'win' : 'loss', 0, 0);
    }
    this.recap = {
      title: `第 ${this.roundNumber} 局结束`,
      summary: `${this.players.get(input.winnerAgentId)?.info.agentName ?? '玩家'} 获胜`,
      detail: input.reason,
      items,
    };
    this.recordEvent({
      kind: 'game_over',
      message: this.recap.summary,
      detail: input.reason,
    });
  }

  private buildPrompt(viewerState: PlayerState | null): string {
    if (!viewerState) {
      return this.phase === 'playing' ? '观战中，等待当前棋局推进' : '等待两位玩家准备开局';
    }

    if (this.phase !== 'playing') {
      if (this.recap) {
        if (!viewerState.ready) return `${this.recap.summary}。点击准备可开始下一局`;
        return `${this.recap.summary}。等待另一位玩家准备`;
      }
      if (viewerState.ready) return '已准备，等待另一位棋手';
      return this.players.size < 2 ? '等待另一位棋手入座后准备' : '点击准备，双方都准备后自动开始';
    }

    if (this.drawOfferedBy && this.drawOfferedBy !== viewerState.info.agentId) {
      return `${this.players.get(this.drawOfferedBy)?.info.agentName ?? '对手'} 提议和棋，你可以接受或拒绝`;
    }

    if (this.currentTurn === viewerState.info.agentId) {
      return `轮到你走子，你当前执${viewerState.color === 'red' ? '红' : '黑'}`;
    }

    return `等待 ${this.playerNameByColor(this.sideToMove)} 行棋`;
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

  private findPlayerByColor(color: XiangqiColor): PlayerState | null {
    for (const state of this.players.values()) {
      if (state.color === color) return state;
    }
    return null;
  }

  private playerNameByColor(color: XiangqiColor): string {
    return this.findPlayerByColor(color)?.info.agentName ?? (color === 'red' ? '红方' : '黑方');
  }

  private removePlayer(agentId: string): void {
    this.players.delete(agentId);
    const seatIndex = this.seatOrder.indexOf(agentId);
    if (seatIndex >= 0) this.seatOrder.splice(seatIndex, 1);
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
      id: `xiangqi-${this.ctx.table.tableId}-${++this.eventCounter}`,
      createdAt: this.ctx.clock.now(),
      severity: input.kind === 'game_over' ? 'success' : input.kind.startsWith('draw_') ? 'warning' : 'info',
    };
    this.ctx.events.emit(event);
    return event;
  }
}

export class XiangqiGame implements ArcadeGameDefinition {
  readonly id = 'xiangqi';
  readonly version = '1.0.0';
  readonly apiVersion = ARCADE_GAME_API_VERSION;
  readonly catalog = {
    name: '中国象棋',
    description: '休闲标准象棋。支持观战、和棋提议、三次重复和棋与断线恢复。',
    minPlayers: 2,
    maxPlayers: 2,
    tags: ['board', 'strategy', 'classic', 'xiangqi'],
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
    return new XiangqiSession(ctx);
  }
}

export default XiangqiGame;
