import { Chess, type Square } from 'chess.js';
import React, { type PointerEvent as ReactPointerEvent, useEffect, useEffectEvent, useMemo, useReducer, useRef, useState } from 'react';
import { formatPluginDateTime } from '@uruc/plugin-sdk/frontend';
import { isPluginCommandError, usePluginAgent, usePluginRuntime } from '@uruc/plugin-sdk/frontend-react';
import { Link, useNavigate } from 'react-router-dom';
import { BarChart3, Bot, Building2, Crown, Eye, Globe2, LayoutGrid, ListOrdered, LockKeyhole, PlusSquare, RefreshCw, Search, ShieldAlert, TimerReset, Trophy, X } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import i18n from 'i18next';
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
  ChessRoomDeltaPayload,
  ChessRoomDirectoryDeltaPayload,
  ChessRoomDirectoryPayload,
  ChessRoomSummary,
  ChessTurnPromptPayload,
  ChessRoomVisibility,
  ChessWatchRoomPayload,
} from './types';

const CHESS_LOCATION_ID = 'uruc.chess.chess-club';
const CHESS_COMMAND = (id: string) => `uruc.chess.${id}@v1`;
const FILES_WHITE = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'] as const;
const FILES_BLACK = ['h', 'g', 'f', 'e', 'd', 'c', 'b', 'a'] as const;
const RANKS_WHITE = ['8', '7', '6', '5', '4', '3', '2', '1'] as const;
const RANKS_BLACK = ['1', '2', '3', '4', '5', '6', '7', '8'] as const;
const PREVIEW_FEN = new Chess().fen();
const DEFAULT_RATING = 1500;
const DEFAULT_CLOCK_MS = 10 * 60 * 1000;

const INITIAL_COUNTS = {
  w: { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 },
  b: { k: 1, q: 1, r: 2, b: 2, n: 2, p: 8 },
};

type PromotionPiece = 'q' | 'r' | 'b' | 'n';
type SyncState = 'idle' | 'initializing' | 'synced' | 'resyncing';
type WorkspaceTab = 'new-game' | 'rooms' | 'record' | 'history' | 'leaderboard';

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

type ChessInspectedRoom = {
  summary: ChessRoomSummary;
  state: ChessMatchState;
};

