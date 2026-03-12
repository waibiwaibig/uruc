import { useEffect, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useAgents } from '../context/AgentsContext';
import { useAgentRuntime } from '../context/AgentRuntimeContext';
import i18n from '../i18n';
import type {
  ArcadeActionResult,
  ArcadeGameActionSchema,
  ArcadeLobbyState,
  ArcadeNoticeKind,
  ArcadePlayerStats,
  ArcadeReconnectedPayload,
  ArcadeSessionPlayerState,
  ArcadeSessionState,
  ArcadeTableChange,
  ArcadeTableClosedPayload,
  ArcadeTableEventPayload,
  ArcadeTableHistory,
  ArcadeTableState,
  ArcadeTableSummary,
  ArcadeTimelineEvent,
  ArcadeWelcomePayload,
} from './types';
import { WsCommandError } from './ws';

export const ARCADE_LOCATION_ID = 'arcade';
const ACTION_ORDER = ['sit_in', 'ready', 'sit_out', 'start_round', 'check', 'call', 'raise', 'all_in', 'bet', 'hit', 'stand', 'double_down', 'fold'];
const LOCAL_EVENT_LIMIT = 18;

export function arcadeTableHref(tableId: string): string {
  return `/play/arcade/table/${tableId}`;
}

export class ArcadeUserCancelledError extends Error {
  constructor(message = i18n.t('play:arcade.runtime.userCancelled')) {
    super(message);
    this.name = 'ArcadeUserCancelledError';
  }
}

export function isArcadeUserCancelledError(error: unknown): error is ArcadeUserCancelledError {
  return error instanceof ArcadeUserCancelledError;
}

export function formatLocation(place: ArcadeLobbyState['yourLocation']['place'] | undefined): string {
  switch (place) {
    case 'table':
      return i18n.t('play:arcade.location.table');
    case 'watching':
      return i18n.t('play:arcade.location.watching');
    case 'disconnected':
      return i18n.t('play:arcade.location.disconnected');
    default:
      return i18n.t('play:arcade.location.lobby');
  }
}

export function formatActionLabel(type: string): string {
  const labels: Record<string, string> = {
    ready: i18n.t('play:arcade.actionLabels.ready'),
    sit_in: i18n.t('play:arcade.actionLabels.sit_in'),
    sit_out: i18n.t('play:arcade.actionLabels.sit_out'),
    start_round: i18n.t('play:arcade.actionLabels.start_round'),
    bet: i18n.t('play:arcade.actionLabels.bet'),
    check: i18n.t('play:arcade.actionLabels.check'),
    call: i18n.t('play:arcade.actionLabels.call'),
    raise: i18n.t('play:arcade.actionLabels.raise'),
    all_in: i18n.t('play:arcade.actionLabels.all_in'),
    hit: i18n.t('play:arcade.actionLabels.hit'),
    stand: i18n.t('play:arcade.actionLabels.stand'),
    double_down: i18n.t('play:arcade.actionLabels.double_down'),
    fold: i18n.t('play:arcade.actionLabels.fold'),
  };
  return labels[type] ?? type;
}

export function formatPlayerStatus(status: string | undefined): string {
  const labels: Record<string, string> = {
    joined: i18n.t('play:arcade.playerStatus.joined'),
    ready: i18n.t('play:arcade.playerStatus.ready'),
    betting: i18n.t('play:arcade.playerStatus.betting'),
    playing: i18n.t('play:arcade.playerStatus.playing'),
    stood: i18n.t('play:arcade.playerStatus.stood'),
    busted: i18n.t('play:arcade.playerStatus.busted'),
    done: i18n.t('play:arcade.playerStatus.done'),
    checked: i18n.t('play:arcade.playerStatus.checked'),
    called: i18n.t('play:arcade.playerStatus.called'),
    raised: i18n.t('play:arcade.playerStatus.raised'),
    all_in: i18n.t('play:arcade.playerStatus.all_in'),
    folded: i18n.t('play:arcade.playerStatus.folded'),
    settled: i18n.t('play:arcade.playerStatus.settled'),
    sitting_out: i18n.t('play:arcade.playerStatus.sitting_out'),
    waiting_next: i18n.t('play:arcade.playerStatus.waiting_next'),
    skipped: i18n.t('play:arcade.playerStatus.skipped'),
  };
  return labels[status ?? 'joined'] ?? status ?? i18n.t('play:arcade.playerStatus.joined');
}

