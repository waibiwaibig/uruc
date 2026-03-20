// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  getSavedAppShellAnchor,
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

let container: HTMLDivElement | null = null;
let root: ReturnType<typeof createRoot> | null = null;

async function settle() {
  await act(async () => {
    await Promise.resolve();
  });
}

async function mountAppShell(pathname = '/lobby') {
  container = document.createElement('div');
  document.body.appendChild(container);
  root = createRoot(container);

  await act(async () => {
    root?.render(
      <MemoryRouter initialEntries={[pathname]}>
        <Routes>
          <Route element={<AppShell />}>
            <Route path="*" element={<div>APP_OUTLET</div>} />
          </Route>
        </Routes>
      </MemoryRouter>,
    );
  });

  await settle();
  return container;
}

async function click(element: Element) {
  await act(async () => {
    (element as HTMLElement).dispatchEvent(new MouseEvent('click', { bubbles: true }));
  });
  await settle();
}

async function pointerDown(target: EventTarget, init: PointerEventInit = {}) {
  await act(async () => {
    target.dispatchEvent(new PointerEvent('pointerdown', { bubbles: true, ...init }));
  });
  await settle();
}

async function pointerMove(target: EventTarget, init: PointerEventInit = {}) {
  await act(async () => {
    target.dispatchEvent(new PointerEvent('pointermove', { bubbles: true, ...init }));
  });
  await settle();
}

async function pointerUp(target: EventTarget, init: PointerEventInit = {}) {
  await act(async () => {
    target.dispatchEvent(new PointerEvent('pointerup', { bubbles: true, ...init }));
  });
  await settle();
}

describe('AppShell behavior', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true;
    document.body.innerHTML = '';

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

    if (!window.PointerEvent) {
      vi.stubGlobal('PointerEvent', MouseEvent);
    }

    Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1440 });
    Object.defineProperty(window, 'innerHeight', { configurable: true, writable: true, value: 960 });

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

    setSavedAppShellAnchor(null);
    setSavedAppShellExpanded(false);
  });

  afterEach(async () => {
    if (root) {
      await act(async () => {
        root?.unmount();
      });
    }

    root = null;
    container?.remove();
    container = null;
    globalThis.IS_REACT_ACT_ENVIRONMENT = false;
    vi.clearAllMocks();
    vi.unstubAllGlobals();
  });

  it('opens from the launcher and collapses when clicking outside the shell', async () => {
    const mounted = await mountAppShell('/app/plugins/uruc.social/hub');
    const launcher = mounted.querySelector('.app-shell-launcher');

    expect(launcher).toBeTruthy();
    expect(mounted.querySelector('.app-side-shell')?.className).not.toContain('is-open');

    await click(launcher as HTMLButtonElement);

    expect(mounted.querySelector('.app-side-shell')?.className).toContain('is-open');

    await pointerDown(document.body, { clientX: 1200, clientY: 120 });

    expect(mounted.querySelector('.app-side-shell')?.className).not.toContain('is-open');
  });

  it('stays expanded after outside clicks when pinned', async () => {
    const mounted = await mountAppShell('/app/plugins/uruc.social/hub');
    const launcher = mounted.querySelector('.app-shell-launcher');

    await click(launcher as HTMLButtonElement);

    const pinButton = mounted.querySelector('.app-side-shell__pin');
    expect(pinButton).toBeTruthy();
    expect(pinButton?.innerHTML).toContain('lucide-pin-off');

    await click(pinButton as HTMLButtonElement);
    expect(pinButton?.innerHTML).toContain('lucide-pin"');
    expect(pinButton?.innerHTML).not.toContain('lucide-pin-off');
    await pointerDown(document.body, { clientX: 1200, clientY: 120 });

    expect(mounted.querySelector('.app-side-shell')?.className).toContain('is-open');
  });

  it('keeps drag behavior without opening the panel by accident', async () => {
    const mounted = await mountAppShell('/lobby');
    const launcher = mounted.querySelector('.app-shell-launcher') as HTMLButtonElement;

    vi.spyOn(launcher, 'getBoundingClientRect').mockReturnValue({
      x: 24,
      y: 24,
      left: 24,
      top: 24,
      right: 92,
      bottom: 92,
      width: 68,
      height: 68,
      toJSON: () => '',
    } as DOMRect);

    launcher.setPointerCapture = vi.fn();
    launcher.hasPointerCapture = vi.fn(() => true);
    launcher.releasePointerCapture = vi.fn();

    await pointerDown(launcher, { pointerId: 1, button: 0, clientX: 34, clientY: 34 });
    await pointerMove(launcher, { pointerId: 1, button: 0, clientX: 94, clientY: 114 });
    await pointerUp(launcher, { pointerId: 1, button: 0, clientX: 94, clientY: 114 });
    await click(launcher);

    expect(getSavedAppShellAnchor()).toEqual({ left: 84, top: 104 });
    expect(launcher.style.left).toBe('84px');
    expect(launcher.style.top).toBe('104px');
    expect(mounted.querySelector('.app-side-shell')?.className).not.toContain('is-open');
  });
});
