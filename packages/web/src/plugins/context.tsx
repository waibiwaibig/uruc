import type { PluginPageData, PluginRuntimeApi } from '@uruc/plugin-sdk/frontend';
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import i18n from '../i18n';
import { useAgents } from '../context/AgentsContext';
import { useAuth } from '../context/AuthContext';
import { useAgentRuntime } from '../context/AgentRuntimeContext';
import { PublicApi } from '../lib/api';
import type { HealthPluginDiagnostic, HealthResponse } from '../lib/types';
import { resolveEnabledPluginIds } from './state';
import {
  createEmptyFrontendPluginRegistry,
  type FrontendPluginDiagnostic,
  type FrontendPluginRegistry,
  type RegisteredIntroCard,
  type RegisteredLocationPage,
  type RegisteredNavEntry,
  type RegisteredPageRoute,
  type RegisteredRuntimeSlice,
  loadFrontendPluginRegistry,
} from './registry';

interface PluginHostContextValue {
  health: HealthResponse | null;
  registryReady: boolean;
  registry: FrontendPluginRegistry;
  diagnostics: FrontendPluginDiagnostic[];
  backendDiagnostics: HealthPluginDiagnostic[];
  loadedPluginIds: string[];
  enabledPluginIds: Set<string>;
  allPageRoutes: RegisteredPageRoute[];
  enabledNavEntries: RegisteredNavEntry[];
  enabledIntroCards: RegisteredIntroCard[];
  enabledLocationPages: RegisteredLocationPage[];
  allLocationPages: RegisteredLocationPage[];
  runtimeSlices: RegisteredRuntimeSlice[];
  isPluginEnabled: (pluginId: string) => boolean;
  buildPageContext: (pluginId: string) => PluginPageData;
}

const PluginHostContext = createContext<PluginHostContextValue | null>(null);

function applyPluginTranslations(registryValue: FrontendPluginRegistry): void {
  for (const plugin of registryValue.plugins) {
    if (!plugin.translations) continue;
    for (const [locale, namespaces] of Object.entries(plugin.translations)) {
      for (const [namespace, bundle] of Object.entries(namespaces)) {
        i18n.addResourceBundle(locale, namespace, bundle, true, true);
      }
    }
  }
}