type ChessResultOverlay = {
  signature: string;
  matchId: string;
  roomName: string;
  result: ChessMatchResult;
  yourAgentId?: string;
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

function pieceAtSquare(board: string[][], square: string): string {
  const file = square.charCodeAt(0) - 97;
  const rank = Number.parseInt(square[1], 10);
  const row = 8 - rank;
  return board[row]?.[file] ?? '';
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

function compareMatchSnapshot(current: ChessMatchState | null | undefined, next: ChessMatchState): number {
  if (!current || current.matchId !== next.matchId) return 1;
  if (next.seq > current.seq) return 1;
  if (next.seq < current.seq) return -1;
  if (next.serverTimestamp > current.serverTimestamp) return 1;
  if (next.serverTimestamp < current.serverTimestamp) return -1;
  return 0;
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

function sortRooms(rooms: ChessRoomSummary[]): ChessRoomSummary[] {
  const phaseOrder: Record<ChessRoomSummary['phase'], number> = {
    waiting: 0,
    playing: 1,
    finished: 2,
  };

  return [...rooms].sort((a, b) => {
    const phaseDelta = phaseOrder[a.phase] - phaseOrder[b.phase];
    if (phaseDelta !== 0) return phaseDelta;
    return b.createdAt - a.createdAt || a.matchId.localeCompare(b.matchId);
  });
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

function roomSummaryFromState(
  current: ChessRoomSummary | null | undefined,
  state: ChessMatchState,
  spectatorCount?: number,
): ChessRoomSummary {
  return {
    matchId: state.matchId,
    roomName: state.roomName,
    visibility: state.visibility,
    phase: state.phase,
    playerCount: state.players.length,
    seatsRemaining: Math.max(0, 2 - state.players.length),
    readyCount: state.players.filter((player) => player.ready).length,
    spectatorCount: spectatorCount ?? current?.spectatorCount ?? 0,
    players: state.players.map((player) => ({
      agentId: player.agentId,
      agentName: player.agentName,
      ready: player.ready,
      connected: player.connected,
    })),
    createdAt: current?.createdAt ?? Date.now(),
  };
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
  const pieces: string[] = [];

  for (const pieceType of order) {
    const missing = INITIAL_COUNTS[color][pieceType as keyof typeof INITIAL_COUNTS.w] - (counts[pieceType] ?? 0);
    for (let index = 0; index < missing; index++) {
      pieces.push(color === 'w' ? pieceType.toUpperCase() : pieceType);
    }
  }

  return pieces;
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

function formatResultTitle(result: ChessMatchResult): string {
  if (result.result === 'draw') return i18n.t('play:chess.result.draw');
  return result.result === 'white_win' ? i18n.t('play:chess.result.whiteWin') : i18n.t('play:chess.result.blackWin');
}

function agentNameLabel(agentName: string | undefined, fallback: string) {
  return agentName && agentName.trim() !== '' ? agentName : fallback;
}

function agentMonogram(name: string | undefined) {
  const label = (name ?? '').trim();
  if (!label) return 'AI';
  return label
    .split(/\s+/)
    .slice(0, 2)
    .map((token) => token[0]?.toUpperCase() ?? '')
    .join('')
    .slice(0, 2);
}

function visibilityLabel(visibility: ChessRoomVisibility) {
  return visibility === 'private' ? i18n.t('play:chess.page.visibilityPrivate') : i18n.t('play:chess.page.visibilityPublic');
}

function ChessPieceIcon({ piece, className }: { piece: string; className?: string }) {
  const isWhite = piece === piece.toUpperCase();
  const type = piece.toLowerCase();
  const fill = isWhite ? 'var(--chess-piece-white-fill)' : 'var(--chess-piece-black-fill)';
  const stroke = isWhite ? 'var(--chess-piece-white-stroke)' : 'var(--chess-piece-black-stroke)';

  return (
    <svg viewBox="0 0 80 80" className={className} aria-hidden="true">
      <g fill={fill} stroke={stroke} strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round">
        {type === 'p' ? (
          <>
            <circle cx="40" cy="18" r="8.5" />
            <path d="M31 42c0-8 4.5-13 9-13s9 5 9 13v5H31z" />
            <path d="M24 55c4-5.5 9.5-8.5 16-8.5S52 49.5 56 55" />
            <path d="M22 61h36" />
            <path d="M26 67h28" />
          </>
        ) : null}
        {type === 'r' ? (
          <>
            <path d="M22 17h36v9H22z" />
            <path d="M24 17v-6h7v6M36.5 17v-6h7v6M49 17v-6h7v6" />
            <path d="M29 26h22v25H29z" />
            <path d="M26 52h28" />
            <path d="M22 60h36" />
            <path d="M26 67h28" />
          </>
        ) : null}
        {type === 'n' ? (
          <>
            <path d="M25 66h31" />
            <path d="M21 59h39" />
            <path d="M31 59c-1-11 1.5-21 8.5-30l-5.5-10 12.5 4c9 2.5 15 9.5 16.5 17-7-1.2-12.5 1-15.5 5.5l7.5 13.5H31z" />
            <path d="M39 22c3.5-4.5 9-7 15.5-7" />
          </>
        ) : null}
        {type === 'b' ? (
          <>
            <path d="M40 13l7 9-7 9-7-9z" />
            <path d="M40 13v18" />
            <path d="M30 45c0-10 4.5-16 10-16s10 6 10 16v4H30z" />
            <path d="M24 57c4.5-5.5 10-8.5 16-8.5s11.5 3 16 8.5" />
            <path d="M22 63h36" />
            <path d="M26 69h28" />
          </>
        ) : null}
        {type === 'q' ? (
          <>
            <circle cx="26" cy="16" r="4" />
            <circle cx="40" cy="12" r="4.5" />
            <circle cx="54" cy="16" r="4" />
            <path d="M23 43l4-18 13 10 13-10 4 18z" />
            <path d="M28 43h24v11H28z" />
            <path d="M22 58c5-4.5 11-7 18-7s13 2.5 18 7" />
            <path d="M20 64h40" />
            <path d="M24 70h32" />
          </>
        ) : null}
        {type === 'k' ? (
          <>
            <path d="M40 10v15" />
            <path d="M33 17.5h14" />
            <path d="M31 34c0-7 4-12 9-12s9 5 9 12v14H31z" />
            <path d="M24 55c5-5.5 10.5-8.5 16-8.5S51 49.5 56 55" />
            <path d="M20 62h40" />
            <path d="M24 68h32" />
          </>
        ) : null}
      </g>
      {type === 'n' ? <circle cx="48" cy="31" r="2.8" fill={stroke} stroke="none" /> : null}
    </svg>
  );
}

export function ChessPage() {
  const { t } = useTranslation(['play', 'nav']);
  const runtime = usePluginRuntime();
  const { connectedAgent } = usePluginAgent();
  const navigate = useNavigate();

  const [viewState, dispatch] = useReducer(chessReducer, INITIAL_VIEW_STATE);
  const viewStateRef = useRef(viewState);
  viewStateRef.current = viewState;

  const [errorText, setErrorText] = useState('');
  const [busyCommand, setBusyCommand] = useState('');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const initialClockNow = performance.now();
  const [clockTick, setClockTick] = useState<number>(initialClockNow);
  const [currentClockAnchor, setCurrentClockAnchor] = useState<number>(initialClockNow);
  const [inspectedClockAnchor, setInspectedClockAnchor] = useState<number>(initialClockNow);
  const [promotionRequest, setPromotionRequest] = useState<{ from: string; to: string } | null>(null);
  const [dragSquare, setDragSquare] = useState<string | null>(null);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('new-game');
  const [roomDirectory, setRoomDirectory] = useState<ChessRoomSummary[]>([]);
  const [roomDirectoryVersion, setRoomDirectoryVersion] = useState(0);
  const [inspectedRoom, setInspectedRoom] = useState<ChessInspectedRoom | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [roomDetailOpen, setRoomDetailOpen] = useState(false);
  const [roomSearchText, setRoomSearchText] = useState('');
  const [activeRoomQuery, setActiveRoomQuery] = useState('');
  const [roomDirectoryBusy, setRoomDirectoryBusy] = useState(false);
  const [createRoomName, setCreateRoomName] = useState('');
  const [createRoomVisibility, setCreateRoomVisibility] = useState<ChessRoomVisibility>('public');
  const [resultOverlay, setResultOverlay] = useState<ChessResultOverlay | null>(null);
  const [orbExpanded, setOrbExpanded] = useState(false);
  const [orbPosition, setOrbPosition] = useState({ x: 24, y: 160 });
  const [orbDragging, setOrbDragging] = useState(false);
  const matchEngineRef = useRef<Chess | null>(null);
  const inspectedRoomRef = useRef(inspectedRoom);
  inspectedRoomRef.current = inspectedRoom;
  const activeRoomQueryRef = useRef(activeRoomQuery);
  activeRoomQueryRef.current = activeRoomQuery;
  const roomsAutoFetchAttemptedRef = useRef(false);
  const bootstrapRefreshJobRef = useRef<{ timer: number | null; inFlight: boolean; rerun: boolean; pendingMode: SyncState }>({
    timer: null,
    inFlight: false,
    rerun: false,
    pendingMode: 'resyncing',
  });
  const roomDirectoryRefreshJobRef = useRef<{ timer: number | null; inFlight: boolean; rerun: boolean }>({
    timer: null,
    inFlight: false,
    rerun: false,
  });
  const matchRefreshJobRef = useRef<{ timer: number | null; inFlight: boolean; rerun: boolean; matchId: string | null }>({
    timer: null,
    inFlight: false,
    rerun: false,
    matchId: null,
  });
  const watchedRoomRefreshJobRef = useRef<{
    timer: number | null;
    inFlight: boolean;
    rerun: boolean;
    matchId: string | null;
    spectatorCount: number | null;
  }>({
    timer: null,
    inFlight: false,
    rerun: false,
    matchId: null,
    spectatorCount: null,
  });
  const orbRef = useRef<HTMLDivElement | null>(null);
  const shownResultOverlaySignatureRef = useRef<string | null>(null);
  const orbPointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);

  const clampOrbPosition = (nextX: number, nextY: number) => {
    if (typeof window === 'undefined') return { x: nextX, y: nextY };
    const rect = orbRef.current?.getBoundingClientRect();
    const width = rect?.width ?? (orbExpanded ? 232 : 72);
    const height = rect?.height ?? (orbExpanded ? 220 : 72);
    const inset = 14;
    const maxX = Math.max(inset, window.innerWidth - width - inset);
    const maxY = Math.max(inset, window.innerHeight - height - inset);
    return {
      x: Math.min(Math.max(inset, nextX), maxX),
      y: Math.min(Math.max(inset, nextY), maxY),
    };
  };

  const waitingActionLabel =
    viewState.currentMatch?.phase === 'waiting' && (viewState.currentMatch.players.length ?? 0) <= 1
      ? t('chess.commands.closeRoom')
      : t('chess.commands.leaveRoom');
  const canCreateOrJoin = !viewState.currentMatch || viewState.currentMatch.phase === 'finished';
  const currentMatch = viewState.currentMatch;
  const inspectedDerived = useMemo(
    () => buildEngineFromState(inspectedRoom?.state).derived,
    [inspectedRoom?.state],
  );
  const boardMatch = workspaceTab === 'rooms' && inspectedRoom ? inspectedRoom.state : currentMatch;
  const boardDerived = workspaceTab === 'rooms' && inspectedRoom
    ? inspectedDerived
    : {
        moveList: viewState.moveList,
        lastMove: viewState.lastMove,
        capturedPieces: viewState.capturedPieces,
      };
  const boardMatchIsCurrent = !!boardMatch && !!currentMatch && boardMatch.matchId === currentMatch.matchId;
  const resolvedOrientation: 'white' | 'black' = boardMatchIsCurrent && boardMatch?.yourColor === 'b' ? 'black' : 'white';
  const boardFiles = resolvedOrientation === 'white' ? FILES_WHITE : FILES_BLACK;
  const boardRanks = resolvedOrientation === 'white' ? RANKS_WHITE : RANKS_BLACK;
  const currentBoardMatrix = useMemo(() => parseFenBoard(currentMatch?.fen), [currentMatch?.fen]);
  const boardMatrix = useMemo(() => parseFenBoard(boardMatch?.fen), [boardMatch?.fen]);
  const previewBoardMatrix = useMemo(() => parseFenBoard(PREVIEW_FEN), []);

  const yourTurn =
    boardMatchIsCurrent &&
    currentMatch?.phase === 'playing' &&
    !!currentMatch.yourColor &&
    currentMatch.turn === currentMatch.yourColor;

  const groupedMoveRows = useMemo(() => groupMoves(boardDerived.moveList), [boardDerived.moveList]);
  const latestMovePly = boardDerived.moveList.length > 0 ? boardDerived.moveList[boardDerived.moveList.length - 1].ply : null;
  const activeResultOverlay = resultOverlay && boardMatch && resultOverlay.matchId === boardMatch.matchId
    ? resultOverlay
    : null;

  const getPieceAtSquare = (square: string): string => {
    if (!currentMatch?.fen) return '';
    return pieceAtSquare(currentBoardMatrix, square);
  };

  const resetCurrentClock = (value = performance.now()) => {
    setCurrentClockAnchor(value);
    setClockTick(value);
  };

  const resetInspectedClock = (value = performance.now()) => {
    setInspectedClockAnchor(value);
    setClockTick(value);
  };

  const syncMatchSnapshot = (match: ChessMatchState | null, nextRating = viewStateRef.current.rating) => {
    const { chess, derived } = buildEngineFromState(match);
    matchEngineRef.current = chess;
    dispatch({ type: 'match_snapshot', match, derived, rating: nextRating });
    setSelectedSquare(null);
    setPromotionRequest(null);
    setDragSquare(null);
    resetCurrentClock();
  };

  const showResultOverlay = useEffectEvent((match: ChessMatchState | null) => {
    if (!match?.result) return;
    const signature = `${match.matchId}:${match.result.endedAt}`;
    if (shownResultOverlaySignatureRef.current === signature) return;
    shownResultOverlaySignatureRef.current = signature;
    setResultOverlay((current) => {
      if (current?.signature === signature) return current;
      return {
        signature,
        matchId: match.matchId,
        roomName: match.roomName,
        result: match.result,
        yourAgentId: match.yourAgentId,
      };
    });
  });

  const syncInspectedRoomSnapshot = (summary: ChessRoomSummary, match: ChessMatchState) => {
    const currentInspected = inspectedRoomRef.current;
    const snapshotOrder = compareMatchSnapshot(currentInspected?.state, match);
    const baseState = snapshotOrder < 0 && currentInspected?.state ? currentInspected.state : match;

    setInspectedRoom({
      summary: roomSummaryFromState(summary, baseState, summary.spectatorCount),
      state: baseState,
    });
    setSelectedRoomId(summary.matchId);
    setSelectedSquare(null);
    setPromotionRequest(null);
    setDragSquare(null);
    if (snapshotOrder > 0) {
      resetInspectedClock();
    }
  };

  const clearInspectedRoomSnapshot = () => {
    setInspectedRoom(null);
    setSelectedRoomId(null);
    setRoomDetailOpen(false);
  };

  const applyBootstrapPayload = (payload: ChessBootstrapPayload) => {
    const { chess, derived } = buildEngineFromState(payload.currentMatch);
    matchEngineRef.current = chess;
    dispatch({ type: 'bootstrap_loaded', payload, derived });
    setSelectedSquare(null);
    setPromotionRequest(null);
    setDragSquare(null);
    resetCurrentClock();
  };

  const acquireActionLeaseIfNeeded = async () => {
    const snapshot = await runtime.refreshSessionState();
    if (snapshot.isController) return snapshot;
    if (snapshot.hasController && !window.confirm(t('chess.runtime.confirmTakeover'))) {
      throw new Error(t('chess.runtime.noControl'));
    }
    return runtime.acquireActionLease();
  };

  const ensureChessReady = async () => {
    if (!connectedAgent) {
      throw new Error(t('runtime:websocket.missingShadowAgent'));
    }

    if (!runtime.isConnected) {
      await runtime.connect();
    }

    const snapshot = await acquireActionLeaseIfNeeded();

    if (!snapshot.inCity) {
      await runtime.enterCity();
    }

    const nextSnapshot = await runtime.refreshSessionState();
    if (nextSnapshot.currentLocation !== CHESS_LOCATION_ID) {
      await runtime.enterLocation(CHESS_LOCATION_ID);
    }
  };

  const refreshRooms = async (query = activeRoomQueryRef.current, options?: { silent?: boolean; skipReady?: boolean }) => {
    const trimmed = query.trim();
    if (!options?.silent) {
      setRoomDirectoryBusy(true);
      setErrorText('');
    }

    try {
      if (!options?.skipReady) {
        await ensureChessReady();
      }

      const payload = await runtime.sendCommand<ChessRoomDirectoryPayload>(CHESS_COMMAND('list_rooms'), {
        query: trimmed || undefined,
        limit: 40,
      });

      setRoomDirectory(sortRooms(payload.rooms));
      setRoomDirectoryVersion(payload.directoryVersion);
      setActiveRoomQuery(trimmed);
      setInspectedRoom((current) => {
        if (!current) return current;
        const nextSummary = payload.rooms.find((room) => room.matchId === current.summary.matchId);
        return nextSummary ? { ...current, summary: nextSummary } : current;
      });
    } catch (err) {
      if (!options?.silent) {
        setErrorText(err instanceof Error ? err.message : t('chess.runtime.syncFailed'));
      }
    } finally {
      if (!options?.silent) {
        setRoomDirectoryBusy(false);
      }
    }
  };

  const stopWatchingRooms = async (options?: { silent?: boolean; clearSelection?: boolean }) => {
    const currentInspected = inspectedRoomRef.current;
    if (!currentInspected) {
      if (options?.clearSelection) clearInspectedRoomSnapshot();
      return;
    }

    try {
      await runtime.sendCommand(CHESS_COMMAND('unwatch_room'), { matchId: currentInspected.summary.matchId });
    } catch {
      // Ignore spectator cleanup errors and let the next room/state refresh recover.
    } finally {
      if (options?.clearSelection !== false) {
        clearInspectedRoomSnapshot();
      }
    }
  };

  const refreshBootstrap = async (mode: SyncState = 'resyncing') => {
    dispatch({ type: 'sync_started', value: mode });
    try {
      await ensureChessReady();
      const payload = await runtime.sendCommand<ChessBootstrapPayload>(CHESS_COMMAND('bootstrap'), { limit: 20 });
      applyBootstrapPayload(payload);
      setErrorText('');
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : t('chess.runtime.syncFailed'));
    }
  };

  const resyncCurrentMatch = async (matchId?: string) => {
    try {
      dispatch({ type: 'sync_started', value: 'resyncing' });
      const state = await runtime.sendCommand<ChessMatchState>(CHESS_COMMAND('state'), matchId ? { matchId } : undefined);
      const nextRating = applyMatchResultToRating(viewStateRef.current.rating, viewStateRef.current.currentMatch, state);
      syncMatchSnapshot(state, nextRating);
      setErrorText('');
    } catch {
      await refreshBootstrap('resyncing');
    }
  };

  const resyncWatchedRoom = async (matchId: string, spectatorCount?: number | null) => {
    try {
      const state = await runtime.sendCommand<ChessMatchState>(CHESS_COMMAND('state'), { matchId });
      const currentInspected = inspectedRoomRef.current;
      if (!currentInspected || currentInspected.summary.matchId !== matchId) return;
      const nextSpectatorCount = spectatorCount ?? currentInspected.summary.spectatorCount;
      const nextSummary = roomSummaryFromState(currentInspected.summary, state, nextSpectatorCount);
      syncInspectedRoomSnapshot(nextSummary, state);
      setErrorText('');
    } catch {
      await refreshRooms(activeRoomQueryRef.current, { silent: true, skipReady: true });
    }
  };

  const scheduleBootstrapRefresh = useEffectEvent((mode: SyncState = 'resyncing') => {
    const job = bootstrapRefreshJobRef.current;
    job.pendingMode = mode;
    job.rerun = true;
    if (job.timer !== null) window.clearTimeout(job.timer);
    job.timer = window.setTimeout(() => {
      job.timer = null;
      if (job.inFlight) return;

      const run = async () => {
        if (!job.rerun) return;
        const nextMode = job.pendingMode;
        job.rerun = false;
        job.inFlight = true;
        try {
          await refreshBootstrap(nextMode);
        } finally {
          job.inFlight = false;
          if (job.rerun) {
            await run();
          }
        }
      };

      void run();
    }, 50);
  });

  const scheduleRoomDirectoryRefresh = useEffectEvent(() => {
    const job = roomDirectoryRefreshJobRef.current;
    job.rerun = true;
    if (job.timer !== null) window.clearTimeout(job.timer);
    job.timer = window.setTimeout(() => {
      job.timer = null;
      if (job.inFlight) return;

      const run = async () => {
        if (!job.rerun) return;
        job.rerun = false;
        job.inFlight = true;
        try {
          await refreshRooms(activeRoomQueryRef.current, { silent: true, skipReady: true });
        } finally {
          job.inFlight = false;
          if (job.rerun) {
            await run();
          }
        }
      };

      void run();
    }, 50);
  });

  const scheduleMatchRefresh = useEffectEvent((matchId?: string | null) => {
    const currentMatchId = matchId ?? viewStateRef.current.currentMatch?.matchId ?? null;
    if (!currentMatchId) return;
    const job = matchRefreshJobRef.current;
    job.matchId = currentMatchId;
    job.rerun = true;
    if (job.timer !== null) window.clearTimeout(job.timer);
    job.timer = window.setTimeout(() => {
      job.timer = null;
      if (job.inFlight) return;

      const run = async () => {
        if (!job.rerun || !job.matchId) return;
        const nextMatchId = job.matchId;
        job.rerun = false;
        job.inFlight = true;
        try {
          await resyncCurrentMatch(nextMatchId);
        } finally {
          job.inFlight = false;
          if (job.rerun) {
            await run();
          }
        }
      };

      void run();
    }, 50);
  });

  const scheduleWatchedRoomRefresh = useEffectEvent((matchId?: string | null, spectatorCount?: number | null) => {
    const currentRoomId = matchId ?? inspectedRoomRef.current?.summary.matchId ?? null;
    if (!currentRoomId) return;
    const job = watchedRoomRefreshJobRef.current;
    job.matchId = currentRoomId;
    job.spectatorCount = spectatorCount ?? job.spectatorCount ?? inspectedRoomRef.current?.summary.spectatorCount ?? null;
    job.rerun = true;
    if (job.timer !== null) window.clearTimeout(job.timer);
    job.timer = window.setTimeout(() => {
      job.timer = null;
      if (job.inFlight) return;

      const run = async () => {
        if (!job.rerun || !job.matchId) return;
        const nextMatchId = job.matchId;
        const nextSpectatorCount = job.spectatorCount;
        job.rerun = false;
        job.inFlight = true;
        try {
          await resyncWatchedRoom(nextMatchId, nextSpectatorCount);
        } finally {
          job.inFlight = false;
          if (job.rerun) {
            await run();
          }
        }
      };

      void run();
    }, 50);
  });

  const runCommand = async <T,>(label: string, type: string, payload?: unknown): Promise<T | null> => {
    setBusyCommand(label);
    setErrorText('');
    try {
      const result = await runtime.sendCommand<T>(type, payload);
      return result;
    } catch (err) {
      if (isPluginCommandError(err) && err.code === 'CONTROLLED_ELSEWHERE') {
        try {
          await acquireActionLeaseIfNeeded();
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
    setDragSquare(null);
    setRoomDirectory([]);
    setRoomDirectoryVersion(0);
    setInspectedRoom(null);
    setSelectedRoomId(null);
    setRoomDetailOpen(false);
    setRoomSearchText('');
    setActiveRoomQuery('');
    roomsAutoFetchAttemptedRef.current = false;
    setCreateRoomName('');
    setCreateRoomVisibility('public');
    setResultOverlay(null);
    shownResultOverlaySignatureRef.current = null;
    if (!connectedAgent) return;
    void refreshBootstrap('initializing');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectedAgent?.id]);

  useEffect(() => {
    if (!currentMatch?.result) return;
    showResultOverlay(currentMatch);
  }, [currentMatch?.matchId, currentMatch?.result?.endedAt, showResultOverlay]);

  useEffect(() => {
    if (!inspectedRoom?.state.result) return;
    showResultOverlay(inspectedRoom.state);
  }, [inspectedRoom?.state.matchId, inspectedRoom?.state.result?.endedAt, showResultOverlay]);

  useEffect(() => {
    if (workspaceTab !== 'rooms') {
      roomsAutoFetchAttemptedRef.current = false;
      setRoomDetailOpen(false);
      return;
    }
    if (!connectedAgent) return;
    if (roomDirectory.length > 0 || roomDirectoryBusy || roomsAutoFetchAttemptedRef.current) return;
    roomsAutoFetchAttemptedRef.current = true;
    void refreshRooms(activeRoomQueryRef.current, { silent: false });
  }, [connectedAgent, roomDirectory.length, roomDirectoryBusy, workspaceTab]);

  useEffect(() => {
    if (workspaceTab === 'rooms') return;
    if (!inspectedRoomRef.current) return;
    void stopWatchingRooms({ silent: true, clearSelection: true });
  }, [workspaceTab]);

  useEffect(() => {
    const handleResize = () => {
      setOrbPosition((current) => clampOrbPosition(current.x, current.y));
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orbExpanded]);

  useEffect(() => {
    if (!boardMatch || (boardMatch.phase !== 'playing' && !boardMatch.players.some((player) => player.disconnectDeadlineAt))) {
      return undefined;
    }
    const timer = window.setInterval(() => {
      setClockTick(performance.now());
    }, 250);
    return () => window.clearInterval(timer);
  }, [boardMatch]);

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
    return () => {
      const timers = [
        bootstrapRefreshJobRef.current.timer,
        roomDirectoryRefreshJobRef.current.timer,
        matchRefreshJobRef.current.timer,
        watchedRoomRefreshJobRef.current.timer,
      ];
      timers.forEach((timer) => {
        if (timer !== null) window.clearTimeout(timer);
      });
    };
  }, []);

  useEffect(() => {
    const unsubWelcome = runtime.subscribe('chess_welcome', (payload) => {
      const data = payload as { needsBootstrap?: boolean } | undefined;
      if (data?.needsBootstrap) {
        scheduleBootstrapRefresh(viewStateRef.current.syncState === 'idle' ? 'initializing' : 'resyncing');
      }
    });

    const unsubLobby = runtime.subscribe('chess_lobby_delta', (payload) => {
      const delta = payload as ChessLobbyDeltaPayload;
      if (delta.version <= viewStateRef.current.lobbyVersion) return;
      scheduleBootstrapRefresh('resyncing');
    });

    const unsubRoomDirectory = runtime.subscribe('chess_room_directory_delta', (payload) => {
      const delta = payload as ChessRoomDirectoryDeltaPayload;
      if (delta.version <= roomDirectoryVersion) return;
      scheduleRoomDirectoryRefresh();
    });

    const unsubMatch = runtime.subscribe('chess_match_delta', (payload) => {
      const delta = payload as ChessMatchDeltaPayload;
      scheduleMatchRefresh(delta.matchId);
      if (delta.needsBootstrap) {
        scheduleBootstrapRefresh('resyncing');
      }
    });

    const unsubRoom = runtime.subscribe('chess_room_delta', (payload) => {
      const delta = payload as ChessRoomDeltaPayload;
      const current = inspectedRoomRef.current;
      if (!current || current.summary.matchId !== delta.matchId) return;
      scheduleWatchedRoomRefresh(delta.matchId, delta.spectatorCount);
    });

    const unsubTurnPrompt = runtime.subscribe('chess_turn_prompt', (payload) => {
      const prompt = payload as ChessTurnPromptPayload;
      scheduleMatchRefresh(prompt.matchId);
    });

    const unsubReconnect = runtime.subscribe('chess_reconnected', (payload) => {
      const data = payload as { needsBootstrap?: boolean } | undefined;
      if (data?.needsBootstrap) {
        scheduleBootstrapRefresh('resyncing');
      }
    });

    return () => {
      unsubWelcome();
      unsubLobby();
      unsubRoomDirectory();
      unsubMatch();
      unsubRoom();
      unsubTurnPrompt();
      unsubReconnect();
    };
  }, [runtime, roomDirectoryVersion, scheduleBootstrapRefresh, scheduleMatchRefresh, scheduleRoomDirectoryRefresh, scheduleWatchedRoomRefresh]);

  const displayedClocks = useMemo(() => {
    const matchState = boardMatch;
    if (!matchState) return null;

    const activeClockAnchor = workspaceTab === 'rooms' && inspectedRoom && !boardMatchIsCurrent
      ? inspectedClockAnchor
      : currentClockAnchor;

    let whiteMs = matchState.clocks.whiteMs;
    let blackMs = matchState.clocks.blackMs;

    if (matchState.phase === 'playing' && matchState.turn) {
      const elapsed = Math.max(0, clockTick - activeClockAnchor);
      if (matchState.turn === 'w') whiteMs = Math.max(0, whiteMs - elapsed);
      if (matchState.turn === 'b') blackMs = Math.max(0, blackMs - elapsed);
    }

    return { whiteMs, blackMs };
  }, [boardMatch, boardMatchIsCurrent, clockTick, currentClockAnchor, inspectedClockAnchor, inspectedRoom, workspaceTab]);

  const getLegalTargets = (square: string | null) => {
    const matchState = currentMatch;
    const chess = matchEngineRef.current;
    if (!matchState || matchState.phase !== 'playing' || !square || !yourTurn || !chess) {
      return new Set<string>();
    }
    try {
      const moves = chess.moves({ square: square as Square, verbose: true }) as Array<{ to: string }>;
      return new Set(moves.map((move) => move.to));
    } catch {
      return new Set<string>();
    }
  };

  const legalTargets = useMemo(() => getLegalTargets(selectedSquare), [selectedSquare, currentMatch, yourTurn]);
  const dragTargets = useMemo(() => getLegalTargets(dragSquare), [dragSquare, currentMatch, yourTurn]);
  const activeTargets = dragSquare ? dragTargets : legalTargets;

  const isLiveMatch = currentMatch?.phase === 'playing';
  const isWaitingMatch = currentMatch?.phase === 'waiting';
  const isFinishedMatch = currentMatch?.phase === 'finished';
  const whitePlayer = findPlayer(boardMatch, 'w');
  const blackPlayer = findPlayer(boardMatch, 'b');
  const boardBottomTone: ChessColor = boardMatchIsCurrent && boardMatch?.yourColor === 'b' ? 'b' : 'w';
  const boardTopTone: ChessColor = boardBottomTone === 'w' ? 'b' : 'w';
  const currentViewer = boardMatchIsCurrent ? findPlayerByAgentId(boardMatch, boardMatch?.yourAgentId) : null;
  const waitingPlayer = findPlayerByAgentId(currentMatch, currentMatch?.yourAgentId ?? connectedAgent?.id);
  const waitingBottomPlayer = boardMatchIsCurrent
    ? currentViewer ?? boardMatch?.players[0] ?? null
    : boardMatch?.players[0] ?? null;
  const waitingOpponent = boardMatch?.players.find((player) => player.agentId !== waitingBottomPlayer?.agentId) ?? null;
  const topStagePlayer = boardMatch
    ? boardMatch.phase === 'waiting'
      ? waitingOpponent
      : boardTopTone === 'w'
        ? whitePlayer
        : blackPlayer
    : null;
  const bottomStagePlayer = boardMatch
    ? boardMatch.phase === 'waiting'
      ? waitingBottomPlayer
      : boardBottomTone === 'w'
        ? whitePlayer
        : blackPlayer
    : null;
  const lobbySelfPreviewPlayer: ChessPlayer | null = connectedAgent
    ? {
        agentId: connectedAgent.id,
        userId: '',
        agentName: connectedAgent.name,
        color: null,
        ready: false,
        connected: true,
        disconnectDeadlineAt: null,
      }
    : null;
  const resolveDisplayedClock = (player: ChessPlayer | null, fallbackColor: ChessColor) => {
    const seatColor = player?.color ?? fallbackColor;
    return seatColor === 'w'
      ? (displayedClocks?.whiteMs ?? boardMatch?.clocks.whiteMs)
      : (displayedClocks?.blackMs ?? boardMatch?.clocks.blackMs);
  };
  const selectedRoom = useMemo(
    () => roomDirectory.find((room) => room.matchId === selectedRoomId) ?? inspectedRoom?.summary ?? null,
    [inspectedRoom?.summary, roomDirectory, selectedRoomId],
  );
  const watchedRoomId = inspectedRoom?.summary.matchId ?? null;
  const recordWins = viewState.rating?.wins ?? 0;
  const recordLosses = viewState.rating?.losses ?? 0;
  const recordDraws = viewState.rating?.draws ?? 0;
  const recordGames = viewState.rating?.gamesPlayed ?? 0;
  const winRate = recordGames > 0 ? Math.round((recordWins / recordGames) * 100) : 0;
  const workspaceTabs = [
    { key: 'new-game' as const, icon: PlusSquare, label: t('chess.page.tabNewGame') },
    { key: 'rooms' as const, icon: Eye, label: t('chess.page.tabRooms') },
    { key: 'record' as const, icon: BarChart3, label: t('chess.page.tabRecord') },
    { key: 'history' as const, icon: ListOrdered, label: t('chess.page.tabHistory') },
    { key: 'leaderboard' as const, icon: Trophy, label: t('chess.page.tabLeaderboard') },
  ] as const;

  const executeMove = async (from: string, to: string, promotion?: PromotionPiece) => {
    if (!viewState.currentMatch || !yourTurn || !viewState.currentMatch.yourColor) return;
    const payload = await runCommand<{ state: ChessMatchState }>(t('chess.commands.move'), CHESS_COMMAND('move'), { from, to, promotion });
    if (payload?.state) {
      const nextRating = applyMatchResultToRating(viewStateRef.current.rating, viewStateRef.current.currentMatch, payload.state);
      syncMatchSnapshot(payload.state, nextRating);
    }
  };

  const attemptMove = (from: string, to: string) => {
    const targets = getLegalTargets(from);
    if (!targets.has(to)) return false;

    const movingPiece = getPieceAtSquare(from);
    if (isPromotionCandidate(movingPiece, to)) {
      setPromotionRequest({ from, to });
      setSelectedSquare(from);
      return true;
    }

    void executeMove(from, to);
    return true;
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

    attemptMove(selectedSquare, square);
  };

  const onSquareDragStart = (square: string) => {
    const matchState = viewState.currentMatch;
    if (!matchState || matchState.phase !== 'playing' || !matchState.yourColor || !yourTurn) return false;
    const piece = getPieceAtSquare(square);
    if (!piece || pieceColor(piece) !== matchState.yourColor) return false;
    setDragSquare(square);
    setSelectedSquare(square);
    return true;
  };

  const renderPlayerCard = (seatTone: ChessColor, player: ChessPlayer | null, clockMs: number | undefined) => {
    const seatColor = player?.color ?? seatTone;
    const isTurnCard = !!player?.color && boardMatch?.turn === player.color && !boardMatch?.result;
    const isSelf = player?.agentId === ((boardMatchIsCurrent ? currentMatch?.yourAgentId : null) ?? connectedAgent?.id);
    const displayName = agentNameLabel(player?.agentName, t('chess.page.pendingPlayer'));
    const detailLabel = !player ? t('chess.page.emptySeat') : !player.connected ? t('chess.page.offline') : '\u00a0';

    return (
      <div className={`chess-seat-card chess-seat-card--${seatColor === 'w' ? 'light' : 'dark'} ${isTurnCard ? 'is-active' : ''}`}>
        <div className="chess-seat-card__identity">
          <div className={`chess-seat-card__avatar ${isSelf ? 'is-self' : ''}`}>{agentMonogram(player?.agentName ?? displayName)}</div>
          <div className="chess-seat-card__copy">
            <strong className="chess-seat-card__name">{displayName}</strong>
            <span className={`chess-seat-card__detail ${detailLabel.trim() === '' ? 'is-placeholder' : ''}`}>{detailLabel}</span>
          </div>
        </div>
        <div className="chess-seat-card__clock mono">{formatClock(clockMs ?? 0)}</div>
      </div>
    );
  };

  const renderBoard = (matrix: string[][], interactive: boolean, showHistory: boolean) => (
    <div className={`chess-board ${showHistory ? 'is-live' : 'is-preview'}`}>
      {boardRanks.map((rank, rowIndex) => (
        boardFiles.map((file, colIndex) => {
          const square = `${file}${rank}`;
          const piece = pieceAtSquare(matrix, square);
          const owner = pieceColor(piece);
          const dark = (rowIndex + colIndex) % 2 === 1;
          const isLastMoveFrom = showHistory && boardDerived.lastMove?.from === square;
          const isLastMoveTo = showHistory && boardDerived.lastMove?.to === square;
          const isTarget = interactive && activeTargets.has(square);
          const isSelected = interactive && selectedSquare === square;
          const isDragSource = interactive && dragSquare === square;
          const canDrag = interactive && !!piece && !!currentMatch?.yourColor && yourTurn && owner === currentMatch.yourColor;

          const squareInner = (
            <>
              {piece ? <ChessPieceIcon piece={piece} className={`chess-piece ${piece === piece.toLowerCase() ? 'black' : 'white'}`} /> : null}
              {rowIndex === 7 ? <span className="chess-mark file">{file}</span> : null}
              {colIndex === 0 ? <span className="chess-mark rank">{rank}</span> : null}
            </>
          );

          const className = `chess-square ${dark ? 'dark' : 'light'} ${isSelected ? 'selected' : ''} ${isTarget ? 'target' : ''} ${isLastMoveFrom || isLastMoveTo ? 'last-move' : ''} ${isLastMoveFrom ? 'last-move-from' : ''} ${isLastMoveTo ? 'last-move-to' : ''} ${isDragSource ? 'drag-source' : ''}`;

          if (!interactive) {
            return (
              <div key={square} className={className}>
                {squareInner}
              </div>
            );
          }

          return (
            <button
              key={square}
              type="button"
              className={className}
              onClick={() => onSquareClick(square)}
              title={square}
              draggable={canDrag}
              onDragStart={(event) => {
                if (!onSquareDragStart(square)) {
                  event.preventDefault();
                  return;
                }
                event.dataTransfer.effectAllowed = 'move';
                event.dataTransfer.setData('text/plain', square);
              }}
              onDragEnd={() => setDragSquare(null)}
              onDragOver={(event) => {
                if (!dragSquare || !activeTargets.has(square)) return;
                event.preventDefault();
                event.dataTransfer.dropEffect = 'move';
              }}
              onDrop={(event) => {
                event.preventDefault();
                const from = dragSquare ?? event.dataTransfer.getData('text/plain');
                setDragSquare(null);
                if (!from) return;
                attemptMove(from, square);
              }}
            >
              {squareInner}
            </button>
          );
        })
      ))}
    </div>
  );

  const startOrbGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (event.button !== 0) return;
    orbPointerRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      offsetX: event.clientX - orbPosition.x,
      offsetY: event.clientY - orbPosition.y,
      moved: false,
    };
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const moveOrbGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const pointer = orbPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;

    const deltaX = event.clientX - pointer.startX;
    const deltaY = event.clientY - pointer.startY;
    if (!pointer.moved && Math.hypot(deltaX, deltaY) >= 6) {
      pointer.moved = true;
      setOrbDragging(true);
    }

    if (!pointer.moved) return;

    setOrbPosition(clampOrbPosition(event.clientX - pointer.offsetX, event.clientY - pointer.offsetY));
  };

  const finishOrbGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    const pointer = orbPointerRef.current;
    if (!pointer || pointer.pointerId !== event.pointerId) return;

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const wasDrag = pointer.moved;
    orbPointerRef.current = null;
    setOrbDragging(false);

    if (!wasDrag) {
      setOrbExpanded((value) => !value);
    }
  };

  const cancelOrbGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (orbPointerRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    orbPointerRef.current = null;
    setOrbDragging(false);
  };

  const renderWorkspaceActions = () => (
    <div className="chess-action-grid">
      {isWaitingMatch ? (
        <>
          <button
            className={waitingPlayer?.ready ? 'app-btn secondary' : 'app-btn chess-cta'}
            disabled={!!busyCommand}
            onClick={() => void runCommand<{ state: ChessMatchState }>(
              waitingPlayer?.ready ? t('chess.commands.unready') : t('chess.commands.ready'),
              CHESS_COMMAND(waitingPlayer?.ready ? 'unready' : 'ready'),
            ).then((res) => {
              if (res?.state) syncMatchSnapshot(res.state);
            })}
          >
            {waitingPlayer?.ready ? t('chess.commands.unready') : t('chess.commands.ready')}
          </button>
          <button
            className="app-btn secondary"
            disabled={!!busyCommand}
            onClick={() => void runCommand<{ state: ChessMatchState | null }>(waitingActionLabel, CHESS_COMMAND('leave_match')).then((res) => {
              if (!res) return;
              dispatch({ type: 'match_cleared' });
              setSelectedSquare(null);
              setPromotionRequest(null);
              setDragSquare(null);
            })}
          >
            {waitingActionLabel}
          </button>
        </>
      ) : null}

      {isLiveMatch ? (
        <>
          {!currentMatch?.drawOfferBy ? (
            <button
              className="app-btn chess-cta"
              disabled={!!busyCommand}
              onClick={() => void runCommand<{ state: ChessMatchState }>(t('chess.commands.offerDraw'), CHESS_COMMAND('offer_draw')).then((res) => {
                if (res?.state) syncMatchSnapshot(res.state);
              })}
            >
              {t('chess.commands.offerDraw')}
            </button>
          ) : null}

          {currentMatch?.drawOfferBy && currentMatch.drawOfferBy !== currentMatch.yourAgentId ? (
            <>
              <button
                className="app-btn chess-cta"
                disabled={!!busyCommand}
                onClick={() => void runCommand<{ state: ChessMatchState }>(t('chess.commands.acceptDraw'), CHESS_COMMAND('accept_draw')).then((res) => {
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
                onClick={() => void runCommand<{ state: ChessMatchState }>(t('chess.commands.declineDraw'), CHESS_COMMAND('decline_draw')).then((res) => {
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
            onClick={() => void runCommand<{ state: ChessMatchState }>(t('chess.commands.resign'), CHESS_COMMAND('resign')).then((res) => {
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
  );

  const createMatch = async () => {
    const payload = await runCommand<{ matchId: string; state: ChessMatchState }>(
      t('chess.commands.createMatch'),
      CHESS_COMMAND('create_match'),
      {
        roomName: createRoomName.trim() || undefined,
        visibility: createRoomVisibility,
      },
    );

    if (payload?.state) {
      syncMatchSnapshot(payload.state);
      setCreateRoomName('');
      void refreshRooms(activeRoomQueryRef.current, { silent: true, skipReady: true });
    }
  };

  const openRoom = async (room: ChessRoomSummary) => {
    setSelectedRoomId(room.matchId);
    setRoomDetailOpen(true);
    const currentInspected = inspectedRoomRef.current;
    if (currentInspected?.summary.matchId === room.matchId) {
      setInspectedRoom({
        summary: roomSummaryFromState(room, currentInspected.state, room.spectatorCount),
        state: currentInspected.state,
      });
      return;
    }
    const payload = await runCommand<ChessWatchRoomPayload>(
      t('chess.page.watchRoom'),
      CHESS_COMMAND('watch_room'),
      { matchId: room.matchId },
    );
    if (!payload) return;
    syncInspectedRoomSnapshot(payload.room, payload.state);
  };

  const searchRooms = async () => {
    await refreshRooms(roomSearchText);
  };

  const joinSelectedRoom = async () => {
    const room = inspectedRoomRef.current?.summary;
    if (!room) return;
    const payload = await runCommand<{ state: ChessMatchState }>(
      t('chess.page.joinThisMatch'),
      CHESS_COMMAND('join_match'),
      { matchId: room.matchId },
    );
    if (!payload?.state) return;

    const nextRating = applyMatchResultToRating(viewStateRef.current.rating, viewStateRef.current.currentMatch, payload.state);
    syncMatchSnapshot(payload.state, nextRating);
    await stopWatchingRooms({ silent: true, clearSelection: true });
    setWorkspaceTab('new-game');
  };

  const workspaceContent = (() => {
    switch (workspaceTab) {
      case 'record':
        return (
          <section className="chess-panel-card chess-panel-card--workspace">
            <header className="chess-panel-card__header">
              <div>
                <span className="chess-stage-label">{t('chess.page.tabRecord')}</span>
                <h2>{t('chess.page.recordTitle')}</h2>
              </div>
              <span className="chess-panel-pill">Elo {viewState.rating?.rating ?? DEFAULT_RATING}</span>
            </header>
            <div className="chess-stat-grid">
              <div className="chess-stat-card">
                <span>{t('chess.page.recordGames')}</span>
                <strong>{recordGames}</strong>
              </div>
              <div className="chess-stat-card">
                <span>{t('chess.page.recordWinRate')}</span>
                <strong>{recordGames > 0 ? `${winRate}%` : '--'}</strong>
              </div>
              <div className="chess-stat-card">
                <span>{t('chess.page.recordWins')}</span>
                <strong>{recordWins}</strong>
              </div>
              <div className="chess-stat-card">
                <span>{t('chess.page.recordLosses')}</span>
                <strong>{recordLosses}</strong>
              </div>
              <div className="chess-stat-card">
                <span>{t('chess.page.recordDraws')}</span>
                <strong>{recordDraws}</strong>
              </div>
              <div className="chess-stat-card">
                <span>{t('chess.page.currentBoard')}</span>
                <strong>{currentMatch ? currentMatch.phase : t('chess.page.waiting')}</strong>
              </div>
            </div>
            <div className="chess-panel-card__summary">
              <div className="chess-panel-pill-row">
                <span className="chess-panel-pill">{t('chess.page.connectedAgent')}</span>
                <span className="chess-panel-pill">{connectedAgent?.name ?? t('chess.runtime.noAgent')}</span>
              </div>
              <p>{t('chess.page.recordBody')}</p>
            </div>
          </section>
        );
      case 'rooms': {
        const detailRoom = inspectedRoom?.summary ?? selectedRoom;
        const detailState = inspectedRoom?.state ?? null;
        const showRoomDetail = roomDetailOpen && !!detailRoom;
        const isWatchingSelectedRoom = !!detailRoom && watchedRoomId === detailRoom.matchId;
        const canJoinSelectedRoom =
          !!detailRoom &&
          detailRoom.phase === 'waiting' &&
          detailRoom.seatsRemaining > 0 &&
          canCreateOrJoin;

        return (
          <section className="chess-panel-card chess-panel-card--workspace">
            <header className="chess-panel-card__header">
              <div>
                <span className="chess-stage-label">{t('chess.page.tabRooms')}</span>
                <h2>{t('chess.page.roomsTitle')}</h2>
              </div>
              {roomDirectoryBusy ? <span className="chess-panel-pill">{t('chess.page.roomsLoading')}</span> : null}
            </header>

            <form
              className="chess-room-search"
              onSubmit={(event) => {
                event.preventDefault();
                void searchRooms();
              }}
            >
              <label className="chess-field">
                <span className="chess-field__label">{t('chess.page.roomsSearchLabel')}</span>
                <div className="chess-field__control chess-field__control--search">
                  <Search size={16} />
                  <input
                    value={roomSearchText}
                    onChange={(event) => setRoomSearchText(event.target.value)}
                    placeholder={t('chess.page.roomsSearchPlaceholder')}
                  />
                </div>
              </label>
              <button className="app-btn secondary" type="submit" disabled={roomDirectoryBusy}>
                {t('chess.page.roomsSearchButton')}
              </button>
            </form>

            {inspectedRoom ? (
              <div className="chess-room-watch-banner">
                <div className="chess-room-watch-banner__copy">
                  <span className="chess-stage-label">{t('chess.page.watchStatusTitle')}</span>
                  <strong>{inspectedRoom.summary.roomName}</strong>
                  <span className="mono">{inspectedRoom.summary.matchId}</span>
                </div>
                <div className="chess-room-watch-banner__actions">
                  <span className="chess-panel-pill chess-panel-pill--watching">{t('chess.page.watchingNow')}</span>
                  <button
                    type="button"
                    className="app-btn secondary"
                    onClick={() => {
                      setSelectedRoomId(inspectedRoom.summary.matchId);
                      setRoomDetailOpen(true);
                    }}
                  >
                    {t('chess.page.showWatchedRoom')}
                  </button>
                  <button
                    type="button"
                    className="app-btn ghost"
                    disabled={!!busyCommand}
                    onClick={() => void stopWatchingRooms({ silent: true, clearSelection: true })}
                  >
                    {t('chess.page.stopWatching')}
                  </button>
                </div>
              </div>
            ) : null}

            {showRoomDetail ? (
              <div className="chess-room-detail-modal" role="dialog" aria-label={t('chess.page.selectedRoomTitle')}>
                <div className="chess-room-detail chess-room-detail--directory chess-room-detail--floating">
                  <div className="chess-room-detail__header">
                    <div>
                      <span className="chess-stage-label">{t('chess.page.selectedRoomTitle')}</span>
                      <h3>{detailRoom.roomName}</h3>
                    </div>
                    <div className="chess-room-detail__header-actions">
                      <span className="chess-panel-pill mono">{detailRoom.matchId}</span>
                      <button
                        type="button"
                        className="chess-room-detail__close"
                        aria-label={t('chess.page.closeRoomPanel')}
                        onClick={() => setRoomDetailOpen(false)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="chess-panel-pill-row">
                    <span className="chess-panel-pill">{visibilityLabel(detailRoom.visibility)}</span>
                    <span className="chess-panel-pill">{t('chess.page.phaseChip', { value: detailRoom.phase })}</span>
                    <span className="chess-panel-pill">{t('chess.page.spectatorChip', { count: detailRoom.spectatorCount })}</span>
                    {isWatchingSelectedRoom ? (
                      <span className="chess-panel-pill chess-panel-pill--watching">{t('chess.page.watchingNow')}</span>
                    ) : null}
                  </div>
                  <div className="chess-room-detail__body">
                    {(detailState?.players ?? detailRoom.players).map((player) => (
                      <div key={player.agentId} className="chess-room-detail__player">
                        <span>{player.agentName}</span>
                        <span>{player.connected ? t('chess.page.online') : t('chess.page.offline')}</span>
                      </div>
                    ))}
                  </div>
                  <div className="chess-room-detail__actions">
                    {isWatchingSelectedRoom ? (
                      <button
                        type="button"
                        className="app-btn secondary"
                        disabled={!!busyCommand}
                        onClick={() => void stopWatchingRooms({ silent: true, clearSelection: true })}
                      >
                        {t('chess.page.stopWatching')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="app-btn secondary"
                        disabled={!!busyCommand}
                        onClick={() => void openRoom(detailRoom)}
                      >
                        {t('chess.page.watchRoom')}
                      </button>
                    )}
                    {canJoinSelectedRoom ? (
                      <button
                        type="button"
                        className="app-btn chess-cta"
                        disabled={!!busyCommand}
                        onClick={() => void joinSelectedRoom()}
                      >
                        {t('chess.page.joinThisMatch')}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <div className="chess-panel-card__header">
              <div>
                <span className="chess-stage-label">{t('chess.page.roomsListKicker')}</span>
                <h2>{t('chess.page.roomsListTitle')}</h2>
              </div>
              <span className="chess-panel-pill">{roomDirectory.length}</span>
            </div>

            {roomDirectory.length === 0 ? (
              <div className="chess-panel-empty">{t('chess.page.noRooms')}</div>
            ) : (
              <div className="chess-room-list chess-scroll chess-scroll--workspace">
                {roomDirectory.map((room) => (
                  <button
                    key={room.matchId}
                    type="button"
                    className={`chess-room-card chess-room-card--selectable ${selectedRoomId === room.matchId ? 'is-selected' : ''}`}
                    onClick={() => void openRoom(room)}
                  >
                    <div className="chess-room-card__head">
                      <strong>{room.roomName}</strong>
                      <span className="mono">{room.matchId}</span>
                    </div>
                    <div className="chess-room-card__meta">
                      <span>{t('chess.page.phaseChip', { value: room.phase })}</span>
                      <span>{t('chess.page.spectatorChip', { count: room.spectatorCount })}</span>
                      <span>{visibilityLabel(room.visibility)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      }
      case 'history':
        return (
          <section className="chess-panel-card chess-panel-card--workspace">
            <header className="chess-panel-card__header">
              <div>
                <span className="chess-stage-label">{t('chess.page.tabHistory')}</span>
                <h2>{t('chess.page.moveSheet')}</h2>
              </div>
              <span className="chess-panel-pill">{boardDerived.moveList.length}</span>
            </header>
            <div className="chess-panel-card__summary">
              <div className="chess-panel-pill-row">
                {boardMatch ? <span className="chess-panel-pill mono">{t('chess.page.matchLabel', { id: boardMatch.matchId })}</span> : null}
                <span className="chess-panel-pill">{boardMatch ? formatPositionSummary(boardMatch) : t('chess.page.noMatch')}</span>
              </div>
              <p>{boardMatch ? t('chess.page.historyBody') : t('chess.page.historyEmptyBody')}</p>
            </div>
            {groupedMoveRows.length === 0 ? (
              <div className="chess-panel-empty">{t('chess.page.moveSheetEmpty')}</div>
            ) : (
              <div className="move-list chess-scroll chess-scroll--workspace">
                {groupedMoveRows.map((row) => (
                  <div key={row.moveNumber} className="move-row">
                    <span className="move-row__index mono">{row.moveNumber}.</span>
                    <span className={`move-pill ${row.white?.ply === latestMovePly ? 'is-latest' : ''}`}>{row.white?.san ?? '...'}</span>
                    <span className={`move-pill ${row.black?.ply === latestMovePly ? 'is-latest' : ''}`}>{row.black?.san ?? '...'}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      case 'leaderboard':
        return (
          <section className="chess-panel-card chess-panel-card--workspace">
            <header className="chess-panel-card__header">
              <div>
                <span className="chess-stage-label">{t('chess.page.tabLeaderboard')}</span>
                <h2>{t('chess.page.leaderboard')}</h2>
              </div>
              <span className="chess-panel-pill">Top {viewState.leaderboard.length}</span>
            </header>
            {viewState.rating ? (
              <div className="chess-panel-card__summary">
                <div className="chess-panel-pill-row">
                  <span className="chess-panel-pill">{t('chess.page.connectedAgent')}</span>
                  <span className="chess-panel-pill">{connectedAgent?.name ?? t('chess.runtime.noAgent')}</span>
                </div>
                <p>{t('chess.page.leaderboardBody', { rating: viewState.rating.rating })}</p>
              </div>
            ) : null}
            {viewState.leaderboard.length === 0 ? (
              <div className="chess-panel-empty">{t('chess.page.noData')}</div>
            ) : (
              <div className="chess-leaderboard-list chess-scroll chess-scroll--workspace">
                {viewState.leaderboard.map((item, idx) => (
                  <div key={item.agentId} className="chess-leaderboard-item">
                    <div className="chess-leaderboard-item__head">
                      <span className="chess-rank"><Crown size={14} /> #{idx + 1}</span>
                      <strong>{item.rating}</strong>
                    </div>
                    <div className="chess-leaderboard-item__name">{agentNameLabel(item.agentName, item.agentId)}</div>
                    <div className="chess-leaderboard-item__meta mono">{item.wins}W/{item.losses}L/{item.draws}D</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      case 'new-game':
      default:
        return (
          <section className="chess-panel-card chess-panel-card--workspace">
            <header className="chess-panel-card__header">
              <div>
                <span className="chess-stage-label">{t('chess.page.tabNewGame')}</span>
                <h2>{t('chess.page.newGameTitle')}</h2>
              </div>
              {busyCommand ? <span className="chess-panel-pill">{t('chess.page.busy', { label: busyCommand })}</span> : null}
            </header>

            {!currentMatch || isFinishedMatch ? (
              <div className="chess-launch-card">
                <label className="chess-field">
                  <span className="chess-field__label">{t('chess.page.roomNameLabel')}</span>
                  <div className="chess-field__control">
                    <input
                      value={createRoomName}
                      onChange={(event) => setCreateRoomName(event.target.value)}
                      placeholder={t('chess.page.roomNamePlaceholder')}
                    />
                  </div>
                </label>
                <div className="chess-visibility-toggle" role="tablist" aria-label={t('chess.page.visibilityTitle')}>
                  {(['public', 'private'] as ChessRoomVisibility[]).map((visibility) => (
                    <button
                      key={visibility}
                      type="button"
                      className={`chess-visibility-toggle__option ${createRoomVisibility === visibility ? 'is-active' : ''}`}
                      onClick={() => setCreateRoomVisibility(visibility)}
                    >
                      {visibility === 'public' ? <Globe2 size={15} /> : <LockKeyhole size={15} />}
                      <span>{visibilityLabel(visibility)}</span>
                    </button>
                  ))}
                </div>
                <div className="chess-launch-card__time">
                  <span className="chess-panel-pill"><TimerReset size={14} /> {t('chess.page.timeControl')}</span>
                </div>
                <button
                  className="app-btn chess-cta"
                  disabled={!!busyCommand || !connectedAgent || !canCreateOrJoin}
                  onClick={() => void createMatch()}
                >
                  {t('chess.commands.createMatch')}
                </button>
              </div>
            ) : null}

            {currentMatch ? (
              <div className="chess-room-detail is-current">
                <div className="chess-room-detail__header">
                  <div>
                    <span className="chess-stage-label">{t('chess.page.currentRoomTitle')}</span>
                    <h3>{currentMatch.roomName}</h3>
                  </div>
                  <span className="chess-panel-pill mono">{currentMatch.matchId}</span>
                </div>
                <div className="chess-panel-pill-row">
                  <span className="chess-panel-pill">{visibilityLabel(currentMatch.visibility)}</span>
                  <span className="chess-panel-pill">{t('chess.page.phaseChip', { value: currentMatch.phase })}</span>
                  <span className="chess-panel-pill">{t('chess.page.playersCount', { count: currentMatch.players.length })}</span>
                  <span className="chess-panel-pill">{t('chess.page.readyCount', { count: currentMatch.players.filter((player) => player.ready).length })}</span>
                </div>
                <div className="chess-room-detail__body">
                  {currentMatch.players.map((player) => (
                    <div key={player.agentId} className="chess-room-detail__player">
                      <span>{player.agentName}</span>
                      <span>{player.ready ? t('chess.page.ready') : t('common:status.waiting')}</span>
                    </div>
                  ))}
                </div>
                <div className="chess-room-detail__actions">{renderWorkspaceActions()}</div>
              </div>
            ) : (
              <div className="chess-panel-empty">{t('chess.page.currentRoomEmpty')}</div>
            )}
          </section>
        );
    }
  })();

  return (
    <div className="page-wrap chess-com-shell">
      <div className="chess-com-shell__ambience" aria-hidden="true" />

      {(!connectedAgent || errorText || runtime.error) ? (
        <div className="chess-notice-stack">
          {!connectedAgent ? (
            <div className="chess-inline-notice chess-inline-notice--info">
              {t('chess.runtime.noAgent')} <Link className="chess-inline-link" to="/lobby">{t('nav:lobby')}</Link> / <Link className="chess-inline-link" to="/agents">{t('nav:agents')}</Link>
            </div>
          ) : null}

          {(errorText || runtime.error) ? (
            <div className="chess-inline-notice chess-inline-notice--error">
              <span className="chess-inline-notice__row"><ShieldAlert size={14} /> {errorText || runtime.error}</span>
            </div>
          ) : null}
        </div>
      ) : null}

      <section className="chess-com-layout">
        <main className="chess-main-column">
          <section className="chess-main-stage is-live" id="play">
            {!boardMatch ? (
              <div className="chess-stage-center chess-stage-center--live">
                {renderPlayerCard('b', null, DEFAULT_CLOCK_MS)}

                <div className="chess-board-shell chess-board-shell--live">
                  <div className="board-wrap board-wrap--live">
                    {renderBoard(previewBoardMatrix, false, false)}
                  </div>
                </div>

                {renderPlayerCard('w', lobbySelfPreviewPlayer, DEFAULT_CLOCK_MS)}
              </div>
            ) : (
              <div className="chess-stage-center chess-stage-center--live">
                {renderPlayerCard(
                  boardTopTone,
                  topStagePlayer,
                  resolveDisplayedClock(topStagePlayer, boardTopTone),
                )}

                <div className="chess-board-shell chess-board-shell--live">
                  <div className="board-wrap board-wrap--live">
                    {activeResultOverlay ? (
                      <div className="chess-result-overlay" role="status" aria-live="polite">
                        <div className="chess-result-overlay__card">
                          <button
                            type="button"
                            className="chess-result-overlay__close"
                            aria-label={t('chess.page.dismissResultOverlay')}
                            onClick={() => setResultOverlay(null)}
                          >
                            <X size={16} />
                          </button>
                          <span className="chess-stage-label">{t('chess.page.resultLabel')}</span>
                          <strong>{formatResultTitle(activeResultOverlay.result)}</strong>
                          <span className="chess-result-overlay__room">{activeResultOverlay.roomName}</span>
                          <div className="chess-result-overlay__meta">
                            <span>{formatReason(activeResultOverlay.result.reason)}</span>
                            <span>{formatPluginDateTime(activeResultOverlay.result.endedAt)}</span>
                          </div>
                          {boardMatchIsCurrent && activeResultOverlay.yourAgentId && typeof activeResultOverlay.result.ratingChanges[activeResultOverlay.yourAgentId] === 'number' ? (
                            <div className="chess-result-overlay__delta">
                              {t('chess.page.yourEloDelta', {
                                delta: `${activeResultOverlay.result.ratingChanges[activeResultOverlay.yourAgentId] > 0 ? '+' : ''}${activeResultOverlay.result.ratingChanges[activeResultOverlay.yourAgentId]}`,
                              })}
                            </div>
                          ) : null}
                        </div>
                      </div>
                    ) : null}
                    {renderBoard(boardMatrix, isLiveMatch && boardMatchIsCurrent, true)}
                  </div>
                </div>

                {renderPlayerCard(
                  boardBottomTone,
                  bottomStagePlayer,
                  resolveDisplayedClock(bottomStagePlayer, boardBottomTone),
                )}
              </div>
            )}
          </section>
        </main>

        <aside className="chess-right-rail">
          <div className="chess-workspace-tabs" role="tablist" aria-label={t('chess.page.workspaceTabs')}>
            {workspaceTabs.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                className={`chess-workspace-tab ${workspaceTab === key ? 'is-active' : ''}`}
                onClick={() => setWorkspaceTab(key)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          {workspaceContent}
        </aside>
      </section>

      <div
        ref={orbRef}
        className={`chess-float-orb ${orbExpanded ? 'is-expanded' : ''} ${orbDragging ? 'is-dragging' : ''}`}
        style={{ left: orbPosition.x, top: orbPosition.y }}
      >
        <button
          type="button"
          className="chess-float-orb__core"
          onPointerDown={startOrbGesture}
          onPointerMove={moveOrbGesture}
          onPointerUp={finishOrbGesture}
          onPointerCancel={cancelOrbGesture}
          onClick={(event) => {
            // Keep keyboard activation working while pointer taps are handled via pointerup.
            if (event.detail === 0) {
              setOrbExpanded((value) => !value);
            }
          }}
        >
          {orbExpanded ? <X size={20} /> : <Bot size={20} />}
        </button>
        {orbExpanded ? (
          <div className="chess-float-orb__menu">
            <button className="chess-float-orb__action" disabled={!!busyCommand || !connectedAgent} onClick={() => void refreshBootstrap('resyncing')}>
              <RefreshCw size={16} />
              <span>{t('chess.page.navSync')}</span>
            </button>
            <button className="chess-float-orb__action" disabled={!!busyCommand} onClick={() => void returnToPlay().catch((err) => setErrorText(err instanceof Error ? err.message : t('chess.runtime.returnToCityFailed')))}>
              <Building2 size={16} />
              <span>{t('chess.page.navCity')}</span>
            </button>
            <button className="chess-float-orb__action" disabled={!!busyCommand} onClick={() => void returnToLobby().catch((err) => setErrorText(err instanceof Error ? err.message : t('chess.runtime.returnToLobbyFailed')))}>
              <LayoutGrid size={16} />
              <span>{t('chess.page.navLobby')}</span>
            </button>
          </div>
        ) : null}
      </div>

      {promotionRequest ? (
        <div className="promotion-overlay">
          <div className="promotion-card">
            <p className="chess-stage-label">{t('chess.page.promotionKicker')}</p>
            <h3>{t('chess.page.promotionTitle')}</h3>
            <p className="promotion-card__copy">
              {t('chess.page.promotionBody', { from: promotionRequest.from, to: promotionRequest.to })}
            </p>

            <div className="promotion-grid">
              {(['q', 'r', 'b', 'n'] as PromotionPiece[]).map((piece) => {
                const code = currentMatch?.yourColor === 'b' ? piece : piece.toUpperCase();
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
                    <ChessPieceIcon piece={code} className="promotion-piece" />
                    <span>{labelMap[piece]}</span>
                  </button>
                );
              })}
            </div>

            <div className="promotion-card__actions">
              <button className="app-btn ghost" onClick={() => setPromotionRequest(null)}>{t('chess.page.cancel')}</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
