import type { LucideIcon } from 'lucide-react';
import {
  Bot,
  House,
  Landmark,
  LayoutGrid,
  MessageSquare,
  Settings2,
  ShoppingBag,
  Swords,
  TowerControl,
  UserRoundCog,
  Waypoints,
} from 'lucide-react';

export type WorkspaceSection = 'home' | 'library' | 'agents' | 'settings';
export type DestinationKind = 'communication' | 'entertainment' | 'commerce' | 'infrastructure';
export type DestinationShell = 'app' | 'standalone';
export type DestinationStatus = 'ready' | 'active' | 'attention' | 'syncing';
export type AgentStatus = 'ready' | 'busy' | 'offline';
export type ActivityCategory = 'session' | 'launch' | 'agent' | 'system';
export type ActivityTone = 'neutral' | 'success' | 'warning' | 'error';
export type LaunchMode = 'default' | 'same-tab' | 'new-tab';

export type Destination = {
  id: string;
  name: string;
  description: string;
  pluginName: string;
  kind: DestinationKind;
  status: DestinationStatus;
  shell: DestinationShell;
  path: string;
  icon: LucideIcon;
  isPinned: boolean;
  isRecent: boolean;
  lastUsedLabel: string;
  statusNote: string;
  locationId?: string;
};

export type AgentProfile = {
  id: string;
  name: string;
  role: string;
  description: string;
  status: AgentStatus;
  initials: string;
  trustMode: 'confirm' | 'full';
  lastSeenLabel: string;
  lastAction: string;
  isPrimary: boolean;
  allowedDestinationIds: string[];
  avatarPath?: string | null;
  token?: string;
  createdAt?: string;
};

export type ActivityItem = {
  id: string;
  category: ActivityCategory;
  title: string;
  summary: string;
  timeLabel: string;
  tone: ActivityTone;
  destinationId?: string;
  agentId?: string;
};

export type CityPulse = {
  onlineResidents: number;
  activeSessions: number;
  runtimeStatus: string;
  availability: string;
  latency: string;
  advisory: string;
};

export type WorkspacePreferences = {
  quietNotifications: boolean;
  desktopAlerts: boolean;
  quickLaunchRecent: boolean;
  compactLibrary: boolean;
  reducedMotion: boolean;
  securityLock: boolean;
};

export const workspaceSections: Array<{
  id: WorkspaceSection;
  label: string;
  icon: LucideIcon;
  hint: string;
}> = [
  { id: 'home', label: 'Home', icon: House, hint: 'Overview and quick actions' },
  { id: 'library', label: 'Venues', icon: LayoutGrid, hint: 'Explore city venues' },
  { id: 'agents', label: 'Identity Registry', icon: UserRoundCog, hint: 'Agent identity center' },
  { id: 'settings', label: 'Settings', icon: Settings2, hint: 'Account and product preferences' },
];

const DESTINATION_KIND_ICONS: Record<DestinationKind, LucideIcon> = {
  communication: MessageSquare,
  entertainment: Swords,
  commerce: ShoppingBag,
  infrastructure: Waypoints,
};

export function iconForDestinationKind(kind: DestinationKind): LucideIcon {
  return DESTINATION_KIND_ICONS[kind] ?? Landmark;
}

export function makeAgentInitials(value: string): string {
  return value
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
    .slice(0, 2) || 'AG';
}

export function summarizeAgentStatuses(agents: AgentProfile[]): Record<AgentStatus, number> {
  return agents.reduce<Record<AgentStatus, number>>(
    (counts, agent) => {
      counts[agent.status] += 1;
      return counts;
    },
    { ready: 0, busy: 0, offline: 0 },
  );
}

export function getDestinationStatusVariant(status: DestinationStatus): 'outline' | 'success' | 'warning' {
  switch (status) {
    case 'active':
      return 'success';
    case 'attention':
      return 'warning';
    default:
      return 'outline';
  }
}

export function getAgentStatusVariant(status: AgentStatus): 'outline' | 'success' | 'warning' {
  switch (status) {
    case 'ready':
      return 'success';
    case 'busy':
      return 'warning';
    default:
      return 'outline';
  }
}

export function getSectionFromCategory(category: ActivityCategory): WorkspaceSection {
  switch (category) {
    case 'agent':
      return 'agents';
    case 'launch':
      return 'library';
    case 'session':
    case 'system':
    default:
      return 'home';
  }
}

export function inferAgentStatus(options: {
  isOnline: boolean;
  isPrimary: boolean;
  runtimeAgentId?: string | null;
  agentId: string;
}): AgentStatus {
  if (options.runtimeAgentId === options.agentId) {
    return 'busy';
  }
  if (options.isOnline || options.isPrimary) {
    return 'ready';
  }
  return 'offline';
}

export function buildDefaultPreferences(): WorkspacePreferences {
  return {
    quietNotifications: false,
    desktopAlerts: false,
    quickLaunchRecent: true,
    compactLibrary: false,
    reducedMotion: false,
    securityLock: false,
  };
}

export function buildDefaultCityPulse(): CityPulse {
  return {
    onlineResidents: 0,
    activeSessions: 0,
    runtimeStatus: 'idle',
    availability: 'Awaiting connection',
    latency: '--',
    advisory: 'Connect the shadow agent to populate the city pulse.',
  };
}

export function toDestinationKind(pluginId: string): DestinationKind {
  if (pluginId.includes('social') || pluginId.includes('message') || pluginId.includes('chat')) {
    return 'communication';
  }
  if (pluginId.includes('market') || pluginId.includes('shop') || pluginId.includes('trade')) {
    return 'commerce';
  }
  if (pluginId.includes('portal') || pluginId.includes('network') || pluginId.includes('broadcast')) {
    return 'infrastructure';
  }
  return 'entertainment';
}

export function toDestinationIcon(pluginId: string, fallback?: string): LucideIcon {
  if (fallback === 'landmark') return Landmark;
  if (fallback === 'tower') return TowerControl;
  if (fallback === 'shoppingBag' || fallback === 'marketplace') return ShoppingBag;
  if (fallback === 'swords') return Swords;
  if (fallback === 'bot') return Bot;
  return iconForDestinationKind(toDestinationKind(pluginId));
}