export function PluginHostProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const { shadowAgent } = useAgents();
  const runtime = useAgentRuntime();
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [registryReady, setRegistryReady] = useState(false);
  const [registry, setRegistry] = useState<FrontendPluginRegistry>(() => createEmptyFrontendPluginRegistry());
  const [runtimeDiagnostics, setRuntimeDiagnostics] = useState<FrontendPluginDiagnostic[]>([]);

  useEffect(() => {
    let active = true;

    void loadFrontendPluginRegistry()
      .then((nextRegistry) => {
        if (!active) return;
        applyPluginTranslations(nextRegistry);
        setRegistry(nextRegistry);
        setRegistryReady(true);
      })
      .catch((error) => {
        if (!active) return;
        setRegistry({
          ...createEmptyFrontendPluginRegistry(),
          diagnostics: [{
            pluginId: 'frontend-host',
            state: 'load_failed',
            source: 'packages/web/src/plugins/context.tsx',
            message: error instanceof Error ? error.message : 'Frontend plugin registry failed to load',
          }],
        });
        setRegistryReady(true);
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    void PublicApi.health()
      .then((response) => {
        if (!active) return;
        setHealth(response);
      })
      .catch(() => {
        if (!active) return;
        setHealth(null);
      });
    return () => {
      active = false;
    };
  }, []);

  const runtimeApi = useMemo<PluginRuntimeApi>(() => ({
    status: runtime.status,
    isConnected: runtime.isConnected,
    hasController: runtime.hasController,
    isController: runtime.isController,
    error: runtime.error,
    inCity: runtime.inCity,
    currentLocation: runtime.currentLocation,
    agentId: runtime.agentSession?.agentId ?? shadowAgent?.id ?? null,
    agentName: runtime.agentSession?.agentName ?? shadowAgent?.name ?? null,
    connect: runtime.connect,
    disconnect: runtime.disconnect,
    claimControl: runtime.claimControl,
    releaseControl: runtime.releaseControl,
    refreshSessionState: runtime.refreshSessionState,
    refreshCommands: runtime.refreshCommands,
    sendCommand: runtime.sendCommand,
    enterCity: runtime.enterCity,
    leaveCity: runtime.leaveCity,
    enterLocation: runtime.enterLocation,
    leaveLocation: runtime.leaveLocation,
    subscribe: runtime.subscribe,
    reportEvent: runtime.reportEvent,
  }), [
    runtime.status,
    runtime.isConnected,
    runtime.hasController,
    runtime.isController,
    runtime.error,
    runtime.inCity,
    runtime.currentLocation,
    runtime.agentSession?.agentId,
    runtime.agentSession?.agentName,
    runtime.connect,
    runtime.disconnect,
    runtime.claimControl,
    runtime.releaseControl,
    runtime.refreshSessionState,
    runtime.refreshCommands,
    runtime.sendCommand,
    runtime.enterCity,
    runtime.leaveCity,
    runtime.enterLocation,
    runtime.leaveLocation,
    runtime.subscribe,
    runtime.reportEvent,
    shadowAgent?.id,
    shadowAgent?.name,
  ]);

  const enabledPluginIds = useMemo(() => {
    const ids = resolveEnabledPluginIds(health);
    console.log('[PluginHost] Health response:', health);
    console.log('[PluginHost] Enabled plugin IDs:', Array.from(ids));
    return ids;
  }, [health]);

  useEffect(() => {
    const cleanups: Array<() => void> = [];
    const nextDiagnostics: FrontendPluginDiagnostic[] = [];

    for (const slice of registry.runtimeSlices) {
      if (!enabledPluginIds.has(slice.pluginId)) continue;
      try {
        const cleanup = slice.mount(runtimeApi) as void | (() => void);
        if (typeof cleanup === 'function') {
          cleanups.push(cleanup);
        }
      } catch (error) {
        nextDiagnostics.push({
          pluginId: slice.pluginId,
          state: 'runtime_error',
          source: slice.source,
          target: slice.id,
          message: error instanceof Error ? error.message : 'Runtime slice mount failed',
        });
      }
    }

    setRuntimeDiagnostics(nextDiagnostics);
    return () => {
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [enabledPluginIds, registry.runtimeSlices, runtimeApi]);

  const ownerAgentSummary = shadowAgent ? {
    id: shadowAgent.id,
    name: shadowAgent.name,
    isShadow: shadowAgent.isShadow,
  } : runtime.agentSession ? {
    id: runtime.agentSession.agentId,
    name: runtime.agentSession.agentName,
  } : null;

  const buildPageContext = useMemo(
    () => (pluginId: string): PluginPageData => ({
      pluginId,
      runtime: runtimeApi,
      user: user ? {
        id: user.id,
        username: user.username,
        role: user.role,
        email: user.email,
        emailVerified: user.emailVerified,
      } : null,
      ownerAgent: ownerAgentSummary,
      connectedAgent: runtime.agentSession ? {
        id: runtime.agentSession.agentId,
        name: runtime.agentSession.agentName,
        isShadow: shadowAgent ? runtime.agentSession.agentId === shadowAgent.id : undefined,
      } : null,
      shell: {},
    }),
    [
      runtime.agentSession,
      runtimeApi,
      ownerAgentSummary,
      shadowAgent,
      user,
    ],
  );

  const value = useMemo<PluginHostContextValue>(() => {
    const isPluginEnabled = (pluginId: string) => enabledPluginIds.has(pluginId);

    console.log('[PluginHost] Registry diagnostics:', registry.diagnostics);
    registry.diagnostics.forEach((d, i) => {
      console.log(`  [${i}] ${d.pluginId} - ${d.state}: ${d.message}`);
    });
    console.log('[PluginHost] All location pages:', registry.locationPages.map(p => ({ pluginId: p.pluginId, locationId: p.locationId, routeId: p.routeId, resolvedPath: p.resolvedPath })));
    console.log('[PluginHost] Enabled location pages:', registry.locationPages.filter((entry) => isPluginEnabled(entry.pluginId)).map(p => ({ pluginId: p.pluginId, locationId: p.locationId })));

    return {
      health,
      registryReady,
      registry,
      diagnostics: [...registry.diagnostics, ...runtimeDiagnostics],
      backendDiagnostics: health?.pluginDiagnostics ?? [],
      loadedPluginIds: registry.plugins.map((plugin) => plugin.pluginId),
      enabledPluginIds,
      allPageRoutes: registry.pageRoutes,
      enabledNavEntries: registry.navEntries.filter((entry) => isPluginEnabled(entry.pluginId)),
      enabledIntroCards: registry.introCards.filter((entry) => isPluginEnabled(entry.pluginId)),
      enabledLocationPages: registry.locationPages.filter((entry) => isPluginEnabled(entry.pluginId)),
      allLocationPages: registry.locationPages,
      runtimeSlices: registry.runtimeSlices,
      isPluginEnabled,
      buildPageContext,
    };
  }, [buildPageContext, enabledPluginIds, health, registry, registryReady, runtimeDiagnostics]);

  return <PluginHostContext.Provider value={value}>{children}</PluginHostContext.Provider>;
}

export function usePluginHost(): PluginHostContextValue {
  const ctx = useContext(PluginHostContext);
  if (!ctx) {
    throw new Error('usePluginHost must be used within PluginHostProvider');
  }
  return ctx;
}
