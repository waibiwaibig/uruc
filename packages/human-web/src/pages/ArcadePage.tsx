import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import {
  ArrowLeft,
  DoorOpen,
  Eye,
  Gamepad2,
  Lock,
  Plus,
  Crown,
  Landmark,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
} from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { ArcadeStatusToasts } from '../components/ArcadeStatusToasts';
import {
  arcadeTableHref,
  formatLocation,
  getGameTagline,
  isArcadeUserCancelledError,
  playerOccupancy,
  useArcadeClient,
} from '../lib/arcade';
import { formatArcadeEventTime, timelineFallbackMessage } from '../lib/arcade-feedback';
import i18n from '../i18n';
import { useTranslation } from 'react-i18next';

type CabinetScreen = 'games' | 'wallet' | 'records' | 'leaderboard';
type RoomFilter = 'public' | 'mine' | 'watching';

type GameSkin = {
  accent: string;
  accentSoft: string;
  panelGlow: string;
  slogan: string;
};

const GAME_DISPLAY_REGISTRY: Record<string, GameSkin> = {
  blackjack: {
    accent: '#ffca6b',
    accentSoft: 'rgba(255, 202, 107, 0.20)',
    panelGlow: 'rgba(255, 202, 107, 0.14)',
    slogan: i18n.t('play:arcade.taglines.blackjack'),
  },
  gomoku: {
    accent: '#e2884f',
    accentSoft: 'rgba(226, 136, 79, 0.18)',
    panelGlow: 'rgba(226, 136, 79, 0.14)',
    slogan: i18n.t('play:arcade.taglines.gomoku'),
  },
  'love-letter': {
    accent: '#ff7ab9',
    accentSoft: 'rgba(255, 122, 185, 0.18)',
    panelGlow: 'rgba(255, 122, 185, 0.14)',
    slogan: i18n.t('play:arcade.taglines.loveLetter'),
  },
  'texas-holdem': {
    accent: '#72ebff',
    accentSoft: 'rgba(114, 235, 255, 0.20)',
    panelGlow: 'rgba(114, 235, 255, 0.14)',
    slogan: i18n.t('play:arcade.taglines.texasHoldem'),
  },
  uno: {
    accent: '#79d55a',
    accentSoft: 'rgba(121, 213, 90, 0.18)',
    panelGlow: 'rgba(121, 213, 90, 0.14)',
    slogan: i18n.t('play:arcade.taglines.uno'),
  },
  xiangqi: {
    accent: '#d06a4f',
    accentSoft: 'rgba(208, 106, 79, 0.18)',
    panelGlow: 'rgba(208, 106, 79, 0.14)',
    slogan: i18n.t('play:arcade.taglines.xiangqi'),
  },
};

function resolveSkin(gameId: string | undefined): GameSkin {
  if (!gameId) {
    return {
      accent: '#72ebff',
      accentSoft: 'rgba(114, 235, 255, 0.18)',
      panelGlow: 'rgba(114, 235, 255, 0.12)',
      slogan: i18n.t('play:arcade.taglines.waitingCatalog'),
    };
  }

  return GAME_DISPLAY_REGISTRY[gameId] ?? {
    accent: '#ff72d8',
    accentSoft: 'rgba(255, 114, 216, 0.18)',
    panelGlow: 'rgba(255, 114, 216, 0.14)',
    slogan: i18n.t('play:arcade.taglines.loaded'),
  };
}

function ownerLabel(
  table: {
    createdBy: string | null;
    playerNames: Record<string, string>;
  },
  currentAgentId: string | null,
  selectedAgentName: string,
): string {
  if (!table.createdBy) return i18n.t('play:arcade.ownership.unspecified');
  if (table.createdBy === currentAgentId) return i18n.t('play:arcade.ownership.you', { name: selectedAgentName });
  return table.playerNames[table.createdBy] ?? table.createdBy;
}

