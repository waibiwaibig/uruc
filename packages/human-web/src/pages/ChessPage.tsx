import { Chess, type Square } from 'chess.js';
import { useEffect, useMemo, useReducer, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Crown, RefreshCw, ShieldAlert, TimerReset } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useGameShellToolbar } from '../components/GameShell';
import { useAgents } from '../context/AgentsContext';
import { useAgentRuntime } from '../context/AgentRuntimeContext';
import i18n, { formatDateTime, formatTime } from '../i18n';
import type {
  ChessBootstrapPayload,
  ChessColor,
  ChessLobbyDeltaPayload,
  ChessMatchDeltaPayload,
  ChessMatchResult,
  ChessMatchState,
  ChessMatchSummary,
  ChessPlayer,
  ChessRating,
} from '../lib/types';
import { WsCommandError } from '../lib/ws';

const CHESS_LOCATION_ID = 'chess-club';
const FILES_WHITE = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const FILES_BLACK = ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] as const;
const RANKS_WHITE = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;
const RANKS_BLACK = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;

const PIECE_GLYPH: Record<string, string> = {
  K: '♔', Q: '♕', R: '♖', B: '♗', N: '♘', P: '♙',
  k: '♚', q: '♛', r: '♜', b: '♝', n: '♞', p: '♟',
};

const INITIAL_COUNTS = {
  w: { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 },
  b: { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 },
};

type OrientationMode = 'auto' | 'white' | 'black';
type PromotionPiece = 'q' | 'r' | 'b' | 'n';
type SyncState = 'idle' | 'initializing' | 'synced' | 'resyncing';

type CapturedPieces = {
  white: string[];
  black: string[];
};

type LastMove = {
  from: string;
  to: string;
};

type ChessMoveEntry = {
  ply: number;
  moveNumber: number;
  color: ChessColor;
  san: string;
  from: string;
  to: string;
  promotion: string | null;
};

type DerivedMatchState = {
  moveList: ChessMoveEntry[];
  lastMove: LastMove | null;
  capturedPieces: CapturedPieces;
};

type ChessViewState = {
  syncState: SyncState;
  lobbyVersion: number;
  joinableMatches: ChessMatchSummary[];
  currentMatch: ChessMatchState | null;
  moveList: ChessMoveEntry[];
  lastMove: LastMove | null;
  capturedPieces: CapturedPieces;
  rating: ChessRating | null;
  leaderboard: ChessRating[];
};

type ChessAction =
  | { type: 'reset' }
  | { type: 'sync_started'; value: SyncState }
  | { type: 'bootstrap_loaded'; payload: ChessBootstrapPayload; derived: DerivedMatchState }
  | { type: 'match_snapshot'; match: ChessMatchState | null; derived: DerivedMatchState; rating: ChessRating | null }
  | { type: 'match_cleared' }
  | { type: 'lobby_delta'; payload: ChessLobbyDeltaPayload }
  | { type: 'match_delta'; match: ChessMatchState; derived: DerivedMatchState; rating: ChessRating | null };

const EMPTY_CAPTURED: CapturedPieces = { white: [], black: [] };
const EMPTY_DERIVED: DerivedMatchState = { moveList: [], lastMove: null, capturedPieces: EMPTY_CAPTURED };
const INITIAL_VIEW_STATE: ChessViewState = {
  syncState: 'idle',
  lobbyVersion: 0,
  joinableMatches: [],
  currentMatch: null,
  moveList: [],
  lastMove: null,
  capturedPieces: EMPTY_CAPTURED,
  rating: null,
  leaderboard: [],
};

function parseFenBoard(fen: string | undefined): string[][] {
  const empty = Array.from({ length: 8 }, () => Array<string>(8).fill(''));
  if (!fen) return empty;
  const rows = fen.split(' ')[0]?.split('/');
  if (!rows || rows.length !== 8) return empty;

  for (let row = 0; row < rows.length; row++) {
    const cells: string[] = [];
    for (const token of rows[row]) {
      if (/\d/.test(token)) {
        const count = Number.parseInt(token, 10);
        for (let i = 0; i < count; i++) cells.push('');
      } else {
        cells.push(token);
      }
    }
    if (cells.length === 8) empty[row] = cells;
  }

  return empty;
}

function pieceColor(piece: string): ChessColor | null {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? 'w' : 'b';
}

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function isPromotionCandidate(piece: string, targetSquare: string): boolean {
  if (piece === 'P') return targetSquare.endsWith('8');
  if (piece === 'p') return targetSquare.endsWith('1');
  return false;
}

function findPlayer(state: ChessMatchState | null, color: ChessColor) {
  return state?.players.find((player) => player.color === color) ?? null;
}

function findPlayerByAgentId(state: ChessMatchState | null, agentId: string | undefined) {
  if (!state || !agentId) return null;
  return state.players.find((player) => player.agentId === agentId) ?? null;
}

function formatReason(reason: string): string {
  const labels: Record<string, string> = {
    checkmate: i18n.t('play:chess.reasons.checkmate'),
    timeout: i18n.t('play:chess.reasons.timeout'),
    resignation: i18n.t('play:chess.reasons.resignation'),
    draw_agreement: i18n.t('play:chess.reasons.draw_agreement'),
    stalemate: i18n.t('play:chess.reasons.stalemate'),
    threefold_repetition: i18n.t('play:chess.reasons.threefold_repetition'),
    fifty_move_rule: i18n.t('play:chess.reasons.fifty_move_rule'),
    insufficient_material: i18n.t('play:chess.reasons.insufficient_material'),
    disconnect_timeout: i18n.t('play:chess.reasons.disconnect_timeout'),
    draw: i18n.t('play:chess.reasons.draw'),
  };
  return labels[reason] ?? reason;
}

function formatTurnLabel(turn: ChessColor | null): string {
  if (turn === 'w') return i18n.t('play:chess.turn.white');
  if (turn === 'b') return i18n.t('play:chess.turn.black');
  return i18n.t('play:chess.turn.waiting');
}

function formatPositionSummary(state: ChessMatchState): string {
  if (state.phase === 'waiting') {
    return i18n.t('play:chess.position.waiting', { count: state.players.length });
  }

  if (state.result) {
    const outcome =
      state.result.result === 'draw'
        ? i18n.t('play:chess.position.draw')
        : state.result.result === 'white_win'
          ? i18n.t('play:chess.position.whiteWin')
          : i18n.t('play:chess.position.blackWin');
    return `${outcome} · ${formatReason(state.result.reason)}`;
  }

  if (state.moveCount === 0) {
    return i18n.t('play:chess.position.standardOpening', { turn: formatTurnLabel(state.turn) });
  }

  return `${i18n.t('play:chess.position.moveLine', { count: state.moveCount, turn: formatTurnLabel(state.turn) })}${state.inCheck ? i18n.t('play:chess.position.inCheckSuffix') : ''}`;
}

