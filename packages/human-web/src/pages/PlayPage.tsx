import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { ArrowLeft, DoorOpen, Gamepad2, Landmark, Map as MapIcon, RefreshCw, ShieldAlert, Sparkles, Swords, TowerControl } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useAgents } from '../context/AgentsContext';
import { useAgentRuntime } from '../context/AgentRuntimeContext';
import type { LocationDef } from '../lib/types';
import { WsCommandError } from '../lib/ws';

const PENDING_STATUSES = new Set(['connecting', 'authenticating', 'syncing', 'reconnecting']);
const LOCATION_ROUTE_MAP: Record<string, string> = {
  arcade: '/play/arcade',
  'chess-club': '/play/chess',
};

type Blueprint = {
  id: string;
  name: string;
  shortLabel: string;
  description: string;
  x: number;
  y: number;
  icon: typeof Swords;
  route?: string;
  accent: string;
};

type Destination = Blueprint & {
  available: boolean;
  source: LocationDef | null;
  isActive: boolean;
};

function buildLocationBlueprints(t: (key: string) => string): Record<string, Blueprint> {
  return {
    'chess-club': {
      id: 'chess-club',
      name: t('play:playPage.builtinChess'),
      shortLabel: t('play:playPage.builtinChessShort'),
      description: t('play:playPage.builtinChessDesc'),
      x: 20,
      y: 28,
      icon: Swords,
      route: '/play/chess',
      accent: 'var(--city-node-royal)',
    },
    arcade: {
      id: 'arcade',
      name: t('play:playPage.builtinArcade'),
      shortLabel: t('play:playPage.builtinArcadeShort'),
      description: t('play:playPage.builtinArcadeDesc'),
      x: 50,
      y: 72,
      icon: Gamepad2,
      route: '/play/arcade',
      accent: 'var(--city-node-neon)',
    },
  };
}

function statusLabel(t: (key: string) => string, status: string): string {
  switch (status) {
    case 'connecting':
      return t('runtime:wsStatus.connecting');
    case 'authenticating':
      return t('runtime:wsStatus.authenticating');
    case 'syncing':
      return t('runtime:wsStatus.syncing');
    case 'reconnecting':
      return t('runtime:wsStatus.reconnecting');
    case 'connected':
      return t('runtime:wsStatus.connected');
    case 'error':
      return t('runtime:wsStatus.error');
    case 'closed':
      return t('runtime:wsStatus.closed');
    default:
      return t('runtime:wsStatus.idle');
  }
}

function fallbackNode(index: number, total: number): Pick<Blueprint, 'x' | 'y' | 'icon' | 'accent'> {
  const base = Math.max(total, 1);
  const angle = (Math.PI * 2 * index) / base - Math.PI / 2;
  const radiusX = 26;
  const radiusY = 18;
  return {
    x: 50 + Math.cos(angle) * radiusX,
    y: 46 + Math.sin(angle) * radiusY,
    icon: Landmark,
    accent: 'var(--city-node-future)',
  };
}

function buildDestinations(
  locations: LocationDef[],
  currentLocation: string | null,
  locationBlueprints: Record<string, Blueprint>,
  t: (key: string) => string,
): Destination[] {
  const availableById = new Map(locations.map((location) => [location.id, location]));
  const ids = Array.from(new Set([...Object.keys(locationBlueprints), ...locations.map((location) => location.id)]));

  return ids.map((id, index) => {
    const source = availableById.get(id) ?? null;
    const blueprint = locationBlueprints[id];
    const fallback = fallbackNode(index, ids.length);

    return {
      id,
      name: source?.name ?? blueprint?.name ?? id,
      shortLabel: blueprint?.shortLabel ?? source?.name ?? id,
      description: source?.description ?? blueprint?.description ?? t('play:playPage.unavailableDescription'),
      x: blueprint?.x ?? fallback.x,
      y: blueprint?.y ?? fallback.y,
      icon: blueprint?.icon ?? fallback.icon,
      route: blueprint?.route ?? LOCATION_ROUTE_MAP[id],
      accent: blueprint?.accent ?? fallback.accent,
      available: availableById.has(id),
      source,
      isActive: currentLocation === id,
    };
  });
}