function statusLabel(status: string): string {
  return status === 'waiting' ? i18n.t('play:arcade.runtime.waitingStatus') : i18n.t('play:arcade.runtime.liveStatus');
}

function runtimeStatusLabel(status: string): string {
  switch (status) {
    case 'connecting':
      return i18n.t('runtime:wsStatus.connecting');
    case 'authenticating':
      return i18n.t('runtime:wsStatus.authenticating');
    case 'syncing':
      return i18n.t('runtime:wsStatus.syncing');
    case 'reconnecting':
      return i18n.t('runtime:wsStatus.reconnecting');
    case 'connected':
      return i18n.t('runtime:wsStatus.connected');
    case 'error':
      return i18n.t('runtime:wsStatus.error');
    case 'closed':
      return i18n.t('runtime:wsStatus.closed');
    default:
      return i18n.t('runtime:wsStatus.idle');
  }
}

function capabilityList(game: NonNullable<ReturnType<typeof useArcadeClient>['availableGames'][number]> | null): string[] {
  if (!game) return [];

  const caps = game.catalog.capabilities;
  const items = [i18n.t('play:arcade.capabilities.players', { min: game.catalog.minPlayers, max: game.catalog.maxPlayers })];
  if (caps.spectators) items.push(i18n.t('play:arcade.capabilities.spectators'));
  if (caps.reconnect) items.push(i18n.t('play:arcade.capabilities.reconnect'));
  if (caps.midGameJoin) items.push(i18n.t('play:arcade.capabilities.midGameJoin'));
  return items;
}

function recordsSummary(stats: ReturnType<typeof useArcadeClient>['selectedStats']) {
  if (!stats) {
    return {
      gamesPlayed: 0,
      record: '0 / 0 / 0',
      totalWagered: 0,
      totalWon: 0,
    };
  }

  return {
    gamesPlayed: stats.gamesPlayed,
    record: `${stats.wins} / ${stats.losses} / ${stats.draws}`,
    totalWagered: stats.totalWagered,
    totalWon: stats.totalWon,
  };
}