function sortMatches(matches: ChessMatchSummary[]): ChessMatchSummary[] {
  return [...matches].sort((a, b) => b.createdAt - a.createdAt || a.matchId.localeCompare(b.matchId));
}

function reduceLobby(matches: ChessMatchSummary[], delta: ChessLobbyDeltaPayload): ChessMatchSummary[] {
  if (delta.kind === 'room_removed') {
    return matches.filter((match) => match.matchId !== delta.matchId);
  }

  if (!delta.room) return matches;

  const next = matches.filter((match) => match.matchId !== delta.matchId);
  next.push(delta.room);
  return sortMatches(next);
}

function chessReducer(state: ChessViewState, action: ChessAction): ChessViewState {
  switch (action.type) {
    case 'reset':
      return INITIAL_VIEW_STATE;
    case 'sync_started':
      return { ...state, syncState: action.value };
    case 'bootstrap_loaded':
      return {
        syncState: 'synced',
        lobbyVersion: action.payload.lobbyVersion,
        joinableMatches: sortMatches(action.payload.joinableMatches),
        currentMatch: action.payload.currentMatch,
        moveList: action.derived.moveList,
        lastMove: action.derived.lastMove,
        capturedPieces: action.derived.capturedPieces,
        rating: action.payload.rating,
        leaderboard: action.payload.leaderboard,
      };
    case 'match_snapshot':
      return {
        ...state,
        syncState: 'synced',
        currentMatch: action.match,
        moveList: action.derived.moveList,
        lastMove: action.derived.lastMove,
        capturedPieces: action.derived.capturedPieces,
        rating: action.rating,
      };
    case 'match_cleared':
      return {
        ...state,
        currentMatch: null,
        moveList: [],
        lastMove: null,
        capturedPieces: EMPTY_CAPTURED,
      };
    case 'lobby_delta':
      if (action.payload.version <= state.lobbyVersion) return state;
      return {
        ...state,
        lobbyVersion: action.payload.version,
        joinableMatches: reduceLobby(state.joinableMatches, action.payload),
      };
    case 'match_delta':
      return {
        ...state,
        syncState: 'synced',
        currentMatch: action.match,
        moveList: action.derived.moveList,
        lastMove: action.derived.lastMove,
        capturedPieces: action.derived.capturedPieces,
        rating: action.rating,
      };
    default:
      return state;
  }
}

function buildEngineFromState(matchState: ChessMatchState | null): { chess: Chess | null; derived: DerivedMatchState } {
  if (!matchState) return { chess: null, derived: EMPTY_DERIVED };

  const chess = new Chess();
  const pgn = matchState.pgn.trim();
  if (pgn) {
    chess.loadPgn(pgn);
  } else if (matchState.fen && matchState.fen !== chess.fen()) {
    chess.load(matchState.fen);
  }

  const history = chess.history({ verbose: true }) as Array<{
    color: ChessColor;
    san: string;
    from: string;
    to: string;
    promotion?: string;
  }>;

  const moveList = history.map((move, index) => ({
    ply: index + 1,
    moveNumber: Math.floor(index / 2) + 1,
    color: move.color,
    san: move.san,
    from: move.from,
    to: move.to,
    promotion: move.promotion ?? null,
  }));

  const counts = {
    w: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 },
    b: { k: 0, q: 0, r: 0, b: 0, n: 0, p: 0 },
  };

  for (const row of chess.board()) {
    for (const piece of row) {
      if (!piece) continue;
      counts[piece.color][piece.type] += 1;
    }
  }

  const capturedPieces: CapturedPieces = {
    white: buildCapturedGlyphs('w', counts.w),
    black: buildCapturedGlyphs('b', counts.b),
  };

  const lastMove = moveList.length > 0
    ? { from: moveList[moveList.length - 1].from, to: moveList[moveList.length - 1].to }
    : null;

  return {
    chess,
    derived: {
      moveList,
      lastMove,
      capturedPieces,
    },
  };
}

function buildCapturedGlyphs(color: ChessColor, counts: Record<string, number>): string[] {
  const order = ['q', 'r', 'b', 'n', 'p'];
  const glyphs: string[] = [];

  for (const pieceType of order) {
    const missing = INITIAL_COUNTS[color][pieceType as keyof typeof INITIAL_COUNTS.w] - (counts[pieceType] ?? 0);
    for (let index = 0; index < missing; index++) {
      glyphs.push(color === 'w' ? PIECE_GLYPH[pieceType.toUpperCase()] : PIECE_GLYPH[pieceType]);
    }
  }

  return glyphs;
}

function applyMatchResultToRating(
  rating: ChessRating | null,
  currentMatch: ChessMatchState | null,
  nextMatch: ChessMatchState | null,
): ChessRating | null {
  if (!rating || !nextMatch?.result || !nextMatch.yourAgentId) return rating;
  if (currentMatch?.result?.endedAt === nextMatch.result.endedAt) return rating;

  const delta = nextMatch.result.ratingChanges[nextMatch.yourAgentId];
  if (typeof delta !== 'number') return rating;

  const didWin = nextMatch.result.winnerAgentId === nextMatch.yourAgentId;
  const didDraw = nextMatch.result.result === 'draw';

  return {
    ...rating,
    rating: rating.rating + delta,
    gamesPlayed: rating.gamesPlayed + 1,
    wins: rating.wins + (didWin ? 1 : 0),
    losses: rating.losses + (!didWin && !didDraw ? 1 : 0),
    draws: rating.draws + (didDraw ? 1 : 0),
    updatedAt: nextMatch.result.endedAt,
  };
}

function clonePlayers(players: ChessPlayer[]): ChessPlayer[] {
  return players.map((player) => ({ ...player }));
}

