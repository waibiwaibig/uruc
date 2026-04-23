import { useEffect, useMemo, useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router-dom';
import { PanelLeftOpen } from 'lucide-react';

import { useAuth } from '../../../context/AuthContext';
import { useAgents } from '../../../context/AgentsContext';
import { useAgentRuntime } from '../../../context/AgentRuntimeContext';
import { usePluginHost } from '../../../plugins/context';
import { resolvePluginIcon } from '../../../plugins/icons';
import { useTranslation } from 'react-i18next';
import {
  STORAGE_KEYS,
  getRememberedLaunchMode,
  getSavedAppShellExpanded,
  getSavedLinkedVenueIds,
  getSavedStringList,
  rememberLaunchMode,
  setSavedAppShellExpanded,
  setSavedStringList,
  setSavedLinkedVenueIds,
  type SavedLaunchMode,
} from '../../../lib/storage';
import { TokenTable } from '../dashboard/TokenTable';
import { CommandCenterDialog } from '../workspace/CommandCenterDialog';
import { DestinationLaunchDialog } from '../workspace/DestinationLaunchDialog';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { WorkspaceSurfaceProvider } from '../../context/WorkspaceSurfaceContext';
import {
  buildDefaultCityPulse,
  buildDefaultPreferences,
  dedupeDestinations,
  inferAgentStatus,
  makeAgentInitials,
  normalizeDestinationKind,
  toDestinationIcon,
  type ActivityItem,
  type AgentProfile,
  type CityPulse,
  type Destination,
  type LaunchMode,
  type WorkspacePreferences,
  type WorkspaceSection,
} from '../../workspace-data';

import cityBg from '../../../assets/city-bg.png';
import cityLightBg from '../../../assets/city-light-bg.png';

const LAUNCH_CANCELLED_ERROR = 'Launch cancelled';

type PendingLaunchRequest = {
  destination: Destination;
  rememberChoice: boolean;
  resolve: (mode: SavedLaunchMode) => void;
  reject: (error: Error) => void;
};

function normalizePluginPath(path: string): string {
  if (path.startsWith('/workspace/')) return path;
  if (path.startsWith('/app/plugins/')) {
    return path.replace('/app/plugins/', '/workspace/plugins/');
  }
  if (path.startsWith('/play/plugins/')) {
    return path.replace('/play/plugins/', '/workspace/plugins/');
  }
  if (path.startsWith('/plugins/')) {
    return path.replace('/plugins/', '/workspace/plugins/');
  }
  return path;
}

function readSavedPreferences(): WorkspacePreferences {
  if (typeof localStorage === 'undefined') {
    return buildDefaultPreferences();
  }
  const raw = localStorage.getItem(STORAGE_KEYS.preferences);
  if (!raw) return buildDefaultPreferences();
  try {
    const parsed = JSON.parse(raw) as Partial<WorkspacePreferences>;
    return {
      ...buildDefaultPreferences(),
      ...parsed,
    };
  } catch {
    return buildDefaultPreferences();
  }
}

function buildTimeLabel(index: number): string {
  return index === 0 ? 'Just now' : `${index + 1} updates ago`;
}

export function WorkspaceLayout({
  isDark,
  toggleTheme,
}: {
  isDark: boolean;
  toggleTheme: () => void;
}) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuth();
  const agentsApi = useAgents();
  const runtime = useAgentRuntime();
  const pluginHost = usePluginHost();

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isDesktopSidebarOpen, setIsDesktopSidebarOpen] = useState(getSavedAppShellExpanded);
  const [isTokenTableOpen, setIsTokenTableOpen] = useState(false);
  const [isCommandOpen, setIsCommandOpen] = useState(false);
  const [manualActivities, setManualActivities] = useState<ActivityItem[]>([]);
  const [linkedDestinationIds, setLinkedDestinationIds] = useState<string[]>(getSavedLinkedVenueIds);
  const [recentDestinationIds, setRecentDestinationIds] = useState<string[]>(() => getSavedStringList(STORAGE_KEYS.recentDestinations));
  const [preferences, setPreferences] = useState<WorkspacePreferences>(readSavedPreferences);
  const [launchError, setLaunchError] = useState('');
  const [pendingLaunchRequest, setPendingLaunchRequest] = useState<PendingLaunchRequest | null>(null);

  useEffect(() => {
    setSavedAppShellExpanded(isDesktopSidebarOpen);
  }, [isDesktopSidebarOpen]);

  useEffect(() => {
    setSavedLinkedVenueIds(linkedDestinationIds);
  }, [linkedDestinationIds]);

  useEffect(() => {
    setSavedStringList(STORAGE_KEYS.recentDestinations, recentDestinationIds);
  }, [recentDestinationIds]);

  useEffect(() => {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(STORAGE_KEYS.preferences, JSON.stringify(preferences));
  }, [preferences]);

  const visiblePageRoutes = useMemo(
    () => pluginHost.allPageRoutes.filter((route) => {
      if (!pluginHost.isPluginEnabled(route.pluginId)) return false;
      if (route.guard === 'admin') return user?.role === 'admin';
      if (route.guard === 'auth') return Boolean(user);
      return true;
    }),
    [pluginHost, user, user?.role],
  );

  const routeByPluginAndId = useMemo(
    () => new Map(visiblePageRoutes.map((route) => [`${route.pluginId}:${route.id}`, route] as const)),
    [visiblePageRoutes],
  );

  const visibleVenueRoutes = useMemo(
    () => visiblePageRoutes.filter((route) => route.venue),
    [visiblePageRoutes],
  );

  const routeDestinations = useMemo<Destination[]>(() => {
    return visibleVenueRoutes.map((route, index) => ({
      id: `route:${route.pluginId}:${route.id}`,
      name: t(route.venue?.shortLabelKey ?? route.venue!.titleKey),
      description: t(route.venue!.descriptionKey),
      pluginName: route.pluginId,
      kind: normalizeDestinationKind(route.venue?.category),
      status: normalizePluginPath(route.path) === location.pathname ? 'active' : 'ready',
      shell: route.shell === 'standalone' ? 'standalone' : 'app',
      path: normalizePluginPath(route.path),
      icon: resolvePluginIcon(route.venue?.icon),
      isLinked: false,
      isRecent: false,
      lastUsedLabel: buildTimeLabel(index),
      statusNote: route.guard === 'admin' ? 'Admin venue route' : route.guard === 'auth' ? 'Authenticated venue route' : 'Public venue route',
    }));
  }, [location.pathname, t, visibleVenueRoutes]);

  const locationDestinations = useMemo<Destination[]>(() => {
    const discoveredById = new Map(runtime.discoveredLocations.map((location) => [location.id, location]));
    const ids = new Set<string>([
      ...pluginHost.enabledLocationPages.map((page) => page.locationId),
      ...runtime.discoveredLocations.map((item) => item.id),
    ]);

    return Array.from(ids).map((locationId, index) => {
      const page = pluginHost.enabledLocationPages.find((item) => item.locationId === locationId);
      const route = page ? routeByPluginAndId.get(`${page.pluginId}:${page.routeId}`) : null;
      const runtimeLocation = discoveredById.get(locationId);
      const name = runtimeLocation?.name ?? (page ? t(page.titleKey) : locationId);
      const description = runtimeLocation?.description
        ?? (page?.descriptionKey ? t(page.descriptionKey) : `Enter ${name} through the live runtime.`);
      const path = page ? normalizePluginPath(page.resolvedPath) : `/workspace/venues?focus=${encodeURIComponent(locationId)}`;
      const isActive = runtime.currentLocation === locationId || path === location.pathname;

      return {
        id: `location:${locationId}`,
        name,
        description,
        pluginName: page?.pluginId ?? runtimeLocation?.pluginName ?? locationId,
        kind: normalizeDestinationKind(page?.venueCategory),
        status: isActive ? 'active' : runtimeLocation ? 'ready' : runtime.inCity ? 'attention' : 'syncing',
        shell: route?.shell === 'standalone' ? 'standalone' : 'app',
        path,
        icon: page ? resolvePluginIcon(page.icon) : toDestinationIcon(),
        isLinked: false,
        isRecent: false,
        lastUsedLabel: buildTimeLabel(index),
        statusNote: runtimeLocation ? 'Runtime-discovered venue' : 'Registered location route',
        locationId,
      };
    });
  }, [
    location.pathname,
    pluginHost.enabledLocationPages,
    runtime.currentLocation,
    runtime.discoveredLocations,
    runtime.inCity,
    routeByPluginAndId,
    t,
  ]);

  const mergedDestinations = useMemo(() => {
    const all = dedupeDestinations([...routeDestinations, ...locationDestinations]);
    return all.map((destination) => ({
      ...destination,
      isLinked: linkedDestinationIds.includes(destination.id),
      isRecent: recentDestinationIds.includes(destination.id),
      lastUsedLabel: recentDestinationIds.includes(destination.id)
        ? recentDestinationIds.indexOf(destination.id) === 0
          ? 'Just now'
          : `${recentDestinationIds.indexOf(destination.id) + 1} launches ago`
        : destination.lastUsedLabel,
    }));
  }, [linkedDestinationIds, locationDestinations, recentDestinationIds, routeDestinations]);

  useEffect(() => {
    const destinationIds = new Set(mergedDestinations.map((destination) => destination.id));
    setLinkedDestinationIds((current) => {
      const next = current.filter((id) => destinationIds.has(id));
      return next.length === current.length ? current : next;
    });
    setRecentDestinationIds((current) => {
      const next = current.filter((id) => destinationIds.has(id));
      return next.length === current.length ? current : next;
    });
  }, [mergedDestinations]);

  const agentProfiles = useMemo<AgentProfile[]>(() => {
    return agentsApi.agents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      role: agent.isShadow ? 'Shadow operator' : 'Registered agent',
      description: agent.description ?? 'No description configured.',
      status: inferAgentStatus({
        agentId: agent.id,
        isOnline: agent.isOnline,
        isPrimary: agent.isShadow,
        runtimeAgentId: runtime.agentSession?.agentId,
      }),
      initials: makeAgentInitials(agent.name),
      trustMode: agent.trustMode,
      lastSeenLabel: agent.isOnline ? 'Live now' : 'Offline',
      lastAction: agent.isShadow ? 'Owns the shared runtime identity.' : 'Available for city work.',
      isPrimary: agent.isShadow,
      allowedDestinationIds: agent.allowedLocations,
      avatarPath: agent.avatarPath,
      token: agent.token,
      createdAt: agent.createdAt,
    }));
  }, [agentsApi.agents, runtime.agentSession?.agentId]);

  const runtimeActivities = useMemo<ActivityItem[]>(() => {
    return runtime.events.slice(0, 8).map((event, index) => ({
      id: `runtime:${index}:${event}`,
      category: 'system',
      title: event,
      summary: 'Shared runtime event from the live WebSocket transport.',
      timeLabel: buildTimeLabel(index),
      tone: event.toLowerCase().includes('error') ? 'error' : 'neutral',
    }));
  }, [runtime.events]);

  const activities = useMemo(() => [...manualActivities, ...runtimeActivities].slice(0, 20), [manualActivities, runtimeActivities]);

  const cityPulse = useMemo<CityPulse>(() => {
    const defaults = buildDefaultCityPulse();
    return {
      onlineResidents: runtime.discoveredLocations.length,
      activeSessions: agentProfiles.filter((agent) => agent.status !== 'offline').length,
      runtimeStatus: runtime.status,
      availability: runtime.isConnected ? (runtime.inCity ? 'Connected in city' : 'Connected outside city') : 'Disconnected',
      latency: runtime.isConnected ? 'Live shared session' : defaults.latency,
      advisory: runtime.error || (runtime.isConnected ? 'Runtime session is available.' : defaults.advisory),
    };
  }, [agentProfiles, runtime.discoveredLocations.length, runtime.error, runtime.inCity, runtime.isConnected, runtime.status]);

  const session = useMemo(
    () => user ? { name: user.username, email: user.email, initials: makeAgentInitials(user.username) } : null,
    [user],
  );

  const recordActivity = (item: Omit<ActivityItem, 'id' | 'timeLabel'> & { timeLabel?: string }) => {
    setManualActivities((current) => [
      {
        ...item,
        id: `activity:${Date.now()}:${current.length}`,
        timeLabel: item.timeLabel ?? 'Just now',
      },
      ...current,
    ].slice(0, 20));
  };

  const ensureRuntimeReady = async () => {
    if (!agentsApi.shadowAgent) {
      throw new Error('No shadow agent is configured yet.');
    }
    if (!runtime.isConnected) {
      await runtime.connect();
    }
    await runtime.refreshSessionState();
    await runtime.refreshLocations();
  };

  const navigateToSection = (section: WorkspaceSection) => {
    setIsMobileMenuOpen(false);
    switch (section) {
      case 'home':
        navigate('/workspace');
        break;
      case 'library':
        navigate('/workspace/venues');
        break;
      case 'agents':
        navigate('/workspace/agents');
        break;
      case 'settings':
        navigate('/workspace/settings');
        break;
    }
  };

  const openDestination = async (destination: Destination, mode: LaunchMode = 'default') => {
    setLaunchError('');
    const target = mode === 'default'
      ? (destination.shell === 'standalone' ? 'new-tab' : 'same-tab')
      : mode;
    const nextPath = destination.locationId
      ? (destination.path.startsWith('/workspace/plugins/')
        ? destination.path
        : `/workspace/venues?focus=${encodeURIComponent(destination.locationId)}`)
      : destination.path;

    try {
      if (destination.locationId) {
        await ensureRuntimeReady();
        if (!runtime.isController) {
          await runtime.claimControl();
        }
        if (!runtime.inCity) {
          await runtime.enterCity();
        }
        if (runtime.currentLocation !== destination.locationId) {
          await runtime.enterLocation(destination.locationId);
        }
        await runtime.refreshLocations();

        recordActivity({
          category: 'launch',
          title: `${destination.name} entered`,
          summary: 'The workspace runtime moved into the selected venue.',
          tone: 'success',
          destinationId: destination.id,
        });
      }

      setRecentDestinationIds((current) => [destination.id, ...current.filter((value) => value !== destination.id)].slice(0, 8));
      recordActivity({
        category: 'launch',
        title: `${destination.name} opened`,
        summary: target === 'new-tab' ? 'Opened in a new tab under the unified workspace host.' : 'Opened inside the current workspace surface.',
        tone: 'neutral',
        destinationId: destination.id,
      });

      if (target === 'new-tab') {
        window.open(nextPath, '_blank', 'noopener,noreferrer');
        return;
      }

      navigate(nextPath);
    } catch (error) {
      const message = error instanceof Error ? error.message : `Unable to open ${destination.name}.`;
      setLaunchError(message);
      recordActivity({
        category: 'launch',
        title: `${destination.name} failed to open`,
        summary: message,
        tone: 'error',
        destinationId: destination.id,
      });
      throw error instanceof Error ? error : new Error(message);
    }
  };

  const requestDestinationLaunch = async (destination: Destination) => {
    const rememberedMode = getRememberedLaunchMode(destination.id);
    if (rememberedMode) {
      await openDestination(destination, rememberedMode);
      return;
    }

    try {
      const mode = await new Promise<SavedLaunchMode>((resolve, reject) => {
        setPendingLaunchRequest({
          destination,
          rememberChoice: false,
          resolve,
          reject,
        });
      });
      await openDestination(destination, mode);
    } catch (error) {
      if (error instanceof Error && error.message === LAUNCH_CANCELLED_ERROR) {
        return;
      }
      throw error;
    }
  };

  const toggleLinkedDestination = (destinationId: string) => {
    setLinkedDestinationIds((current) =>
      current.includes(destinationId)
        ? current.filter((value) => value !== destinationId)
        : [...current, destinationId],
    );
  };

  const updatePreference = <K extends keyof WorkspacePreferences>(key: K, value: WorkspacePreferences[K]) => {
    setPreferences((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const activeSection: WorkspaceSection = location.pathname === '/workspace/agents'
    ? 'agents'
    : location.pathname === '/workspace/settings'
      ? 'settings'
      : location.pathname === '/workspace/venues' || location.pathname.startsWith('/workspace/plugins/')
        ? 'library'
        : 'home';

  const alertCount = activities.filter((activity) => activity.tone === 'warning' || activity.tone === 'error').length;
  const linkedDestinations = mergedDestinations.filter((destination) => destination.isLinked);

  return (
    <WorkspaceSurfaceProvider
      value={{
        destinations: mergedDestinations,
        agents: agentProfiles,
        activities,
        cityPulse,
        preferences,
        launchError,
        navigateToSection,
        openDestination,
        requestDestinationLaunch,
        toggleLinkedDestination,
        clearLaunchError: () => setLaunchError(''),
        updatePreference,
        recordActivity,
      }}
    >
      <div className="flex h-screen w-full flex-col overflow-hidden bg-white font-sans text-zinc-950 antialiased transition-colors duration-200 selection:bg-zinc-900 selection:text-white dark:bg-[#09090B] dark:text-zinc-50 dark:selection:bg-white dark:selection:text-zinc-900">
        <TopBar
          isDark={isDark}
          toggleTheme={toggleTheme}
          onMenuClick={() => setIsMobileMenuOpen((current) => !current)}
          onOpenTokens={() => setIsTokenTableOpen(true)}
          onOpenCommand={() => setIsCommandOpen(true)}
          onOpenSettings={() => navigate('/workspace/settings')}
          session={session}
          onSignOut={() => logout()}
        />

        <TokenTable isOpen={isTokenTableOpen} onClose={() => setIsTokenTableOpen(false)} />
        <CommandCenterDialog
          open={isCommandOpen}
          onOpenChange={setIsCommandOpen}
          destinations={mergedDestinations}
          agents={agentProfiles}
          activities={activities}
          onNavigate={navigateToSection}
          onOpenAgent={(agentId) => navigate(`/workspace/agents?agent=${encodeURIComponent(agentId)}`)}
          onLaunchDestination={openDestination}
        />
        <DestinationLaunchDialog
          destination={pendingLaunchRequest?.destination ?? null}
          open={Boolean(pendingLaunchRequest)}
          rememberChoice={pendingLaunchRequest?.rememberChoice ?? false}
          onRememberChoiceChange={(rememberChoice) => {
            if (!pendingLaunchRequest) return;
            setPendingLaunchRequest({
              ...pendingLaunchRequest,
              rememberChoice,
            });
          }}
          onOpenHere={(destination) => {
            if (!pendingLaunchRequest) return;
            if (pendingLaunchRequest.rememberChoice) {
              rememberLaunchMode(destination.id, 'same-tab');
            }
            pendingLaunchRequest.resolve('same-tab');
            setPendingLaunchRequest(null);
          }}
          onOpenInNewTab={(destination) => {
            if (!pendingLaunchRequest) return;
            if (pendingLaunchRequest.rememberChoice) {
              rememberLaunchMode(destination.id, 'new-tab');
            }
            pendingLaunchRequest.resolve('new-tab');
            setPendingLaunchRequest(null);
          }}
          onOpenChange={(open) => {
            if (open) return;
            if (!pendingLaunchRequest) return;
            pendingLaunchRequest.reject(new Error(LAUNCH_CANCELLED_ERROR));
            setPendingLaunchRequest(null);
          }}
        />

        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
          <div
            className="absolute inset-0 opacity-10 mix-blend-multiply transition-all duration-500 dark:opacity-20 dark:mix-blend-luminosity"
            style={{ backgroundImage: `url(${isDark ? cityBg : cityLightBg})`, backgroundSize: 'cover', backgroundPosition: 'center' }}
          />
          <div
            className={`absolute inset-0 transition-opacity duration-700 ${activeSection === 'library' ? 'opacity-30 dark:opacity-20' : 'opacity-0'}`}
            style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, currentColor 1px, transparent 0)', backgroundSize: '32px 32px' }}
          />
        </div>

        <div className="relative z-10 flex flex-1 overflow-hidden">
          <div
            className="relative z-30 hidden shrink-0 overflow-hidden transition-[width] duration-300 ease-in-out lg:block"
            style={{ width: isDesktopSidebarOpen ? '16rem' : '0' }}
          >
            <div className="h-full w-64">
              <Sidebar
                activeSection={activeSection}
                onNavigate={navigateToSection}
                cityPulse={cityPulse}
                alertCount={alertCount}
                linkedDestinations={linkedDestinations}
                availableDestinations={mergedDestinations}
                onRequestLaunchDestination={requestDestinationLaunch}
                onToggleLinkedDestination={toggleLinkedDestination}
                onClose={() => setIsDesktopSidebarOpen(false)}
              />
            </div>
          </div>

          {!isDesktopSidebarOpen ? (
            <button
              onClick={() => setIsDesktopSidebarOpen(true)}
              className="absolute bottom-6 left-6 z-40 hidden h-10 w-10 items-center justify-center rounded-full border border-zinc-200/50 bg-white/60 text-zinc-600 shadow-lg backdrop-blur-xl transition-all hover:scale-110 hover:bg-white hover:text-zinc-900 dark:border-white/10 dark:bg-black/50 dark:text-zinc-400 dark:hover:bg-white/10 dark:hover:text-white lg:flex"
            >
              <PanelLeftOpen size={18} />
            </button>
          ) : null}

          {isMobileMenuOpen ? (
            <div className="fixed inset-0 z-40 lg:hidden">
              <div
                className="absolute inset-0 bg-zinc-900/50 backdrop-blur-sm dark:bg-black/50"
                onClick={() => setIsMobileMenuOpen(false)}
              />
              <div className="absolute inset-y-0 left-0 flex w-64 transform flex-col transition-transform">
                <Sidebar
                  className="w-full border-none shadow-2xl"
                  isMobileOpen
                  activeSection={activeSection}
                  onNavigate={navigateToSection}
                  cityPulse={cityPulse}
                  alertCount={alertCount}
                  linkedDestinations={linkedDestinations}
                  availableDestinations={mergedDestinations}
                  onRequestLaunchDestination={requestDestinationLaunch}
                  onToggleLinkedDestination={toggleLinkedDestination}
                  onClose={() => setIsMobileMenuOpen(false)}
                />
              </div>
            </div>
          ) : null}

          <main className="relative flex h-full min-w-0 flex-1 flex-col overflow-hidden bg-transparent">
            <div className="min-h-0 h-full w-full flex-1 overflow-y-auto">
              <Outlet />
            </div>
          </main>
        </div>
      </div>
    </WorkspaceSurfaceProvider>
  );
}