export function ArcadePage() {
  const { t } = useTranslation('play');
  const navigate = useNavigate();
  const [cabinetScreen, setCabinetScreen] = useState<CabinetScreen>('games');
  const [roomFilter, setRoomFilter] = useState<RoomFilter>('public');
  const [isPrivateRoom, setIsPrivateRoom] = useState(false);
  const [showCreatePanel, setShowCreatePanel] = useState(false);
  const {
    selectedAgent,
    runtime,
    lobby,
    stats,
    leaderboard,
    availableGames,
    selectedGameId,
    setSelectedGameId,
    tableSummaries,
    currentPlace,
    currentTableId,
    currentAgentId,
    canClaimChips,
    initialSyncDone,
    busyAction,
    errorText,
    setErrorText,
    newTableName,
    setNewTableName,
    feed,
    refreshArcade,
    createTableAndJoin,
    joinTable,
    watchTable,
    claimChips,
    exitArcadeToLobby,
  } = useArcadeClient();

  useEffect(() => {
    if (!availableGames.length) return;
    if (!availableGames.some((game) => game.id === selectedGameId)) {
      setSelectedGameId(availableGames[0].id);
    }
  }, [availableGames, selectedGameId, setSelectedGameId]);

  useEffect(() => {
    if (!initialSyncDone) return;
    if (currentPlace !== 'lobby' && currentTableId) {
      navigate(arcadeTableHref(currentTableId), { replace: true });
    }
  }, [initialSyncDone, currentPlace, currentTableId, navigate]);

  const selectedGame = useMemo(
    () => availableGames.find((game) => game.id === selectedGameId) ?? availableGames[0] ?? null,
    [availableGames, selectedGameId],
  );
  const selectedStats = useMemo(
    () => stats.find((item) => item.gameId === selectedGame?.id) ?? null,
    [selectedGame?.id, stats],
  );
  const selectedLeaderboard = useMemo(
    () => leaderboard[selectedGame?.id ?? ''] ?? [],
    [leaderboard, selectedGame?.id],
  );
  const selectedGameTables = useMemo(
    () => tableSummaries.filter((table) => table.gameId === selectedGame?.id),
    [selectedGame?.id, tableSummaries],
  );
  const filteredTables = useMemo(() => {
    if (!selectedGame) return [];
    switch (roomFilter) {
      case 'mine':
        return selectedGameTables.filter((table) => (
          table.createdBy === currentAgentId || table.players.includes(currentAgentId ?? '')
        ));
      case 'watching':
        return selectedGameTables.filter((table) => table.spectators.includes(currentAgentId ?? ''));
      default:
        return selectedGameTables.filter((table) => !table.isPrivate);
    }
  }, [currentAgentId, roomFilter, selectedGame, selectedGameTables]);
  const skin = resolveSkin(selectedGame?.id);
  const summary = recordsSummary(selectedStats);
  const hallStyle = useMemo<CSSProperties>(() => ({
    '--arcade-game-accent': skin.accent,
    '--arcade-game-accent-soft': skin.accentSoft,
    '--arcade-game-glow': skin.panelGlow,
  } as CSSProperties), [skin]);
  const systemToasts = useMemo(() => [
    ...(errorText ? [{
      id: `arcade-local-error:${errorText}`,
      tone: 'error' as const,
      title: t('arcade.runtime.actionFailed'),
      body: errorText,
      durationMs: 6000,
      onDismiss: () => setErrorText(''),
    }] : []),
    ...(runtime.error ? [{
      id: `arcade-runtime-error:${runtime.error}`,
      tone: 'warning' as const,
      title: runtimeStatusLabel(runtime.status),
      body: runtime.error,
    }] : []),
  ], [errorText, runtime.error, runtime.status, setErrorText, t]);

  const createRoom = async () => {
    const tableId = await createTableAndJoin({
      gameId: selectedGame?.id,
      isPrivate: isPrivateRoom,
    });
    if (!tableId) return;
    setShowCreatePanel(false);
    navigate(arcadeTableHref(tableId));
  };

  const enterTable = async (tableId: string) => {
    const joined = await joinTable(tableId);
    if (!joined) return;
    navigate(arcadeTableHref(tableId));
  };

  const enterWatch = async (tableId: string) => {
    const watched = await watchTable(tableId);
    if (!watched) return;
    navigate(arcadeTableHref(tableId));
  };

  const goBackToLobby = async () => {
    try {
      await exitArcadeToLobby();
      navigate('/lobby');
    } catch (error) {
      if (isArcadeUserCancelledError(error)) return;
      setErrorText(error instanceof Error ? error.message : t('errors:fallback.requestFailed', { status: 500 }));
    }
  };

  if (!selectedAgent) {
    return (
      <div className="page-wrap main-grid">
        <section className="card game-stage game-stage--empty">
          <div className="stack-md content-narrow">
            <p className="kicker">arcade runtime</p>
            <h1 className="section-title">{t('arcade.runtime.noAgentTitle')}</h1>
            <p className="section-sub">{t('arcade.runtime.noAgentBody')}</p>
            <div className="utility-links">
              <Link className="app-btn" to="/lobby"><ArrowLeft size={14} /> {t('arcade.runtime.backToLobby')}</Link>
              <Link className="app-btn secondary" to="/agents"><Gamepad2 size={14} /> {t('common:actions.goToAgentCenter')}</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-wrap arcade-hub">
      <div className="arcade-hub__backdrop" aria-hidden="true" />

      <header className="arcade-mergebar">
        <div className="arcade-mergebar__brand">
          <span className="brand-mark brand-mark--compact arcade-mergebar__mark" />
          <div className="arcade-mergebar__copy">
            <strong>{`URUC / ${t('arcade.runtime.hallTitle')}`}</strong>
            <span>{runtime.isController ? t('arcade.runtime.controllerHint') : t('arcade.runtime.observerHint')}</span>
          </div>
        </div>

        <div className="arcade-mergebar__status">
          <span className="arcade-mergebar__pill"><Landmark size={12} /> {runtimeStatusLabel(runtime.status)}</span>
          <span className="arcade-mergebar__pill"><ShieldCheck size={12} /> {runtime.isController ? t('arcade.runtime.controlClaimed') : runtime.hasController ? t('arcade.runtime.controlElsewhere') : t('arcade.runtime.controlIdle')}</span>
          {selectedAgent ? <span className="arcade-mergebar__pill"><Crown size={12} /> {selectedAgent.name}</span> : null}
          <span className="arcade-mergebar__pill">{t('arcade.runtime.balance', { value: lobby?.wallet?.balance ?? '--' })}</span>
          <span className="arcade-mergebar__pill">{t('arcade.runtime.location', { value: formatLocation(currentPlace) })}</span>
          <span className="arcade-mergebar__pill">{t('arcade.runtime.roomCount', { count: tableSummaries.length })}</span>
        </div>

        <div className="arcade-mergebar__actions">
          <button className="arcade-mergebar__btn" disabled={!!busyAction} onClick={() => navigate('/play')}>
            <ArrowLeft size={16} /> {t('arcade.runtime.cityMap')}
          </button>
          <button className="arcade-mergebar__btn" disabled={!!busyAction} onClick={() => void goBackToLobby()}>
            <DoorOpen size={16} /> {t('arcade.runtime.backToLobby')}
          </button>
          <button className="arcade-mergebar__btn arcade-mergebar__btn--accent" disabled={!!busyAction} onClick={() => void refreshArcade()}>
            <RefreshCw size={16} /> {t('arcade.runtime.refreshHost')}
          </button>
        </div>
      </header>

      <ArcadeStatusToasts items={systemToasts} />

      <section className="arcade-cabinet-hall" style={hallStyle}>
        {/* ── Left: Arcade Cabinet ── */}
        <section className="arcade-cabinet-pane">
          <div className="arcade-machine arcade-machine--hall arcade-handheld-shell">
            <div className="arcade-machine__lightbar" />

            <div className="arcade-handheld">
              <div className="arcade-handheld__display-frame">
                <div className="arcade-handheld__statusbar">
                  <span>URUC-ARCADE</span>
                  <span>{cabinetScreen.toUpperCase()}</span>
                </div>

                <div className="arcade-handheld__display">
                  <div className="arcade-handheld__screen-head">
                    <div>
                      <span className="arcade-handheld__screen-kicker">{cabinetScreen === 'games' ? t('arcade.runtime.gameSelect') : selectedGame?.catalog.name ?? t('arcade.runtime.arcadeStatus')}</span>
                      <strong className="arcade-handheld__screen-title">
                        {cabinetScreen === 'games' ? t('arcade.runtime.gamesTab') : cabinetScreen === 'wallet' ? t('arcade.runtime.walletTab') : cabinetScreen === 'records' ? t('arcade.runtime.recordsTab') : t('arcade.runtime.leaderboardTab')}
                      </strong>
                    </div>
                    <span className="arcade-handheld__screen-tag">
                      {t('arcade.runtime.defaultGame', { name: selectedGame?.catalog.name ?? t('arcade.runtime.unselected') })}
                    </span>
                  </div>

                  <div className="arcade-handheld__display-body">
                    {/* Games screen */}
                    {cabinetScreen === 'games' ? (
                      <>
                        <div className="arcade-handheld__list">
                          {availableGames.length ? (
                            availableGames.map((game, index) => {
                              const counts = tableSummaries.filter((table) => table.gameId === game.id && !table.isPrivate).length;
                              return (
                                <button
                                  key={game.id}
                                  className={`arcade-handheld__list-row ${selectedGame?.id === game.id ? 'is-selected' : ''}`}
                                  type="button"
                                  onClick={() => setSelectedGameId(game.id)}
                                >
                                  <span>{String(index + 1).padStart(2, '0')}</span>
                                  <strong>{game.catalog.name}</strong>
                                  <em>{t('arcade.runtime.roomsCount', { count: counts })}</em>
                                </button>
                              );
                            })
                          ) : (
                            <div className="arcade-handheld__empty">{t('arcade.runtime.waitingForGames')}</div>
                          )}
                        </div>

                        <div className="arcade-handheld__detail">
                          <div className="arcade-handheld__pixel-title">{selectedGame?.catalog.name ?? t('arcade.runtime.noGameLabel')}</div>
                          <p>{selectedGame?.catalog.description ?? t('arcade.runtime.waitingCatalog')}</p>
                          <div className="arcade-handheld__caps">
                            {capabilityList(selectedGame).map((item) => <span key={item}>{item}</span>)}
                          </div>
                          <div className="arcade-handheld__slogan">{selectedGame ? getGameTagline(selectedGame.id) : t('arcade.runtime.waitingSelection')}</div>
                        </div>
                      </>
                    ) : null}

                    {/* Wallet screen */}
                    {cabinetScreen === 'wallet' ? (
                      <div className="arcade-handheld__info-stack">
                        <div className="arcade-handheld__statline"><span>{t('arcade.runtime.chipsLabel')}</span><strong>{lobby?.wallet?.balance ?? '--'}</strong></div>
                        <div className="arcade-handheld__statline"><span>{t('arcade.runtime.frozenLabel')}</span><strong>{lobby?.wallet?.frozen ?? '--'}</strong></div>
                        <div className="arcade-handheld__statline"><span>{t('arcade.runtime.gameLabel')}</span><strong>{selectedGame?.catalog.name ?? '--'}</strong></div>
                        <div className="arcade-handheld__statline"><span>{t('arcade.runtime.placeLabel')}</span><strong>{formatLocation(currentPlace)}</strong></div>
                        {canClaimChips ? (
                          <button className="arcade-handheld__screen-action" disabled={!!busyAction} onClick={() => void claimChips()}>
                            {t('arcade.runtime.claimChips')}
                          </button>
                        ) : (
                          <div className="arcade-handheld__hint">{t('arcade.runtime.claimHint')}</div>
                        )}
                      </div>
                    ) : null}

                    {/* Records screen */}
                    {cabinetScreen === 'records' ? (
                      <div className="arcade-handheld__info-stack">
                        <div className="arcade-handheld__statline"><span>GAMES</span><strong>{summary.gamesPlayed}</strong></div>
                        <div className="arcade-handheld__statline"><span>W/L/D</span><strong>{summary.record}</strong></div>
                        <div className="arcade-handheld__statline"><span>WAGERED</span><strong>{summary.totalWagered}</strong></div>
                        <div className="arcade-handheld__statline"><span>WON</span><strong>{summary.totalWon}</strong></div>
                        <div className="arcade-handheld__feed">
                          {feed.length ? feed.slice(0, 5).map((event) => (
                            <div key={event.id} className="arcade-handheld__feedline">
                              <strong>{formatArcadeEventTime(event.createdAt)}</strong> {timelineFallbackMessage(event)}
                            </div>
                          )) : <div className="arcade-handheld__hint">{t('arcade.runtime.noRecentFeed')}</div>}
                        </div>
                      </div>
                    ) : null}

                    {/* Leaderboard screen */}
                    {cabinetScreen === 'leaderboard' ? (
                      <div className="arcade-handheld__leaderboard">
                        {selectedLeaderboard.length ? (
                          selectedLeaderboard.map((entry, index) => (
                            <div key={`${entry.agentId}-${index}`} className="arcade-handheld__rankline">
                              <span>{String(index + 1).padStart(2, '0')}</span>
                              <strong>{entry.agentId === currentAgentId ? t('arcade.ownership.you', { name: selectedAgent.name }) : entry.agentId}</strong>
                              <em>{entry.score}</em>
                            </div>
                          ))
                        ) : (
                          <div className="arcade-handheld__hint">{t('arcade.runtime.noLeaderboard')}</div>
                        )}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

              <div className="arcade-handheld__controls">
                <div className="arcade-handheld__buttons">
                  <button className={`arcade-handheld__button ${cabinetScreen === 'games' ? 'is-active' : ''}`} type="button" onClick={() => setCabinetScreen('games')}>
                    <span>{t('arcade.runtime.gamesTab')}</span>
                  </button>
                  <button className={`arcade-handheld__button ${cabinetScreen === 'wallet' ? 'is-active' : ''}`} type="button" onClick={() => setCabinetScreen('wallet')}>
                    <span>{t('arcade.runtime.walletTab')}</span>
                  </button>
                  <button className={`arcade-handheld__button ${cabinetScreen === 'records' ? 'is-active' : ''}`} type="button" onClick={() => setCabinetScreen('records')}>
                    <span>{t('arcade.runtime.recordsTab')}</span>
                  </button>
                  <button className={`arcade-handheld__button ${cabinetScreen === 'leaderboard' ? 'is-active' : ''}`} type="button" onClick={() => setCabinetScreen('leaderboard')}>
                    <span>{t('arcade.runtime.leaderboardTab')}</span>
                  </button>
                </div>

                <div className="arcade-handheld__gripbar" aria-hidden="true">
                  <span />
                  <span />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Right: Room Manager ── */}
        <section className="arcade-room-pane">
          <header className="arcade-room-pane__head">
            <div className="arcade-room-pane__title">
              <span className="arcade-kicker"><Users size={14} /> {t('arcade.runtime.roomManager')}</span>
              <h2>{selectedGame?.catalog.name ?? t('arcade.runtime.noCatalogTitle')}</h2>
              <p>{selectedGame?.catalog.description ?? t('arcade.runtime.noCatalogBody')}</p>
            </div>

            <div className="arcade-room-pane__actions">
              <button className="arcade-room-pane__add" type="button" disabled={!!busyAction || !selectedGame} onClick={() => setShowCreatePanel((current) => !current)}>
                <Plus size={18} /> {t('arcade.runtime.createRoom')}
              </button>
              {currentTableId ? (
                <button className="arcade-ghost" type="button" onClick={() => navigate(arcadeTableHref(currentTableId))}>
                  <Gamepad2 size={16} /> {t('arcade.runtime.returnCurrentRoom')}
                </button>
              ) : null}
            </div>
          </header>

          <div className="arcade-room-pane__filters" role="tablist" aria-label={t('arcade.runtime.roomFilterLabel')}>
            <button className={`arcade-room-filter ${roomFilter === 'public' ? 'is-active' : ''}`} type="button" onClick={() => setRoomFilter('public')}>
              {t('arcade.runtime.publicRooms')}
            </button>
            <button className={`arcade-room-filter ${roomFilter === 'mine' ? 'is-active' : ''}`} type="button" onClick={() => setRoomFilter('mine')}>
              {t('arcade.runtime.myRooms')}
            </button>
            <button className={`arcade-room-filter ${roomFilter === 'watching' ? 'is-active' : ''}`} type="button" onClick={() => setRoomFilter('watching')}>
              {t('arcade.runtime.watchingRooms')}
            </button>
          </div>

          <div className="arcade-room-pane__body">
            {showCreatePanel ? (
              <div className="arcade-room-pane__overlay" role="dialog" aria-modal="true" aria-label={t('arcade.runtime.createRoomDialog')}>
                <section className="arcade-room-pane__create">
                  <div className="arcade-room-pane__create-head">
                    <div>
                      <span className="arcade-kicker"><Sparkles size={14} /> {t('arcade.runtime.roomForge')}</span>
                      <h3>{t('arcade.runtime.createRoomTitle', { name: selectedGame?.catalog.name ?? t('arcade.runtime.createRoomFallback') })}</h3>
                    </div>
                    <button className="arcade-close" type="button" onClick={() => setShowCreatePanel(false)}>
                      ×
                    </button>
                  </div>

                  <input
                    className="arcade-lobby-input"
                    placeholder={selectedGame ? t('arcade.runtime.roomNamePlaceholder', { name: selectedGame.catalog.name }) : t('arcade.runtime.noMachineAvailable')}
                    value={newTableName}
                    disabled={!selectedGame}
                    onChange={(event) => setNewTableName(event.target.value)}
                  />

                  <label className={`arcade-toggle ${isPrivateRoom ? 'is-active' : ''}`}>
                    <input
                      type="checkbox"
                      checked={isPrivateRoom}
                      onChange={(event) => setIsPrivateRoom(event.target.checked)}
                    />
                    <span className="arcade-toggle__icon">{isPrivateRoom ? <Lock size={15} /> : <Users size={15} />}</span>
                    <span>{isPrivateRoom ? t('arcade.runtime.createPrivateRoom') : t('arcade.runtime.createPublicRoom')}</span>
                  </label>

                  <button className="arcade-cta arcade-cta--wide" disabled={!!busyAction || !selectedGame} onClick={() => void createRoom()}>
                    <Gamepad2 size={18} /> {t('arcade.runtime.createAndEnterRoom')}
                  </button>
                </section>
              </div>
            ) : null}

            <div className="arcade-room-pane__list">
              {filteredTables.length ? (
                filteredTables.map((table) => {
                  const alreadyHere = currentTableId === table.tableId;
                  const roomOwner = ownerLabel(table, currentAgentId, selectedAgent.name);
                  return (
                    <article key={table.tableId} className={`arcade-room-card ${alreadyHere ? 'is-current' : ''}`}>
                      <div className="arcade-room-card__head">
                        <div>
                          <strong>{table.name}</strong>
                          <p>{table.gameName} · {statusLabel(table.status)}</p>
                        </div>
                        <span className={`arcade-room-badge ${table.status === 'waiting' ? 'is-waiting' : 'is-live'}`}>
                          {statusLabel(table.status)}
                        </span>
                      </div>

                      <div className="arcade-room-card__meta">
                        <span><Users size={14} /> {playerOccupancy(table)}</span>
                        <span><Eye size={14} /> {t('arcade.runtime.spectators', { count: table.spectators.length })}</span>
                        <span><Ticket size={14} /> {t('arcade.runtime.owner', { name: roomOwner })}</span>
                      </div>

                      <div className="arcade-room-card__actions">
                        <button
                          className={alreadyHere ? 'arcade-cta' : 'arcade-ghost'}
                          type="button"
                          disabled={!!busyAction}
                          onClick={() => void (alreadyHere ? navigate(arcadeTableHref(table.tableId)) : enterTable(table.tableId))}
                        >
                          {alreadyHere ? t('arcade.runtime.returnRoom') : t('arcade.runtime.enterRoom')}
                        </button>
                        <button className="arcade-ghost" type="button" disabled={!!busyAction || alreadyHere} onClick={() => void enterWatch(table.tableId)}>
                          {t('arcade.runtime.spectate')}
                        </button>
                        {table.isPrivate ? <span className="arcade-room-card__privacy"><Lock size={13} /> {t('arcade.runtime.privateRoom')}</span> : null}
                      </div>
                    </article>
                  );
                })
              ) : (
                <div className="arcade-room-empty">
                  <strong>{roomFilter === 'public' ? t('arcade.runtime.noPublicRooms') : roomFilter === 'mine' ? t('arcade.runtime.noMineRooms') : t('arcade.runtime.noWatchingRooms')}</strong>
                  <p>{selectedGame ? t('arcade.runtime.emptyRoomsWithGame', { name: selectedGame.catalog.name }) : t('arcade.runtime.emptyRoomsNoGame')}</p>
                  <button className="arcade-cta" type="button" disabled={!!busyAction || !selectedGame} onClick={() => setShowCreatePanel(true)}>
                    <Plus size={18} /> {t('arcade.runtime.createFirstRoom')}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>
      </section>
    </div>
  );
}