function applyMatchDeltaLocally(
  currentMatch: ChessMatchState,
  delta: ChessMatchDeltaPayload,
  chess: Chess,
): ChessMatchState | 'resync' | 'ignore' {
  if (delta.matchId !== currentMatch.matchId) return 'ignore';
  if (delta.seq <= currentMatch.seq) return 'ignore';
  if (delta.seq !== currentMatch.seq + 1) return 'resync';

  const nextMatch: ChessMatchState = {
    ...currentMatch,
    seq: delta.seq,
    serverTimestamp: delta.serverTimestamp,
    players: clonePlayers(currentMatch.players),
  };

  const updatePlayer = (agentId: string | undefined, mutator: (player: ChessPlayer) => void) => {
    if (!agentId) return;
    const player = nextMatch.players.find((entry) => entry.agentId === agentId);
    if (player) mutator(player);
  };

  switch (delta.kind) {
    case 'player_joined':
      if (!delta.player || nextMatch.phase !== 'waiting') return 'resync';
      nextMatch.players = [...nextMatch.players.filter((player) => player.agentId !== delta.player!.agentId), delta.player];
      return nextMatch;
    case 'player_ready':
      updatePlayer(delta.agentId, (player) => {
        player.ready = true;
      });
      return nextMatch;
    case 'player_left_waiting':
      nextMatch.players = nextMatch.players.filter((player) => player.agentId !== delta.agentId);
      return nextMatch;
    case 'player_disconnected':
      updatePlayer(delta.agentId, (player) => {
        player.connected = false;
        player.disconnectDeadlineAt = delta.reconnectDeadlineAt ?? player.disconnectDeadlineAt;
      });
      return nextMatch;
    case 'player_reconnected':
      updatePlayer(delta.agentId, (player) => {
        player.connected = true;
        player.disconnectDeadlineAt = null;
      });
      return nextMatch;
    case 'game_started': {
      chess.reset();
      nextMatch.phase = 'playing';
      nextMatch.moveCount = 0;
      nextMatch.fen = chess.fen();
      nextMatch.pgn = chess.pgn();
      nextMatch.turn = delta.turn ?? 'w';
      nextMatch.inCheck = delta.inCheck ?? false;
      nextMatch.clocks = delta.clocks ?? nextMatch.clocks;
      nextMatch.drawOfferBy = delta.drawOfferBy ?? null;
      nextMatch.result = null;

      if (!delta.players) return 'resync';
      nextMatch.players = nextMatch.players.map((player) => {
        const patch = delta.players?.find((item) => item.agentId === player.agentId);
        if (!patch) return player;
        return {
          ...player,
          color: patch.color,
          ready: patch.ready,
          connected: patch.connected,
          disconnectDeadlineAt: patch.disconnectDeadlineAt,
        };
      });
      const you = nextMatch.players.find((player) => player.agentId === nextMatch.yourAgentId);
      nextMatch.yourColor = you?.color ?? null;
      return nextMatch;
    }
    case 'move_made': {
      if (!delta.move || nextMatch.phase !== 'playing') return 'resync';
      const applied = chess.move({
        from: delta.move.from,
        to: delta.move.to,
        promotion: delta.move.promotion ?? undefined,
      });
      if (!applied) return 'resync';
      nextMatch.fen = chess.fen();
      nextMatch.pgn = chess.pgn();
      nextMatch.moveCount = chess.history().length;
      nextMatch.turn = delta.turn ?? (chess.turn() as ChessColor);
      nextMatch.inCheck = delta.inCheck ?? chess.isCheck();
      nextMatch.clocks = delta.clocks ?? nextMatch.clocks;
      nextMatch.drawOfferBy = delta.drawOfferBy ?? null;
      return nextMatch;
    }
    case 'draw_offered':
      nextMatch.drawOfferBy = delta.drawOfferBy ?? nextMatch.drawOfferBy;
      return nextMatch;
    case 'draw_declined':
      nextMatch.drawOfferBy = null;
      return nextMatch;
    case 'game_finished':
      if (!delta.result) return 'resync';
      nextMatch.phase = 'finished';
      nextMatch.turn = null;
      nextMatch.drawOfferBy = null;
      nextMatch.result = delta.result;
      return nextMatch;
    default:
      return 'ignore';
  }
}

function groupMoves(moveList: ChessMoveEntry[]) {
  const rows: Array<{ moveNumber: number; white: ChessMoveEntry | null; black: ChessMoveEntry | null }> = [];
  for (let index = 0; index < moveList.length; index += 2) {
    rows.push({
      moveNumber: moveList[index].moveNumber,
      white: moveList[index] ?? null,
      black: moveList[index + 1] ?? null,
    });
  }
  return rows;
}

function describeLobbyDelta(delta: ChessLobbyDeltaPayload): string {
  if (delta.kind === 'room_added') return i18n.t('play:chess.lobbyDelta.added', { matchId: delta.matchId });
  if (delta.kind === 'room_removed') return i18n.t('play:chess.lobbyDelta.removed', { matchId: delta.matchId });
  return i18n.t('play:chess.lobbyDelta.updated', { matchId: delta.matchId });
}

function describeMatchDelta(delta: ChessMatchDeltaPayload, currentMatch: ChessMatchState | null): string {
  const playerName = delta.agentId ? findPlayerByAgentId(currentMatch, delta.agentId)?.agentName : null;
  switch (delta.kind) {
    case 'player_joined':
      return i18n.t('play:chess.matchDelta.joined', { name: delta.player?.agentName ?? i18n.t('play:chess.matchDelta.newPlayer') });
    case 'player_ready':
      return i18n.t('play:chess.matchDelta.ready', { name: playerName ?? i18n.t('play:chess.matchDelta.opponent') });
    case 'player_left_waiting':
      return i18n.t('play:chess.matchDelta.leftWaiting', { name: playerName ?? i18n.t('play:chess.matchDelta.aPlayer') });
    case 'player_disconnected':
      return i18n.t('play:chess.matchDelta.disconnected', { name: playerName ?? i18n.t('play:chess.matchDelta.aPlayer') });
    case 'player_reconnected':
      return i18n.t('play:chess.matchDelta.reconnected', { name: playerName ?? i18n.t('play:chess.matchDelta.aPlayer') });
    case 'game_started':
      return i18n.t('play:chess.matchDelta.gameStarted');
    case 'move_made':
      return delta.move ? i18n.t('play:chess.matchDelta.latestMove', { move: delta.move.san }) : i18n.t('play:chess.matchDelta.updated');
    case 'draw_offered':
      return i18n.t('play:chess.matchDelta.drawOffered');
    case 'draw_declined':
      return i18n.t('play:chess.matchDelta.drawDeclined');
    case 'game_finished':
      return i18n.t('play:chess.matchDelta.finished', { reason: delta.result ? formatReason(delta.result.reason) : i18n.t('play:chess.page.settled') });
    default:
      return i18n.t('play:chess.matchDelta.updated');
  }
}

function formatResultTitle(result: ChessMatchResult): string {
  if (result.result === 'draw') return i18n.t('play:chess.result.draw');
  return result.result === 'white_win' ? i18n.t('play:chess.result.whiteWin') : i18n.t('play:chess.result.blackWin');
}