export function formatEvent(event?: ArcadeTimelineEvent): string {
  if (!event) return i18n.t('play:arcade.fallback.stateUpdated');
  return event.message ?? i18n.t('play:arcade.fallback.eventArrived');
}

export function isBlackjackState(state: ArcadeSessionState | null): boolean {
  return !!state && Array.isArray(state.players) && 'dealer' in state;
}

export function cardFaceClass(card: string): string {
  if (card.includes('♠') || card.includes('♣')) return 'arcade-card arcade-card--dark';
  return 'arcade-card arcade-card--light';
}

export function getGameTagline(gameId: string): string {
  switch (gameId) {
    case 'blackjack':
      return i18n.t('play:arcade.taglines.blackjack');
    case 'texas-holdem':
      return i18n.t('play:arcade.taglines.texasHoldem');
    case 'gomoku':
      return i18n.t('play:arcade.taglines.gomoku');
    case 'love-letter':
      return i18n.t('play:arcade.taglines.loveLetter');
    case 'xiangqi':
      return i18n.t('play:arcade.taglines.xiangqi');
    case 'uno':
      return i18n.t('play:arcade.taglines.uno');
    default:
      return i18n.t('play:arcade.taglines.loaded');
  }
}

export function playerOccupancy(table: ArcadeTableSummary): string {
  return `${table.players.length}/${table.maxPlayers}`;
}

export function byActionOrder(a: ArcadeGameActionSchema, b: ArcadeGameActionSchema): number {
  const left = ACTION_ORDER.indexOf(a.type);
  const right = ACTION_ORDER.indexOf(b.type);
  if (left === -1 && right === -1) return a.type.localeCompare(b.type);
  if (left === -1) return 1;
  if (right === -1) return -1;
  return left - right;
}

function noticeFromChange(change: Pick<ArcadeTableChange, 'kind'>): ArcadeNoticeKind {
  if (['game_over', 'round_finished', 'match_finished'].includes(change.kind)) return 'success';
  if (['draw_offered', 'draw_penalty', 'uno_caught', 'player_eliminated', 'player_kicked'].includes(change.kind)) return 'warning';
  if (['resigned', 'player_timeout', 'player_busted', 'table_closed'].includes(change.kind)) return 'danger';
  if (['your_turn', 'turn_started'].includes(change.kind)) return 'turn';
  return 'info';
}

function toTimelineEvent(change: ArcadeTableChange, id: string): ArcadeTimelineEvent {
  return {
    id,
    kind: change.kind,
    severity: noticeFromChange(change),
    actorId: change.actorId,
    actorName: change.actorName,
    message: change.message,
    detail: change.detail,
    createdAt: change.createdAt,
  };
}

