// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  useAgentsMock,
  useAgentRuntimeMock,
  prepareGameWindowMock,
  navigateMock,
} = vi.hoisted(() => ({
  useAgentsMock: vi.fn(),
  useAgentRuntimeMock: vi.fn(),
  prepareGameWindowMock: vi.fn(),
  navigateMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  initReactI18next: {
    type: '3rdParty',
    init: () => undefined,
  },
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../../context/AgentsContext', () => ({
  useAgents: useAgentsMock,
}));

vi.mock('../../context/AgentRuntimeContext', () => ({
  useAgentRuntime: useAgentRuntimeMock,
}));

vi.mock('../../lib/game-window', () => ({
  prepareGameWindow: prepareGameWindowMock,
}));

vi.mock('react-router-dom', () => ({
  Link: ({ children, to, ...props }: { children: React.ReactNode; to: string }) => <a href={to} {...props}>{children}</a>,
  useNavigate: () => navigateMock,
}));

import { LobbyPage } from '../LobbyPage';

let container: HTMLDivElement;
let root: ReturnType<typeof createRoot>;

async function renderPage() {
  await act(async () => {
    root.render(<LobbyPage />);
  });
}

describe('LobbyPage', () => {
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
    useAgentRuntimeMock.mockReturnValue({
      status: 'connected',
      isConnected: true,
      hasController: true,
      isController: true,
      error: '',
      refreshCommands: vi.fn(async () => undefined),
      connect: vi.fn(async () => undefined),
      disconnect: vi.fn(),
    });
    prepareGameWindowMock.mockReturnValue({
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

  it('opens the play window without disconnecting the shared runtime', async () => {
    await renderPage();

    const openButton = Array.from(container.querySelectorAll('button')).find((button) => (
      button.textContent?.includes('dashboard:lobby.actionEnterCity')
    ));

    expect(openButton).toBeDefined();

    await act(async () => {
      openButton?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    });

    const runtime = useAgentRuntimeMock.mock.results[0]?.value as { disconnect: ReturnType<typeof vi.fn> };
    const prepared = prepareGameWindowMock.mock.results[0]?.value as { navigate: ReturnType<typeof vi.fn> };

    expect(prepared.navigate).toHaveBeenCalledWith('/play?autostart=1');
    expect(runtime.disconnect).not.toHaveBeenCalled();
  });
});
