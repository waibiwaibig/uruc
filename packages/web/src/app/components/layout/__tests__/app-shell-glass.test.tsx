// @vitest-environment jsdom

import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';

import type { CityPulse } from '../../../workspace-data';
import { Sidebar } from '../Sidebar';
import {
  clampAppShellAnchor,
  getDesktopSidebarFrameClassName,
  getDesktopSidebarFrameStyle,
  getDefaultAppShellAnchor,
  shouldRenderFloatingShellToggle,
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

  it('renders the account menu in the sidebar header before the workspace title', async () => {
    const { container, cleanup } = await renderAppShell(
      <Sidebar
        activeSection="home"
        onNavigate={() => undefined}
        cityPulse={cityPulse}
        alertCount={0}
        linkedDestinations={[]}
        availableDestinations={[]}
        session={{ name: 'Workspace User', initials: 'W' }}
        onSignOut={() => undefined}
        onOpenSettings={() => undefined}
      />,
    );

    const accountButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Open account menu'));
    const workspaceTitle = Array.from(container.querySelectorAll('span')).find((span) => span.textContent === 'Uruc Workspace');

    expect(accountButton).toBeDefined();
    expect(accountButton?.textContent).toContain('W');
    expect(workspaceTitle).toBeDefined();
    expect(accountButton!.compareDocumentPosition(workspaceTitle!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await cleanup();
  });

  it('renders claim control before settings in the account menu', async () => {
    const onClaimControl = vi.fn();
    const { container, cleanup } = await renderAppShell(
      <Sidebar
        activeSection="home"
        onNavigate={() => undefined}
        cityPulse={cityPulse}
        alertCount={0}
        linkedDestinations={[]}
        availableDestinations={[]}
        session={{ name: 'Workspace User', initials: 'W' }}
        onSignOut={() => undefined}
        onOpenSettings={() => undefined}
        onClaimControl={onClaimControl}
      />,
    );

    const accountButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Open account menu'));
    expect(accountButton).toBeDefined();

    await act(async () => {
      accountButton?.dispatchEvent(new MouseEvent('pointerdown', { bubbles: true, cancelable: true, button: 0 }));
    });

    const claimControlItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent?.includes('Claim control'));
    const settingsItem = Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((item) => item.textContent?.includes('Settings'));

    expect(claimControlItem).toBeDefined();
    expect(settingsItem).toBeDefined();
    expect(claimControlItem!.compareDocumentPosition(settingsItem!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await act(async () => {
      (claimControlItem as HTMLElement | undefined)?.click();
    });

    expect(onClaimControl).toHaveBeenCalledTimes(1);

    await cleanup();
  });

  it('renders the command search trigger above the workspace navigation in the sidebar', async () => {
    const onOpenCommand = vi.fn();
    const { container, cleanup } = await renderAppShell(
      <Sidebar
        activeSection="home"
        onNavigate={() => undefined}
        cityPulse={cityPulse}
        alertCount={0}
        linkedDestinations={[]}
        availableDestinations={[]}
        onOpenCommand={onOpenCommand}
      />,
    );

    const searchTrigger = container.querySelector<HTMLButtonElement>('[data-workspace-search-trigger="sidebar"]');
    const homeButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Home'));

    expect(searchTrigger).not.toBeNull();
    expect(homeButton).toBeDefined();
    expect(searchTrigger?.textContent).toContain('Search workspace...');
    expect(searchTrigger!.compareDocumentPosition(homeButton!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await act(async () => {
      searchTrigger?.click();
    });

    expect(onOpenCommand).toHaveBeenCalledTimes(1);

    await cleanup();
  });

  it('renders guide, notifications, and theme actions above city pulse in the sidebar', async () => {
    const onOpenTokens = vi.fn();
    const toggleTheme = vi.fn();
    const { container, cleanup } = await renderAppShell(
      <Sidebar
        activeSection="home"
        onNavigate={() => undefined}
        cityPulse={cityPulse}
        alertCount={0}
        linkedDestinations={[]}
        availableDestinations={[]}
        onOpenTokens={onOpenTokens}
        toggleTheme={toggleTheme}
      />,
    );

    const guideButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('View Guide'));
    const notificationsButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Notifications'));
    const themeButton = Array.from(container.querySelectorAll('button')).find((button) => button.textContent?.includes('Toggle theme'));
    const cityPulseLabel = Array.from(container.querySelectorAll('span')).find((span) => span.textContent === 'City Pulse');

    expect(guideButton).toBeDefined();
    expect(notificationsButton).toBeDefined();
    expect(themeButton).toBeDefined();
    expect(cityPulseLabel).toBeDefined();
    expect(guideButton!.compareDocumentPosition(cityPulseLabel!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(notificationsButton!.compareDocumentPosition(cityPulseLabel!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);
    expect(themeButton!.compareDocumentPosition(cityPulseLabel!)).toBe(Node.DOCUMENT_POSITION_FOLLOWING);

    await act(async () => {
      guideButton?.click();
      themeButton?.click();
    });

    expect(onOpenTokens).toHaveBeenCalledTimes(1);
    expect(toggleTheme).toHaveBeenCalledTimes(1);

    await cleanup();
  });

  it('keeps desktop shell visibility out of global Tailwind display utilities', () => {
    const classTokens = getDesktopSidebarFrameClassName().split(/\s+/);
    expect(classTokens).not.toContain('hidden');
    expect(classTokens).not.toContain('lg:block');
    expect(getDesktopSidebarFrameStyle(true, true)).toEqual({ width: '16rem', display: 'block' });
    expect(getDesktopSidebarFrameStyle(false, true)).toEqual({ width: '0', display: 'block' });
    expect(getDesktopSidebarFrameStyle(true, false)).toEqual({ width: '16rem', display: 'none' });
  });

  it('renders the floating shell toggle for collapsed desktop and mobile shell access', () => {
    expect(shouldRenderFloatingShellToggle(false, true)).toBe(true);
    expect(shouldRenderFloatingShellToggle(true, true)).toBe(false);
    expect(shouldRenderFloatingShellToggle(false, false)).toBe(true);
    expect(shouldRenderFloatingShellToggle(true, false)).toBe(true);
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