function buildRoads(destinations: Destination[]) {
  const coreDestinationIds = new Set(['chess-club', 'arcade']);
  const knownRoads = [
    ['chess-club', 'arcade'],
  ];
  const byId = new Map(destinations.map((destination) => [destination.id, destination]));
  const roads: Array<{ id: string; from: Destination; to: Destination }> = [];

  for (const [fromId, toId] of knownRoads) {
    const from = byId.get(fromId);
    const to = byId.get(toId);
    if (from && to) roads.push({ id: `${fromId}-${toId}`, from, to });
  }

  const extras = destinations.filter((destination) => !coreDestinationIds.has(destination.id));
  extras.forEach((destination, index) => {
    const anchor = index === 0 ? byId.get('arcade') ?? destinations[0] : extras[index - 1];
    if (!anchor) return;
    roads.push({ id: `${anchor.id}-${destination.id}`, from: anchor, to: destination });
  });

  return roads;
}

function describeNode(t: (key: string) => string, destination: Destination): string {
  if (destination.available) return destination.description;
  return `${destination.shortLabel} ${t('play:playPage.unavailableDescription')}`;
}

export function PlayPage() {
  const { t } = useTranslation(['play', 'common', 'runtime', 'dashboard']);
  const { selectedAgent } = useAgents();
  const runtime = useAgentRuntime();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [busyAction, setBusyAction] = useState('');
  const [errorText, setErrorText] = useState('');
  const autoConnectAttemptRef = useRef('');
  const isPending = PENDING_STATUSES.has(runtime.status);
  const autoStart = searchParams.get('autostart') === '1';
  const locationBlueprints = useMemo(() => buildLocationBlueprints(t), [t]);

  const destinations = useMemo(
    () => buildDestinations(runtime.availableLocations, runtime.currentLocation, locationBlueprints, t),
    [locationBlueprints, runtime.availableLocations, runtime.currentLocation, t],
  );
  const roads = useMemo(() => buildRoads(destinations), [destinations]);
  const focusDestination = useMemo(
    () => destinations.find((item) => item.isActive) ?? destinations.find((item) => item.available) ?? destinations[0] ?? null,
    [destinations],
  );

  const run = async <T,>(label: string, action: () => Promise<T>): Promise<T | null> => {
    setBusyAction(label);
    setErrorText('');
    try {
      return await action();
    } catch (err) {
      setErrorText(err instanceof Error ? err.message : t('play:playPage.openFailure', { label }));
      return null;
    } finally {
      setBusyAction('');
    }
  };

  const promptTakeover = async () => {
    if (!window.confirm(t('play:playPage.takeoverConfirm'))) {
      throw new Error(t('play:playPage.noControl'));
    }
    return runtime.claimControl();
  };

  const withGameplayControl = async <T,>(action: () => Promise<T>): Promise<T> => {
    try {
      return await action();
    } catch (err) {
      if (err instanceof WsCommandError && err.code === 'CONTROLLED_ELSEWHERE') {
        await promptTakeover();
        return action();
      }
      throw err;
    }
  };

  const ensureGameplayReady = async () => {
    if (!runtime.isConnected) {
      await runtime.connect();
    }

    const snapshot = await runtime.refreshSessionState();
    if (!snapshot.isController) {
      if (snapshot.hasController && !window.confirm(t('play:playPage.enterCityTakeoverConfirm'))) {
        throw new Error(t('play:playPage.noControl'));
      }
      await runtime.claimControl();
    }

    const synced = await runtime.refreshSessionState();
    if (!synced.inCity) {
      await runtime.enterCity();
    }
    await runtime.refreshCommands();
  };

  useEffect(() => {
    autoConnectAttemptRef.current = '';
    setErrorText('');
  }, [selectedAgent?.id]);

  useEffect(() => {
    if (!selectedAgent || !autoStart) return;
    if (runtime.isConnected || isPending) return;
    if (autoConnectAttemptRef.current === selectedAgent.id) return;
    autoConnectAttemptRef.current = selectedAgent.id;
    void ensureGameplayReady().then(() => {
      setSearchParams((prev) => {
        const next = new URLSearchParams(prev);
        next.delete('autostart');
        return next;
      }, { replace: true });
    }).catch((err) => {
      setErrorText(err instanceof Error ? err.message : t('play:playPage.autoEnterFailure'));
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedAgent?.id, autoStart, runtime.isConnected, isPending]);

  useEffect(() => {
    if (!runtime.currentLocation) return undefined;
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [runtime.currentLocation]);

  const reconnect = () => run(t('play:playPage.reconnectLabel'), runtime.connect);

  const enterCity = () => run(t('play:playPage.enterCityLabel'), async () => {
    await ensureGameplayReady();
  });

  const openLocation = (locationId: string) => run(t('play:playPage.enterLocationLabel'), async () => {
    const route = LOCATION_ROUTE_MAP[locationId];
    if (route && runtime.currentLocation === locationId) {
      navigate(route);
      return;
    }

    if (!runtime.isConnected) {
      await runtime.connect();
    }
    const snapshot = await runtime.refreshSessionState();
    if (!snapshot.inCity) {
      await withGameplayControl(runtime.enterCity);
    }
    await withGameplayControl(() => runtime.enterLocation(locationId));
    await runtime.refreshCommands();

    if (route) {
      navigate(route);
    }
  });

  const leaveLocation = () => run(t('play:playPage.leaveLocationLabel'), async () => {
    if (!runtime.currentLocation) return;
    if (!window.confirm(t('play:playPage.leaveVenueConfirm'))) return;
    await withGameplayControl(runtime.leaveLocation);
    await runtime.refreshCommands();
  });

  const leaveCity = () => run(t('play:playPage.leaveCityLabel'), async () => {
    if (runtime.currentLocation && !window.confirm(t('play:playPage.leaveCityConfirm'))) return;
    if (runtime.currentLocation) {
      await withGameplayControl(runtime.leaveLocation);
    }
    await withGameplayControl(runtime.leaveCity);
  });

  const returnToLobby = () => run(t('play:playPage.returnLobbyLabel'), async () => {
    if (runtime.currentLocation && !window.confirm(t('play:playPage.returnLobbyConfirm'))) return;
    if (runtime.currentLocation) {
      await withGameplayControl(runtime.leaveLocation);
    }
    if (runtime.inCity) {
      await withGameplayControl(runtime.leaveCity);
    }
    navigate('/lobby');
  });

  if (!selectedAgent) {
    return (
      <div className="page-wrap main-grid">
        <section className="card game-stage game-stage--empty">
            <div className="stack-md content-narrow">
              <p className="kicker">game lobby mismatch</p>
            <h1 className="section-title">{t('play:playPage.emptyTitle')}</h1>
            <p className="section-sub">{t('play:playPage.emptyBody')}</p>
            <div className="utility-links">
              <Link className="app-btn" to="/lobby"><ArrowLeft size={14} /> {t('common:actions.returnToLobby')}</Link>
              <Link className="app-btn secondary" to="/agents"><TowerControl size={14} /> {t('common:actions.goToAgentCenter')}</Link>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page-wrap game-page city-play">
      <section className="city-toolbar">
        <div className="city-toolbar__identity">
          <span className="city-toolbar__title">{t('play:playPage.cityNav')}</span>
          <span className="city-toolbar__hint">{focusDestination?.shortLabel ?? runtime.currentLocation ?? t('play:playPage.outsideGate')}</span>
        </div>

        <div className="city-toolbar__status">
          <span className="status-chip status-chip--accent"><Landmark size={14} /> {statusLabel(t, runtime.status)}</span>
          <span className="status-chip">{t('dashboard:lobby.controlStatus')}: {runtime.isController ? t('play:playPage.controlCurrent') : runtime.hasController ? t('play:playPage.controlElsewhere') : t('play:playPage.controlIdle')}</span>
          <span className="status-chip">{t('play:playPage.inCity')}: {runtime.inCity ? t('play:playPage.activeYes') : t('play:playPage.activeNo')}</span>
        </div>

        <div className="city-toolbar__actions">
          {!runtime.isConnected ? (
            <button className="app-btn" disabled={!!busyAction || isPending} onClick={reconnect}>
              <span className="row"><RefreshCw size={14} /> {t('play:playPage.reconnect')}</span>
            </button>
          ) : null}

          {runtime.isConnected && !runtime.isController && runtime.hasController ? (
            <button className="app-btn secondary" disabled={!!busyAction} onClick={() => void run(t('common:actions.claimControl'), runtime.claimControl)}>
              <span className="row"><TowerControl size={14} /> {t('play:playPage.claim')}</span>
            </button>
          ) : null}

          {runtime.isConnected && !runtime.inCity ? (
            <button className="app-btn" disabled={!!busyAction} onClick={enterCity}>
              <span className="row"><DoorOpen size={14} /> {t('common:actions.enterCity')}</span>
            </button>
          ) : null}

          {runtime.currentLocation ? (
            <button className="app-btn secondary" disabled={!!busyAction} onClick={leaveLocation}>
              {t('play:playPage.leaveCurrentVenue')}
            </button>
          ) : null}

          {runtime.isConnected && runtime.inCity ? (
            <button className="app-btn ghost" disabled={!!busyAction} onClick={leaveCity}>
              {t('common:actions.leaveCity')}
            </button>
          ) : null}

          <button className="app-btn ghost" disabled={!!busyAction} onClick={returnToLobby}>
            <span className="row"><ArrowLeft size={14} /> {t('common:actions.returnToLobby')}</span>
          </button>
        </div>
      </section>

      {(errorText || runtime.error) ? (
        <div className="notice error">
          <span className="row"><ShieldAlert size={14} /> {errorText || runtime.error}</span>
        </div>
      ) : null}

      {runtime.isConnected && runtime.inCity ? (
        <section className="city-atlas" aria-label={t('play:playPage.cityAtlasLabel')}>
          {/* SVG noise filter for parchment texture */}
          <svg width="0" height="0" aria-hidden="true" style={{ position: 'absolute' }}>
            <defs>
              <filter id="parchment-noise" x="0%" y="0%" width="100%" height="100%">
                <feTurbulence type="fractalNoise" baseFrequency="0.65" numOctaves="4" stitchTiles="stitch" result="noise" />
                <feColorMatrix type="saturate" values="0" in="noise" result="mono" />
                <feBlend in="SourceGraphic" in2="mono" mode="multiply" />
              </filter>
              <filter id="ink-rough">
                <feTurbulence type="turbulence" baseFrequency="0.04" numOctaves="3" result="warp" />
                <feDisplacementMap in="SourceGraphic" in2="warp" scale="1.5" xChannelSelector="R" yChannelSelector="G" />
              </filter>
            </defs>
          </svg>

          {/* decorative double-line border */}
          <div className="city-atlas__border" />

          {/* terrain stain layers */}
          <div className="city-atlas__backdrop">
            <div className="city-atlas__terrain city-atlas__terrain--one" />
            <div className="city-atlas__terrain city-atlas__terrain--two" />
            <div className="city-atlas__terrain city-atlas__terrain--three" />
          </div>

          {/* hand-drawn ink roads — rendered as absolute-positioned SVG matching container */}
          <svg className="city-atlas__roads" aria-hidden="true">
            {roads.map((road, index) => {
              /* Use percentage-based coordinates via a viewBox-less SVG
                 that fills the container. Coordinates are in % so we use
                 string interpolation with % units in the path. */
              const x1 = road.from.x;
              const y1 = road.from.y;
              const x2 = road.to.x;
              const y2 = road.to.y;
              const mx = (x1 + x2) / 2;
              const my = (y1 + y2) / 2;
              /* small perpendicular offset for gentle curve */
              const dx = x2 - x1;
              const dy = y2 - y1;
              const len = Math.sqrt(dx * dx + dy * dy) || 1;
              const perpX = -dy / len;
              const perpY = dx / len;
              const bulge = (index % 2 === 0 ? 3 : -3);
              const cx = mx + perpX * bulge;
              const cy = my + perpY * bulge;
              return (
                <g key={road.id}>
                  <path
                    d={`M ${x1}% ${y1}% Q ${cx}% ${cy}% ${x2}% ${y2}%`}
                    className="city-atlas__road city-atlas__road--outline"
                  />
                  <path
                    d={`M ${x1}% ${y1}% Q ${cx}% ${cy}% ${x2}% ${y2}%`}
                    className="city-atlas__road"
                  />
                  <circle cx={`${mx}%`} cy={`${my}%`} className="city-atlas__road-dot" r="3" />
                </g>
              );
            })}
          </svg>

          {/* compass rose */}
          <svg className="city-atlas__compass" viewBox="0 0 72 72" aria-hidden="true">
            <g transform="translate(36,36)" stroke="rgba(180,140,70,0.5)" fill="none" strokeWidth="0.8">
              <circle r="30" />
              <circle r="22" strokeDasharray="2 3" />
              <line y1="-32" y2="32" />
              <line x1="-32" x2="32" />
              <line x1="-22" y1="-22" x2="22" y2="22" strokeWidth="0.4" />
              <line x1="22" y1="-22" x2="-22" y2="22" strokeWidth="0.4" />
              <polygon points="0,-28 3,-18 -3,-18" fill="rgba(201,168,76,0.6)" stroke="none" />
              <text y="-33" textAnchor="middle" fill="rgba(201,168,76,0.5)" fontSize="7" fontFamily="var(--font-display)" letterSpacing="0.1em">N</text>
            </g>
          </svg>

          {/* legend / caption panel */}
          <div className="city-atlas__caption">
            <span className="city-atlas__caption-mark"><MapIcon size={14} /> {t('play:playPage.atlasCaption')}</span>
            <span>{focusDestination ? describeNode(t, focusDestination) : t('play:playPage.atlasWaiting')}</span>
          </div>

          {/* location nodes */}
          {destinations.map((destination) => {
            const Icon = destination.icon;
            return (
              <button
                key={destination.id}
                type="button"
                className={`city-node ${destination.available ? '' : 'is-dormant'} ${destination.isActive ? 'is-active' : ''}`}
                style={{ left: `${destination.x}%`, top: `${destination.y}%`, ['--city-node-accent' as string]: destination.accent }}
                onClick={() => destination.available && void openLocation(destination.id)}
                disabled={!destination.available || !!busyAction}
                title={destination.name}
              >
                <span className="city-node__core">
                  <Icon size={28} />
                </span>
                <span className="city-node__label">{destination.shortLabel}</span>
                {destination.isActive ? <span className="city-node__tag">{t('play:playPage.activeLocationTag')}</span> : null}
                {!destination.available ? <span className="city-node__tag city-node__tag--dormant">{t('play:playPage.dormantTag')}</span> : null}
              </button>
            );
          })}
        </section>
      ) : (
        <section className="city-gate-note">
          <Sparkles size={18} />
          <span>{t('play:playPage.cityMapHint')}</span>
        </section>
      )}
    </div>
  );
}
