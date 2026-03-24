import React, { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react';
import { Link } from 'react-router-dom';
import { formatPluginDateTime } from '@uruc/plugin-sdk/frontend';
import { isPluginCommandError, usePluginAgent, usePluginRuntime } from '@uruc/plugin-sdk/frontend-react';
import {
  BarChart3,
  Bot,
  Eye,
  Globe2,
  ListOrdered,
  LockKeyhole,
  PlusSquare,
  RefreshCw,
  ShieldAlert,
  TimerReset,
  Trophy,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  ChineseChessBootstrapPayload,
  ChineseChessLegalMove,
  ChineseChessLobbyDeltaPayload,
  ChineseChessMatchDeltaPayload,
  ChineseChessMatchPhase,
  ChineseChessMatchResult,
  ChineseChessMatchState,
  ChineseChessPlayer,
  ChineseChessRating,
  ChineseChessRoomDeltaPayload,
  ChineseChessRoomDirectoryDeltaPayload,
  ChineseChessRoomDirectoryPayload,
  ChineseChessRoomSummary,
  ChineseChessRoomVisibility,
  ChineseChessSide,
  ChineseChessTurnPromptPayload,
  ChineseChessWatchRoomPayload,
} from './types';
import { pieceAssetUrl } from './piece-assets';

const CHINESE_CHESS_LOCATION_ID = 'uruc.chinese-chess.chinese-chess-club';
const CHINESE_CHESS_COMMAND = (id: string) => `uruc.chinese-chess.${id}@v1`;
const FILES = ['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i'] as const;
const FILES_RED = FILES;
const FILES_BLACK = [...FILES].reverse() as typeof FILES;
const RANKS_RED = ['9', '8', '7', '6', '5', '4', '3', '2', '1', '0'] as const;
const RANKS_BLACK = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'] as const;
const BOARD_VERTICAL_GUIDES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5] as const;
const BOARD_HORIZONTAL_GUIDES = [0.5, 1.5, 2.5, 3.5, 4.5, 5.5, 6.5, 7.5, 8.5, 9.5] as const;
const BOARD_STAR_POINTS = [
  { x: 1.5, y: 2.5, edge: 'full' as const },
  { x: 7.5, y: 2.5, edge: 'full' as const },
  { x: 0.5, y: 3.5, edge: 'left' as const },
  { x: 2.5, y: 3.5, edge: 'full' as const },
  { x: 4.5, y: 3.5, edge: 'full' as const },
  { x: 6.5, y: 3.5, edge: 'full' as const },
  { x: 8.5, y: 3.5, edge: 'right' as const },
  { x: 1.5, y: 7.5, edge: 'full' as const },
  { x: 7.5, y: 7.5, edge: 'full' as const },
  { x: 0.5, y: 6.5, edge: 'left' as const },
  { x: 2.5, y: 6.5, edge: 'full' as const },
  { x: 4.5, y: 6.5, edge: 'full' as const },
  { x: 6.5, y: 6.5, edge: 'full' as const },
  { x: 8.5, y: 6.5, edge: 'right' as const },
] as const;
const DEFAULT_CLOCK_MS = 10 * 60 * 1000;
const INITIAL_POSITION_FEN = 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r';
const MAX_TOASTS = 4;
const INITIAL_COUNTS = {
  red: { K: 1, A: 2, B: 2, N: 2, R: 2, C: 2, P: 5 },
  black: { k: 1, a: 2, b: 2, n: 2, r: 2, c: 2, p: 5 },
};
const PIECE_GLYPHS: Record<string, string> = {
  K: '帥',
  A: '仕',
  B: '相',
  N: '傌',
  R: '俥',
  C: '炮',
  P: '兵',
  k: '將',
  a: '士',
  b: '象',
  n: '馬',
  r: '車',
  c: '砲',
  p: '卒',
};

type WorkspaceTab = 'new-game' | 'rooms' | 'record' | 'history' | 'leaderboard';
type OrientationMode = 'auto' | 'red' | 'black';
type InspectedRoom = {
  summary: ChineseChessRoomSummary;
  state: ChineseChessMatchState;
};
type ToastTone = 'info' | 'error';
type ToastItem = {
  id: number;
  text: string;
  tone: ToastTone;
};

function parseFenBoard(fen: string | undefined): string[][] {
  const empty = Array.from({ length: 10 }, () => Array<string>(9).fill(''));
  if (!fen) return empty;
  const rows = fen.split(' ')[0]?.split('/');
  if (!rows || rows.length !== 10) return empty;

  for (let row = 0; row < rows.length; row += 1) {
    const cells: string[] = [];
    for (const token of rows[row]) {
      if (/\d/.test(token)) {
        const count = Number.parseInt(token, 10);
        for (let index = 0; index < count; index += 1) cells.push('');
      } else {
        cells.push(token);
      }
    }
    if (cells.length === 9) empty[row] = cells;
  }

  return empty;
}

function pieceSide(piece: string): ChineseChessSide | null {
  if (!piece) return null;
  return piece === piece.toUpperCase() ? 'red' : 'black';
}

function pieceAtSquare(board: string[][], square: string): string {
  const file = square.charCodeAt(0) - 97;
  const rank = Number.parseInt(square[1], 10);
  const row = 9 - rank;
  return board[row]?.[file] ?? '';
}

function formatClock(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function oppositeSide(side: ChineseChessSide): ChineseChessSide {
  return side === 'red' ? 'black' : 'red';
}

function agentMonogram(name: string): string {
  const tokens = name.trim().split(/\s+/).filter(Boolean);
  if (tokens.length === 0) return '??';
  if (tokens.length === 1) return tokens[0].slice(0, 2).toUpperCase();
  return `${tokens[0][0] ?? ''}${tokens[1][0] ?? ''}`.toUpperCase();
}

function agentNameLabel(name: string | undefined | null, fallback: string) {
  return name?.trim() || fallback;
}

function buildStarMarkPath(x: number, y: number, edge: 'full' | 'left' | 'right') {
  const arm = 0.16;
  const inset = 0.14;
  const cross = 0.08;
  const segments: string[] = [];

  if (edge !== 'right') {
    segments.push(
      `M ${x - inset - arm} ${y - inset} h ${arm} v ${cross}`,
      `M ${x - inset - arm} ${y + inset} h ${arm} v ${-cross}`,
    );
  }

  if (edge !== 'left') {
    segments.push(
      `M ${x + inset + arm} ${y - inset} h ${-arm} v ${cross}`,
      `M ${x + inset + arm} ${y + inset} h ${-arm} v ${-cross}`,
    );
  }

  return segments.join(' ');
}

function reduceRooms(rooms: ChineseChessRoomSummary[], matchId: string, room?: ChineseChessRoomSummary) {
  const next = rooms.filter((entry) => entry.matchId !== matchId);
  if (room) next.push(room);
  return next.sort((left, right) => {
    const phaseOrder = { waiting: 0, playing: 1, finished: 2 };
    return (
      phaseOrder[left.phase] - phaseOrder[right.phase] ||
      right.createdAt - left.createdAt ||
      left.matchId.localeCompare(right.matchId)
    );
  });
}

function reduceJoinableRooms(rooms: ChineseChessRoomSummary[], delta: ChineseChessLobbyDeltaPayload) {
  if (delta.kind === 'room_removed') {
    return rooms.filter((entry) => entry.matchId !== delta.matchId);
  }
  if (!delta.room) return rooms;
  return reduceRooms(rooms, delta.matchId, delta.room);
}

function deriveCapturedPieces(board: string[][]) {
  const currentCounts = {
    red: { K: 0, A: 0, B: 0, N: 0, R: 0, C: 0, P: 0 },
    black: { k: 0, a: 0, b: 0, n: 0, r: 0, c: 0, p: 0 },
  };

  for (const row of board) {
    for (const piece of row) {
      if (!piece) continue;
      if (piece === piece.toUpperCase()) {
        currentCounts.red[piece as keyof typeof currentCounts.red] += 1;
      } else {
        currentCounts.black[piece as keyof typeof currentCounts.black] += 1;
      }
    }
  }

  const redCaptured: string[] = [];
  const blackCaptured: string[] = [];

  for (const [piece, total] of Object.entries(INITIAL_COUNTS.red)) {
    const missing = total - currentCounts.red[piece as keyof typeof currentCounts.red];
    for (let index = 0; index < missing; index += 1) redCaptured.push(piece);
  }

  for (const [piece, total] of Object.entries(INITIAL_COUNTS.black)) {
    const missing = total - currentCounts.black[piece as keyof typeof currentCounts.black];
    for (let index = 0; index < missing; index += 1) blackCaptured.push(piece);
  }

  return { red: redCaptured, black: blackCaptured };
}

function renderPieceSprite(piece: string, variant: 'board' | 'capture' = 'board') {
  const side = pieceSide(piece);
  const src = pieceAssetUrl(piece);
  const label = PIECE_GLYPHS[piece] ?? piece;

  return (
    <span
      className={[
        'chinese-chess-piece',
        `chinese-chess-piece--${variant}`,
        side ? `is-${side}` : '',
      ].filter(Boolean).join(' ')}
      aria-hidden={variant === 'board' ? 'true' : undefined}
      aria-label={variant === 'capture' ? label : undefined}
      role={variant === 'capture' ? 'img' : undefined}
    >
      {src ? (
        <img
          className="chinese-chess-piece-image"
          src={src}
          alt=""
          draggable={false}
          loading="eager"
          decoding="async"
        />
      ) : (
        <span className="chinese-chess-piece-fallback" aria-hidden="true">
          {label}
        </span>
      )}
    </span>
  );
}

function roomSummaryFromState(
  current: ChineseChessRoomSummary | null | undefined,
  state: ChineseChessMatchState,
  spectatorCount?: number,
) {
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
      side: player.side,
      ready: player.ready,
      connected: player.connected,
    })),
    createdAt: current?.createdAt ?? Date.now(),
  } satisfies ChineseChessRoomSummary;
}

