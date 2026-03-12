import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import i18n, { formatTime } from '../i18n';
import { AgentWsClient } from '../lib/ws';
import { getSavedWsUrl, setSavedWsUrl } from '../lib/storage';
import type { CommandSchema, LocationDef, RuntimeSnapshot, WsConnectionStatus, WsEnvelope } from '../lib/types';
import { useAgents } from './AgentsContext';
import { useAuth } from './AuthContext';

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
  serverTimestamp: number | null;
  availableCommands: CommandSchema[];
  availableLocations: LocationDef[];
  events: string[];
  connect: () => Promise<void>;
  disconnect: () => void;
  claimControl: () => Promise<RuntimeSnapshot>;
  releaseControl: () => Promise<RuntimeSnapshot>;
  refreshSessionState: () => Promise<RuntimeSnapshot>;
  sendCommand: <T = unknown>(type: string, payload?: unknown) => Promise<T>;
  enterCity: () => Promise<RuntimeSnapshot>;
  leaveCity: () => Promise<void>;
  enterLocation: (locationId: string) => Promise<void>;
  leaveLocation: () => Promise<void>;
  refreshCommands: () => Promise<void>;
  subscribe: (event: string, listener: (payload: unknown) => void) => () => void;
}

const AgentRuntimeContext = createContext<AgentRuntimeContextValue | null>(null);

function parseRuntimePatch(payload: unknown): Partial<RuntimeSnapshot & { locationId: string | null }> {
  if (!payload || typeof payload !== 'object') return {};
  const data = payload as Record<string, unknown>;
  const patch: Partial<RuntimeSnapshot & { locationId: string | null }> = {};

  if (typeof data.connected === 'boolean') patch.connected = data.connected;
  if (typeof data.hasController === 'boolean') patch.hasController = data.hasController;
  if (typeof data.isController === 'boolean') patch.isController = data.isController;
  if (typeof data.inCity === 'boolean') patch.inCity = data.inCity;
  if (typeof data.serverTimestamp === 'number') patch.serverTimestamp = data.serverTimestamp;
  if (Array.isArray(data.availableCommands)) patch.availableCommands = data.availableCommands as CommandSchema[];
  if (Array.isArray(data.availableLocations)) patch.availableLocations = data.availableLocations as LocationDef[];
  if (typeof data.currentLocation === 'string' || data.currentLocation === null) {
    patch.currentLocation = data.currentLocation as string | null;
  }
  if (typeof data.locationId === 'string' || data.locationId === null) {
    patch.locationId = data.locationId as string | null;
  }

  return patch;
}

function shouldClearRuntimeError(payload: unknown): boolean {
  const patch = parseRuntimePatch(payload);
  if (patch.connected === false) return false;
  if (patch.isController === true) return true;
  if (patch.hasController === false) return true;
  return false;
}

function nowLabel(message: string): string {
  return `${formatTime(new Date())} ${message}`;
}

