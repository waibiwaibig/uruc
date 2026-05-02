import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import i18n, { formatTime } from '../i18n';
import { createRuntimeTransport } from '../lib/runtime-transport';
import { getSavedWsUrl, setSavedWsUrl } from '../lib/storage';
import type {
  CommandDiscoveryGroup,
  CommandDiscoveryQuery,
  CommandDiscoveryResponse,
  CommandSchema,
  LocationDef,
  LocationDiscoveryCurrent,
  LocationDiscoveryResult,
  RuntimeSnapshot,
  WsConnectionStatus,
} from '../lib/types';
import { useAgents } from './AgentsContext';
import { useAuth } from './AuthContext';
import type { SharedRuntimeState } from '../lib/runtime-broker-protocol';

interface AgentRuntimeContextValue {
  status: WsConnectionStatus;
  isConnected: boolean;
  hasController: boolean;
  isController: boolean;
  wsUrl: string;
  setWsUrl: (value: string) => void;
  error: string;
  agentSession: { agentId: string; agentName: string } | null;
  inCity: boolean;
  currentLocation: string | null;
  citytime: number | null;
  currentPlace: LocationDiscoveryCurrent | null;
  commandGroups: CommandDiscoveryGroup[];
  discoveredCommands: CommandSchema[];
  discoveredLocations: LocationDef[];
  events: string[];
  connect: () => Promise<void>;
  disconnect: () => void;
  claimControl: () => Promise<RuntimeSnapshot>;
  releaseControl: () => Promise<RuntimeSnapshot>;
  refreshSessionState: () => Promise<RuntimeSnapshot>;
  refreshLocations: () => Promise<LocationDiscoveryResult>;
  sendCommand: <T = unknown>(type: string, payload?: unknown) => Promise<T>;
  enterCity: () => Promise<RuntimeSnapshot>;
  leaveCity: () => Promise<void>;
  enterLocation: (locationId: string) => Promise<void>;
  leaveLocation: () => Promise<void>;
  refreshCommands: (query?: CommandDiscoveryQuery) => Promise<CommandDiscoveryResponse>;
  subscribe: (event: string, listener: (payload: unknown) => void) => () => void;
  reportEvent: (message: string) => void;
}

const AgentRuntimeContext = createContext<AgentRuntimeContextValue | null>(null);

function nowLabel(message: string): string {
  return `${formatTime(new Date())} ${message}`;
}

function createEmptyListenerMap() {
  return new Map<string, Set<(payload: unknown) => void>>();
}

