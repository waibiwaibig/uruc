// @vitest-environment jsdom

import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import type { CityPulse } from '../../../workspace-data';
import { Sidebar } from '../Sidebar';
import { TopBar } from '../TopBar';
import {
  clampAppShellAnchor,
  getDefaultAppShellAnchor,
  getTopBarFrameClassName,
} from '../WorkspaceLayout';

const cityPulse: CityPulse = {
  onlineResidents: 1,
  activeSessions: 1,
  runtimeStatus: 'idle',
  availability: 'Connected',
  latency: 'Live',
  advisory: 'Ready',
};

async function renderAppShell(element: React.ReactNode) {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter>
        {element}
      </MemoryRouter>,
    );
  });

  return {
    container,
    cleanup: async () => {
      await act(async () => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('workspace app shell glass surfaces', () => {
  it('renders the top bar with a lighter saturated glass surface', async () => {
    const { container, cleanup } = await renderAppShell(
      <TopBar
        toggleTheme={() => undefined}
        isDark={false}
        onMenuClick={() => undefined}
        onOpenTokens={() => undefined}
        onOpenCommand={() => undefined}
        onOpenSettings={() => undefined}
        session={null}
        onSignOut={() => undefined}
      />,
    );

    const topBar = container.querySelector('header');

    expect(topBar?.className).toContain('bg-white/55');
    expect(topBar?.className).toContain('backdrop-blur-2xl');
    expect(topBar?.className).toContain('backdrop-saturate-150');
    expect(topBar?.className).toContain('shadow-[0_1px_0_rgba(255,255,255,0.55),0_18px_42px_rgba(15,23,42,0.08)]');

    await cleanup();
  });

  it('renders the sidebar as a translucent glass rail with a soft edge', async () => {
    const { container, cleanup } = await renderAppShell(
      <Sidebar
        activeSection="library"
        onNavigate={() => undefined}
        cityPulse={cityPulse}
        alertCount={0}
        linkedDestinations={[]}
        availableDestinations={[]}
      />,
    );

    const sidebar = container.firstElementChild;
    const softEdge = container.querySelector('[data-app-shell-soft-edge="sidebar"]');

    expect(sidebar?.className).toContain('bg-white/35');
    expect(sidebar?.className).toContain('backdrop-blur-2xl');
    expect(sidebar?.className).toContain('backdrop-saturate-150');
    expect(sidebar?.className).toContain('shadow-[18px_0_48px_rgba(15,23,42,0.08)]');
    expect(softEdge?.className).toContain('bg-gradient-to-l');

    await cleanup();
  });

  it('hides the desktop top bar when the desktop sidebar is collapsed', () => {
    expect(getTopBarFrameClassName(false)).toContain('lg:hidden');
    expect(getTopBarFrameClassName(true)).not.toContain('lg:hidden');
  });

  it('defaults the collapsed shell toggle near the lower left viewport edge', () => {
    expect(getDefaultAppShellAnchor({ width: 1200, height: 800 })).toEqual({
      left: 24,
      top: 724,
    });
  });

  it('keeps the collapsed shell toggle inside the viewport while dragging', () => {
    expect(clampAppShellAnchor({ left: -40, top: 900 }, { width: 1200, height: 800 })).toEqual({
      left: 16,
      top: 732,
    });
  });
});
