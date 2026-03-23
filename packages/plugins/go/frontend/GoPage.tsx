import React, { startTransition, useDeferredValue, useEffect, useEffectEvent, useMemo, useState } from 'react';
import { formatPluginDateTime } from '@uruc/plugin-sdk/frontend';
import { isPluginCommandError, usePluginAgent, usePluginRuntime } from '@uruc/plugin-sdk/frontend-react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Bot,
  Building2,
  Eye,
  Globe2,
  House,
  LayoutGrid,
  ListOrdered,
  LockKeyhole,
  PlusSquare,
  RefreshCw,
  Search,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import { useTranslation } from 'react-i18next';
import type {
  GoBootstrapPayload,
  GoColor,
  GoMatchState,
  GoMatchSummary,
  GoMoveRecord,
  GoPlayer,
  GoRating,
  GoRoomDirectoryPayload,
  GoRoomSummary,
  GoRoomVisibility,
  GoWatchRoomPayload,
} from './types';

const GO_LOCATION_ID = 'uruc.go.go-club';
const GO_COMMAND = (id: string) => `uruc.go.${id}@v1`;
const EMPTY_BOARD = Array.from({ length: 19 }, () => Array<GoColor | null>(19).fill(null));
const STAR_POINTS = new Set([
  '3,3',
  '3,9',
  '3,15',
  '9,3',
  '9,9',
  '9,15',
  '15,3',
  '15,9',
  '15,15',
]);

type WorkspaceTab = 'new-game' | 'rooms' | 'record' | 'history' | 'leaderboard';
type ConfirmExitState = {
  target: 'city' | 'lobby';
  phase: 'playing' | 'waiting';
};

type ViewState = {
  currentMatch: GoMatchState | null;
  joinableMatches: GoMatchSummary[];
  roomDirectory: GoRoomSummary[];
  rating: GoRating | null;
  leaderboard: GoRating[];
  lobbyVersion: number;
  directoryVersion: number;
};

const INITIAL_VIEW_STATE: ViewState = {
  currentMatch: null,
  joinableMatches: [],
  roomDirectory: [],
  rating: null,
  leaderboard: [],
  lobbyVersion: 0,
  directoryVersion: 0,
};

