// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  useAgentsMock,
  useAgentRuntimeMock,
  usePluginHostMock,
  navigateMock,
  setSearchParamsMock,
  prepareVenueWindowMock,
} = vi.hoisted(() => ({
  useAgentsMock: vi.fn(),
  useAgentRuntimeMock: vi.fn(),
  usePluginHostMock: vi.fn(),
  navigateMock: vi.fn(),
  setSearchParamsMock: vi.fn(),
  prepareVenueWindowMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => undefined,
  },
  useTranslation: () => ({
    t: (key: string, params?: Record<string, unknown>) => {
      if (!params) return key;
      return Object.entries(params).reduce(
        (result, [name, value]) => result.replace(`{{${name}}}`, String(value)),
        key,
      );
    },
  }),
}));

vi.mock('../../context/AgentsContext', () => ({
  useAgents: useAgentsMock,
}));

vi.mock('../../context/AgentRuntimeContext', () => ({
  useAgentRuntime: useAgentRuntimeMock,
}));

vi.mock('../../plugins/context', () => ({
  usePluginHost: usePluginHostMock,
}));

vi.mock('../../lib/venue-window', () => ({
  prepareVenueWindow: prepareVenueWindowMock,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => navigateMock,
  useSearchParams: () => [new URLSearchParams(), setSearchParamsMock],
}));

import { PlayPage } from '../PlayPage';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

function createRuntime(overrides: Record<string, unknown> = {}) {
  return {
    status: 'connected',
    isConnected: true,
    hasController: true,
    isController: true,
    error: '',
    inCity: true,
    currentLocation: null,
    availableLocations: [
      {
        id: 'acme.venue.sunny-plaza',
        name: 'Sunny Plaza',
        description: 'A calm venue for plugin testing.',
      },
    ],
    agentSession: {
      agentId: 'shadow-1',
      agentName: 'Shadow',
    },
    connect: vi.fn(async () => undefined),
    disconnect: vi.fn(),
    claimControl: vi.fn(async () => ({
      isController: true,
      hasController: true,
      inCity: true,
      currentLocation: null,
      serverTimestamp: Date.now(),
      availableCommands: [],
      availableLocations: [],
    })),
    releaseControl: vi.fn(async () => ({
      isController: false,
      hasController: false,
      inCity: false,
      currentLocation: null,
      serverTimestamp: Date.now(),
      availableCommands: [],
      availableLocations: [],
    })),
    refreshSessionState: vi.fn(async () => ({
      isController: true,
      hasController: true,
      inCity: true,
      currentLocation: null,
      serverTimestamp: Date.now(),
      availableCommands: [],
      availableLocations: [],
    })),
    refreshCommands: vi.fn(async () => undefined),
    sendCommand: vi.fn(async () => ({})),
    enterCity: vi.fn(async () => ({
      isController: true,
      hasController: true,
      inCity: true,
      currentLocation: null,
      serverTimestamp: Date.now(),
      availableCommands: [],
      availableLocations: [],
    })),
    leaveCity: vi.fn(async () => undefined),
    enterLocation: vi.fn(async () => undefined),
    leaveLocation: vi.fn(async () => undefined),
    subscribe: vi.fn(() => () => undefined),
    reportEvent: vi.fn(),
    ...overrides,
  };
}

async function renderPage() {
  await act(async () => {
    root.render(<PlayPage />);
  });
}

describe('PlayPage', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useAgentsMock.mockReturnValue({
      shadowAgent: {
        id: 'shadow-1',
        name: 'Shadow',
      },
    });
    usePluginHostMock.mockReturnValue({
      enabledLocationPages: [
        {
          pluginId: 'acme.venue',
          pluginVersion: '0.1.0',
          source: 'test',
          locationId: 'acme.venue.sunny-plaza',
          routeId: 'plaza',
          titleKey: 'venue:title',
          shortLabelKey: 'venue:shortLabel',
          descriptionKey: 'venue:description',
          icon: 'swords',
          accent: 'var(--city-node-royal)',
          order: 20,
          x: 20,
          y: 28,
          resolvedPath: '/play/plugins/acme.venue/plaza',
        },
      ],
    });
    prepareVenueWindowMock.mockReturnValue({
      navigate: vi.fn(),
      close: vi.fn(),
    });
  });

  afterEach(async () => {
    await act(async () => {
      root.unmount();
    });
    container.remove();
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    vi.clearAllMocks();
  });

  it('opens venue routes in a dedicated venue tab instead of navigating the city tab', async () => {
    const runtime = createRuntime();
    useAgentRuntimeMock.mockReturnValue(runtime);

    await renderPage();

    const venueButton = container.querySelector('button[title="Sunny Plaza"]');
    expect(venueButton).toBeTruthy();

    await act(async () => {
      venueButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    expect(runtime.enterLocation).toHaveBeenCalledWith('acme.venue.sunny-plaza');
    expect(runtime.refreshCommands).toHaveBeenCalled();
    expect(prepareVenueWindowMock).toHaveBeenCalledTimes(1);

    const preparedVenue = prepareVenueWindowMock.mock.results[0]?.value as { navigate: ReturnType<typeof vi.fn> };
    expect(preparedVenue.navigate).toHaveBeenCalledWith('/play/plugins/acme.venue/plaza');
    expect(navigateMock).not.toHaveBeenCalled();
  });
});
