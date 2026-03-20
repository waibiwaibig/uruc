import type { ReactNode } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const { browserPath, usePluginHostMock } = vi.hoisted(() => ({
  browserPath: { current: '/' },
  usePluginHostMock: vi.fn(),
}));

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');

  return {
    ...actual,
    BrowserRouter: ({ children }: { children: ReactNode }) => (
      <actual.MemoryRouter initialEntries={[browserPath.current]}>
        {children}
      </actual.MemoryRouter>
    ),
  };
});

vi.mock('../components/PublicShell', () => ({
  PublicShell: () => 'PUBLIC_SHELL',
}));

vi.mock('../components/AppShell', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    AppShell: () => (
      <div data-shell="app">
        APP_SHELL
        <actual.Outlet />
      </div>
    ),
  };
});

vi.mock('../components/StandaloneShell', async () => {
  const actual = await vi.importActual<typeof import('react-router-dom')>('react-router-dom');
  return {
    StandaloneShell: () => (
      <div data-shell="standalone">
        STANDALONE_SHELL
        <actual.Outlet />
      </div>
    ),
  };
});

vi.mock('../components/AdminRoute', () => ({
  AdminRoute: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../components/ProtectedRoute', () => ({
  ProtectedRoute: ({ children }: { children: ReactNode }) => children,
}));

vi.mock('../components/plugins/PluginRouteElement', () => ({
  PluginRouteElement: ({ route }: { route: { pluginId: string; id: string } }) => `PLUGIN:${route.pluginId}:${route.id}`,
}));

vi.mock('../pages/IntroPage', () => ({
  IntroPage: () => 'INTRO_PAGE',
}));

vi.mock('../pages/LoginPage', () => ({
  LoginPage: () => 'LOGIN_PAGE',
}));

vi.mock('../pages/RegisterPage', () => ({
  RegisterPage: () => 'REGISTER_PAGE',
}));

vi.mock('../pages/VerifyEmailPage', () => ({
  VerifyEmailPage: () => 'VERIFY_EMAIL_PAGE',
}));

vi.mock('../pages/AuthCallbackPage', () => ({
  AuthCallbackPage: () => 'AUTH_CALLBACK_PAGE',
}));

vi.mock('../pages/AgentConsolePage', () => ({
  AgentConsolePage: () => 'AGENT_CONSOLE_PAGE',
}));

vi.mock('../pages/LobbyPage', () => ({
  LobbyPage: () => 'LOBBY_PAGE',
}));

vi.mock('../pages/PlayPage', () => ({
  PlayPage: () => 'PLAY_PAGE',
}));

vi.mock('../pages/DeveloperRuntimePage', () => ({
  DeveloperRuntimePage: () => 'DEVELOPER_RUNTIME_PAGE',
}));

vi.mock('../plugins/context', () => ({
  usePluginHost: usePluginHostMock,
}));

import App from '../App';

function renderApp(): string {
  return renderToStaticMarkup(<App />);
}

describe('App route shells', () => {
  beforeEach(() => {
    browserPath.current = '/';
    usePluginHostMock.mockReset();
    usePluginHostMock.mockReturnValue({
      registryReady: true,
      allPageRoutes: [],
    });
  });

  it('mounts standalone plugin routes under the standalone shell', () => {
    browserPath.current = '/play/plugins/uruc.test/arena';
    usePluginHostMock.mockReturnValue({
      registryReady: true,
      allPageRoutes: [
        {
          pluginId: 'uruc.test',
          pluginVersion: '0.1.0',
          source: 'test',
          id: 'arena',
          path: '/play/plugins/uruc.test/arena',
          shell: 'standalone',
          guard: 'auth',
          aliases: ['/play/test'],
          load: vi.fn(),
        },
      ],
    });

    const html = renderApp();

    expect(html).toContain('STANDALONE_SHELL');
    expect(html).toContain('PLUGIN:uruc.test:arena');
    expect(html).not.toContain('GAME_SHELL');
  });

  it('mounts the city play route under the app shell', () => {
    browserPath.current = '/play';

    const html = renderApp();

    expect(html).toContain('APP_SHELL');
    expect(html).toContain('PLAY_PAGE');
    expect(html).not.toContain('STANDALONE_SHELL');
  });
});