export function AgentRuntimeProvider({ children }: { children: React.ReactNode }) {
  const { shadowAgent } = useAgents();
  const { user } = useAuth();
  const clientRef = useRef(new AgentWsClient());
  const previousAgentIdRef = useRef<string | null>(null);

  const [status, setStatus] = useState<WsConnectionStatus>('idle');
  const [wsUrl, setWsUrlState] = useState<string>(() => getSavedWsUrl());
  const [error, setError] = useState('');
  const [agentSession, setAgentSession] = useState<{ agentId: string; agentName: string } | null>(null);
  const [hasController, setHasController] = useState(false);
  const [isController, setIsController] = useState(false);
  const [inCity, setInCity] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<string | null>(null);
  const [serverTimestamp, setServerTimestamp] = useState<number | null>(null);
  const [availableCommands, setAvailableCommands] = useState<CommandSchema[]>([]);
  const [availableLocations, setAvailableLocations] = useState<LocationDef[]>([]);
  const [events, setEvents] = useState<string[]>([]);

  const pushEvent = useCallback((message: string) => {
    setEvents((prev) => [nowLabel(message), ...prev].slice(0, 30));
  }, []);

  const applyPatch = useCallback((payload: unknown) => {
    const patch = parseRuntimePatch(payload);

    if (patch.hasController !== undefined) setHasController(patch.hasController);
    if (patch.isController !== undefined) setIsController(patch.isController);
    if (patch.inCity !== undefined) setInCity(patch.inCity);
    if (patch.serverTimestamp !== undefined) setServerTimestamp(patch.serverTimestamp);
    if (patch.availableCommands) setAvailableCommands(patch.availableCommands);
    if (patch.availableLocations) setAvailableLocations(patch.availableLocations);
    if (patch.currentLocation !== undefined) setCurrentLocation(patch.currentLocation);
    if (patch.locationId !== undefined) setCurrentLocation(patch.locationId);
  }, []);

  useEffect(() => {
    const client = clientRef.current;

    const offStatus = client.on('status', (nextStatus) => {
      setStatus(nextStatus as WsConnectionStatus);
      if (nextStatus !== 'connected') {
        setHasController(false);
        setIsController(false);
        setInCity(false);
        setCurrentLocation(null);
        setServerTimestamp(null);
        setAvailableCommands([]);
        setAvailableLocations([]);
      }
    });

    const offError = client.on('error', (message) => {
      const text = String(message);
      setError(text);
      pushEvent(i18n.t('runtime:websocket.connectionPrefix', { message: text }));
    });

    const offMessage = client.on('message', (raw) => {
      const envelope = raw as WsEnvelope;
      if (envelope.type === 'session_state') {
        applyPatch(envelope.payload);
        if (shouldClearRuntimeError(envelope.payload)) {
          setError('');
        }
      }
      if (envelope.type === 'error') {
        const payload = envelope.payload as { error?: string } | undefined;
        if (payload?.error) {
          setError(payload.error);
          pushEvent(i18n.t('runtime:websocket.commandRejectedPrefix', { message: payload.error }));
        }
      }
      if (envelope.type === 'result') {
        applyPatch(envelope.payload);
        if (shouldClearRuntimeError(envelope.payload)) {
          setError('');
        }
      }
      if (envelope.type === 'chess_welcome') {
        pushEvent(i18n.t('runtime:events.chessEntered'));
      }
      if (envelope.type === 'chess_lobby_delta') {
        const eventName = (envelope.payload as { kind?: string } | undefined)?.kind ?? 'room_updated';
        pushEvent(i18n.t('runtime:events.chessLobbyUpdate', { eventName }));
      }
      if (envelope.type === 'chess_match_delta') {
        const eventName = (envelope.payload as { kind?: string } | undefined)?.kind ?? 'match_update';
        pushEvent(i18n.t('runtime:events.chessMatchUpdate', { eventName }));
      }
      if (envelope.type === 'chess_reconnected') {
        pushEvent(i18n.t('runtime:events.chessRestored'));
      }
      if (envelope.type === 'arcade_welcome') {
        pushEvent(i18n.t('runtime:events.arcadeEntered'));
      }
      if (envelope.type === 'arcade_table_event') {
        const payload = envelope.payload as {
          change?: { message?: string; kind?: string };
          state?: { prompt?: string };
        } | undefined;
        pushEvent(
          payload?.state?.prompt
          ?? payload?.change?.message
          ?? i18n.t('runtime:events.arcadeTableEvent', { eventName: payload?.change?.kind ?? 'table_event' }),
        );
      }
      if (envelope.type === 'arcade_table_closed') {
        pushEvent(i18n.t('runtime:events.arcadeTableClosed'));
      }
      if (envelope.type === 'arcade_reconnected') {
        pushEvent(i18n.t('runtime:events.arcadeRestored'));
      }
      if (envelope.type === 'control_replaced') {
        applyPatch(envelope.payload);
        setIsController(false);
        const payload = envelope.payload as { error?: string } | undefined;
        const text = payload?.error ?? i18n.t('runtime:websocket.controlReplaced');
        setError(text);
        pushEvent(text);
      }
    });

    return () => {
      offStatus();
      offError();
      offMessage();
      client.disconnect();
    };
  }, [applyPatch, pushEvent]);

  useEffect(() => {
    const previousAgentId = previousAgentIdRef.current;
    previousAgentIdRef.current = shadowAgent?.id ?? null;

    setError('');
    setAgentSession(null);
    setHasController(false);
    setIsController(false);
    setInCity(false);
    setCurrentLocation(null);
    setServerTimestamp(null);
    setAvailableCommands([]);
    setAvailableLocations([]);
    setEvents([]);
    if (previousAgentId && previousAgentId !== shadowAgent?.id) {
      clientRef.current.disconnect();
    }
  }, [shadowAgent?.id]);

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
      const result = await clientRef.current.connect(wsUrl.trim(), undefined);
      setAgentSession({ agentId: result.agentId, agentName: result.agentName });
      applyPatch(result.snapshot);
      pushEvent(i18n.t('runtime:events.agentConnected', { name: result.agentName }));
    } catch (err) {
      const message = err instanceof Error ? err.message : i18n.t('runtime:websocket.connectFailure');
      setError(message);
      throw err;
    }
  }, [shadowAgent, user, wsUrl, pushEvent, applyPatch]);

  const disconnect = useCallback(() => {
    clientRef.current.disconnect();
    setError('');
    setAgentSession(null);
    setHasController(false);
    setIsController(false);
    setInCity(false);
    setCurrentLocation(null);
    setAvailableCommands([]);
    setAvailableLocations([]);
    pushEvent(i18n.t('runtime:events.disconnected'));
  }, [pushEvent]);

  const sendCommand = useCallback(async <T = unknown,>(type: string, payload?: unknown): Promise<T> => {
    const result = await clientRef.current.send<T>(type, payload);
    applyPatch(result);
    if (shouldClearRuntimeError(result)) {
      setError('');
    }
    return result;
  }, [applyPatch]);

  const refreshSessionState = useCallback(async () => {
    const result = await clientRef.current.send<RuntimeSnapshot>('session_state');
    applyPatch(result);
    if (shouldClearRuntimeError(result)) {
      setError('');
    }
    return result;
  }, [applyPatch]);

  const claimControl = useCallback(async () => {
    const result = await clientRef.current.send<RuntimeSnapshot>('claim_control');
    applyPatch(result);
    if (shouldClearRuntimeError(result)) {
      setError('');
    }
    return result;
  }, [applyPatch]);

  const releaseControl = useCallback(async () => {
    const result = await clientRef.current.send<RuntimeSnapshot>('release_control');
    applyPatch(result);
    if (shouldClearRuntimeError(result)) {
      setError('');
    }
    return result;
  }, [applyPatch]);

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

  const refreshCommands = useCallback(async () => {
    const result = await refreshSessionState();
    setAvailableCommands(result.availableCommands ?? []);
    setAvailableLocations(result.availableLocations ?? []);
  }, [refreshSessionState]);

  const subscribe = useCallback((event: string, listener: (payload: unknown) => void) => {
    return clientRef.current.on(event, listener);
  }, []);

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
      serverTimestamp,
      availableCommands,
      availableLocations,
      events,
      connect,
      disconnect,
      claimControl,
      releaseControl,
      refreshSessionState,
      sendCommand,
      enterCity,
      leaveCity,
      enterLocation,
      leaveLocation,
      refreshCommands,
      subscribe,
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
      serverTimestamp,
      availableCommands,
      availableLocations,
      events,
      connect,
      disconnect,
      claimControl,
      releaseControl,
      refreshSessionState,
      sendCommand,
      enterCity,
      leaveCity,
      enterLocation,
      leaveLocation,
      refreshCommands,
      subscribe,
    ],
  );

  return <AgentRuntimeContext.Provider value={value}>{children}</AgentRuntimeContext.Provider>;
}

export function useAgentRuntime(): AgentRuntimeContextValue {
  const ctx = useContext(AgentRuntimeContext);
  if (!ctx) throw new Error('useAgentRuntime must be used within AgentRuntimeProvider');
  return ctx;
}
