import { createContext, useContext, type ReactNode } from 'react';

import type {
  ActivityItem,
  AgentProfile,
  CityPulse,
  Destination,
  LaunchMode,
  WorkspacePreferences,
  WorkspaceSection,
} from '../workspace-data';

interface WorkspaceSurfaceContextValue {
  destinations: Destination[];
  agents: AgentProfile[];
  activities: ActivityItem[];
  cityPulse: CityPulse;
  preferences: WorkspacePreferences;
  navigateToSection: (section: WorkspaceSection) => void;
  openDestination: (destination: Destination, mode?: LaunchMode) => void;
  togglePinnedDestination: (destinationId: string) => void;
  updatePreference: <K extends keyof WorkspacePreferences>(key: K, value: WorkspacePreferences[K]) => void;
  recordActivity: (item: Omit<ActivityItem, 'id' | 'timeLabel'> & { timeLabel?: string }) => void;
}

const WorkspaceSurfaceContext = createContext<WorkspaceSurfaceContextValue | null>(null);

export function WorkspaceSurfaceProvider({
  value,
  children,
}: {
  value: WorkspaceSurfaceContextValue;
  children: ReactNode;
}) {
  return (
    <WorkspaceSurfaceContext.Provider value={value}>
      {children}
    </WorkspaceSurfaceContext.Provider>
  );
}

export function useWorkspaceSurface(): WorkspaceSurfaceContextValue {
  const context = useContext(WorkspaceSurfaceContext);
  if (!context) {
    throw new Error('useWorkspaceSurface must be used within WorkspaceSurfaceProvider');
  }
  return context;
}