function formatClock(ms: number) {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatPoint(x: number, y: number) {
  return `${x + 1},${y + 1}`;
}

function moveLabel(move: GoMoveRecord, t: (key: string, options?: Record<string, unknown>) => string) {
  if (move.type === 'pass') {
    return t('go.page.movePass', { color: move.color });
  }
  return t('go.page.movePlay', {
    color: move.color,
    point: formatPoint(move.x ?? 0, move.y ?? 0),
  });
}

function resultLabel(match: GoMatchState | null, t: (key: string, options?: Record<string, unknown>) => string) {
  if (!match?.result) return t('go.page.waitingResult');
  if (match.result.result === 'black_win') return t('go.page.blackWin');
  if (match.result.result === 'white_win') return t('go.page.whiteWin');
  return t('go.page.draw');
}

function visibilityLabel(visibility: GoRoomVisibility, t: (key: string) => string) {
  return visibility === 'private' ? t('go.page.visibilityPrivate') : t('go.page.visibilityPublic');
}

function colorLabel(color: GoColor | null, t: (key: string) => string) {
  if (color === 'B') return t('go.page.black');
  if (color === 'W') return t('go.page.white');
  return t('go.page.unassigned');
}

function findPlayer(match: GoMatchState | null, color: GoColor) {
  return match?.players.find((player) => player.color === color) ?? null;
}

function previewPlayer(agentId: string | null, agentName: string | null): GoPlayer | null {
  if (!agentId || !agentName) return null;
  return {
    agentId,
    userId: '',
    agentName,
    color: null,
    ready: false,
    connected: true,
    disconnectDeadlineAt: null,
  };
}

export function GoPage() {
  const { t } = useTranslation(['play', 'nav']);
  const navigate = useNavigate();
  const runtime = usePluginRuntime();
  const { connectedAgent } = usePluginAgent();

  const [viewState, setViewState] = useState<ViewState>(INITIAL_VIEW_STATE);
  const [workspaceTab, setWorkspaceTab] = useState<WorkspaceTab>('new-game');
  const [createRoomName, setCreateRoomName] = useState('');
  const [createRoomVisibility, setCreateRoomVisibility] = useState<GoRoomVisibility>('public');
  const [roomSearchDraft, setRoomSearchDraft] = useState('');
  const deferredRoomSearch = useDeferredValue(roomSearchDraft);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);
  const [watchedRoom, setWatchedRoom] = useState<GoWatchRoomPayload | null>(null);
  const [busyCommand, setBusyCommand] = useState<string | null>(null);
  const [errorText, setErrorText] = useState('');
  const [orbExpanded, setOrbExpanded] = useState(false);
  const [confirmExit, setConfirmExit] = useState<ConfirmExitState | null>(null);
  const [dismissedResultEndedAt, setDismissedResultEndedAt] = useState<string | null>(null);

  const isInHall = runtime.currentLocation === GO_LOCATION_ID;
  const currentMatch = viewState.currentMatch;
  const boardMatch = watchedRoom?.state ?? currentMatch;
  const surfaceError = errorText || runtime.error;
  const canCreateOrJoin = !currentMatch || currentMatch.phase === 'finished';
  const legalMoveSet = useMemo(
    () => new Set((currentMatch?.legalMoves ?? []).map((move) => `${move.x},${move.y}`)),
    [currentMatch?.legalMoves],
  );

  const filteredRooms = useMemo(() => {
    const query = deferredRoomSearch.trim().toLowerCase();
    if (!query) return viewState.roomDirectory;
    return viewState.roomDirectory.filter((room) => {
      return room.roomName.toLowerCase().includes(query) || room.matchId.toLowerCase().includes(query);
    });
  }, [deferredRoomSearch, viewState.roomDirectory]);

  const selectedRoom = useMemo(() => {
    return filteredRooms.find((room) => room.matchId === selectedRoomId) ?? null;
  }, [filteredRooms, selectedRoomId]);

  const yourSeat = useMemo(() => {
    if (!currentMatch || !runtime.agentId) return null;
    return currentMatch.players.find((player) => player.agentId === runtime.agentId) ?? null;
  }, [currentMatch, runtime.agentId]);

  const activeBoardRecord = boardMatch?.record ?? [];
  const whitePlayer = findPlayer(boardMatch, 'W');
  const blackPlayer = findPlayer(boardMatch, 'B');
  const currentViewer = boardMatch?.players.find((player) => player.agentId === runtime.agentId) ?? null;
  const waitingBottomPlayer = currentViewer ?? boardMatch?.players[0] ?? previewPlayer(connectedAgent?.id ?? null, connectedAgent?.name ?? null);
  const waitingTopPlayer = boardMatch?.players.find((player) => player.agentId !== waitingBottomPlayer?.agentId) ?? null;
  const topStagePlayer = boardMatch
    ? boardMatch.phase === 'waiting'
      ? waitingTopPlayer
      : whitePlayer
    : null;
  const bottomStagePlayer = boardMatch
    ? boardMatch.phase === 'waiting'
      ? waitingBottomPlayer
      : blackPlayer
    : waitingBottomPlayer;
  const activeResult = boardMatch?.result && boardMatch.result.endedAt !== dismissedResultEndedAt
    ? boardMatch.result
    : null;
  const workspaceTabs = [
    { key: 'new-game' as const, label: t('go.page.tabNewGame'), icon: PlusSquare },
    { key: 'rooms' as const, label: t('go.page.tabRooms'), icon: House },
    { key: 'record' as const, label: t('go.page.tabRecord'), icon: Users },
    { key: 'history' as const, label: t('go.page.tabHistory'), icon: ListOrdered },
    { key: 'leaderboard' as const, label: t('go.page.tabLeaderboard'), icon: Trophy },
  ] as const;

  const runCommand = useEffectEvent(async <T,>(label: string, command: string, payload?: unknown) => {
    setBusyCommand(label);
    setErrorText('');
    try {
      return await runtime.sendCommand<T>(command, payload);
    } catch (error) {
      if (isPluginCommandError(error)) {
        setErrorText(error.message);
      } else if (error instanceof Error) {
        setErrorText(error.message);
      } else {
        setErrorText(t('go.runtime.unknownError'));
      }
      throw error;
    } finally {
      setBusyCommand(null);
    }
  });

  const refreshBootstrap = useEffectEvent(async () => {
    if (!runtime.isConnected || !runtime.isController || !isInHall) return;
    const payload = await runCommand<GoBootstrapPayload>(t('go.page.syncing'), GO_COMMAND('bootstrap'));
    startTransition(() => {
      setViewState((current) => ({
        ...current,
        currentMatch: payload.currentMatch,
        joinableMatches: payload.joinableMatches ?? [],
        rating: payload.rating,
        leaderboard: payload.leaderboard ?? [],
        lobbyVersion: payload.lobbyVersion ?? 0,
      }));
      if (payload.currentMatch) {
        setWorkspaceTab('rooms');
      }
    });
  });

  const refreshRooms = useEffectEvent(async () => {
    if (!runtime.isConnected || !runtime.isController || !isInHall) return;
    const payload = await runCommand<GoRoomDirectoryPayload>(t('go.page.roomsLoading'), GO_COMMAND('list_rooms'), {
      query: roomSearchDraft.trim() || undefined,
      limit: 50,
    });
    const rooms = payload.rooms ?? [];
    startTransition(() => {
      setViewState((current) => ({
        ...current,
        roomDirectory: rooms,
        directoryVersion: payload.directoryVersion ?? 0,
      }));
      if (!selectedRoomId && rooms.length > 0) {
        setSelectedRoomId(rooms[0].matchId);
      }
    });
  });

  useEffect(() => {
    if (!runtime.isConnected || !runtime.isController || !isInHall) return;
    void refreshBootstrap();
  }, [isInHall, runtime.isConnected, runtime.isController]);

  useEffect(() => {
    if (!runtime.isConnected) return;
    const unsubscribers = [
      runtime.subscribe('go_lobby_delta', () => {
        if (isInHall) void refreshBootstrap();
      }),
      runtime.subscribe('go_match_delta', () => {
        if (isInHall) void refreshBootstrap();
      }),
      runtime.subscribe('go_room_directory_delta', () => {
        if (isInHall) void refreshRooms();
      }),
      runtime.subscribe('go_room_delta', () => {
        if (isInHall) void refreshBootstrap();
      }),
      runtime.subscribe('go_reconnected', () => {
        if (isInHall) void refreshBootstrap();
      }),
    ];
    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [isInHall, runtime]);

  useEffect(() => {
    if (workspaceTab !== 'rooms' || !runtime.isConnected || !runtime.isController || !isInHall) return;
    void refreshRooms();
  }, [isInHall, runtime.isConnected, runtime.isController, workspaceTab]);

  const handleCreateMatch = async () => {
    const payload = await runCommand<{ state: GoMatchState }>(
      t('go.commands.createMatch'),
      GO_COMMAND('create_match'),
      {
        roomName: createRoomName.trim() || undefined,
        visibility: createRoomVisibility,
      },
    );
    startTransition(() => {
      setCreateRoomName('');
      setViewState((current) => ({ ...current, currentMatch: payload.state }));
      setWorkspaceTab('rooms');
    });
    await refreshBootstrap();
  };

  const handleJoinMatch = async (matchId: string) => {
    const payload = await runCommand<{ state: GoMatchState }>(
      t('go.commands.joinMatch'),
      GO_COMMAND('join_match'),
      { matchId },
    );
    startTransition(() => {
      setViewState((current) => ({ ...current, currentMatch: payload.state }));
      setWorkspaceTab('rooms');
    });
    await refreshBootstrap();
  };

  const handleReady = async () => {
    const payload = await runCommand<{ state: GoMatchState }>(t('go.commands.ready'), GO_COMMAND('ready'));
    setViewState((current) => ({ ...current, currentMatch: payload.state }));
    await refreshBootstrap();
  };

  const handleUnready = async () => {
    const payload = await runCommand<{ state: GoMatchState }>(t('go.commands.unready'), GO_COMMAND('unready'));
    setViewState((current) => ({ ...current, currentMatch: payload.state }));
    await refreshBootstrap();
  };

  const handleLeave = async () => {
    const payload = await runCommand<{ state: GoMatchState | null }>(t('go.commands.leaveMatch'), GO_COMMAND('leave_match'));
    startTransition(() => {
      setViewState((current) => ({ ...current, currentMatch: payload.state ?? null }));
      setWatchedRoom(null);
      setWorkspaceTab('new-game');
    });
    await refreshBootstrap();
  };

  const handleWatchRoom = async (matchId: string) => {
    const payload = await runCommand<GoWatchRoomPayload>(t('go.commands.watchRoom'), GO_COMMAND('watch_room'), { matchId });
    startTransition(() => {
      setWatchedRoom(payload);
      setSelectedRoomId(matchId);
    });
  };

  const handleUnwatchRoom = async () => {
    await runCommand(t('go.commands.unwatchRoom'), GO_COMMAND('unwatch_room'));
    setWatchedRoom(null);
  };

  const handleBoardMove = async (x: number, y: number) => {
    const payload = await runCommand<{ state: GoMatchState }>(t('go.commands.move'), GO_COMMAND('move'), { x, y });
    setViewState((current) => ({ ...current, currentMatch: payload.state }));
    await refreshBootstrap();
  };

  const handlePass = async () => {
    const payload = await runCommand<{ state: GoMatchState }>(t('go.commands.pass'), GO_COMMAND('pass'));
    setViewState((current) => ({ ...current, currentMatch: payload.state }));
    await refreshBootstrap();
  };

  const handleResign = async () => {
    const payload = await runCommand<{ state: GoMatchState }>(t('go.commands.resign'), GO_COMMAND('resign'));
    setViewState((current) => ({ ...current, currentMatch: payload.state }));
    await refreshBootstrap();
  };

  const leaveGoHall = async () => {
    if (runtime.currentLocation === GO_LOCATION_ID) {
      await runtime.leaveLocation();
    }
  };

  const executeReturnToPlay = useEffectEvent(async () => {
    await leaveGoHall();
    navigate('/play');
  });

  const executeReturnToLobby = useEffectEvent(async () => {
    await leaveGoHall();
    if (runtime.inCity) {
      await runtime.leaveCity();
    }
    navigate('/lobby');
  });

  const requestExit = (target: ConfirmExitState['target']) => {
    if (currentMatch?.phase === 'playing' || currentMatch?.phase === 'waiting') {
      setConfirmExit({ target, phase: currentMatch.phase });
      return;
    }

    if (target === 'city') {
      void executeReturnToPlay().catch((error) => {
        setErrorText(error instanceof Error ? error.message : t('go.runtime.returnToCityFailed'));
      });
      return;
    }

    void executeReturnToLobby().catch((error) => {
      setErrorText(error instanceof Error ? error.message : t('go.runtime.returnToLobbyFailed'));
    });
  };

  const renderBoard = (match: GoMatchState | null) => {
    const displayBoard = match?.board ?? EMPTY_BOARD;

    return (
      <div className={`go-board-wrap ${match ? 'is-live' : 'is-preview'}`}>
        <div className="go-board-grid" role="grid" aria-label={t('go.page.boardTitle')}>
          {displayBoard.map((row, y) => row.map((stone, x) => {
            const pointKey = `${x},${y}`;
            const isStarPoint = STAR_POINTS.has(pointKey);
            const isPlayable = !!match
              && match.matchId === currentMatch?.matchId
              && match.phase === 'playing'
              && match.yourColor === match.turn
              && legalMoveSet.has(pointKey);

            return (
              <button
                key={pointKey}
                type="button"
                className={`go-board-cell ${isStarPoint ? 'is-star' : ''} ${isPlayable ? 'is-playable' : ''}`}
                aria-label={t('go.page.playPoint', { point: formatPoint(x, y) })}
                disabled={!isPlayable || !!busyCommand}
                onClick={() => void handleBoardMove(x, y)}
              >
                {stone ? <span className={`go-stone ${stone === 'B' ? 'is-black' : 'is-white'}`} /> : null}
                {!stone && isStarPoint ? <span className="go-star-point" /> : null}
              </button>
            );
          }))}
        </div>
      </div>
    );
  };

  const renderSeatCard = (seatColor: GoColor, player: GoPlayer | null) => {
    const isTurnCard = !!player?.color && boardMatch?.turn === player.color && !boardMatch?.result;
    const detailLabel = !player
      ? t('go.page.unassigned')
      : !player.connected
        ? t('go.page.offline')
        : boardMatch?.phase === 'waiting'
          ? player.ready
            ? t('go.page.ready')
            : t('go.page.waiting')
          : t('go.page.waitingResult');
    const captureCount = seatColor === 'B'
      ? (boardMatch?.captures.black ?? 0)
      : (boardMatch?.captures.white ?? 0);
    const clockMs = seatColor === 'B'
      ? (boardMatch?.clocks.blackMs ?? 0)
      : (boardMatch?.clocks.whiteMs ?? 0);

    return (
      <div className={`go-seat-card go-seat-card--${seatColor === 'B' ? 'black' : 'white'} ${isTurnCard ? 'is-active' : ''}`}>
        <div className="go-seat-card__identity">
          <div className="go-seat-card__avatar">{seatColor}</div>
          <div className="go-seat-card__copy">
            <strong className="go-seat-card__name">{player?.agentName ?? t('go.page.waiting')}</strong>
            <span className="go-seat-card__detail">{detailLabel}</span>
          </div>
        </div>
        <div className="go-seat-card__side">
          <span className="go-panel-pill">{colorLabel(seatColor, t)}</span>
          <span className="go-panel-pill">{seatColor === 'B' ? t('go.page.captureBlack') : t('go.page.captureWhite')}: {captureCount}</span>
          <div className="go-seat-card__clock mono">{formatClock(clockMs)}</div>
        </div>
      </div>
    );
  };

  const renderCurrentRoomCard = () => {
    if (!currentMatch) {
      return <div className="go-panel-empty">{t('go.page.currentRoomEmpty')}</div>;
    }

    return (
      <div className="go-room-detail is-current">
        <div className="go-room-detail__header">
          <div>
            <span className="go-stage-label">{t('go.page.activeRoom')}</span>
            <h3>{currentMatch.roomName}</h3>
          </div>
          <span className="go-panel-pill mono">{currentMatch.matchId}</span>
        </div>
        <div className="go-panel-pill-row">
          <span className="go-panel-pill">{visibilityLabel(currentMatch.visibility, t)}</span>
          <span className="go-panel-pill">{t('go.page.phaseChip', { value: currentMatch.phase })}</span>
          <span className="go-panel-pill">{t('go.page.playersCount', { count: currentMatch.players.length })}</span>
        </div>
        <div className="go-room-detail__body">
          {currentMatch.players.map((player) => (
            <div key={player.agentId} className="go-room-detail__player">
              <span>{player.agentName}</span>
              <span>{player.ready ? t('go.page.ready') : t('go.page.waiting')}</span>
            </div>
          ))}
        </div>
        <div className="go-room-detail__actions">
          {currentMatch.phase === 'waiting' && yourSeat?.ready !== true ? (
            <button className="app-btn" type="button" disabled={!!busyCommand} onClick={() => void handleReady()}>
              {t('go.commands.ready')}
            </button>
          ) : null}
          {currentMatch.phase === 'waiting' && yourSeat?.ready ? (
            <button className="app-btn secondary" type="button" disabled={!!busyCommand} onClick={() => void handleUnready()}>
              {t('go.commands.unready')}
            </button>
          ) : null}
          {currentMatch.phase === 'waiting' ? (
            <button className="app-btn ghost" type="button" disabled={!!busyCommand} onClick={() => void handleLeave()}>
              {t('go.commands.leaveMatch')}
            </button>
          ) : null}
          {currentMatch.phase === 'finished' ? (
            <button className="app-btn ghost" type="button" disabled={!!busyCommand} onClick={() => void handleLeave()}>
              {t('go.commands.leaveMatch')}
            </button>
          ) : null}
        </div>
      </div>
    );
  };

  const renderWorkspacePanel = () => {
    if (workspaceTab === 'rooms') {
      return (
        <section className="go-panel-card go-panel-card--workspace">
          <header className="go-panel-card__header">
            <div>
              <span className="go-stage-label">{t('go.page.tabRooms')}</span>
              <h2>{t('go.page.roomsTitle')}</h2>
            </div>
            <button className="app-btn ghost" type="button" disabled={!!busyCommand} onClick={() => void refreshRooms()}>
              <RefreshCw size={14} /> {t('go.page.roomsRefresh')}
            </button>
          </header>

          <label className="go-field">
            <span className="go-field__label">{t('go.page.roomsSearchLabel')}</span>
            <div className="go-field__control">
              <Search size={16} />
              <input
                value={roomSearchDraft}
                onChange={(event) => setRoomSearchDraft(event.target.value)}
                placeholder={t('go.page.roomsSearchPlaceholder')}
              />
            </div>
          </label>

          {watchedRoom ? (
            <div className="go-room-watch-banner">
              <div>
                <span className="go-stage-label">{t('go.page.watchingNow')}</span>
                <strong>{watchedRoom.room.roomName}</strong>
                <span className="mono">{watchedRoom.room.matchId}</span>
              </div>
              <button className="app-btn ghost" type="button" disabled={!!busyCommand} onClick={() => void handleUnwatchRoom()}>
                {t('go.commands.unwatchRoom')}
              </button>
            </div>
          ) : null}

          {renderCurrentRoomCard()}

          <div className="go-panel-card__header">
            <div>
              <span className="go-stage-label">{t('go.page.tabRooms')}</span>
              <h2>{t('go.page.selectedRoom')}</h2>
            </div>
            <span className="go-panel-pill">{filteredRooms.length}</span>
          </div>

          {filteredRooms.length === 0 ? (
            <div className="go-panel-empty">{t('go.page.noRooms')}</div>
          ) : (
            <div className="go-room-list">
              {filteredRooms.map((room) => (
                <button
                  key={room.matchId}
                  type="button"
                  className={`go-room-card go-room-card--selectable ${selectedRoomId === room.matchId ? 'is-selected' : ''}`}
                  onClick={() => setSelectedRoomId(room.matchId)}
                >
                  <div className="go-room-card__header">
                    <div>
                      <strong>{room.roomName}</strong>
                      <div className="go-room-card__meta">
                        <span>{t('go.page.phaseChip', { value: room.phase })}</span>
                        <span>{visibilityLabel(room.visibility, t)}</span>
                        <span>{t('go.page.spectatorChip', { count: room.spectatorCount })}</span>
                      </div>
                    </div>
                    <span className="go-panel-pill mono">{room.matchId}</span>
                  </div>
                </button>
              ))}
            </div>
          )}

          {selectedRoom ? (
            <div className="go-room-detail">
              <div className="go-room-detail__header">
                <div>
                  <span className="go-stage-label">{t('go.page.selectedRoom')}</span>
                  <h3>{selectedRoom.roomName}</h3>
                </div>
                <span className="go-panel-pill mono">{selectedRoom.matchId}</span>
              </div>
              <div className="go-panel-pill-row">
                <span className="go-panel-pill">{visibilityLabel(selectedRoom.visibility, t)}</span>
                <span className="go-panel-pill">{t('go.page.phaseChip', { value: selectedRoom.phase })}</span>
                <span className="go-panel-pill">{t('go.page.spectatorChip', { count: selectedRoom.spectatorCount })}</span>
              </div>
              <div className="go-room-detail__actions">
                <button className="app-btn secondary" type="button" disabled={!!busyCommand} onClick={() => void handleWatchRoom(selectedRoom.matchId)}>
                  <Eye size={14} /> {t('go.commands.watchRoom')}
                </button>
                {selectedRoom.phase === 'waiting' && currentMatch?.matchId !== selectedRoom.matchId && canCreateOrJoin ? (
                  <button className="app-btn" type="button" disabled={!!busyCommand} onClick={() => void handleJoinMatch(selectedRoom.matchId)}>
                    {t('go.commands.joinMatch')}
                  </button>
                ) : null}
              </div>
            </div>
          ) : null}
        </section>
      );
    }

    if (workspaceTab === 'record') {
      return (
        <section className="go-panel-card go-panel-card--workspace">
          <header className="go-panel-card__header">
            <div>
              <span className="go-stage-label">{t('go.page.tabRecord')}</span>
              <h2>{t('go.page.recordTitle')}</h2>
            </div>
            <span className="go-panel-pill">Elo {viewState.rating?.rating ?? '--'}</span>
          </header>
          <div className="go-stat-grid">
            <div className="go-stat-card">
              <span>{t('go.page.recordRating')}</span>
              <strong>{viewState.rating?.rating ?? '--'}</strong>
            </div>
            <div className="go-stat-card">
              <span>{t('go.page.recordGames')}</span>
              <strong>{viewState.rating?.gamesPlayed ?? 0}</strong>
            </div>
            <div className="go-stat-card">
              <span>{t('go.page.recordWins')}</span>
              <strong>{viewState.rating?.wins ?? 0}</strong>
            </div>
            <div className="go-stat-card">
              <span>{t('go.page.recordLosses')}</span>
              <strong>{viewState.rating?.losses ?? 0}</strong>
            </div>
          </div>
          <div className="go-panel-card__summary">
            <div className="go-panel-pill-row">
              <span className="go-panel-pill">{t('go.page.connectedAgent')}</span>
              <span className="go-panel-pill">{connectedAgent?.name ?? t('go.runtime.noAgent')}</span>
            </div>
            <p>{t('go.page.recordBody')}</p>
          </div>
        </section>
      );
    }

    if (workspaceTab === 'history') {
      return (
        <section className="go-panel-card go-panel-card--workspace">
          <header className="go-panel-card__header">
            <div>
              <span className="go-stage-label">{t('go.page.tabHistory')}</span>
              <h2>{t('go.page.historyTitle')}</h2>
            </div>
            <span className="go-panel-pill">{activeBoardRecord.length}</span>
          </header>
          {activeBoardRecord.length === 0 ? (
            <div className="go-panel-empty">{t('go.page.moveSheetEmpty')}</div>
          ) : (
            <div className="go-record-list">
              {activeBoardRecord.map((move) => (
                <div key={`${move.moveNumber}-${move.type}-${move.x ?? 'pass'}-${move.y ?? 'pass'}`} className="go-record-row">
                  <span className="go-panel-pill">{move.moveNumber}</span>
                  <span>{moveLabel(move, t)}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      );
    }

    if (workspaceTab === 'leaderboard') {
      return (
        <section className="go-panel-card go-panel-card--workspace">
          <header className="go-panel-card__header">
            <div>
              <span className="go-stage-label">{t('go.page.tabLeaderboard')}</span>
              <h2>{t('go.page.leaderboard')}</h2>
            </div>
          </header>
          {viewState.leaderboard.length === 0 ? (
            <div className="go-panel-empty">{t('go.page.noData')}</div>
          ) : (
            <div className="go-leaderboard-list">
              {viewState.leaderboard.map((item, index) => (
                <div key={item.agentId} className="go-leaderboard-item">
                  <div>
                    <strong>#{index + 1} {item.agentName ?? item.agentId}</strong>
                    <div className="go-room-card__meta">
                      <span>{item.wins}W</span>
                      <span>{item.losses}L</span>
                      <span>{item.draws}D</span>
                    </div>
                  </div>
                  <span className="go-panel-pill">{item.rating}</span>
                </div>
              ))}
            </div>
          )}
        </section>
      );
    }

    return (
      <section className="go-panel-card go-panel-card--workspace">
        <header className="go-panel-card__header">
          <div>
            <span className="go-stage-label">{t('go.page.tabNewGame')}</span>
            <h2>{t('go.page.newGameTitle')}</h2>
          </div>
          {busyCommand ? <span className="go-panel-pill">{busyCommand}</span> : null}
        </header>
        {!canCreateOrJoin ? (
          <div className="go-panel-card__summary">
            <p>{t('go.page.currentRoomEmpty')}</p>
          </div>
        ) : (
          <div className="go-launch-card">
            <label className="go-field">
              <span className="go-field__label">{t('go.page.roomNameLabel')}</span>
              <div className="go-field__control">
                <input
                  value={createRoomName}
                  onChange={(event) => setCreateRoomName(event.target.value)}
                  placeholder={t('go.page.roomNamePlaceholder')}
                />
              </div>
            </label>
            <div className="go-visibility-toggle" role="tablist" aria-label={t('go.page.workspaceTabs')}>
              {(['public', 'private'] as GoRoomVisibility[]).map((visibility) => (
                <button
                  key={visibility}
                  type="button"
                  className={`go-visibility-toggle__option ${createRoomVisibility === visibility ? 'is-active' : ''}`}
                  onClick={() => setCreateRoomVisibility(visibility)}
                >
                  {visibility === 'public' ? <Globe2 size={15} /> : <LockKeyhole size={15} />}
                  <span>{visibilityLabel(visibility, t)}</span>
                </button>
              ))}
            </div>
            <div className="go-action-grid">
              <button className="app-btn" type="button" disabled={!!busyCommand} onClick={() => void handleCreateMatch()}>
                <PlusSquare size={14} /> {t('go.commands.createMatch')}
              </button>
              <button className="app-btn ghost" type="button" disabled={!!busyCommand || !isInHall} onClick={() => void refreshBootstrap()}>
                <RefreshCw size={14} /> {t('go.page.syncNow')}
              </button>
            </div>
          </div>
        )}

        {viewState.joinableMatches.length > 0 ? (
          <div className="go-joinable-list">
            {viewState.joinableMatches.map((match) => (
              <div key={match.matchId} className="go-room-card">
                <div className="go-room-card__header">
                  <div>
                    <strong>{match.roomName}</strong>
                    <div className="go-room-card__meta">
                      <span>{match.players.length}/2</span>
                      <span>{visibilityLabel(match.visibility, t)}</span>
                    </div>
                  </div>
                  <button className="app-btn secondary" type="button" disabled={!!busyCommand || !canCreateOrJoin} onClick={() => void handleJoinMatch(match.matchId)}>
                    {t('go.commands.joinMatch')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    );
  };

  const renderModal = () => {
    const roomLabel = currentMatch?.roomName ?? watchedRoom?.room.roomName ?? t('go.page.title');

    if (confirmExit) {
      const title = confirmExit.target === 'city' ? t('go.page.modalCityTitle') : t('go.page.modalLobbyTitle');
      const body = confirmExit.target === 'city'
        ? confirmExit.phase === 'playing'
          ? t('go.runtime.returnToCityPlayingConfirm')
          : t('go.runtime.returnToCityWaitingConfirm')
        : confirmExit.phase === 'playing'
          ? t('go.runtime.returnToLobbyPlayingConfirm')
          : t('go.runtime.returnToLobbyWaitingConfirm');

      return (
        <div className="go-modal-backdrop" role="presentation">
          <div className="go-modal" role="dialog" aria-modal="true" aria-label={title}>
            <div className="go-modal__copy">
              <span className="go-stage-label">{t('go.page.activeRoom')}</span>
              <h2>{title}</h2>
              <p>{body}</p>
            </div>
            <div className="go-modal__actions">
              <button className="app-btn ghost" type="button" onClick={() => setConfirmExit(null)}>
                {t('go.page.modalStay')}
              </button>
              <button
                className="app-btn"
                type="button"
                onClick={() => {
                  const nextTarget = confirmExit.target;
                  setConfirmExit(null);
                  if (nextTarget === 'city') {
                    void executeReturnToPlay().catch((error) => {
                      setErrorText(error instanceof Error ? error.message : t('go.runtime.returnToCityFailed'));
                    });
                    return;
                  }
                  void executeReturnToLobby().catch((error) => {
                    setErrorText(error instanceof Error ? error.message : t('go.runtime.returnToLobbyFailed'));
                  });
                }}
              >
                {confirmExit.target === 'city' ? t('go.page.modalContinueCity') : t('go.page.modalContinueLobby')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (activeResult) {
      return (
        <div className="go-modal-backdrop" role="presentation">
          <div className="go-modal" role="dialog" aria-modal="true" aria-label={t('go.page.resultLabel')}>
            <button
              type="button"
              className="go-modal__close"
              aria-label={t('go.page.modalDismiss')}
              onClick={() => setDismissedResultEndedAt(activeResult.endedAt)}
            >
              <X size={16} />
            </button>
            <div className="go-modal__copy">
              <span className="go-stage-label">{t('go.page.resultLabel')}</span>
              <h2>{resultLabel(boardMatch, t)}</h2>
              <p>{roomLabel}</p>
            </div>
            <div className="go-modal__meta">
              <span>{activeResult.reason}</span>
              <span>{formatPluginDateTime(activeResult.endedAt)}</span>
            </div>
            {activeResult.score ? (
              <div className="go-modal__pills">
                <span className="go-panel-pill">{t('go.page.scoreBlack', { value: activeResult.score.blackScore })}</span>
                <span className="go-panel-pill">{t('go.page.scoreWhite', { value: activeResult.score.whiteScore })}</span>
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    if (surfaceError) {
      return (
        <div className="go-modal-backdrop" role="presentation">
          <div className="go-modal" role="dialog" aria-modal="true" aria-label={t('go.page.modalErrorTitle')}>
            <div className="go-modal__copy">
              <span className="go-stage-label">{t('go.page.title')}</span>
              <h2>{t('go.page.modalErrorTitle')}</h2>
              <p>{surfaceError}</p>
            </div>
            {errorText ? (
              <div className="go-modal__actions">
                <button className="app-btn ghost" type="button" onClick={() => setErrorText('')}>
                  {t('go.page.modalDismiss')}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    if (!connectedAgent) {
      return (
        <div className="go-modal-backdrop" role="presentation">
          <div className="go-modal" role="dialog" aria-modal="true" aria-label={t('go.page.modalNoAgentTitle')}>
            <div className="go-modal__copy">
              <span className="go-stage-label">{t('go.page.connectedAgent')}</span>
              <h2>{t('go.page.modalNoAgentTitle')}</h2>
              <p>{t('go.runtime.noAgent')}</p>
            </div>
            <div className="go-modal__actions">
              <Link className="app-btn ghost" to="/lobby">{t('go.page.modalOpenLobby')}</Link>
              <Link className="app-btn" to="/agents">{t('go.page.modalOpenAgents')}</Link>
            </div>
          </div>
        </div>
      );
    }

    if (!runtime.isConnected) {
      return (
        <div className="go-modal-backdrop" role="presentation">
          <div className="go-modal" role="dialog" aria-modal="true" aria-label={t('go.runtime.connectTitle')}>
            <div className="go-modal__copy">
              <span className="go-stage-label">{t('go.page.title')}</span>
              <h2>{t('go.runtime.connectTitle')}</h2>
              <p>{t('go.runtime.connectBody')}</p>
            </div>
            <div className="go-modal__actions">
              <button className="app-btn" type="button" onClick={() => void runtime.connect()}>
                {t('go.runtime.connect')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!runtime.isController) {
      return (
        <div className="go-modal-backdrop" role="presentation">
          <div className="go-modal" role="dialog" aria-modal="true" aria-label={t('go.runtime.claimTitle')}>
            <div className="go-modal__copy">
              <span className="go-stage-label">{t('go.page.title')}</span>
              <h2>{t('go.runtime.claimTitle')}</h2>
              <p>{t('go.runtime.claimBody')}</p>
            </div>
            <div className="go-modal__actions">
              <button className="app-btn" type="button" onClick={() => void runtime.claimControl()}>
                {t('go.runtime.claim')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!runtime.inCity) {
      return (
        <div className="go-modal-backdrop" role="presentation">
          <div className="go-modal" role="dialog" aria-modal="true" aria-label={t('go.runtime.cityTitle')}>
            <div className="go-modal__copy">
              <span className="go-stage-label">{t('go.page.title')}</span>
              <h2>{t('go.runtime.cityTitle')}</h2>
              <p>{t('go.runtime.cityBody')}</p>
            </div>
            <div className="go-modal__actions">
              <button className="app-btn" type="button" onClick={() => void runtime.enterCity()}>
                {t('go.runtime.enterCity')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    if (!isInHall) {
      return (
        <div className="go-modal-backdrop" role="presentation">
          <div className="go-modal" role="dialog" aria-modal="true" aria-label={t('go.runtime.locationTitle')}>
            <div className="go-modal__copy">
              <span className="go-stage-label">{t('go.page.title')}</span>
              <h2>{t('go.runtime.locationTitle')}</h2>
              <p>{t('go.runtime.locationBody')}</p>
            </div>
            <div className="go-modal__actions">
              <button className="app-btn" type="button" onClick={() => void runtime.enterLocation(GO_LOCATION_ID)}>
                {t('go.page.enterHall')}
              </button>
            </div>
          </div>
        </div>
      );
    }

    return null;
  };

  return (
    <div className="page-wrap go-com-shell">
      <div className="go-com-shell__ambience" aria-hidden="true" />

      <section className="go-com-layout">
        <main className="go-main-column">
          <section className="go-main-stage is-live" id="play">
            <div className="go-board-stage">
              <div className="go-board-stage__surface">
                <div className="go-board-stage__seat go-board-stage__seat--top">
                  {renderSeatCard('W', topStagePlayer)}
                </div>
                <div className="go-board-shell go-board-shell--live">
                  {renderBoard(boardMatch)}
                </div>
                <div className="go-board-stage__seat go-board-stage__seat--bottom">
                  {renderSeatCard('B', bottomStagePlayer)}
                </div>
              </div>
            </div>
          </section>
        </main>

        <aside className="go-right-rail">
          {currentMatch?.phase === 'playing' ? (
            <div className="go-panel-card go-panel-card--actions">
              <header className="go-panel-card__header">
                <div>
                  <span className="go-stage-label">{t('go.page.activeRoom')}</span>
                  <h2>{t('go.page.turnLabel', { value: colorLabel(currentMatch.turn, t) })}</h2>
                </div>
                <span className="go-panel-pill">{currentMatch.roomName}</span>
              </header>
              <div className="go-action-grid">
                <button className="app-btn" type="button" disabled={!!busyCommand || currentMatch.turn !== currentMatch.yourColor} onClick={() => void handlePass()}>
                  {t('go.commands.pass')}
                </button>
                <button className="app-btn secondary" type="button" disabled={!!busyCommand} onClick={() => void handleResign()}>
                  {t('go.commands.resign')}
                </button>
              </div>
            </div>
          ) : null}
          <div className="go-workspace-tabs" role="tablist" aria-label={t('go.page.workspaceTabs')}>
            {workspaceTabs.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                type="button"
                className={`go-workspace-tab ${workspaceTab === key ? 'is-active' : ''}`}
                onClick={() => setWorkspaceTab(key)}
              >
                <Icon size={18} />
                <span>{label}</span>
              </button>
            ))}
          </div>
          {renderWorkspacePanel()}
        </aside>
      </section>

      <div className={`go-float-orb ${orbExpanded ? 'is-expanded' : ''}`}>
        <button
          type="button"
          className="go-float-orb__core"
          onClick={() => setOrbExpanded((value) => !value)}
        >
          {orbExpanded ? <X size={20} /> : <Bot size={20} />}
        </button>
        {orbExpanded ? (
          <div className="go-float-orb__menu">
            <button className="go-float-orb__action" disabled={!!busyCommand || !isInHall} onClick={() => void refreshBootstrap()}>
              <RefreshCw size={16} />
              <span>{t('go.page.navSync')}</span>
            </button>
            <button className="go-float-orb__action" disabled={!!busyCommand} onClick={() => requestExit('city')}>
              <Building2 size={16} />
              <span>{t('go.page.navCity')}</span>
            </button>
            <button className="go-float-orb__action" disabled={!!busyCommand} onClick={() => requestExit('lobby')}>
              <LayoutGrid size={16} />
              <span>{t('go.page.navLobby')}</span>
            </button>
          </div>
        ) : null}
      </div>

      {renderModal()}
    </div>
  );
}
