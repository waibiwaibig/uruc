import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSavedAppShellAnchor,
  getSavedAppShellExpanded,
  setSavedAppShellAnchor,
  setSavedAppShellExpanded,
} from '../../lib/storage';

const {
  useAuthMock,
  useAgentRuntimeMock,
  usePluginHostMock,
  logoutMock,
  disconnectMock,
  connectMock,
  claimControlMock,
} = vi.hoisted(() => ({
  useAuthMock: vi.fn(),
  useAgentRuntimeMock: vi.fn(),
  usePluginHostMock: vi.fn(),
  logoutMock: vi.fn(),
  disconnectMock: vi.fn(),
  connectMock: vi.fn(),
  claimControlMock: vi.fn(),
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string) => key,
  }),
}));

vi.mock('../LanguageToggle', () => ({
  LanguageToggle: () => 'LANGUAGE_TOGGLE',
}));

vi.mock('../../context/AuthContext', () => ({
  useAuth: useAuthMock,
}));

vi.mock('../../context/AgentRuntimeContext', () => ({
  useAgentRuntime: useAgentRuntimeMock,
}));

vi.mock('../../plugins/context', () => ({
  usePluginHost: usePluginHostMock,
}));

import { AppShell } from '../AppShell';

function renderAppShell(pathname: string): string {
  return renderToStaticMarkup(
    <MemoryRouter initialEntries={[pathname]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="*" element={<div>APP_OUTLET</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe('AppShell', () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal('localStorage', {
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, value);
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    });

    logoutMock.mockReset();
    disconnectMock.mockReset();
    connectMock.mockReset();
    claimControlMock.mockReset();

    useAuthMock.mockReturnValue({
      user: {
        id: 'user-1',
        username: 'waibiwaibi',
        role: 'admin',
      },
      logout: logoutMock,
    });

    useAgentRuntimeMock.mockReturnValue({
      isConnected: true,
      status: 'connected',
      hasController: false,
      isController: false,
      error: '',
      connect: connectMock,
      claimControl: claimControlMock,
      refreshSessionState: vi.fn(),
      disconnect: disconnectMock,
    });

    usePluginHostMock.mockReturnValue({
      enabledNavEntries: [
        {
          pluginId: 'uruc.social',
          pluginVersion: '0.1.0',
          source: 'test',
          id: 'social-link',
          to: '/app/plugins/uruc.social/hub',
          labelKey: 'social:nav.label',
          icon: 'landmark',
        },
      ],
    });
  });

  it('renders the floating side shell expanded by default', () => {
    const html = renderAppShell('/app/plugins/uruc.social/hub');

    expect(html).toContain('app-shell is-shell-expanded');
    expect(html).toContain('app-shell-launcher is-hidden');
    expect(html).toContain('app-side-shell is-open');
    expect(html).toContain('app-side-shell__control');
    expect(html).toContain('app-side-shell__drag-handle');
    expect(html).toContain('nav:lobby');
    expect(html).toContain('nav:city');
    expect(html).toContain('nav:agents');
    expect(html).toContain('href="/play"');
    expect(html).toContain('social:nav.label');
    expect(html).toContain('LANGUAGE_TOGGLE');
    expect(html).toContain('common:actions.claimControl');
    expect(html).not.toContain('app-side-shell__rail');
  });

  it('respects the saved collapsed preference when rendering', () => {
    setSavedAppShellExpanded(false);

    expect(getSavedAppShellExpanded()).toBe(false);

    const html = renderAppShell('/lobby');

    expect(html).toContain('app-shell is-shell-collapsed');
    expect(html).toContain('app-shell-launcher');
    expect(html).not.toContain('app-shell-launcher is-hidden');
    expect(html).not.toContain('app-side-shell is-open');
    expect(html).toContain('common:actions.openNavigation');
  });

  it('renders a connect action when the runtime is offline', () => {
    useAgentRuntimeMock.mockReturnValue({
      isConnected: false,
      status: 'idle',
      hasController: false,
      isController: false,
      error: '',
      connect: connectMock,
      claimControl: claimControlMock,
      refreshSessionState: vi.fn(),
      disconnect: disconnectMock,
    });

    const html = renderAppShell('/lobby');

    expect(html).toContain('common:actions.connect');
    expect(html).not.toContain('common:actions.claimControl');
  });

  it('persists the shell preference as a boolean flag', () => {
    expect(getSavedAppShellExpanded()).toBe(true);

    setSavedAppShellExpanded(false);
    expect(getSavedAppShellExpanded()).toBe(false);

    setSavedAppShellExpanded(true);
    expect(getSavedAppShellExpanded()).toBe(true);
  });

  it('persists the launcher anchor position when moved', () => {
    expect(getSavedAppShellAnchor()).toBeNull();

    setSavedAppShellAnchor({ left: 88, top: 144 });
    expect(getSavedAppShellAnchor()).toEqual({ left: 88, top: 144 });

    setSavedAppShellAnchor(null);
    expect(getSavedAppShellAnchor()).toBeNull();
  });
});