export function ChessPage() {
  const { t } = useTranslation(['play', 'nav']);
  const { shadowAgent } = useAgents();
  const runtime = useAgentRuntime();
  const navigate = useNavigate();
  const toolbarNode = useGameShellToolbar();

  const [viewState, dispatch] = useReducer(chessReducer, INITIAL_VIEW_STATE);
  const viewStateRef = useRef(viewState);
  viewStateRef.current = viewState;

  const [errorText, setErrorText] = useState('');
  const [busyCommand, setBusyCommand] = useState('');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [orientationMode, setOrientationMode] = useState<OrientationMode>('auto');
  const [lastEvents, setLastEvents] = useState<string[]>([]);
  const [clockTick, setClockTick] = useState<number>(performance.now());
  const [clockAnchor, setClockAnchor] = useState<number>(performance.now());
  const [promotionRequest, setPromotionRequest] = useState<{ from: string; to: string } | null>(null);
  const matchEngineRef = useRef<Chess | null>(null);

  const pushEvent = (message: string) => {
    setLastEvents((prev) => [`${formatTime(Date.now())} ${message}`, ...prev].slice(0, 20));
  };

  const resolvedOrientation = useMemo<'white' | 'black'>(() => {
    if (orientationMode === 'white') return 'white';
    if (orientationMode === 'black') return 'black';
    if (viewState.currentMatch?.yourColor === 'b') return 'black';
    return 'white';
  }, [orientationMode, viewState.currentMatch?.yourColor]);

  const boardFiles = resolvedOrientation === 'white' ? FILES_WHITE : FILES_BLACK;
  const boardRanks = resolvedOrientation === 'white' ? RANKS_WHITE : RANKS_BLACK;
  const boardMatrix = useMemo(() => parseFenBoard(viewState.currentMatch?.fen), [viewState.currentMatch?.fen]);

  const yourTurn =
    viewState.currentMatch?.phase === 'playing' &&
    !!viewState.currentMatch.yourColor &&
    viewState.currentMatch.turn === viewState.currentMatch.yourColor;

  const groupedMoveRows = useMemo(() => groupMoves(viewState.moveList), [viewState.moveList]);

  const whitePlayer = findPlayer(viewState.currentMatch, 'w');
  const blackPlayer = findPlayer(viewState.currentMatch, 'b');
  const waitingActionLabel =
    viewState.currentMatch?.phase === 'waiting' && (viewState.currentMatch.players.length ?? 0) <= 1
      ? t('chess.commands.closeRoom')
      : t('chess.commands.leaveRoom');

  const getPieceAtSquare = (square: string): string => {
    if (!viewState.currentMatch?.fen) return '';
    const file = square.charCodeAt(0) - 97;
    const rank = Number.parseInt(square[1], 10);
    const row = 8 - rank;
    return boardMatrix[row]?.[file] ?? '';
  };

  const syncMatchSnapshot = (match: ChessMatchState | null, nextRating = viewStateRef.current.rating) => {
    const { chess, derived } = buildEngineFromState(match);
    matchEngineRef.current = chess;
    dispatch({ type: 'match_snapshot', match, derived, rating: nextRating });
    setSelectedSquare(null);
    setPromotionRequest(null);
    const now = performance.now();
    setClockAnchor(now);
    setClockTick(now);
  };

  const applyBootstrapPayload = (payload: ChessBootstrapPayload) => {
    const { chess, derived } = buildEngineFromState(payload.currentMatch);
    matchEngineRef.current = chess;
    dispatch({ type: 'bootstrap_loaded', payload, derived });
    setSelectedSquare(null);
    setPromotionRequest(null);
    const now = performance.now();
    setClockAnchor(now);
    setClockTick(now);
  };

  const claimControlIfNeeded = async () => {
    const snapshot = await runtime.refreshSessionState();
    if (snapshot.isController) return snapshot;
    if (snapshot.hasController && !window.confirm(t('chess.runtime.confirmTakeover'))) {
      throw new Error(t('chess.runtime.noControl'));
    }
    return runtime.claimControl();
  };

  const ensureChessReady = async () => {
    if (!shadowAgent) {
      throw new Error(t('runtime:websocket.missingShadowAgent'));
    }

    if (!runtime.isConnected) {
      await runtime.connect();
    }

    const snapshot = await claimControlIfNeeded();

    if (!snapshot.inCity) {
      await runtime.enterCity();
    }

    const nextSnapshot = await runtime.refreshSessionState();
    if (nextSnapshot.currentLocation !== CHESS_LOCATION_ID) {
      await runtime.enterLocation(CHESS_LOCATION_ID);
    }
  };

  const refreshBootstrap = async (mode: SyncState = 'resyncing') => {
    dispatch({ type: 'sync_started', value: mode });
    try {
      await ensureChessReady();
      const payload = await runtime.sendCommand<ChessBootstrapPayload>('chess_bootstrap', { limit: 20 });
      applyBootstrapPayload(payload);
      setErrorText('');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : t('chess.runtime.syncFailed'));
    }
  };

  const resyncCurrentMatch = async (matchId?: string) => {
    try {
      dispatch({ type: 'sync_started', value: 'resyncing' });
      const state = await runtime.sendCommand<ChessMatchState>('chess_state', matchId ? { matchId } : undefined);
      const nextRating = applyMatchResultToRating(viewStateRef.current.rating, viewStateRef.current.currentMatch, state);
      syncMatchSnapshot(state, nextRating);
      setErrorText('');
    } catch {
      await refreshBootstrap('resyncing');
    }
  };

  const runCommand = async <T,>(label: string, type: string, payload?: unknown): Promise<T | null> => {
    setBusyCommand(label);
    setErrorText('');
    try {
      const result = await runtime.sendCommand<T>(type, payload);
      return result;
    } catch (err) {
      if (err instanceof WsCommandError && err.code === 'CONTROLLED_ELSEWHERE') {
        try {
          await claimControlIfNeeded();
          const retry = await runtime.sendCommand<T>(type, payload);
          return retry;
        } catch (retryErr) {
          setErrorText(retryErr instanceof Error ? retryErr.message : t('chess.runtime.actionFailed', { label }));
          return null;
        }
      }
      setErrorText(err instanceof Error ? err.message : t('chess.runtime.actionFailed', { label }));
      return null;
    } finally {
      setBusyCommand('');
    }
  };

  const leaveChessHall = async () => {
    if (runtime.currentLocation === CHESS_LOCATION_ID) {
      await runtime.leaveLocation();
    }
  };

  const returnToPlay = async () => {
    if (viewState.currentMatch?.phase === 'playing' && !window.confirm(t('chess.runtime.returnToCityPlayingConfirm'))) {
      return;
    }
    if (viewState.currentMatch?.phase === 'waiting' && !window.confirm(t('chess.runtime.returnToCityWaitingConfirm'))) {
      return;
    }
    await leaveChessHall();
    navigate('/play');
  };

  const returnToLobby = async () => {
    if (viewState.currentMatch?.phase === 'playing' && !window.confirm(t('chess.runtime.returnToLobbyPlayingConfirm'))) {
      return;
    }
    if (viewState.currentMatch?.phase === 'waiting' && !window.confirm(t('chess.runtime.returnToLobbyWaitingConfirm'))) {
      return;
    }
    await leaveChessHall();
    if (runtime.inCity) {
      await runtime.leaveCity();
    }
    navigate('/lobby');
  };

  useEffect(() => {
    dispatch({ type: 'reset' });
    matchEngineRef.current = null;
    setSelectedSquare(null);
    setPromotionRequest(null);
    setLastEvents([]);
    if (!shadowAgent) return;
    void refreshBootstrap('initializing');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shadowAgent?.id]);

  useEffect(() => {
    if (!viewState.currentMatch || (viewState.currentMatch.phase !== 'playing' && !viewState.currentMatch.players.some((player) => player.disconnectDeadlineAt))) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setClockTick(performance.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, [viewState.currentMatch]);

  useEffect(() => {
    if (viewState.currentMatch?.phase !== 'waiting' && viewState.currentMatch?.phase !== 'playing') return undefined;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [viewState.currentMatch?.phase]);

  useEffect(() => {
    const unsubWelcome = runtime.subscribe('chess_welcome', (payload) => {
      const data = payload as { needsBootstrap?: boolean } | undefined;
      pushEvent(t('chess.runtime.entered'));
      if (data?.needsBootstrap) {
        void refreshBootstrap(viewStateRef.current.syncState === 'idle' ? 'initializing' : 'resyncing');
      }
    });

    const unsubLobby = runtime.subscribe('chess_lobby_delta', (payload) => {
      const delta = payload as ChessLobbyDeltaPayload;
      const current = viewStateRef.current;
      if (delta.version > current.lobbyVersion + 1) {
        void refreshBootstrap('resyncing');
        return;
      }
      dispatch({ type: 'lobby_delta', payload: delta });
      pushEvent(describeLobbyDelta(delta));
    });

    const unsubMatch = runtime.subscribe('chess_match_delta', (payload) => {
      const delta = payload as ChessMatchDeltaPayload;
      const current = viewStateRef.current;
      if (!current.currentMatch || current.currentMatch.matchId !== delta.matchId) {
        if (delta.kind !== 'player_joined') {
          void resyncCurrentMatch(delta.matchId);
        }
        return;
      }

      const chess = matchEngineRef.current;
      if (!chess) {
        void resyncCurrentMatch(delta.matchId);
        return;
      }

      const applied = applyMatchDeltaLocally(current.currentMatch, delta, chess);
      if (applied === 'ignore') return;
      if (applied === 'resync') {
        void resyncCurrentMatch(delta.matchId);
        return;
      }

      const derived = buildEngineFromState(applied).derived;
      const nextRating = applyMatchResultToRating(current.rating, current.currentMatch, applied);
      matchEngineRef.current = buildEngineFromState(applied).chess;
      dispatch({ type: 'match_delta', match: applied, derived, rating: nextRating });
      setSelectedSquare(null);
      setPromotionRequest(null);
      const now = performance.now();
      setClockAnchor(now);
      setClockTick(now);
      pushEvent(describeMatchDelta(delta, current.currentMatch));
    });

    const unsubReconnect = runtime.subscribe('chess_reconnected', (payload) => {
      const data = payload as { needsBootstrap?: boolean } | undefined;
      pushEvent(t('chess.runtime.restored'));
      if (data?.needsBootstrap) {
        void refreshBootstrap('resyncing');
      }
    });

    return () => {
      unsubWelcome();
      unsubLobby();
      unsubMatch();
      unsubReconnect();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const displayedClocks = useMemo(() => {
    const matchState = viewState.currentMatch;
    if (!matchState) return null;

    let whiteMs = matchState.clocks.whiteMs;
    let blackMs = matchState.clocks.blackMs;

    if (matchState.phase === 'playing' && matchState.turn) {
      const elapsed = Math.max(0, clockTick - clockAnchor);
      if (matchState.turn === 'w') whiteMs = Math.max(0, whiteMs - elapsed);
      if (matchState.turn === 'b') blackMs = Math.max(0, blackMs - elapsed);
    }

    return { whiteMs, blackMs };
  }, [clockAnchor, clockTick, viewState.currentMatch]);

  const legalTargets = useMemo(() => {
    const matchState = viewState.currentMatch;
    const chess = matchEngineRef.current;
    if (!matchState || matchState.phase !== 'playing' || !selectedSquare || !yourTurn || !chess) {
      return new Set<string>();
    }
    try {
      const moves = chess.moves({ square: selectedSquare as Square, verbose: true }) as Array<{ to: string }>;
      return new Set(moves.map((move) => move.to));
    } catch {
      return new Set<string>();
    }
  }, [selectedSquare, viewState.currentMatch, yourTurn]);

  const disconnectedPlayers = useMemo(
    () => viewState.currentMatch?.players.filter((player) => player.disconnectDeadlineAt) ?? [],
    [viewState.currentMatch],
  );

  const statusHighlights = useMemo(() => {
    const matchState = viewState.currentMatch;
    if (!matchState) return [];

    const notes: string[] = [];
    if (matchState.drawOfferBy) {
      const drawBySelf = matchState.drawOfferBy === matchState.yourAgentId;
      notes.push(drawBySelf ? t('chess.runtime.drawOfferedByYou') : t('chess.runtime.drawOfferedByOpponent'));
    }
    if (matchState.inCheck) {
      notes.push(matchState.turn === matchState.yourColor ? t('chess.runtime.selfInCheck') : t('chess.runtime.opponentInCheck'));
    }
    for (const player of disconnectedPlayers) {
      const secondsLeft = Math.max(0, Math.ceil((player.disconnectDeadlineAt! - Date.now()) / 1000));
      notes.push(t('chess.runtime.disconnectDeadline', { name: player.agentName, seconds: secondsLeft }));
    }
    return notes;
  }, [disconnectedPlayers, viewState.currentMatch]);

  const syncLabel = viewState.syncState === 'initializing'
    ? t('chess.runtime.firstSync')
    : viewState.syncState === 'resyncing'
      ? t('chess.runtime.resyncing')
      : t('chess.runtime.synced');

  const executeMove = async (from: string, to: string, promotion?: PromotionPiece) => {
    if (!viewState.currentMatch || !yourTurn || !viewState.currentMatch.yourColor) return;
    const payload = await runCommand<{ state: ChessMatchState }>(t('chess.commands.move'), 'move', { from, to, promotion });
    if (payload?.state) {
      const nextRating = applyMatchResultToRating(viewStateRef.current.rating, viewStateRef.current.currentMatch, payload.state);
      syncMatchSnapshot(payload.state, nextRating);
    }
  };

  const onSquareClick = (square: string) => {
    const matchState = viewState.currentMatch;
    if (!matchState || matchState.phase !== 'playing') return;
    if (!matchState.yourColor) return;

    const squarePiece = getPieceAtSquare(square);
    const owner = pieceColor(squarePiece);

    if (!selectedSquare) {
      if (!yourTurn) return;
      if (!squarePiece) return;
      if (owner !== matchState.yourColor) return;
      setSelectedSquare(square);
      return;
    }

    if (square === selectedSquare) {
      setSelectedSquare(null);
      return;
    }

    if (squarePiece && owner === matchState.yourColor) {
      setSelectedSquare(square);
      return;
    }

    if (!legalTargets.has(square)) {
      return;
    }

    const movingPiece = getPieceAtSquare(selectedSquare);
    if (isPromotionCandidate(movingPiece, square)) {
      setPromotionRequest({ from: selectedSquare, to: square });
      return;
    }

    void executeMove(selectedSquare, square);
  };

  const chessHeader = toolbarNode ? createPortal(
    <div className="game-shell__pagebar">
      <div className="game-shell__pagebar-main">
        <span className="game-shell__pagebar-title">{t('chess.page.title')}</span>
        <div className="game-shell__pagebar-meta">
          {viewState.rating ? <span className="status-chip">Elo {viewState.rating.rating} · {viewState.rating.wins}W/{viewState.rating.losses}L/{viewState.rating.draws}D</span> : null}
          {viewState.currentMatch ? <span className="status-chip mono">{t('chess.page.matchLabel', { id: viewState.currentMatch.matchId })}</span> : null}
          <span className="status-chip">{syncLabel}</span>
        </div>
      </div>
      <div className="game-shell__pagebar-actions">
        <button className="app-btn ghost" disabled={!!busyCommand} onClick={() => void returnToPlay().catch((err) => setErrorText(err instanceof Error ? err.message : t('chess.runtime.returnToCityFailed')))}>
          <span className="row"><ArrowLeft size={14} /> {t('chess.page.backToCity')}</span>
        </button>
        <button className="app-btn ghost" disabled={!!busyCommand} onClick={() => void returnToLobby().catch((err) => setErrorText(err instanceof Error ? err.message : t('chess.runtime.returnToLobbyFailed')))}>
          {t('chess.page.backToLobby')}
        </button>
        <button className="app-btn" disabled={!!busyCommand || !shadowAgent} onClick={() => void refreshBootstrap('resyncing')}>
          <span className="row"><RefreshCw size={14} /> {t('chess.page.syncHall')}</span>
        </button>
      </div>
    </div>,
    toolbarNode,
  ) : null;

  return (
    <>
      {chessHeader}
      <div className="page-wrap main-grid">
        {!shadowAgent ? (
          <div className="notice info">
            {t('chess.runtime.noAgent')} <Link className="link-btn" to="/lobby">{t('nav:lobby')}</Link> / <Link className="link-btn" to="/agents">{t('nav:agents')}</Link>
          </div>
        ) : null}

        {(errorText || runtime.error) ? (
          <div className="notice error">
            <span className="row"><ShieldAlert size={14} /> {errorText || runtime.error}</span>
          </div>
        ) : null}

        <section className="chess-layout">
          <div className="card chess-stage">
            <div className="panel-head">
              <div className="panel-copy">
                <p className="section-label">{t('chess.page.boardKicker')}</p>
                <h2 className="title-card">{t('chess.page.boardTitle')}</h2>
              </div>
              <div className="utility-links">
                <button className="app-btn secondary" onClick={() => setOrientationMode('auto')}>{t('chess.page.autoOrientation')}</button>
                <button className="app-btn secondary" onClick={() => setOrientationMode('white')}>{t('chess.page.whiteOrientation')}</button>
                <button className="app-btn secondary" onClick={() => setOrientationMode('black')}>{t('chess.page.blackOrientation')}</button>
              </div>
            </div>

            {!viewState.currentMatch ? (
              <div className="notice info">
                {t('chess.page.noMatch')}
              </div>
            ) : (
              <div className="stack-lg">
                <div className="chess-statusbar">
                  <div className="clock-card">
                    <span className="tiny muted">{t('chess.page.whiteClock')}</span>
                    <div className="clock-card__value mono">{formatClock(displayedClocks?.whiteMs ?? viewState.currentMatch.clocks.whiteMs)}</div>
                  </div>
                  <div className="clock-card">
                    <span className="tiny muted">{t('chess.page.blackClock')}</span>
                    <div className="clock-card__value mono">{formatClock(displayedClocks?.blackMs ?? viewState.currentMatch.clocks.blackMs)}</div>
                  </div>
                  <div className="clock-card">
                    <span className="tiny muted">{t('chess.page.currentState')}</span>
                    <div className="clock-card__value clock-card__state">
                      {viewState.currentMatch.result
                        ? t('chess.page.settled')
                        : yourTurn
                          ? t('chess.page.yourTurn')
                          : viewState.currentMatch.turn === 'w'
                            ? t('chess.turn.white')
                            : viewState.currentMatch.turn === 'b'
                              ? t('chess.turn.black')
                              : t('chess.page.waiting')}
                    </div>
                    <div className="tiny muted u-mt-1">
                      {formatPositionSummary(viewState.currentMatch)}
                    </div>
                  </div>
                </div>

                {statusHighlights.length > 0 ? (
                  <div className="board-signals">
                    {statusHighlights.map((note) => (
                      <span key={note} className="status-chip status-chip--warn">{note}</span>
                    ))}
                  </div>
                ) : null}

                <div className="duel-banner">
                  <div className={`duel-player ${viewState.currentMatch.turn === 'w' ? 'is-active' : ''}`}>
                    <div className="duel-player__color">{t('chess.page.whiteSide')}</div>
                    <h3 className="title-panel">{whitePlayer?.agentName ?? t('chess.page.pendingPlayer')}</h3>
                    <div className="pill-row u-mt-1">
                      <span className="info-pill">{whitePlayer?.ready ? t('chess.page.ready') : t('common:status.waiting')}</span>
                      <span className="info-pill">{whitePlayer?.connected ? t('chess.page.online') : t('chess.page.offline')}</span>
                      {viewState.currentMatch.yourColor === 'w' ? <span className="info-pill">{t('chess.page.youWhite')}</span> : null}
                    </div>
                    <div className="captured-row">
                      <span className="tiny muted">{t('chess.page.whiteLosses')}</span>
                      <span className="captured-row__glyphs">{viewState.capturedPieces.white.join(' ') || t('chess.page.none')}</span>
                    </div>
                  </div>

                  <div className={`duel-player ${viewState.currentMatch.turn === 'b' ? 'is-active' : ''}`}>
                    <div className="duel-player__color">{t('chess.page.blackSide')}</div>
                    <h3 className="title-panel">{blackPlayer?.agentName ?? t('chess.page.pendingPlayer')}</h3>
                    <div className="pill-row u-mt-1">
                      <span className="info-pill">{blackPlayer?.ready ? t('chess.page.ready') : t('common:status.waiting')}</span>
                      <span className="info-pill">{blackPlayer?.connected ? t('chess.page.online') : t('chess.page.offline')}</span>
                      {viewState.currentMatch.yourColor === 'b' ? <span className="info-pill">{t('chess.page.youBlack')}</span> : null}
                    </div>
                    <div className="captured-row">
                      <span className="tiny muted">{t('chess.page.blackLosses')}</span>
                      <span className="captured-row__glyphs">{viewState.capturedPieces.black.join(' ') || t('chess.page.none')}</span>
                    </div>
                  </div>
                </div>

                <div className="board-caption">
                  <div className="pill-row">
                    <span className="status-chip"><TimerReset size={14} /> {t('chess.page.timeControl')}</span>
                    <span className="status-chip">{t('chess.page.phase', { value: viewState.currentMatch.phase })}</span>
                    {viewState.lastMove ? <span className="status-chip mono">{t('chess.page.lastMove', { from: viewState.lastMove.from, to: viewState.lastMove.to })}</span> : null}
                  </div>
                  <span className="tiny muted">{formatPositionSummary(viewState.currentMatch)}</span>
                </div>

                <div className="board-wrap">
                  <div className="chess-board">
                    {boardRanks.map((rank, rowIndex) => (
                      boardFiles.map((file, colIndex) => {
                        const square = `${file}${rank}`;
                        const piece = getPieceAtSquare(square);
                        const dark = (rowIndex + colIndex) % 2 === 1;
                        const isLastMove = viewState.lastMove?.from === square || viewState.lastMove?.to === square;
                        const isTarget = legalTargets.has(square);

                        return (
                          <button
                            key={square}
                            className={`chess-square ${dark ? 'dark' : 'light'} ${selectedSquare === square ? 'selected' : ''} ${isTarget ? 'target' : ''} ${isLastMove ? 'last-move' : ''}`}
                            onClick={() => onSquareClick(square)}
                            title={square}
                          >
                            {piece ? <span className={`chess-piece ${piece === piece.toLowerCase() ? 'black' : 'white'}`}>{PIECE_GLYPH[piece]}</span> : null}
                            {rowIndex === 7 ? <span className="chess-mark file">{file}</span> : null}
                            {colIndex === 0 ? <span className="chess-mark rank">{rank}</span> : null}
                          </button>
                        );
                      })
                    ))}
                  </div>
                </div>

                {viewState.currentMatch.result ? (
                  <div className="result-banner">
                    <div className="row space">
                      <span>{t('chess.page.resultLabel')}</span>
                      <strong>{formatResultTitle(viewState.currentMatch.result)}</strong>
                    </div>
                    <div className="tiny muted u-mt-1">
                      {t('chess.page.reason', { reason: formatReason(viewState.currentMatch.result.reason), endedAt: formatDateTime(viewState.currentMatch.result.endedAt) })}
                    </div>
                    {viewState.currentMatch.yourAgentId && typeof viewState.currentMatch.result.ratingChanges[viewState.currentMatch.yourAgentId] === 'number' ? (
                      <div className="tiny u-mt-1">
                        {t('chess.page.yourEloDelta', {
                          delta: `${viewState.currentMatch.result.ratingChanges[viewState.currentMatch.yourAgentId] > 0 ? '+' : ''}${viewState.currentMatch.result.ratingChanges[viewState.currentMatch.yourAgentId]}`,
                        })}
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="side-panel">
            <div className="card side-panel__card">
              <div className="panel-head">
                <div className="panel-copy">
                  <p className="section-label">{t('chess.page.actionsKicker')}</p>
                  <h3 className="title-panel">{t('chess.page.actionsTitle')}</h3>
                </div>
                {busyCommand ? <span className="info-pill">{t('chess.page.busy', { label: busyCommand })}</span> : null}
              </div>

              <div className="grid-cards">
                {!viewState.currentMatch ? (
                  <button
                    className="app-btn"
                    disabled={!!busyCommand || !shadowAgent}
                    onClick={() => void runCommand<{ matchId: string; state: ChessMatchState }>(t('chess.commands.createMatch'), 'chess_create_match').then((res) => {
                      if (res?.state) syncMatchSnapshot(res.state);
                    })}
                  >
                    {t('chess.commands.createMatch')}
                  </button>
                ) : null}

                {viewState.currentMatch?.phase === 'waiting' ? (
                  <>
                    <button
                      className="app-btn"
                      disabled={!!busyCommand}
                      onClick={() => void runCommand<{ state: ChessMatchState }>(t('chess.commands.ready'), 'ready').then((res) => {
                        if (res?.state) syncMatchSnapshot(res.state);
                      })}
                    >
                      {t('chess.commands.ready')}
                    </button>
                    <button
                      className="app-btn secondary"
                      disabled={!!busyCommand}
                      onClick={() => void runCommand<{ removedMatchId: string; matches: ChessMatchSummary[] }>(waitingActionLabel, 'chess_leave_match').then((res) => {
                        if (!res) return;
                        dispatch({ type: 'match_cleared' });
                        setSelectedSquare(null);
                        setPromotionRequest(null);
                        pushEvent(t('chess.page.waitingActionSuccess', { label: waitingActionLabel }));
                      })}
                    >
                      {waitingActionLabel}
                    </button>
                  </>
                ) : null}

                {viewState.currentMatch?.phase === 'playing' ? (
                  <>
                    {!viewState.currentMatch.drawOfferBy ? (
                      <button
                        className="app-btn"
                        disabled={!!busyCommand}
                        onClick={() => void runCommand<{ state: ChessMatchState }>(t('chess.commands.offerDraw'), 'offer_draw').then((res) => {
                          if (res?.state) syncMatchSnapshot(res.state);
                        })}
                      >
                        {t('chess.commands.offerDraw')}
                      </button>
                    ) : null}

                    {viewState.currentMatch.drawOfferBy && viewState.currentMatch.drawOfferBy !== viewState.currentMatch.yourAgentId ? (
                      <>
                        <button
                          className="app-btn"
                          disabled={!!busyCommand}
                          onClick={() => void runCommand<{ state: ChessMatchState }>(t('chess.commands.acceptDraw'), 'accept_draw').then((res) => {
                            if (res?.state) {
                              const nextRating = applyMatchResultToRating(viewStateRef.current.rating, viewStateRef.current.currentMatch, res.state);
                              syncMatchSnapshot(res.state, nextRating);
                            }
                          })}
                        >
                          {t('chess.commands.acceptDraw')}
                        </button>
                        <button
                          className="app-btn secondary"
                          disabled={!!busyCommand}
                          onClick={() => void runCommand<{ state: ChessMatchState }>(t('chess.commands.declineDraw'), 'decline_draw').then((res) => {
                            if (res?.state) syncMatchSnapshot(res.state);
                          })}
                        >
                          {t('chess.commands.declineDraw')}
                        </button>
                      </>
                    ) : null}

                    <button
                      className="app-btn secondary"
                      disabled={!!busyCommand}
                      onClick={() => void runCommand<{ state: ChessMatchState }>(t('chess.commands.resign'), 'resign').then((res) => {
                        if (res?.state) {
                          const nextRating = applyMatchResultToRating(viewStateRef.current.rating, viewStateRef.current.currentMatch, res.state);
                          syncMatchSnapshot(res.state, nextRating);
                        }
                      })}
                    >
                      {t('chess.commands.resign')}
                    </button>
                  </>
                ) : null}
              </div>
            </div>

            <div className="card side-panel__card">
              <div className="panel-head">
                <div className="panel-copy">
                  <p className="section-label">{t('chess.page.moveSheetKicker')}</p>
                  <h3 className="title-panel">{t('chess.page.moveSheet')}</h3>
                </div>
                <span className="info-pill">{viewState.moveList.length}</span>
              </div>
              {groupedMoveRows.length === 0 ? (
                <div className="notice info">{t('chess.page.moveSheetEmpty')}</div>
              ) : (
                <div className="move-list scroll-pane list-pane-md">
                  {groupedMoveRows.map((row) => (
                    <div key={row.moveNumber} className="move-row">
                      <span className="move-row__index mono">{row.moveNumber}.</span>
                      <span className={`move-pill ${viewState.lastMove?.to === row.white?.to ? 'is-latest' : ''}`}>{row.white?.san ?? '...'}</span>
                      <span className={`move-pill ${viewState.lastMove?.to === row.black?.to ? 'is-latest' : ''}`}>{row.black?.san ?? '...'}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card side-panel__card">
              <div className="panel-head">
                <div className="panel-copy">
                  <p className="section-label">{t('chess.page.waitingRoomsKicker')}</p>
                  <h3 className="title-panel">{t('chess.page.joinableMatches')}</h3>
                </div>
                <span className="info-pill">{viewState.joinableMatches.length}</span>
              </div>
              {viewState.joinableMatches.length === 0 ? (
                <div className="notice info">{t('chess.page.noJoinableMatches')}</div>
              ) : (
                <div className="list-pane list-pane-md scroll-pane">
                  {viewState.joinableMatches.map((match) => (
                    <article key={match.matchId} className="queue-card">
                      <div className="row space tiny">
                        <strong className="mono">{match.matchId}</strong>
                        <span>{t('chess.page.emptySeats', { count: match.seatsRemaining })}</span>
                      </div>
                      <div className="pill-row u-mt-1">
                        <span className="info-pill">{t('chess.page.playersCount', { count: match.playerCount })}</span>
                        <span className="info-pill">{t('chess.page.readyCount', { count: match.readyCount })}</span>
                      </div>
                      <div className="tiny muted u-mt-1">
                        {match.players.map((player) => `${player.agentName}${player.connected ? '' : t('chess.page.offlineSuffix')}`).join(' / ') || t('chess.page.nobodySeated')}
                      </div>
                      <button
                        className="app-btn secondary u-mt-2"
                        disabled={!!busyCommand || !!viewState.currentMatch}
                        onClick={() => void runCommand<{ state: ChessMatchState }>(t('chess.page.joinThisMatch'), 'chess_join_match', { matchId: match.matchId }).then((res) => {
                          if (res?.state) syncMatchSnapshot(res.state);
                        })}
                      >
                        {t('chess.page.joinThisMatch')}
                      </button>
                    </article>
                  ))}
                </div>
              )}
            </div>

            <div className="card side-panel__card">
              <div className="panel-head">
                <div className="panel-copy">
                  <p className="section-label">{t('chess.page.leaderboardKicker')}</p>
                  <h3 className="title-panel">{t('chess.page.leaderboard')}</h3>
                </div>
                <span className="info-pill">Top {viewState.leaderboard.length}</span>
              </div>
              {viewState.leaderboard.length === 0 ? (
                <div className="notice info">{t('chess.page.noData')}</div>
              ) : (
                <div className="list-pane list-pane-sm scroll-pane">
                  {viewState.leaderboard.map((item, idx) => (
                    <div key={item.agentId} className="list-item non-interactive">
                      <div className="row space">
                        <span className="row"><Crown size={14} /> #{idx + 1}</span>
                        <strong>{item.rating}</strong>
                      </div>
                      <div className="tiny mono muted u-mt-1" title={item.agentId}>
                        {item.agentId}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="card side-panel__card">
              <div className="panel-head">
                <div className="panel-copy">
                  <p className="section-label">{t('chess.page.hallJournalKicker')}</p>
                  <h3 className="title-panel">{t('chess.page.hallJournal')}</h3>
                </div>
                <span className="info-pill">{lastEvents.length}</span>
              </div>
              {lastEvents.length === 0 ? (
                <div className="notice info">{t('chess.page.noEvents')}</div>
              ) : (
                <div className="list-pane list-pane-sm scroll-pane">
                  {lastEvents.map((item, idx) => (
                    <div key={`${item}-${idx}`} className="code-block">{item}</div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </section>

        {promotionRequest ? (
          <div className="promotion-overlay">
            <div className="promotion-card">
              <p className="section-label">{t('chess.page.promotionKicker')}</p>
              <h3 className="title-card">{t('chess.page.promotionTitle')}</h3>
              <p className="section-sub u-mt-1">
                {t('chess.page.promotionBody', { from: promotionRequest.from, to: promotionRequest.to })}
              </p>

              <div className="promotion-grid">
                {(['q', 'r', 'b', 'n'] as PromotionPiece[]).map((piece) => {
                  const glyphMap = viewState.currentMatch?.yourColor === 'b'
                    ? { q: '♛', r: '♜', b: '♝', n: '♞' }
                    : { q: '♕', r: '♖', b: '♗', n: '♘' };

                  const labelMap = {
                    q: t('chess.page.promotionQueen'),
                    r: t('chess.page.promotionRook'),
                    b: t('chess.page.promotionBishop'),
                    n: t('chess.page.promotionKnight'),
                  };

                  return (
                    <button
                      key={piece}
                      className="promotion-option"
                      onClick={() => void executeMove(promotionRequest.from, promotionRequest.to, piece)}
                    >
                      <span className="promotion-glyph">{glyphMap[piece]}</span>
                      <span>{labelMap[piece]}</span>
                    </button>
                  );
                })}
              </div>

              <div className="utility-links u-mt-3">
                <button className="app-btn ghost" onClick={() => setPromotionRequest(null)}>{t('chess.page.cancel')}</button>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </>
  );
}
