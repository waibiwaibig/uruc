// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { AgentsPage } from '../AgentsPage';

const mocks = vi.hoisted(() => ({
  getAllowedLocations: vi.fn(),
  listLogs: vi.fn(),
  notify: vi.fn(),
  recordActivity: vi.fn(),
  agents: [
    {
      id: 'agent-offline',
      userId: 'user-a',
      name: 'uruc0',
      token: 'br_1234567890abcdef1234567890abcdef',
      isShadow: false,
      trustMode: 'confirm',
      allowedLocations: [],
      isOnline: false,
      description: 'testor',
      avatarPath: null,
      searchable: true,
      createdAt: '2026-01-01T00:00:00.000Z',
    },
  ],
  emptyArray: [],
}));

vi.mock('../../../../context/AgentsContext', () => ({
  useAgents: () => ({
    loading: false,
    error: '',
    agents: mocks.agents,
    shadowAgent: null,
    reloadAgents: vi.fn(),
    createAgent: vi.fn(),
    updateAgent: vi.fn(),
    deleteAgent: vi.fn(),
    getAllowedLocations: mocks.getAllowedLocations,
    setAllowedLocations: vi.fn(),
  }),
}));

vi.mock('../../../../context/AgentRuntimeContext', () => ({
  useAgentRuntime: () => ({
    status: 'idle',
    isConnected: false,
    hasController: false,
    isController: false,
    wsUrl: 'ws://localhost:3210/ws',
    setWsUrl: vi.fn(),
    error: '',
    agentSession: null,
    inCity: false,
    currentLocation: null,
    citytime: null,
    currentPlace: null,
    commandGroups: mocks.emptyArray,
    discoveredCommands: mocks.emptyArray,
    discoveredLocations: mocks.emptyArray,
    events: mocks.emptyArray,
    connect: vi.fn(),
    disconnect: vi.fn(),
    acquireActionLease: vi.fn(),
    releaseActionLease: vi.fn(),
    refreshSessionState: vi.fn(),
    refreshLocations: vi.fn(),
    sendCommand: vi.fn(),
    enterCity: vi.fn(),
    leaveCity: vi.fn(),
    enterLocation: vi.fn(),
    leaveLocation: vi.fn(),
    refreshCommands: vi.fn(),
    subscribe: vi.fn(),
    reportEvent: vi.fn(),
  }),
}));

vi.mock('../../../notifications/NotificationProvider', () => ({
  useNotifications: () => ({
    notify: mocks.notify,
    dismiss: vi.fn(),
  }),
}));

vi.mock('../../../context/WorkspaceSurfaceContext', () => ({
  useWorkspaceSurface: () => ({
    destinations: mocks.emptyArray,
    agents: mocks.emptyArray,
    activities: mocks.emptyArray,
    cityPulse: {
      onlineResidents: 0,
      activeSessions: 0,
      runtimeStatus: 'idle',
      availability: 'offline',
      latency: 'n/a',
      advisory: '',
    },
    preferences: {
      quietNotifications: false,
      desktopAlerts: false,
      quickLaunchRecent: true,
      compactLibrary: false,
      reducedMotion: false,
      securityLock: false,
    },
    launchError: '',
    navigateToSection: vi.fn(),
    openDestination: vi.fn(),
    requestDestinationLaunch: vi.fn(),
    toggleLinkedDestination: vi.fn(),
    clearLaunchError: vi.fn(),
    updatePreference: vi.fn(),
    recordActivity: mocks.recordActivity,
  }),
}));

vi.mock('../../../../lib/api', () => ({
  DashboardApi: {
    listLogs: mocks.listLogs,
    uploadAgentAvatar: vi.fn(),
  },
}));

async function renderAgentsPage() {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter>
        <AgentsPage />
      </MemoryRouter>,
    );
  });

  await act(async () => {
    await Promise.resolve();
  });

  return {
    container,
    unmount: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('AgentsPage selected agent status badge', () => {
  beforeEach(() => {
    mocks.getAllowedLocations.mockResolvedValue([]);
    mocks.listLogs.mockResolvedValue({ logs: [] });
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: {
        writeText: vi.fn().mockResolvedValue(undefined),
      },
    });
  });

  afterEach(() => {
    vi.clearAllMocks();
    document.body.innerHTML = '';
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
  });

  it('uses contrast-safe offline badge colors inside the selected agent button', async () => {
    const mounted = await renderAgentsPage();

    try {
      const selectedAgentButton = [...mounted.container.querySelectorAll('button')]
        .find((button) => button.textContent?.includes('uruc0') && button.textContent?.includes('offline'));
      expect(selectedAgentButton).toBeDefined();

      const offlineBadge = [...(selectedAgentButton as HTMLButtonElement).querySelectorAll('div')]
        .find((element) => element.textContent?.trim() === 'offline');
      expect(offlineBadge).toBeDefined();

      expect(offlineBadge?.className).toContain('text-white');
      expect(offlineBadge?.className).toContain('dark:text-zinc-900');
      expect(offlineBadge?.className).not.toContain('text-zinc-950');
      expect(offlineBadge?.className).not.toContain('dark:text-zinc-50');
    } finally {
      await mounted.unmount();
    }
  });

  it('shows a shortened backend token on the license and copies the full token', async () => {
    const mounted = await renderAgentsPage();

    try {
      expect(mounted.container.textContent).toContain('br_1...cdef');
      expect(mounted.container.textContent).not.toContain('AOFFLINE7604');

      const copyButtons = [...mounted.container.querySelectorAll('button')]
        .filter((button) => button.querySelector('svg') && !button.textContent?.trim());
      const licenseCopyButton = copyButtons.at(-1);
      expect(licenseCopyButton).toBeDefined();

      await act(async () => {
        licenseCopyButton?.click();
      });

      expect(navigator.clipboard.writeText).toHaveBeenCalledWith('br_1234567890abcdef1234567890abcdef');
    } finally {
      await mounted.unmount();
    }
  });
});