export function useArcadeClient(preferredTableId?: string | null) {
  const { t } = useTranslation('play');
  const { shadowAgent } = useAgents();
  const runtime = useAgentRuntime();

  const [lobby, setLobby] = useState<ArcadeLobbyState | null>(null);
  const [currentTable, setCurrentTable] = useState<ArcadeTableState | null>(null);
  const [stats, setStats] = useState<ArcadePlayerStats[]>([]);
  const [leaderboard, setLeaderboard] = useState<Record<string, ArcadePlayerStats[]>>({});
  const [busyAction, setBusyAction] = useState('');
  const [errorText, setErrorText] = useState('');
  const [successText, setSuccessText] = useState('');
  const [selectedGameId, setSelectedGameId] = useState('');
  const [newTableName, setNewTableName] = useState('');
  const [localFeed, setLocalFeed] = useState<ArcadeTimelineEvent[]>([]);
  const [initialSyncDone, setInitialSyncDone] = useState(false);
  const autoBootRef = useRef('');

  const currentAgentId = runtime.agentSession?.agentId ?? shadowAgent?.id ?? null;
  const availableGames = lobby?.games ?? [];
  const selectedGame = availableGames.find((game) => game.id === selectedGameId) ?? availableGames[0] ?? null;
  const tableSummaries = lobby?.tables ?? [];
  const currentSeat = useMemo<ArcadeSessionPlayerState | null>(() => {
    if (!currentAgentId || !currentTable) return null;
    return currentTable.state.players.find((player) => player.agentId === currentAgentId) ?? null;
  }, [currentAgentId, currentTable]);
  const selectedLeaderboard = useMemo(
    () => leaderboard[selectedGame?.id ?? selectedGameId] ?? [],
    [leaderboard, selectedGame?.id, selectedGameId],
  );
  const selectedStats = useMemo(
    () => stats.find((item) => item.gameId === (selectedGame?.id ?? selectedGameId)) ?? null,
    [selectedGame?.id, selectedGameId, stats],
  );
  const currentPlace = lobby?.yourLocation.place ?? 'lobby';
  const canClaimChips = (lobby?.wallet?.balance ?? 0) === 0 && (lobby?.wallet?.frozen ?? 0) === 0 && currentPlace === 'lobby';
  const locationTableId = lobby && lobby.yourLocation.place !== 'lobby' ? lobby.yourLocation.tableId : null;
  const currentTableId = currentTable?.table.tableId ?? locationTableId;
  const isCurrentHost = currentTable?.table.createdBy === currentAgentId;
  const feed = useMemo(() => localFeed, [localFeed]);

  const pushFeed = (input: {
    kind?: string;
    severity?: ArcadeNoticeKind;
    actorId?: string;
    actorName?: string;
    message: string;
    detail?: string;
    viewerPrompt?: string;
    createdAt?: number;
  } | string): ArcadeTimelineEvent => {
    const event: ArcadeTimelineEvent = typeof input === 'string'
      ? {
          id: `local-${Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          kind: 'local',
          severity: 'info',
          message: input,
          createdAt: Date.now(),
        }
      : {
          id: `local-${input.createdAt ?? Date.now()}-${Math.random().toString(16).slice(2, 8)}`,
          kind: input.kind ?? 'local',
          severity: input.severity ?? 'info',
          actorId: input.actorId,
          actorName: input.actorName,
          message: input.message,
          detail: input.detail,
          viewerPrompt: input.viewerPrompt,
          createdAt: input.createdAt ?? Date.now(),
        };

    setLocalFeed((prev) => [event, ...prev].slice(0, LOCAL_EVENT_LIMIT));
    return event;
  };

  const claimControlIfNeeded = async () => {
    const snapshot = await runtime.refreshSessionState();
    if (snapshot.isController) return snapshot;
    if (snapshot.hasController && !window.confirm(t('arcade.runtime.confirmTakeover'))) {
      throw new Error(t('arcade.runtime.noControl'));
    }
    return runtime.claimControl();
  };

  const ensureArcadeReady = async () => {
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

    const refreshed = await runtime.refreshSessionState();
    if (refreshed.currentLocation !== ARCADE_LOCATION_ID) {
      await runtime.enterLocation(ARCADE_LOCATION_ID);
    }
  };

  const sendArcadeCommand = async <T,>(label: string, type: string, payload?: unknown): Promise<T | null> => {
    setBusyAction(label);
    setErrorText('');
    setSuccessText('');

    try {
      const result = await runtime.sendCommand<T>(type, payload);
      return result;
    } catch (error) {
      if (error instanceof WsCommandError && error.code === 'CONTROLLED_ELSEWHERE') {
        try {
          await claimControlIfNeeded();
          const retry = await runtime.sendCommand<T>(type, payload);
          return retry;
        } catch (retryError) {
          setErrorText(retryError instanceof Error ? retryError.message : t('arcade.runtime.actionFailed'));
          return null;
        }
      }
      setErrorText(error instanceof Error ? error.message : t('arcade.runtime.actionFailed'));
      return null;
    } finally {
      setBusyAction('');
    }
  };

  const loadTableSnapshot = async (tableId: string, viewerAgentId?: string | null) => {
    const [table, history] = await Promise.all([
      runtime.sendCommand<ArcadeTableState>('arcade_table_state', { tableId }),
      runtime.sendCommand<ArcadeTableHistory>('arcade_table_history', { tableId }).catch(() => null),
    ]);
    setCurrentTable(table);
    if (history) {
      setLocalFeed(history.history.map((entry) => toTimelineEvent(entry.change, `history-${entry.seq}`)));
    } else if (!viewerAgentId) {
      setLocalFeed([]);
    }
    return table;
  };

  const syncArcade = async (tableIdHint?: string | null) => {
    await ensureArcadeReady();

    const [nextLobby, nextStats, nextLeaderboard] = await Promise.all([
      runtime.sendCommand<ArcadeLobbyState>('arcade_lobby'),
      runtime.sendCommand<{ stats: ArcadePlayerStats[] }>('arcade_my_stats'),
      runtime.sendCommand<{ leaderboard: Record<string, ArcadePlayerStats[]> }>('arcade_leaderboard', { limit: 8 }),
    ]);

    setLobby(nextLobby);
    setStats(nextStats.stats ?? []);
    setLeaderboard(nextLeaderboard.leaderboard ?? {});

    const activeTableId = nextLobby.yourLocation.place !== 'lobby'
      ? nextLobby.yourLocation.tableId
      : (tableIdHint ?? preferredTableId ?? null);

    if (activeTableId) {
      try {
        await loadTableSnapshot(activeTableId, currentAgentId);
      } catch {
        setCurrentTable(null);
      }
    } else {
      setCurrentTable(null);
      setLocalFeed([]);
    }

    setInitialSyncDone(true);
  };

  const refreshArcade = async (tableIdHint?: string | null) => {
    try {
      await syncArcade(tableIdHint ?? currentTable?.table.tableId ?? preferredTableId ?? null);
      setSuccessText(t('arcade.runtime.syncToast'));
      pushFeed({ kind: 'sync', severity: 'success', message: t('arcade.runtime.syncToast') });
      return true;
    } catch (error) {
      setErrorText(error instanceof Error ? error.message : t('arcade.runtime.refreshFailed'));
      return false;
    }
  };

  const createTableAndJoin = async (options?: {
    gameId?: string;
    name?: string;
    isPrivate?: boolean;
  }): Promise<string | null> => {
    const gameId = options?.gameId ?? selectedGameId ?? selectedGame?.id;
    const tableName = options?.name ?? (newTableName.trim() || undefined);
    if (!gameId) {
      setErrorText(t('arcade.runtime.noAvailableGame'));
      return null;
    }

    const chosenGame = availableGames.find((game) => game.id === gameId) ?? selectedGame;

    const created = await sendArcadeCommand<{ tableId: string }>(t('arcade.runtime.createTableLabel'), 'arcade_create_table', {
      gameId,
      name: tableName,
      private: options?.isPrivate ?? false,
    });
    if (!created) return null;

    const joined = await sendArcadeCommand<ArcadeTableState>(t('arcade.runtime.joinTableLabel'), 'arcade_join_table', {
      tableId: created.tableId,
    });
    if (!joined) return null;

    setCurrentTable(joined);
    setNewTableName('');
    pushFeed({
      kind: 'table_created',
      severity: 'success',
      message: t('arcade.runtime.createRoomFeed', { gameName: chosenGame?.catalog.name ?? gameId }),
    });
    // Update lobby in background without awaiting — caller navigates immediately
    void runtime.sendCommand<ArcadeLobbyState>('arcade_lobby').then(setLobby).catch(() => {});
    return created.tableId;
  };

  const joinTable = async (tableId: string): Promise<boolean> => {
    const joined = await sendArcadeCommand<ArcadeTableState>(t('arcade.runtime.joinTableLabel'), 'arcade_join_table', { tableId });
    if (!joined) return false;
    setCurrentTable(joined);
    pushFeed({ kind: 'table_join', severity: 'success', message: t('arcade.runtime.joinedRoomFeed', { tableId }) });
    void runtime.sendCommand<ArcadeLobbyState>('arcade_lobby').then(setLobby).catch(() => {});
    return true;
  };

  const watchTable = async (tableId: string): Promise<boolean> => {
    const watched = await sendArcadeCommand<ArcadeTableState>(t('arcade.runtime.watchTableLabel'), 'arcade_watch_table', { tableId });
    if (!watched) return false;
    setCurrentTable(watched);
    pushFeed({ kind: 'table_watch', severity: 'info', message: t('arcade.runtime.watchingRoomFeed', { tableId }) });
    void runtime.sendCommand<ArcadeLobbyState>('arcade_lobby').then(setLobby).catch(() => {});
    return true;
  };

  const leaveArcadeTable = async (): Promise<boolean> => {
    const place = lobby?.yourLocation.place ?? 'lobby';
    if (place === 'table' || place === 'disconnected') {
      const result = await sendArcadeCommand<{ lobby: ArcadeLobbyState }>(t('arcade.runtime.leaveTableLabel'), 'arcade_leave_table');
      if (!result) return false;
      setLobby(result.lobby);
      setCurrentTable(null);
      pushFeed({ kind: 'table_leave', severity: 'info', message: t('arcade.runtime.returnedToLobbyFeed') });
      return true;
    }

    if (place === 'watching') {
      const result = await sendArcadeCommand<{ lobby: ArcadeLobbyState }>(t('arcade.runtime.unwatchTableLabel'), 'arcade_unwatch_table');
      if (!result) return false;
      setLobby(result.lobby);
      setCurrentTable(null);
      pushFeed({ kind: 'table_unwatch', severity: 'info', message: t('arcade.runtime.stoppedWatchingFeed') });
      return true;
    }

    return true;
  };

  const claimChips = async (): Promise<boolean> => {
    const result = await sendArcadeCommand<{ wallet: ArcadeLobbyState['wallet'] }>(t('arcade.runtime.claimChipsLabel'), 'arcade_claim_chips');
    if (!result) return false;
    setLobby((prev) => prev ? { ...prev, wallet: result.wallet ?? null } : prev);
    setSuccessText(t('arcade.runtime.chipsClaimed'));
    pushFeed({ kind: 'wallet_claim', severity: 'success', message: t('arcade.runtime.reliefClaimedFeed') });
    await syncArcade(currentTable?.table.tableId ?? preferredTableId ?? null);
    return true;
  };

  const runGameAction = async (type: string, params?: Record<string, unknown>): Promise<boolean> => {
    if (!currentTable) return false;
    const action: Record<string, unknown> = { type, ...(params ?? {}) };

    const result = await sendArcadeCommand<ArcadeActionResult>(
      formatActionLabel(type),
      'arcade_game_action',
      { tableId: currentTable.table.tableId, action },
    );
    if (!result) return false;
    setSuccessText(result.message ?? t('arcade.runtime.actionSubmitted', { label: formatActionLabel(type) }));
    if (result.message) {
      pushFeed({
        kind: 'action_result',
        severity: 'success',
        message: result.message,
      });
    }
    void loadTableSnapshot(currentTable.table.tableId, currentAgentId).catch(() => {});
    return true;
  };

  const kickPlayer = async (targetAgentId: string): Promise<boolean> => {
    if (!currentTable) return false;
    const result = await sendArcadeCommand<{ table: ArcadeTableState }>(t('arcade.runtime.kickPlayerLabel'), 'arcade_kick_player', {
      targetAgentId,
    });
    if (!result) return false;
    setCurrentTable(result.table);
    setSuccessText(t('arcade.runtime.playerRemoved'));
    pushFeed({ kind: 'table_kick', severity: 'warning', message: t('arcade.runtime.playerRemovedFeed', { agentId: targetAgentId }) });
    return true;
  };

  const closeCurrentTable = async (): Promise<boolean> => {
    if (!currentTable) return false;
    if (!window.confirm(t('arcade.runtime.closeTableConfirm'))) return false;
    const result = await sendArcadeCommand<{ lobby: ArcadeLobbyState }>(t('arcade.runtime.closeTableLabel'), 'arcade_close_table', {
      tableId: currentTable.table.tableId,
    });
    if (!result) return false;
    setLobby(result.lobby);
    setCurrentTable(null);
    setSuccessText(t('arcade.runtime.tableClosed'));
    pushFeed({ kind: 'table_closed', severity: 'warning', message: t('arcade.runtime.tableClosedFeed', { tableName: currentTable.table.name }) });
    return true;
  };

  const exitArcadeToLobby = async (): Promise<void> => {
    const place = lobby?.yourLocation.place ?? 'lobby';
    if (place !== 'lobby' && !window.confirm(t('arcade.runtime.leaveBeforeLobbyConfirm'))) {
      throw new ArcadeUserCancelledError();
    }

    if (place !== 'lobby') {
      const left = await leaveArcadeTable();
      if (!left) {
        throw new Error(t('arcade.runtime.leaveTableFailed'));
      }
    }

    if (runtime.currentLocation === ARCADE_LOCATION_ID) {
      await runtime.leaveLocation();
    }
    if (runtime.inCity) {
      await runtime.leaveCity();
    }
  };

  useEffect(() => {
    autoBootRef.current = '';
    setLobby(null);
    setCurrentTable(null);
    setStats([]);
    setLeaderboard({});
    setErrorText('');
    setSuccessText('');
    setLocalFeed([]);
    setInitialSyncDone(false);
  }, [shadowAgent?.id]);

  useEffect(() => {
    if (!shadowAgent) return;
    if (autoBootRef.current === shadowAgent.id) return;
    autoBootRef.current = shadowAgent.id;
    void refreshArcade(preferredTableId ?? null);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shadowAgent?.id, preferredTableId]);

  useEffect(() => {
    if (!lobby) return undefined;
    if (lobby.yourLocation.place === 'lobby') return undefined;

    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [lobby]);

  useEffect(() => {
    const unsubscribers = [
      runtime.subscribe('arcade_welcome', (payload) => {
        const next = payload as ArcadeWelcomePayload;
        if (next.lobby) setLobby(next.lobby);
        if (next.currentTableId) {
          void loadTableSnapshot(next.currentTableId, currentAgentId).catch(() => {});
        }
        pushFeed({ kind: 'welcome', severity: 'info', message: next.message ?? t('arcade.runtime.welcome') });
      }),
      runtime.subscribe('arcade_reconnected', (payload) => {
        const next = payload as ArcadeReconnectedPayload;
        setLobby(next.lobby);
        pushFeed({ kind: 'reconnected', severity: 'success', message: t('arcade.runtime.restored') });
        if (next.currentTableId) {
          void loadTableSnapshot(next.currentTableId, currentAgentId).catch(() => {});
        }
      }),
      runtime.subscribe('arcade_table_event', (payload) => {
        const next = payload as ArcadeTableEventPayload;
        pushFeed(toTimelineEvent(next.change, `event-${next.seq}`));
        setCurrentTable((prev) => (
          prev && prev.table.tableId === next.tableId
            ? { ...prev, seq: next.seq, snapshotVersion: next.snapshotVersion, state: next.state }
            : prev
        ));
        if (!currentTable || currentTable.table.tableId !== next.tableId) {
          void runtime.sendCommand<ArcadeLobbyState>('arcade_lobby').then(setLobby).catch(() => {});
        }
      }),
      runtime.subscribe('arcade_table_closed', (payload) => {
        const next = payload as ArcadeTableClosedPayload;
        setLobby(next.lobby);
        setCurrentTable(null);
        pushFeed({ kind: 'table_closed', severity: 'warning', message: t('arcade.runtime.tableClosedReason', { reason: next.reason }) });
      }),
    ];

    return () => {
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [runtime, selectedGameId, preferredTableId]);

  return {
    selectedAgent: shadowAgent,
    runtime,
    lobby,
    currentTable,
    stats,
    leaderboard,
    selectedLeaderboard,
    selectedStats,
    currentAgentId,
    currentSeat,
    availableGames,
    selectedGame,
    selectedGameId,
    setSelectedGameId,
    tableSummaries,
    currentPlace,
    currentTableId,
    canClaimChips,
    isCurrentHost,
    initialSyncDone,
    busyAction,
    errorText,
    setErrorText,
    successText,
    setSuccessText,
    newTableName,
    setNewTableName,
    feed,
    refreshArcade,
    createTableAndJoin,
    joinTable,
    watchTable,
    leaveArcadeTable,
    claimChips,
    runGameAction,
    kickPlayer,
    closeCurrentTable,
    exitArcadeToLobby,
  };
}
