// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  useAgentsMock,
  useAgentRuntimeMock,
  usePluginHostMock,
  listLogsMock,
  translateMock,
} = vi.hoisted(() => ({
  useAgentsMock: vi.fn(),
  useAgentRuntimeMock: vi.fn(),
  usePluginHostMock: vi.fn(),
  listLogsMock: vi.fn(),
  translateMock: vi.fn((key: string) => key),
}));

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => undefined,
  },
  useTranslation: () => ({
    t: translateMock,
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

vi.mock('../../lib/api', () => ({
  DashboardApi: {
    listLogs: listLogsMock,
    uploadAgentAvatar: vi.fn(async () => undefined),
  },
}));

import { AgentConsolePage } from '../AgentConsolePage';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function renderPage() {
  await act(async () => {
    root.render(<AgentConsolePage />);
  });
  await act(async () => {
    await Promise.resolve();
    await Promise.resolve();
  });
}

describe('AgentConsolePage', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    container = document.createElement('div');
    document.body.appendChild(container);
    root = createRoot(container);

    useAgentsMock.mockReturnValue({
      loading: false,
      error: '',
      agents: [
        {
          id: 'agent-1',
          userId: 'user-1',
          name: 'Merlin',
          token: 'secret-token',
          isShadow: false,
          trustMode: 'confirm',
          allowedLocations: [],
          isOnline: true,
          description: 'Wizard',
          avatarPath: null,
          createdAt: '2026-03-17T00:00:00.000Z',
        },
      ],
      reloadAgents: vi.fn(async () => undefined),
      createAgent: vi.fn(async () => ({
        id: 'agent-2',
        name: 'New agent',
      })),
      updateAgent: vi.fn(async () => undefined),
      deleteAgent: vi.fn(async () => undefined),
      getAllowedLocations: vi.fn(async () => []),
      setAllowedLocations: vi.fn(async () => undefined),
    });

    useAgentRuntimeMock.mockReturnValue({
      availableLocations: [],
    });

    usePluginHostMock.mockReturnValue({
      enabledLocationPages: [],
    });

    listLogsMock.mockResolvedValue({
      logs: [
        {
          id: 'log-1',
          userId: 'user-1',
          agentId: 'agent-1',
          locationId: 'lobby',
          actionType: 'enter_city',
          result: 'success',
          createdAt: '2026-03-20T10:00:00.000Z',
        },
      ],
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

  it('renders the selected-agent control bar instead of a standalone token card', async () => {
    await renderPage();

    const toolbar = container.querySelector('.selected-agent-banner');
    const firstRegistryCard = container.querySelector('.registry-card');

    expect(toolbar).not.toBeNull();
    expect(toolbar?.textContent).toContain('Merlin');
    expect(toolbar?.textContent).toContain('common:actions.copyToken');
    expect(toolbar?.textContent).toContain('common:actions.show');

    expect(container.textContent).toContain('dashboard:agents.sectionBase');
    expect(container.textContent).toContain('dashboard:agents.sectionLocations');
    expect(container.textContent).toContain('dashboard:agents.sectionRecent');
    expect(container.textContent).not.toContain('dashboard:agents.sectionToken');
    expect(firstRegistryCard?.textContent).not.toContain('dashboard:agents.created');
  });

  it('shows success feedback as a floating toast instead of an inline notice', async () => {
    await renderPage();

    const copyButton = [...container.querySelectorAll('button')]
      .find((button) => button.textContent?.includes('common:actions.copyToken')) as HTMLButtonElement | undefined;

    expect(copyButton).toBeTruthy();
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async () => undefined),
      },
    });

    await act(async () => {
      copyButton!.dispatchEvent(new MouseEvent('click', { bubbles: true }));
      await Promise.resolve();
      await Promise.resolve();
      await Promise.resolve();
    });

    const toast = container.querySelector('.agent-console-toast');

    expect(container.querySelector('.agent-console-message')).toBeNull();
    expect(toast).not.toBeNull();
    expect(toast?.getAttribute('role')).toBe('status');
    expect(toast?.textContent).toContain('dashboard:agents.tokenCopied');
  });
});