export function AgentRuntimeProvider({ children }: { children: React.ReactNode }) {
  const { shadowAgent } = useAgents();
  const { user } = useAuth();
  const transportRef = useRef(createRuntimeTransport({ allowDirectFallback: false }));
  const previousIdentityKeyRef = useRef<string | null>(null);
  const eventListenersRef = useRef(createEmptyListenerMap());

  const [status, setStatus] = useState<WsConnectionStatus>('idle');
  const [wsUrl, setWsUrlState] = useState<string>(() => getSavedWsUrl());
  const [error, setError] = useState('');
  const [agentSession, setAgentSession] = useState<{ agentId: string; agentName: string } | null>(null);
  const [hasController, setHasController] = useState(false);
  const [isController, setIsController] = useState(false);
  const [inCity, setInCity] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [citytime, setCitytime] = useState<number | null>(null);
  const [currentPlace, setCurrentPlace] = useState<LocationDiscoveryCurrent | null>(null);
  const [commandGroups, setCommandGroups] = useState<CommandDiscoveryGroup[]>([]);
  const [discoveredCommands, setDiscoveredCommands] = useState<CommandSchema[]>([]);
  const [discoveredLocations, setDiscoveredLocations] = useState<LocationDef[]>([]);
  const [events, setEvents] = useState<string[]>([]);

  const pushEvent = useCallback((message: string) => {
    setEvents((prev) => [nowLabel(message), ...prev].slice(0, 30));
  }, []);

  const applySharedState = useCallback((nextState: SharedRuntimeState) => {
    setStatus(nextState.status);
    setError(nextState.error);
    setAgentSession(nextState.agentSession);
    setHasController(nextState.hasController);
    setIsController(nextState.isController);
    setInCity(nextState.inCity);
    setCurrentLocation(nextState.currentLocation);
    setCitytime(nextState.citytime);
  }, []);

  const resetRuntimeState = useCallback((clearEvents = false) => {
    setStatus('idle');
    setError('');
    setAgentSession(null);
    setHasController(false);
    setIsController(false);
    setInCity(false);
    setCurrentLocation(null);
    setCitytime(null);
    setCurrentPlace(null);
    setCommandGroups([]);
    setDiscoveredCommands([]);
    setDiscoveredLocations([]);
    if (clearEvents) {
      setEvents([]);
    }
  }, []);

  const emitRuntimeMessage = useCallback((type: string, payload: unknown) => {
    const listeners = eventListenersRef.current.get(type);
    if (!listeners) return;
    for (const listener of listeners) {
      listener(payload);
    }
  }, []);

  useEffect(() => {
    const transport = transportRef.current;
    applySharedState(transport.getState());

    const offSnapshot = transport.subscribeSnapshot((nextState) => {
      applySharedState(nextState);
    });

    const offError = transport.subscribeError((message) => {
      const text = String(message);
      pushEvent(i18n.t('runtime:websocket.connectionPrefix', { message: text }));
    });

    const offMessage = transport.subscribeMessage((envelope) => {
      if (envelope.type === 'error') {
        const payload = envelope.payload as { error?: string } | undefined;
        if (payload?.error) {
          pushEvent(i18n.t('runtime:websocket.commandRejectedPrefix', { message: payload.error }));
        }
      }
      // `control_replaced` is a hidden compatibility read path for servers older than
      // issue #13. Remove it once deployed servers emit action_lease_moved only.
      if (envelope.type === 'action_lease_moved' || envelope.type === 'control_replaced') {
        const payload = envelope.payload as { error?: string } | undefined;
        const text = payload?.error ?? i18n.t('runtime:websocket.controlReplaced');
        pushEvent(text);
      }
      emitRuntimeMessage(envelope.type, envelope.payload);
    });

    return () => {
      offSnapshot();
      offError();
      offMessage();
      transport.dispose();
    };
  }, [applySharedState, emitRuntimeMessage, pushEvent]);

  useEffect(() => {
    if (!inCity) {
      setCurrentPlace({ place: 'outside', locationId: null, locationName: null });
      return;
    }
    if (!currentLocation) {
      setCurrentPlace({ place: 'city', locationId: null, locationName: null });
      return;
    }

    const locationName = discoveredLocations.find((location) => location.id === currentLocation)?.name ?? null;
    setCurrentPlace({ place: 'location', locationId: currentLocation, locationName });
  }, [discoveredLocations, currentLocation, inCity]);

  useEffect(() => {
    const transport = transportRef.current;
    const nextIdentityKey = user && shadowAgent ? `${user.id}:${shadowAgent.id}` : null;
    const previousIdentityKey = previousIdentityKeyRef.current;
    previousIdentityKeyRef.current = nextIdentityKey;

    if (previousIdentityKey === nextIdentityKey) return;

    const currentState = transport.getState();
    const mustClearImmediately = nextIdentityKey === null
      || (currentState.identityKey !== null && currentState.identityKey !== nextIdentityKey);

    if (mustClearImmediately) {
      resetRuntimeState(true);
    }

    void transport.resetIdentity(nextIdentityKey)
      .then(() => {
        applySharedState(transport.getState());
      })
      .catch(() => undefined);
  }, [applySharedState, resetRuntimeState, shadowAgent, user]);

  const setWsUrl = useCallback((value: string) => {
    setWsUrlState(value);
    setSavedWsUrl(value);
  }, []);

  const connect = useCallback(async () => {
    if (!user) {
      throw new Error(i18n.t('runtime:websocket.needOwnerLogin'));
    }
    if (!shadowAgent) {
      throw new Error(i18n.t('runtime:websocket.missingShadowAgent'));
    }

    setError('');
    try {
      const result = await transportRef.current.connect(wsUrl.trim(), undefined);
      pushEvent(i18n.t('runtime:events.agentConnected', { name: result.agentName }));
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t('runtime:websocket.connectFailure');
      setError(message);
      throw err;
    }
  }, [shadowAgent, user, wsUrl, pushEvent]);

  const disconnect = useCallback(() => {
    transportRef.current.disconnect();
    setError('');
    setAgentSession(null);
    setHasController(false);
    setIsController(false);
    setInCity(false);
    setCurrentLocation(null);
    setCitytime(null);
    setCurrentPlace(null);
    setCommandGroups([]);
    setDiscoveredCommands([]);
    setDiscoveredLocations([]);
    pushEvent(i18n.t('runtime:events.disconnected'));
  }, [pushEvent]);

  const sendCommand = useCallback(async <T = unknown,>(type: string, payload?: unknown): Promise<T> => {
    return transportRef.current.send<T>(type, payload);
  }, []);

  const refreshSessionState = useCallback(async () => {
    return transportRef.current.send<RuntimeSnapshot>('what_state_am_i');
  }, []);

  const refreshLocations = useCallback(async () => {
    const result = await transportRef.current.send<LocationDiscoveryResult>('where_can_i_go');
    setDiscoveredLocations(result.locations);
    setCurrentPlace(result.current);
    return result;
  }, []);

  const claimControl = useCallback(async () => {
    return transportRef.current.send<RuntimeSnapshot>('acquire_action_lease');
  }, []);

  const releaseControl = useCallback(async () => {
    return transportRef.current.send<RuntimeSnapshot>('release_action_lease');
  }, []);

  const enterCity = useCallback(async () => {
    return sendCommand<RuntimeSnapshot>('enter_city');
  }, [sendCommand]);

  const leaveCity = useCallback(async () => {
    await sendCommand('leave_city');
  }, [sendCommand]);

  const enterLocation = useCallback(async (locationId: string) => {
    await sendCommand('enter_location', { locationId });
  }, [sendCommand]);

  const leaveLocation = useCallback(async () => {
    await sendCommand('leave_location');
  }, [sendCommand]);

  const refreshCommands = useCallback(async (query?: CommandDiscoveryQuery) => {
    const result = await transportRef.current.send<CommandDiscoveryResponse>('what_can_i_do', query);
    if (result.level === 'summary') {
      setCommandGroups(result.groups);
      setDiscoveredCommands([]);
      return result;
    }
    setDiscoveredCommands(result.commands);
    return result;
  }, []);

  const subscribe = useCallback((event: string, listener: (payload: unknown) => void) => {
    const listeners = eventListenersRef.current;
    if (!listeners.has(event)) {
      listeners.set(event, new Set());
    }
    listeners.get(event)!.add(listener);
    return () => {
      listeners.get(event)?.delete(listener);
    };
  }, []);

  const reportEvent = useCallback((message: string) => {
    pushEvent(message);
  }, [pushEvent]);

  const value = useMemo<AgentRuntimeContextValue>(
    () => ({
      status,
      isConnected: status === 'connected',
      hasController,
      isController,
      wsUrl,
      setWsUrl,
      error,
      agentSession,
      inCity,
      currentLocation,
      citytime,
      currentPlace,
      commandGroups,
      discoveredCommands,
      discoveredLocations,
      events,
      connect,
      disconnect,
      claimControl,
      releaseControl,
      refreshSessionState,
      refreshLocations,
      sendCommand,
      enterCity,
      leaveCity,
      enterLocation,
      leaveLocation,
      refreshCommands,
      subscribe,
      reportEvent,
    }),
    [
      status,
      hasController,
      isController,
      wsUrl,
      setWsUrl,
      error,
      agentSession,
      inCity,
      currentLocation,
      citytime,
      currentPlace,
      commandGroups,
      discoveredCommands,
      discoveredLocations,
      events,
      connect,
      disconnect,
      claimControl,
      releaseControl,
      refreshSessionState,
      refreshLocations,
      sendCommand,
      enterCity,
      leaveCity,
      enterLocation,
      leaveLocation,
      refreshCommands,
      subscribe,
      reportEvent,
    ],
  );

  return <AgentRuntimeContext.Provider value={value}>{children}</AgentRuntimeContext.Provider>;
}

export function useAgentRuntime(): AgentRuntimeContextValue {
  const ctx = useContext(AgentRuntimeContext);
  if (!ctx) throw new Error('useAgentRuntime must be used within AgentRuntimeProvider');
  return ctx;
}