export function ChineseChessPage() {
  const { t } = useTranslation(['play', 'chineseChess', 'nav']);
  const runtime = usePluginRuntime();
  const { connectedAgent } = usePluginAgent();

  const [syncing, setSyncing] = useState(false);
  const [busyCommand, setBusyCommand] = useState('');
  const [errorText, setErrorText] = useState('');
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('new-game');
  const [orientationMode, setOrientationMode] = useState<OrientationMode>('auto');
  const [currentMatch, setCurrentMatch] = useState<ChineseChessMatchState | null>(null);
  const [joinableMatches, setJoinableMatches] = useState<ChineseChessRoomSummary[]>([]);
  const [roomDirectory, setRoomDirectory] = useState<ChineseChessRoomSummary[]>([]);
  const [roomDirectoryVersion, setRoomDirectoryVersion] = useState(0);
  const [rating, setRating] = useState<ChineseChessRating | null>(null);
  const [leaderboard, setLeaderboard] = useState<ChineseChessRating[]>([]);
  const [roomQuery, setRoomQuery] = useState('');
  const [createRoomName, setCreateRoomName] = useState('');
  const [createRoomVisibility, setCreateRoomVisibility] = useState<ChineseChessRoomVisibility>('public');
  const [selectedSquare, setSelectedSquare] = useState<string | null>(null);
  const [inspectedRoom, setInspectedRoom] = useState<InspectedRoom | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [resultOverlay, setResultOverlay] = useState<ChineseChessMatchState | null>(null);
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [orbExpanded, setOrbExpanded] = useState(false);
  const [orbDragging, setOrbDragging] = useState(false);
  const [orbPosition, setOrbPosition] = useState({ x: 24, y: 24 });

  const toastIdRef = useRef(0);
  const orbRef = useRef<HTMLDivElement | null>(null);
  const shownResultOverlaySignatureRef = useRef<string | null>(null);
  const appliedRatingSignatureRef = useRef<string | null>(null);
  const inspectedRoomRef = useRef<InspectedRoom | null>(null);
  const orbPointerRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    offsetX: number;
    offsetY: number;
    moved: boolean;
  } | null>(null);

  useEffect(() => {
    inspectedRoomRef.current = inspectedRoom;
  }, [inspectedRoom]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    setOrbPosition((current) => {
      const targetX = current.x === 24 ? window.innerWidth - 96 : current.x;
      const targetY = current.y === 24 ? window.innerHeight - 118 : current.y;
      return { x: Math.max(14, targetX), y: Math.max(14, targetY) };
    });
  }, []);

  const pushToast = (text: string, tone: ToastTone = 'info') => {
    const id = toastIdRef.current + 1;
    toastIdRef.current = id;
    setToasts((current) => [...current, { id, text, tone }].slice(-MAX_TOASTS));
  };

  const dismissToast = (id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  };

  useEffect(() => {
    if (toasts.length === 0) return undefined;
    const timeout = window.setTimeout(() => {
      setToasts((current) => current.slice(1));
    }, 3800);
    return () => window.clearTimeout(timeout);
  }, [toasts]);

  useEffect(() => {
    if (!errorText) return;
    pushToast(errorText, 'error');
  }, [errorText]);

  const clampOrbPosition = (nextX: number, nextY: number) => {
    if (typeof window === 'undefined') return { x: nextX, y: nextY };
    const rect = orbRef.current?.getBoundingClientRect();
    const width = rect?.width ?? (orbExpanded ? 248 : 76);
    const height = rect?.height ?? (orbExpanded ? 320 : 76);
    const inset = 14;
    const maxX = Math.max(inset, window.innerWidth - width - inset);
    const maxY = Math.max(inset, window.innerHeight - height - inset);
    return {
      x: Math.min(Math.max(inset, nextX), maxX),
      y: Math.min(Math.max(inset, nextY), maxY),
    };
  };

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    const onResize = () => {
      setOrbPosition((current) => clampOrbPosition(current.x, current.y));
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, [orbExpanded]);

  const formatSide = (side: ChineseChessSide | null | undefined) => {
    if (side === 'red') return t('play:chineseChess.sides.red');
    if (side === 'black') return t('play:chineseChess.sides.black');
    return t('play:chineseChess.page.unassigned');
  };

  const formatPhase = (phase: ChineseChessMatchPhase) => {
    switch (phase) {
      case 'waiting':
        return t('play:chineseChess.page.phaseWaiting');
      case 'playing':
        return t('play:chineseChess.page.phasePlaying');
      case 'finished':
        return t('play:chineseChess.page.phaseFinished');
      default:
        return phase;
    }
  };

  const visibilityLabel = (visibility: ChineseChessRoomVisibility) =>
    visibility === 'public' ? t('play:chineseChess.page.publicRoom') : t('play:chineseChess.page.privateRoom');

  const formatReason = (reason: ChineseChessMatchResult['reason']) => t(`play:chineseChess.reasons.${reason}`);

  const formatResultTitle = (result: ChineseChessMatchResult | null) => {
    if (!result) return t('play:chineseChess.page.inProgress');
    if (result.result === 'draw') return t('play:chineseChess.result.draw');
    return result.result === 'red_win'
      ? t('play:chineseChess.result.redWin')
      : t('play:chineseChess.result.blackWin');
  };

  const formatPositionSummary = (state: ChineseChessMatchState | null) => {
    if (!state) return t('play:chineseChess.page.noBoard');
    if (state.phase === 'waiting') {
      return t('play:chineseChess.position.waiting', { count: state.players.length });
    }
    if (state.result) {
      return `${formatResultTitle(state.result)} · ${formatReason(state.result.reason)}`;
    }
    return state.inCheck
      ? t('play:chineseChess.position.inCheck', { side: formatSide(state.sideToMove) })
      : t('play:chineseChess.position.turn', { side: formatSide(state.sideToMove) });
  };

  const applyMatchState = (next: ChineseChessMatchState | null) => {
    setCurrentMatch(next);
    setSelectedSquare(null);
    if (!next?.result || !next.yourAgentId) return;

    const signature = `${next.matchId}:${next.result.endedAt}`;
    if (appliedRatingSignatureRef.current === signature) return;
    appliedRatingSignatureRef.current = signature;

    const delta = next.result.ratingChanges[next.yourAgentId];
    if (typeof delta !== 'number') return;

    setRating((current) => {
      if (!current) return current;
      const didWin = next.result?.winnerAgentId === next.yourAgentId;
      const didDraw = next.result?.result === 'draw';
      return {
        ...current,
        rating: current.rating + delta,
        gamesPlayed: current.gamesPlayed + 1,
        wins: current.wins + (didWin ? 1 : 0),
        losses: current.losses + (!didWin && !didDraw ? 1 : 0),
        draws: current.draws + (didDraw ? 1 : 0),
        updatedAt: next.result!.endedAt,
      };
    });
  };

  const applyInspectedRoomState = (summary: ChineseChessRoomSummary, state: ChineseChessMatchState) => {
    setInspectedRoom({ summary, state });
  };

  const claimControlIfNeeded = async () => {
    const snapshot = await runtime.refreshSessionState();
    if (snapshot.isController) return snapshot;
    if (snapshot.hasController && !window.confirm(t('chineseChess:runtime.confirmTakeover'))) {
      throw new Error(t('chineseChess:runtime.noControl'));
    }
    return runtime.claimControl();
  };

  const ensureChineseChessReady = async () => {
    if (!connectedAgent) throw new Error(t('chineseChess:runtime.noAgent'));

    if (!runtime.isConnected) await runtime.connect();
    await claimControlIfNeeded();

    const citySnapshot = await runtime.refreshSessionState();
    if (!citySnapshot.inCity) await runtime.enterCity();

    const locationSnapshot = await runtime.refreshSessionState();
    if (locationSnapshot.currentLocation !== CHINESE_CHESS_LOCATION_ID) {
      await runtime.enterLocation(CHINESE_CHESS_LOCATION_ID);
    }
  };

  const refreshRooms = async (query = roomQuery, options?: { silent?: boolean; skipReady?: boolean }) => {
    if (!options?.silent) {
      setSyncing(true);
      setErrorText('');
    }
    try {
      if (!options?.skipReady) await ensureChineseChessReady();
      const payload = await runtime.sendCommand<ChineseChessRoomDirectoryPayload>(CHINESE_CHESS_COMMAND('list_rooms'), {
        query: query.trim() || undefined,
        limit: 40,
      });
      setRoomDirectory(payload.rooms);
      setRoomDirectoryVersion(payload.directoryVersion);
    } catch (error) {
      if (!options?.silent) {
        setErrorText(error instanceof Error ? error.message : t('chineseChess:runtime.syncFailed'));
      }
    } finally {
      if (!options?.silent) setSyncing(false);
    }
  };

  const refreshBootstrap = async (options?: { silent?: boolean }) => {
    if (!options?.silent) {
      setSyncing(true);
      setErrorText('');
    }
    try {
      await ensureChineseChessReady();
      const payload = await runtime.sendCommand<ChineseChessBootstrapPayload>(CHINESE_CHESS_COMMAND('bootstrap'), {
        limit: 20,
      });
      applyMatchState(payload.currentMatch);
      setJoinableMatches(payload.joinableMatches);
      setRating(payload.rating);
      setLeaderboard(payload.leaderboard);
      await refreshRooms(roomQuery, { silent: true, skipReady: true });
    } catch (error) {
      if (!options?.silent) {
        setErrorText(error instanceof Error ? error.message : t('chineseChess:runtime.syncFailed'));
      }
    } finally {
      if (!options?.silent) setSyncing(false);
    }
  };

  const runCommand = async <T,>(label: string, type: string, payload?: unknown): Promise<T | null> => {
    setBusyCommand(label);
    setErrorText('');
    try {
      await ensureChineseChessReady();
      return await runtime.sendCommand<T>(type, payload);
    } catch (error) {
      if (isPluginCommandError(error)) {
        setErrorText(error.message);
      } else if (error instanceof Error) {
        setErrorText(error.message);
      } else {
        setErrorText(t('chineseChess:runtime.actionFailed', { label }));
      }
      return null;
    } finally {
      setBusyCommand('');
    }
  };

  const handleCreateMatch = async () => {
    const payload = await runCommand<{ matchId: string; state: ChineseChessMatchState }>(
      t('play:chineseChess.actions.createMatch'),
      CHINESE_CHESS_COMMAND('create_match'),
      {
        roomName: createRoomName.trim() || undefined,
        visibility: createRoomVisibility,
      },
    );
    if (!payload?.state) return;
    applyMatchState(payload.state);
    setCreateRoomName('');
    setWorkspaceTab('new-game');
    await refreshBootstrap({ silent: true });
  };

  const handleJoinMatch = async (matchId: string) => {
    const payload = await runCommand<{ state: ChineseChessMatchState }>(
      t('play:chineseChess.actions.join'),
      CHINESE_CHESS_COMMAND('join_match'),
      { matchId },
    );
    if (!payload?.state) return;
    applyMatchState(payload.state);
    setSelectedRoomId(null);
    setWorkspaceTab('new-game');
    await refreshBootstrap({ silent: true });
  };

  const openRoom = async (room: ChineseChessRoomSummary) => {
    setSelectedRoomId(room.matchId);
    const payload = await runCommand<ChineseChessWatchRoomPayload>(
      t('play:chineseChess.actions.watch'),
      CHINESE_CHESS_COMMAND('watch_room'),
      { matchId: room.matchId },
    );
    if (!payload?.state) return;
    applyInspectedRoomState(roomSummaryFromState(room, payload.state, room.spectatorCount), payload.state);
  };

  const stopWatchingRooms = async (options?: { clearSelection?: boolean; silent?: boolean }) => {
    if (!inspectedRoomRef.current) return;
    await runCommand(
      t('play:chineseChess.page.stopWatching'),
      CHINESE_CHESS_COMMAND('unwatch_room'),
      { matchId: inspectedRoomRef.current.summary.matchId },
    );
    setInspectedRoom(null);
    if (options?.clearSelection) setSelectedRoomId(null);
    if (!options?.silent) pushToast(t('play:chineseChess.page.stoppedWatching'));
  };

  const submitMove = async (move: ChineseChessLegalMove) => {
    const payload = await runCommand<{ state: ChineseChessMatchState }>(
      `${t('play:chineseChess.actions.move')} ${move.display}`,
      CHINESE_CHESS_COMMAND('move'),
      { from: move.from, to: move.to, iccs: move.iccs },
    );
    if (payload?.state) applyMatchState(payload.state);
  };

  useEffect(() => {
    void refreshBootstrap();
  }, [connectedAgent?.id]);

  useEffect(() => {
    const offWelcome = runtime.subscribe('chinese_chess_welcome', () => {
      pushToast(t('chineseChess:events.entered'));
      void refreshBootstrap({ silent: true });
    });

    const offLobby = runtime.subscribe('chinese_chess_lobby_delta', (raw) => {
      const payload = raw as ChineseChessLobbyDeltaPayload;
      setJoinableMatches((current) => reduceJoinableRooms(current, payload));
      pushToast(t('chineseChess:events.lobbyUpdate', { eventName: payload.kind }));
    });

    const offRoomDirectory = runtime.subscribe('chinese_chess_room_directory_delta', (raw) => {
      const payload = raw as ChineseChessRoomDirectoryDeltaPayload;
      setRoomDirectoryVersion(payload.version);
      setRoomDirectory((current) => {
        if (payload.kind === 'room_removed') {
          return current.filter((room) => room.matchId !== payload.matchId);
        }
        if (!payload.room) return current;
        return reduceRooms(current, payload.matchId, payload.room);
      });
      if (payload.kind === 'room_removed' && selectedRoomId === payload.matchId) {
        setSelectedRoomId(null);
      }
    });

    const offMatch = runtime.subscribe('chinese_chess_match_delta', (raw) => {
      const payload = raw as ChineseChessMatchDeltaPayload;
      if (payload.state?.players.some((player) => player.agentId === connectedAgent?.id)) {
        applyMatchState(payload.state);
        setJoinableMatches((current) =>
          reduceRooms(
            current,
            payload.state!.matchId,
            payload.state!.phase === 'waiting'
              ? roomSummaryFromState(current.find((room) => room.matchId === payload.state!.matchId) ?? null, payload.state!)
              : undefined,
          ),
        );
      }
      if (inspectedRoomRef.current && payload.state?.matchId === inspectedRoomRef.current.summary.matchId) {
        applyInspectedRoomState(
          roomSummaryFromState(inspectedRoomRef.current.summary, payload.state, inspectedRoomRef.current.summary.spectatorCount),
          payload.state,
        );
      }
    });

    const offRoom = runtime.subscribe('chinese_chess_room_delta', (raw) => {
      const payload = raw as ChineseChessRoomDeltaPayload;
      if (!payload.state || !inspectedRoomRef.current || payload.matchId !== inspectedRoomRef.current.summary.matchId) return;
      applyInspectedRoomState(
        roomSummaryFromState(inspectedRoomRef.current.summary, payload.state, payload.spectatorCount),
        payload.state,
      );
    });

    const offTurnPrompt = runtime.subscribe('chinese_chess_turn_prompt', (raw) => {
      const payload = raw as ChineseChessTurnPromptPayload;
      if (payload.state) applyMatchState(payload.state);
    });

    const offReconnected = runtime.subscribe('chinese_chess_reconnected', () => {
      pushToast(t('chineseChess:events.restored'));
      void refreshBootstrap({ silent: true });
    });

    return () => {
      offWelcome();
      offLobby();
      offRoomDirectory();
      offMatch();
      offRoom();
      offTurnPrompt();
      offReconnected();
    };
  }, [runtime, connectedAgent?.id, selectedRoomId, t]);

  useEffect(() => {
    if (!currentMatch?.result) return;
    const signature = `${currentMatch.matchId}:${currentMatch.result.endedAt}`;
    if (shownResultOverlaySignatureRef.current === signature) return;
    shownResultOverlaySignatureRef.current = signature;
    setResultOverlay(currentMatch);
    pushToast(`${formatResultTitle(currentMatch.result)} · ${currentMatch.roomName}`);
  }, [currentMatch?.matchId, currentMatch?.result?.endedAt]);

  useEffect(() => {
    setSelectedSquare(null);
  }, [workspaceTab, currentMatch?.seq]);

  const canCreateOrJoin = !currentMatch || currentMatch.phase === 'finished';
  const isFinishedMatch = currentMatch?.phase === 'finished';
  const previewBoardMatrix = useMemo(() => parseFenBoard(INITIAL_POSITION_FEN), []);
  const currentBoardMatrix = useMemo(() => parseFenBoard(currentMatch?.positionFen ?? INITIAL_POSITION_FEN), [currentMatch?.positionFen]);
  const boardMatch = workspaceTab === 'rooms' && inspectedRoom ? inspectedRoom.state : currentMatch;
  const boardSummary = workspaceTab === 'rooms' && inspectedRoom
    ? inspectedRoom.summary
    : currentMatch
      ? roomSummaryFromState(null, currentMatch)
      : null;
  const boardMatchIsCurrent = !!boardMatch && !!currentMatch && boardMatch.matchId === currentMatch.matchId;
  const boardMatrix = useMemo(() => parseFenBoard(boardMatch?.positionFen ?? INITIAL_POSITION_FEN), [boardMatch?.positionFen]);
  const boardCaptured = useMemo(() => deriveCapturedPieces(boardMatrix), [boardMatrix]);
  const lastMove = boardMatch?.moveHistory.at(-1) ?? null;
  const yourTurn = boardMatchIsCurrent && currentMatch?.phase === 'playing' && currentMatch.yourSide === currentMatch.sideToMove;
  const resolvedOrientation: ChineseChessSide = orientationMode === 'auto'
    ? (boardMatchIsCurrent ? currentMatch?.yourSide ?? 'red' : 'red')
    : orientationMode;
  const boardFiles = resolvedOrientation === 'red' ? FILES_RED : FILES_BLACK;
  const boardRanks = resolvedOrientation === 'red' ? RANKS_RED : RANKS_BLACK;
  const legalMoves = currentMatch?.legalMoves ?? [];
  const selectedMoves = selectedSquare ? legalMoves.filter((move) => move.from === selectedSquare) : [];
  const activeTargets = new Set(selectedMoves.map((move) => move.to));
  const redPlayer = boardMatch?.players.find((player) => player.side === 'red') ?? null;
  const blackPlayer = boardMatch?.players.find((player) => player.side === 'black') ?? null;
  const waitingPlayer = currentMatch?.players.find((player) => player.agentId === currentMatch.yourAgentId) ?? null;
  const boardBottomSide = resolvedOrientation;
  const boardTopSide = oppositeSide(boardBottomSide);
  const topStagePlayer = boardTopSide === 'red' ? redPlayer : blackPlayer;
  const bottomStagePlayer = boardBottomSide === 'red' ? redPlayer : blackPlayer;
  const activeSide = boardMatch?.phase === 'playing' ? boardMatch.sideToMove : null;
  const selectedRoom = useMemo(() => {
    if (!selectedRoomId) return null;
    return roomDirectory.find((room) => room.matchId === selectedRoomId)
      ?? (inspectedRoom?.summary.matchId === selectedRoomId ? inspectedRoom.summary : null);
  }, [inspectedRoom?.summary, roomDirectory, selectedRoomId]);
  const detailRoom = selectedRoom;
  const detailState = detailRoom && inspectedRoom?.summary.matchId === detailRoom.matchId ? inspectedRoom.state : null;
  const isWatchingSelectedRoom = !!detailRoom && inspectedRoom?.summary.matchId === detailRoom.matchId;
  const activeResultOverlay = resultOverlay && boardMatch && resultOverlay.matchId === boardMatch.matchId ? resultOverlay : null;
  const hasFloatingNotices = !connectedAgent || !!runtime.error || !!busyCommand || toasts.length > 0;
  const recordWins = rating?.wins ?? 0;
  const recordLosses = rating?.losses ?? 0;
  const recordDraws = rating?.draws ?? 0;
  const recordGames = rating?.gamesPlayed ?? 0;
  const winRate = recordGames > 0 ? Math.round((recordWins / recordGames) * 100) : 0;
  const workspaceTabs = [
    { key: 'new-game' as const, icon: PlusSquare, label: t('play:chineseChess.tabs.newGame') },
    { key: 'rooms' as const, icon: Eye, label: t('play:chineseChess.tabs.rooms') },
    { key: 'record' as const, icon: BarChart3, label: t('play:chineseChess.tabs.record') },
    { key: 'history' as const, icon: ListOrdered, label: t('play:chineseChess.tabs.history') },
    { key: 'leaderboard' as const, icon: Trophy, label: t('play:chineseChess.tabs.leaderboard') },
  ] as const;

  const getPieceAtSquare = (square: string) => pieceAtSquare(currentBoardMatrix, square);

  const resolveDisplayedClock = (player: ChineseChessPlayer | null, fallbackSide: ChineseChessSide) => {
    const side = player?.side ?? fallbackSide;
    return side === 'red'
      ? (boardMatch?.clocks.redMs ?? DEFAULT_CLOCK_MS)
      : (boardMatch?.clocks.blackMs ?? DEFAULT_CLOCK_MS);
  };

  const handleBoardSquareClick = (square: string) => {
    if (!currentMatch || !boardMatchIsCurrent || currentMatch.phase !== 'playing' || !yourTurn || !currentMatch.yourSide) return;
    const piece = getPieceAtSquare(square);
    const owner = pieceSide(piece);
    const pieceBelongsToYou = !!piece && owner === currentMatch.yourSide;

    if (!selectedSquare) {
      if (pieceBelongsToYou && legalMoves.some((move) => move.from === square)) setSelectedSquare(square);
      return;
    }

    if (square === selectedSquare) {
      setSelectedSquare(null);
      return;
    }

    const matchingMove = legalMoves.find((move) => move.from === selectedSquare && move.to === square);
    if (matchingMove) {
      void submitMove(matchingMove);
      return;
    }

    if (pieceBelongsToYou && legalMoves.some((move) => move.from === square)) {
      setSelectedSquare(square);
      return;
    }

    setSelectedSquare(null);
  };

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
    if (!wasDrag) setOrbExpanded((value) => !value);
  };

  const cancelOrbGesture = (event: ReactPointerEvent<HTMLButtonElement>) => {
    if (orbPointerRef.current?.pointerId !== event.pointerId) return;
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    orbPointerRef.current = null;
    setOrbDragging(false);
  };

  const renderBoardPlayerBadge = (position: 'top' | 'bottom', player: ChineseChessPlayer | null, clockMs: number) => {
    const displayName = agentNameLabel(player?.agentName, t('play:chineseChess.page.pendingPlayer'));
    const isSelf = player?.agentId === connectedAgent?.id;
    const detailLabel = !player
      ? t('play:chineseChess.page.emptySeat')
      : !player.connected
        ? t('play:chineseChess.page.offline')
        : player.ready
          ? t('play:chineseChess.page.ready')
          : '\u00a0';
    const isTurnBadge = !!player?.side && !boardMatch?.result && activeSide === player.side;
    const statusTone = !player
      ? 'is-empty'
      : !player.connected
        ? 'is-offline'
        : player.ready
          ? 'is-ready'
          : 'is-waiting';

    return (
      <div
        className={[
          'chinese-chess-board-player-badge',
          `chinese-chess-board-player-badge--${position}`,
          isTurnBadge ? 'is-active' : '',
          isSelf ? 'is-self' : '',
        ].filter(Boolean).join(' ')}
        title={detailLabel.trim() ? detailLabel : undefined}
      >
        <span className={`chinese-chess-board-player-badge__avatar ${isSelf ? 'is-self' : ''}`}>{agentMonogram(displayName)}</span>
        <span className={`chinese-chess-board-player-badge__status ${statusTone}`} aria-hidden="true" />
        <strong className="chinese-chess-board-player-badge__name">{displayName}</strong>
        <span className="chinese-chess-board-player-badge__clock mono">{formatClock(clockMs)}</span>
        {detailLabel.trim() ? <span className="chinese-chess-visually-hidden">{detailLabel}</span> : null}
      </div>
    );
  };

  const renderBoard = (
    matrix: string[][],
    interactive: boolean,
    showHistory: boolean,
    topBadge: React.ReactNode,
    bottomBadge: React.ReactNode,
  ) => {
    const riverLabels = resolvedOrientation === 'red'
      ? [t('play:chineseChess.page.riverChu'), t('play:chineseChess.page.riverHan')]
      : [t('play:chineseChess.page.riverHan'), t('play:chineseChess.page.riverChu')];

    return (
      <div className="chinese-chess-board-stage">
        <div className={`chinese-chess-board-stage__table ${showHistory ? 'is-live' : 'is-preview'}`}>
          {topBadge}
          <div className="chinese-chess-board-frame">
            <div className={`chinese-chess-board-grid ${showHistory ? 'is-live' : 'is-preview'}`}>
              <svg className="chinese-chess-board-overlay" viewBox="0 0 9 10" preserveAspectRatio="none" aria-hidden="true">
                {BOARD_HORIZONTAL_GUIDES.map((y) => (
                  <line key={`h-${y}`} x1="0.5" y1={y} x2="8.5" y2={y} />
                ))}
                {BOARD_VERTICAL_GUIDES.map((x, index) => (
                  index === 0 || index === BOARD_VERTICAL_GUIDES.length - 1 ? (
                    <line key={`v-${x}`} x1={x} y1="0.5" x2={x} y2="9.5" />
                  ) : (
                    <React.Fragment key={`v-${x}`}>
                      <line x1={x} y1="0.5" x2={x} y2="4.5" />
                      <line x1={x} y1="5.5" x2={x} y2="9.5" />
                    </React.Fragment>
                  )
                ))}
                <line x1="3.5" y1="0.5" x2="5.5" y2="2.5" />
                <line x1="5.5" y1="0.5" x2="3.5" y2="2.5" />
                <line x1="3.5" y1="7.5" x2="5.5" y2="9.5" />
                <line x1="5.5" y1="7.5" x2="3.5" y2="9.5" />
                {BOARD_STAR_POINTS.map((point) => (
                  <path
                    key={`star-${point.x}-${point.y}`}
                    className="chinese-chess-board-star"
                    d={buildStarMarkPath(point.x, point.y, point.edge)}
                  />
                ))}
              </svg>
              <div className="chinese-chess-river" aria-hidden="true">
                <span>{riverLabels[0]}</span>
                <span>{riverLabels[1]}</span>
              </div>
              {boardRanks.map((rank, rowIndex) =>
                boardFiles.map((file, colIndex) => {
                  const square = `${file}${rank}`;
                  const piece = pieceAtSquare(matrix, square);
                  const isSelected = interactive && selectedSquare === square;
                  const isTarget = interactive && activeTargets.has(square);
                  const isLastMove = showHistory && (lastMove?.from === square || lastMove?.to === square);

                  return (
                    <button
                      key={square}
                      type="button"
                      className={[
                        'chinese-chess-board-intersection',
                        piece ? 'has-piece' : '',
                        interactive ? 'is-interactive' : 'is-static',
                        isSelected ? 'is-selected' : '',
                        isTarget ? 'is-target' : '',
                        isLastMove ? 'is-last-move' : '',
                      ].filter(Boolean).join(' ')}
                      style={{ gridColumn: colIndex + 1, gridRow: rowIndex + 1 }}
                      onClick={() => handleBoardSquareClick(square)}
                      disabled={!interactive}
                      data-square={square}
                      aria-label={`${square}${piece ? ` ${PIECE_GLYPHS[piece]}` : ''}`}
                    >
                      {piece ? renderPieceSprite(piece) : <span className="chinese-chess-board-node" aria-hidden="true" />}
                    </button>
                  );
                }),
              )}
            </div>
          </div>
          {bottomBadge}
        </div>
      </div>
    );
  };

  const renderWorkspaceActions = () => {
    if (!currentMatch) return null;

    const actions: React.ReactNode[] = [];
    const localWaitingPlayer = currentMatch.players.find((player) => player.agentId === currentMatch.yourAgentId) ?? null;

    if (currentMatch.phase === 'waiting') {
      actions.push(
        <button
          key="ready-toggle"
          type="button"
          className={`app-btn ${localWaitingPlayer?.ready ? 'secondary' : 'chinese-chess-cta'}`}
          disabled={!!busyCommand}
          onClick={() => void runCommand<{ state: ChineseChessMatchState }>(
            localWaitingPlayer?.ready ? t('play:chineseChess.actions.unready') : t('play:chineseChess.actions.ready'),
            CHINESE_CHESS_COMMAND(localWaitingPlayer?.ready ? 'unready' : 'ready'),
          ).then((payload) => {
            if (payload?.state) applyMatchState(payload.state);
          })}
        >
          {localWaitingPlayer?.ready ? t('play:chineseChess.actions.unready') : t('play:chineseChess.actions.ready')}
        </button>,
      );

      actions.push(
        <button
          key="leave-room"
          type="button"
          className="app-btn secondary"
          disabled={!!busyCommand}
          onClick={() => void runCommand<{ state: ChineseChessMatchState | null }>(
            t('play:chineseChess.actions.leave'),
            CHINESE_CHESS_COMMAND('leave_match'),
          ).then((payload) => {
            applyMatchState(payload?.state ?? null);
            setSelectedSquare(null);
          })}
        >
          {t('play:chineseChess.actions.leave')}
        </button>,
      );
    }

    if (currentMatch.phase === 'playing') {
      if (!currentMatch.drawOfferBy) {
        actions.push(
          <button
            key="offer-draw"
            type="button"
            className="app-btn chinese-chess-cta"
            disabled={!!busyCommand}
            onClick={() => void runCommand<{ state: ChineseChessMatchState }>(
              t('play:chineseChess.actions.offerDraw'),
              CHINESE_CHESS_COMMAND('offer_draw'),
            ).then((payload) => {
              if (payload?.state) applyMatchState(payload.state);
            })}
          >
            {t('play:chineseChess.actions.offerDraw')}
          </button>,
        );
      }

      if (currentMatch.drawOfferBy && currentMatch.drawOfferBy !== currentMatch.yourAgentId) {
        actions.push(
          <button
            key="accept-draw"
            type="button"
            className="app-btn secondary"
            disabled={!!busyCommand}
            onClick={() => void runCommand<{ state: ChineseChessMatchState }>(
              t('play:chineseChess.actions.acceptDraw'),
              CHINESE_CHESS_COMMAND('accept_draw'),
            ).then((payload) => {
              if (payload?.state) applyMatchState(payload.state);
            })}
          >
            {t('play:chineseChess.actions.acceptDraw')}
          </button>,
        );

        actions.push(
          <button
            key="decline-draw"
            type="button"
            className="app-btn secondary"
            disabled={!!busyCommand}
            onClick={() => void runCommand<{ state: ChineseChessMatchState }>(
              t('play:chineseChess.actions.declineDraw'),
              CHINESE_CHESS_COMMAND('decline_draw'),
            ).then((payload) => {
              if (payload?.state) applyMatchState(payload.state);
            })}
          >
            {t('play:chineseChess.actions.declineDraw')}
          </button>,
        );
      }

      actions.push(
        <button
          key="resign"
          type="button"
          className="app-btn secondary"
          disabled={!!busyCommand}
          onClick={() => void runCommand<{ state: ChineseChessMatchState }>(
            t('play:chineseChess.actions.resign'),
            CHINESE_CHESS_COMMAND('resign'),
          ).then((payload) => {
            if (payload?.state) applyMatchState(payload.state);
          })}
        >
          {t('play:chineseChess.actions.resign')}
        </button>,
      );
    }

    if (currentMatch.phase === 'finished') {
      actions.push(
        <button
          key="leave-finished"
          type="button"
          className="app-btn secondary"
          disabled={!!busyCommand}
          onClick={() => void runCommand<{ state: ChineseChessMatchState | null }>(
            t('play:chineseChess.actions.leave'),
            CHINESE_CHESS_COMMAND('leave_match'),
          ).then((payload) => {
            applyMatchState(payload?.state ?? null);
          })}
        >
          {t('play:chineseChess.actions.leave')}
        </button>,
      );
    }

    return <div className="chinese-chess-action-grid">{actions}</div>;
  };

  const workspaceContent = (() => {
    switch (workspaceTab) {
      case 'rooms':
        return (
          <section className="chinese-chess-panel-card chinese-chess-panel-card--workspace chinese-chess-scroll">
            {detailRoom ? (
              <div className="chinese-chess-room-detail-modal">
                <div className="chinese-chess-room-detail chinese-chess-room-detail--floating">
                  <div className="chinese-chess-room-detail__header">
                    <div>
                      <span className="chinese-chess-stage-label">{t('play:chineseChess.page.selectedRoomTitle')}</span>
                      <h3>{detailRoom.roomName}</h3>
                    </div>
                    <div className="chinese-chess-room-detail__header-actions">
                      <span className="chinese-chess-panel-pill mono">{detailRoom.matchId}</span>
                      <button
                        type="button"
                        className="chinese-chess-room-detail__close"
                        aria-label={t('play:chineseChess.page.closeRoomPanel')}
                        onClick={() => setSelectedRoomId(null)}
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>
                  <div className="chinese-chess-panel-pill-row">
                    <span className="chinese-chess-panel-pill">{visibilityLabel(detailRoom.visibility)}</span>
                    <span className="chinese-chess-panel-pill">{t('play:chineseChess.page.phaseChip', { value: formatPhase(detailRoom.phase) })}</span>
                    <span className="chinese-chess-panel-pill">{t('play:chineseChess.page.playersCount', { count: detailRoom.playerCount })}</span>
                    <span className="chinese-chess-panel-pill">{t('play:chineseChess.page.readyCount', { count: detailRoom.readyCount })}</span>
                  </div>
                  <div className="chinese-chess-room-detail__body">
                    {(detailState?.players ?? detailRoom.players).map((player) => (
                      <div key={player.agentId} className="chinese-chess-room-detail__player">
                        <span>{player.agentName}</span>
                        <span>{player.connected ? t('play:chineseChess.page.online') : t('play:chineseChess.page.offline')}</span>
                      </div>
                    ))}
                  </div>
                  <div className="chinese-chess-room-detail__actions">
                    {isWatchingSelectedRoom ? (
                      <button
                        type="button"
                        className="app-btn secondary"
                        disabled={!!busyCommand}
                        onClick={() => void stopWatchingRooms({ clearSelection: true, silent: true })}
                      >
                        {t('play:chineseChess.page.stopWatching')}
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="app-btn secondary"
                        disabled={!!busyCommand}
                        onClick={() => void openRoom(detailRoom)}
                      >
                        {t('play:chineseChess.actions.watch')}
                      </button>
                    )}
                    {detailRoom.phase === 'waiting' && detailRoom.seatsRemaining > 0 && canCreateOrJoin ? (
                      <button
                        type="button"
                        className="app-btn chinese-chess-cta"
                        disabled={!!busyCommand}
                        onClick={() => void handleJoinMatch(detailRoom.matchId)}
                      >
                        {t('play:chineseChess.page.joinThisMatch')}
                      </button>
                    ) : null}
                  </div>
                </div>
              </div>
            ) : null}

            <header className="chinese-chess-panel-card__header">
              <div>
                <span className="chinese-chess-stage-label">{t('play:chineseChess.page.roomsKicker')}</span>
                <h2>{t('play:chineseChess.page.roomsTitle')}</h2>
              </div>
              <span className="chinese-chess-panel-pill">{t('play:chineseChess.page.roomsVersion', { version: roomDirectoryVersion })}</span>
            </header>

            {inspectedRoom ? (
              <div className="chinese-chess-room-watch-banner">
                <div className="chinese-chess-room-watch-banner__copy">
                  <span className="chinese-chess-stage-label">{t('play:chineseChess.page.watchStatusTitle')}</span>
                  <strong>{t('play:chineseChess.page.watchingNow', { room: inspectedRoom.summary.roomName })}</strong>
                  <span>{inspectedRoom.summary.matchId}</span>
                </div>
                <div className="chinese-chess-room-watch-banner__actions">
                  <button
                    type="button"
                    className="app-btn secondary"
                    disabled={!!busyCommand}
                    onClick={() => setSelectedRoomId(inspectedRoom.summary.matchId)}
                  >
                    {t('play:chineseChess.page.showWatchedRoom')}
                  </button>
                  <button
                    type="button"
                    className="app-btn secondary"
                    disabled={!!busyCommand}
                    onClick={() => void stopWatchingRooms({ clearSelection: selectedRoomId === inspectedRoom.summary.matchId })}
                  >
                    {t('play:chineseChess.page.stopWatching')}
                  </button>
                </div>
              </div>
            ) : null}

            <div className="chinese-chess-room-search">
              <label className="chinese-chess-field">
                <span className="chinese-chess-field__label">{t('play:chineseChess.page.roomSearchPlaceholder')}</span>
                <div className="chinese-chess-field__control chinese-chess-field__control--search">
                  <input
                    value={roomQuery}
                    onChange={(event) => setRoomQuery(event.target.value)}
                    placeholder={t('play:chineseChess.page.roomSearchPlaceholder')}
                  />
                </div>
              </label>
              <button
                type="button"
                className="app-btn secondary"
                disabled={syncing || !!busyCommand}
                onClick={() => void refreshRooms()}
              >
                {t('play:chineseChess.actions.search')}
              </button>
            </div>

            {joinableMatches.length > 0 ? (
              <div className="chinese-chess-quick-join">
                <div className="chinese-chess-sidebar-headline">
                  <span>{t('play:chineseChess.page.quickJoin')}</span>
                  <span>{joinableMatches.length}</span>
                </div>
                <div className="chinese-chess-room-list chinese-chess-scroll chinese-chess-scroll--workspace">
                  {joinableMatches.map((room) => (
                    <button
                      key={`joinable-${room.matchId}`}
                      type="button"
                      className={`chinese-chess-room-card chinese-chess-room-card--selectable ${selectedRoomId === room.matchId ? 'is-selected' : ''}`}
                      onClick={() => void openRoom(room)}
                    >
                      <div className="chinese-chess-room-card__head">
                        <strong>{room.roomName}</strong>
                        <span className="mono">{room.matchId}</span>
                      </div>
                      <div className="chinese-chess-room-card__meta">
                        <span>{t('play:chineseChess.page.playersCount', { count: room.playerCount })}</span>
                        <span>{t('play:chineseChess.page.readyCount', { count: room.readyCount })}</span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="chinese-chess-sidebar-headline">
              <span>{t('play:chineseChess.page.roomsListTitle')}</span>
              <span>{roomDirectory.length}</span>
            </div>

            {roomDirectory.length === 0 ? (
              <div className="chinese-chess-panel-empty">
                {syncing ? t('play:chineseChess.page.roomsLoading') : t('play:chineseChess.page.noRooms')}
              </div>
            ) : (
              <div className="chinese-chess-room-list chinese-chess-scroll chinese-chess-scroll--workspace">
                {roomDirectory.map((room) => (
                  <button
                    key={room.matchId}
                    type="button"
                    className={`chinese-chess-room-card chinese-chess-room-card--selectable ${selectedRoomId === room.matchId ? 'is-selected' : ''}`}
                    onClick={() => void openRoom(room)}
                  >
                    <div className="chinese-chess-room-card__head">
                      <strong>{room.roomName}</strong>
                      <span className="mono">{room.matchId}</span>
                    </div>
                    <div className="chinese-chess-room-card__meta">
                      <span>{t('play:chineseChess.page.phaseChip', { value: formatPhase(room.phase) })}</span>
                      <span>{t('play:chineseChess.page.spectators', { count: room.spectatorCount })}</span>
                      <span>{visibilityLabel(room.visibility)}</span>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </section>
        );
      case 'record':
        return (
          <section className="chinese-chess-panel-card chinese-chess-panel-card--workspace chinese-chess-scroll">
            <header className="chinese-chess-panel-card__header">
              <div>
                <span className="chinese-chess-stage-label">{t('play:chineseChess.tabs.record')}</span>
                <h2>{t('play:chineseChess.page.recordTitle')}</h2>
              </div>
              <span className="chinese-chess-panel-pill">
                <BarChart3 size={14} /> {rating ? `${t('play:chineseChess.page.elo')} ${rating.rating}` : t('play:chineseChess.page.noRating')}
              </span>
            </header>

            <div className="chinese-chess-panel-card__summary">
              <p>{t('play:chineseChess.page.recordBody')}</p>
            </div>

            <div className="chinese-chess-stat-grid">
              <div className="chinese-chess-stat-card">
                <span>{t('play:chineseChess.page.recordGames')}</span>
                <strong>{recordGames}</strong>
              </div>
              <div className="chinese-chess-stat-card">
                <span>{t('play:chineseChess.page.recordWinRate')}</span>
                <strong>{winRate}%</strong>
              </div>
              <div className="chinese-chess-stat-card">
                <span>{t('play:chineseChess.page.recordWins')}</span>
                <strong>{recordWins}</strong>
              </div>
              <div className="chinese-chess-stat-card">
                <span>{t('play:chineseChess.page.recordLosses')}</span>
                <strong>{recordLosses}</strong>
              </div>
              <div className="chinese-chess-stat-card">
                <span>{t('play:chineseChess.page.recordDraws')}</span>
                <strong>{recordDraws}</strong>
              </div>
              <div className="chinese-chess-stat-card">
                <span>{t('play:chineseChess.page.elo')}</span>
                <strong>{rating?.rating ?? 0}</strong>
              </div>
            </div>
          </section>
        );
      case 'history':
        return (
          <section className="chinese-chess-panel-card chinese-chess-panel-card--workspace chinese-chess-scroll">
            <header className="chinese-chess-panel-card__header">
              <div>
                <span className="chinese-chess-stage-label">{t('play:chineseChess.tabs.history')}</span>
                <h2>{t('play:chineseChess.page.historyTitle')}</h2>
              </div>
              <span className="chinese-chess-panel-pill">{boardMatch?.moveHistory.length ?? 0}</span>
            </header>
            <div className="chinese-chess-panel-card__summary">
              <div className="chinese-chess-panel-pill-row">
                {boardMatch ? <span className="chinese-chess-panel-pill mono">{boardMatch.matchId}</span> : null}
                <span className="chinese-chess-panel-pill">{formatPositionSummary(boardMatch ?? null)}</span>
              </div>
            </div>
            {!boardMatch?.moveHistory.length ? (
              <div className="chinese-chess-panel-empty">{t('play:chineseChess.page.noMoves')}</div>
            ) : (
              <div className="chinese-chess-move-list chinese-chess-scroll chinese-chess-scroll--workspace">
                {boardMatch.moveHistory.map((move, index) => (
                  <div key={`${move.iccs}-${index}`} className="chinese-chess-move-row">
                    <span className="chinese-chess-move-row__index mono">{index + 1}</span>
                    <div className="chinese-chess-move-pill">
                      <strong>{move.display}</strong>
                      <span>{move.iccs}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      case 'leaderboard':
        return (
          <section className="chinese-chess-panel-card chinese-chess-panel-card--workspace chinese-chess-scroll">
            <header className="chinese-chess-panel-card__header">
              <div>
                <span className="chinese-chess-stage-label">{t('play:chineseChess.tabs.leaderboard')}</span>
                <h2>{t('play:chineseChess.page.leaderboardTitle')}</h2>
              </div>
              <span className="chinese-chess-panel-pill">Top {leaderboard.length}</span>
            </header>

            {rating ? (
              <div className="chinese-chess-panel-card__summary">
                <p>{t('play:chineseChess.page.leaderboardBody', { rating: rating.rating })}</p>
              </div>
            ) : null}

            {leaderboard.length === 0 ? (
              <div className="chinese-chess-panel-empty">{t('play:chineseChess.page.noLeaderboard')}</div>
            ) : (
              <div className="chinese-chess-leaderboard-list chinese-chess-scroll chinese-chess-scroll--workspace">
                {leaderboard.map((entry, index) => (
                  <div key={entry.agentId} className="chinese-chess-leaderboard-item">
                    <div className="chinese-chess-leaderboard-item__head">
                      <span className="chinese-chess-rank">#{index + 1}</span>
                      <strong>{entry.rating}</strong>
                    </div>
                    <div className="chinese-chess-leaderboard-item__name">{agentNameLabel(entry.agentName, entry.agentId)}</div>
                    <div className="chinese-chess-leaderboard-item__meta mono">{entry.wins}W/{entry.losses}L/{entry.draws}D</div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      case 'new-game':
      default:
        return (
          <section className="chinese-chess-panel-card chinese-chess-panel-card--workspace chinese-chess-scroll">
            <header className="chinese-chess-panel-card__header">
              <div>
                <span className="chinese-chess-stage-label">{t('play:chineseChess.tabs.newGame')}</span>
                <h2>{t('play:chineseChess.page.manageTitle')}</h2>
              </div>
              {busyCommand ? <span className="chinese-chess-panel-pill">{t('play:chineseChess.page.busy', { label: busyCommand })}</span> : null}
            </header>

            {(!currentMatch || isFinishedMatch) ? (
              <div className="chinese-chess-launch-card">
                <label className="chinese-chess-field">
                  <span className="chinese-chess-field__label">{t('play:chineseChess.page.roomName')}</span>
                  <div className="chinese-chess-field__control">
                    <input
                      value={createRoomName}
                      onChange={(event) => setCreateRoomName(event.target.value)}
                      placeholder={t('play:chineseChess.page.roomNamePlaceholder')}
                    />
                  </div>
                </label>
                <div className="chinese-chess-visibility-toggle" role="tablist" aria-label={t('play:chineseChess.page.visibilityTitle')}>
                  {(['public', 'private'] as ChineseChessRoomVisibility[]).map((visibility) => (
                    <button
                      key={visibility}
                      type="button"
                      className={`chinese-chess-visibility-toggle__option ${createRoomVisibility === visibility ? 'is-active' : ''}`}
                      onClick={() => setCreateRoomVisibility(visibility)}
                    >
                      {visibility === 'public' ? <Globe2 size={15} /> : <LockKeyhole size={15} />}
                      <span>{visibilityLabel(visibility)}</span>
                    </button>
                  ))}
                </div>
                <div className="chinese-chess-launch-card__time">
                  <span className="chinese-chess-panel-pill"><TimerReset size={14} /> {t('play:chineseChess.page.timeControl')}</span>
                </div>
                <button
                  type="button"
                  className="app-btn chinese-chess-cta"
                  disabled={!!busyCommand || !connectedAgent || !canCreateOrJoin}
                  onClick={() => void handleCreateMatch()}
                >
                  {t('play:chineseChess.actions.createMatch')}
                </button>
              </div>
            ) : null}

            {currentMatch ? (
              <div className="chinese-chess-room-detail is-current">
                <div className="chinese-chess-room-detail__header">
                  <div>
                    <span className="chinese-chess-stage-label">{t('play:chineseChess.page.currentRoomTitle')}</span>
                    <h3>{currentMatch.roomName}</h3>
                  </div>
                  <span className="chinese-chess-panel-pill mono">{currentMatch.matchId}</span>
                </div>
                <div className="chinese-chess-panel-pill-row">
                  <span className="chinese-chess-panel-pill">{visibilityLabel(currentMatch.visibility)}</span>
                  <span className="chinese-chess-panel-pill">{t('play:chineseChess.page.phaseChip', { value: formatPhase(currentMatch.phase) })}</span>
                  <span className="chinese-chess-panel-pill">{t('play:chineseChess.page.playersCount', { count: currentMatch.players.length })}</span>
                  <span className="chinese-chess-panel-pill">{t('play:chineseChess.page.readyCount', { count: currentMatch.players.filter((player) => player.ready).length })}</span>
                </div>
                <div className="chinese-chess-room-detail__body">
                  {currentMatch.players.map((player) => (
                    <div key={player.agentId} className="chinese-chess-room-detail__player">
                      <span>{player.agentName}</span>
                      <span>{player.ready ? t('play:chineseChess.page.ready') : t('play:chineseChess.page.phaseWaiting')}</span>
                    </div>
                  ))}
                </div>
                <div className="chinese-chess-room-detail__actions">{renderWorkspaceActions()}</div>
              </div>
            ) : (
              <div className="chinese-chess-panel-empty">{t('play:chineseChess.page.currentRoomEmpty')}</div>
            )}
          </section>
        );
    }
  })();

  const sidebarMeta = (
    <div className="chinese-chess-sidebar-meta">
      <div className="chinese-chess-stage-badges chinese-chess-stage-badges--sidebar">
        <span className="chinese-chess-stage-badge">
          {boardMatch ? t('play:chineseChess.page.currentBoard') : t('play:chineseChess.page.noRoom')}
        </span>
        {boardMatch ? <span className="chinese-chess-stage-badge mono">{boardMatch.matchId}</span> : null}
        {boardSummary ? (
          <span className="chinese-chess-stage-badge">{t('play:chineseChess.page.spectators', { count: boardSummary.spectatorCount })}</span>
        ) : null}
        {boardMatch?.drawOfferBy ? (
          <span className="chinese-chess-stage-badge chinese-chess-stage-badge--warn">{t('play:chineseChess.page.drawOffered')}</span>
        ) : null}
      </div>
      {boardMatch?.result ? (
        <div className="chinese-chess-result-banner">
          <div className="chinese-chess-result-banner__head">
            <span>{t('play:chineseChess.page.resultLabel')}</span>
            <strong>{formatResultTitle(boardMatch.result)}</strong>
          </div>
          <div className="chinese-chess-result-banner__body">
            <span>{formatReason(boardMatch.result.reason)}</span>
            <span>{formatPluginDateTime(boardMatch.result.endedAt)}</span>
          </div>
          {boardMatchIsCurrent && boardMatch.yourAgentId && typeof boardMatch.result.ratingChanges[boardMatch.yourAgentId] === 'number' ? (
            <div className="chinese-chess-result-banner__delta">
              {t('play:chineseChess.page.yourEloDelta', {
                delta: `${boardMatch.result.ratingChanges[boardMatch.yourAgentId] > 0 ? '+' : ''}${boardMatch.result.ratingChanges[boardMatch.yourAgentId]}`,
              })}
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );

  return (
    <div className={`page-wrap chinese-chess-com-shell ${hasFloatingNotices ? 'has-floating-notices' : ''}`}>
      <div className="chinese-chess-com-shell__ambience" aria-hidden="true" />

      <div className="chinese-chess-notice-stack">
        {!connectedAgent ? (
          <div className="chinese-chess-inline-notice chinese-chess-inline-notice--info">
            {t('chineseChess:runtime.noAgent')} <Link className="chinese-chess-inline-link" to="/lobby">{t('nav:lobby')}</Link> / <Link className="chinese-chess-inline-link" to="/agents">{t('nav:agents')}</Link>
          </div>
        ) : null}
        {runtime.error ? (
          <div className="chinese-chess-inline-notice chinese-chess-inline-notice--error">
            <span className="chinese-chess-inline-notice__row"><ShieldAlert size={14} /> {runtime.error}</span>
          </div>
        ) : null}
        {busyCommand ? (
          <div className="chinese-chess-inline-notice chinese-chess-inline-notice--info">
            <span className="chinese-chess-inline-notice__row"><RefreshCw size={14} className="is-spinning" /> {t('play:chineseChess.page.busy', { label: busyCommand })}</span>
          </div>
        ) : null}
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`chinese-chess-inline-notice ${toast.tone === 'error' ? 'chinese-chess-inline-notice--error' : 'chinese-chess-inline-notice--info'}`}
          >
            <span className="chinese-chess-inline-notice__row">{toast.text}</span>
            <button type="button" className="chinese-chess-inline-notice__close" onClick={() => dismissToast(toast.id)}>
              <X size={14} />
            </button>
          </div>
        ))}
      </div>

      <section className="chinese-chess-com-layout">
        <main className="chinese-chess-main-column">
          <section className="chinese-chess-main-stage is-live" id="play">
            {!boardMatch ? (
              <div className="chinese-chess-stage-center chinese-chess-stage-center--live">
                <div className="chinese-chess-board-wrap chinese-chess-board-wrap--live">
                  {renderBoard(
                    previewBoardMatrix,
                    false,
                    false,
                    renderBoardPlayerBadge('top', null, DEFAULT_CLOCK_MS),
                    renderBoardPlayerBadge(
                      'bottom',
                      connectedAgent
                        ? {
                            agentId: connectedAgent.id,
                            userId: '',
                            agentName: connectedAgent.name,
                            side: boardBottomSide,
                            ready: false,
                            connected: true,
                            disconnectDeadlineAt: null,
                          }
                        : null,
                      DEFAULT_CLOCK_MS,
                    ),
                  )}
                </div>
              </div>
            ) : (
              <div className="chinese-chess-stage-center chinese-chess-stage-center--live">
                <div className="chinese-chess-board-wrap chinese-chess-board-wrap--live">
                  {activeResultOverlay ? (
                    <div className="chinese-chess-result-overlay" role="status" aria-live="polite">
                      <div className="chinese-chess-result-overlay__card">
                        <button
                          type="button"
                          className="chinese-chess-result-overlay__close"
                          aria-label={t('play:chineseChess.page.dismissResultOverlay')}
                          onClick={() => setResultOverlay(null)}
                        >
                          <X size={16} />
                        </button>
                        <span className="chinese-chess-stage-label">{t('play:chineseChess.page.resultLabel')}</span>
                        <strong>{formatResultTitle(activeResultOverlay.result)}</strong>
                        <span className="chinese-chess-result-overlay__room">{activeResultOverlay.roomName}</span>
                        <div className="chinese-chess-result-overlay__meta">
                          <span>{formatReason(activeResultOverlay.result!.reason)}</span>
                          <span>{formatPluginDateTime(activeResultOverlay.result!.endedAt)}</span>
                        </div>
                        {boardMatchIsCurrent && activeResultOverlay.yourAgentId && typeof activeResultOverlay.result!.ratingChanges[activeResultOverlay.yourAgentId] === 'number' ? (
                          <div className="chinese-chess-result-overlay__delta">
                            {t('play:chineseChess.page.yourEloDelta', {
                              delta: `${activeResultOverlay.result!.ratingChanges[activeResultOverlay.yourAgentId] > 0 ? '+' : ''}${activeResultOverlay.result!.ratingChanges[activeResultOverlay.yourAgentId]}`,
                            })}
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ) : null}
                  {renderBoard(
                    boardMatrix,
                    yourTurn,
                    true,
                    renderBoardPlayerBadge('top', topStagePlayer, resolveDisplayedClock(topStagePlayer, boardTopSide)),
                    renderBoardPlayerBadge('bottom', bottomStagePlayer, resolveDisplayedClock(bottomStagePlayer, boardBottomSide)),
                  )}
                </div>
                <div className="chinese-chess-captures">
                  <div className="chinese-chess-capture-row">
                    <span>{t('play:chineseChess.page.redLosses')}</span>
                    <div>
                      {boardCaptured.red.length > 0 ? boardCaptured.red.map((piece, index) => (
                        <span key={`red-${piece}-${index}`} className="chinese-chess-capture-piece">
                          {renderPieceSprite(piece, 'capture')}
                        </span>
                      )) : <em>{t('play:chineseChess.page.none')}</em>}
                    </div>
                  </div>
                  <div className="chinese-chess-capture-row">
                    <span>{t('play:chineseChess.page.blackLosses')}</span>
                    <div>
                      {boardCaptured.black.length > 0 ? boardCaptured.black.map((piece, index) => (
                        <span key={`black-${piece}-${index}`} className="chinese-chess-capture-piece">
                          {renderPieceSprite(piece, 'capture')}
                        </span>
                      )) : <em>{t('play:chineseChess.page.none')}</em>}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>
        </main>

        <aside className="chinese-chess-right-rail">
          {sidebarMeta}
          <div className="chinese-chess-workspace-tabs" role="tablist" aria-label={t('play:chineseChess.page.workspaceTabs')}>
            {workspaceTabs.map(({ key, icon: Icon, label }) => (
              <button
                key={key}
                type="button"
                className={`chinese-chess-workspace-tab ${workspaceTab === key ? 'is-active' : ''}`}
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
        className={`chinese-chess-float-orb ${orbExpanded ? 'is-expanded' : ''} ${orbDragging ? 'is-dragging' : ''}`}
        style={{ left: orbPosition.x, top: orbPosition.y }}
      >
        <button
          type="button"
          className="chinese-chess-float-orb__core"
          onPointerDown={startOrbGesture}
          onPointerMove={moveOrbGesture}
          onPointerUp={finishOrbGesture}
          onPointerCancel={cancelOrbGesture}
          onClick={(event) => {
            if (event.detail === 0) setOrbExpanded((value) => !value);
          }}
        >
          {orbExpanded ? <X size={20} /> : <Bot size={20} />}
        </button>
        {orbExpanded ? (
          <div className="chinese-chess-float-orb__menu">
            <button className="chinese-chess-float-orb__action" disabled={!!busyCommand || !connectedAgent} onClick={() => void refreshBootstrap()}>
              <RefreshCw size={16} />
              <span>{t('play:chineseChess.page.navSync')}</span>
            </button>
            <button className="chinese-chess-float-orb__action" onClick={() => setWorkspaceTab('new-game')}>
              <PlusSquare size={16} />
              <span>{t('play:chineseChess.page.navNewGame')}</span>
            </button>
            <button className="chinese-chess-float-orb__action" onClick={() => setWorkspaceTab('rooms')}>
              <Eye size={16} />
              <span>{t('play:chineseChess.page.navRooms')}</span>
            </button>
            <button className="chinese-chess-float-orb__action" onClick={() => setWorkspaceTab('record')}>
              <BarChart3 size={16} />
              <span>{t('play:chineseChess.page.navRecord')}</span>
            </button>
            <button className="chinese-chess-float-orb__action" onClick={() => setWorkspaceTab('history')}>
              <ListOrdered size={16} />
              <span>{t('play:chineseChess.page.navHistory')}</span>
            </button>
            <button className="chinese-chess-float-orb__action" onClick={() => setWorkspaceTab('leaderboard')}>
              <Trophy size={16} />
              <span>{t('play:chineseChess.page.navLeaderboard')}</span>
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
