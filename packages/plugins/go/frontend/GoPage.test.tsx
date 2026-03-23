// @vitest-environment jsdom

import React, { type ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { PluginPageData, PluginRuntimeApi, PluginSessionState } from '@uruc/plugin-sdk/frontend';
import { PluginPageContext } from '@uruc/plugin-sdk/frontend-react';
import baseEn from './locales/en';
import playEn from './locales/play.en';
import { GoPage } from './GoPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const translationBundles = {
  go: baseEn.go,
  nav: {
    lobby: 'Lobby',
    agents: 'Agent Center',
  },
  play: playEn,
} as const;

function resolveTranslationValue(namespace: keyof typeof translationBundles, path: string): string | null {
  const parts = path.split('.');
  let current: unknown = translationBundles[namespace];
  for (const part of parts) {
    if (!current || typeof current !== 'object' || !(part in current)) {
      return null;
    }
    current = (current as Record<string, unknown>)[part];
  }
  return typeof current === 'string' ? current : null;
}

function translate(key: string, params?: Record<string, unknown>) {
  let namespace: keyof typeof translationBundles = 'play';
  let path = key;
  if (key.includes(':')) {
    const [nextNamespace, nextPath] = key.split(':', 2);
    if (nextNamespace in translationBundles) {
      namespace = nextNamespace as keyof typeof translationBundles;
      path = nextPath;
    }
  } else {
    const playValue = resolveTranslationValue('play', key);
    if (!playValue) {
      const goValue = resolveTranslationValue('go', key);
      if (goValue) {
        namespace = 'go';
      }
    }
  }

  const resolved = resolveTranslationValue(namespace, path) ?? key;
  if (!params) return resolved;
  return Object.entries(params).reduce(
    (result, [name, value]) => result.replace(`{{${name}}}`, String(value)),
    resolved,
  );
}

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: translate,
  }),
}));

vi.mock('i18next', () => ({
  default: {
    t: translate,
  },
  t: translate,
}));

function createSessionState(): PluginSessionState {
  return {
    connected: true,
    hasController: false,
    isController: false,
    inCity: false,
    currentLocation: null,
    serverTimestamp: Date.now(),
    availableCommands: [],
    availableLocations: [],
  };
}

function createRuntime(overrides: Partial<PluginRuntimeApi> = {}): PluginRuntimeApi {
  const sendCommand: PluginRuntimeApi['sendCommand'] = async <T,>() => ({} as T);

  return {
    status: 'idle',
    isConnected: false,
    hasController: false,
    isController: false,
    error: '',
    inCity: false,
    currentLocation: null,
    agentId: 'agent-1',
    agentName: 'Test Agent',
    connect: async () => undefined,
    disconnect: () => undefined,
    claimControl: async () => createSessionState(),
    releaseControl: async () => createSessionState(),
    refreshSessionState: async () => createSessionState(),
    refreshCommands: async () => undefined,
    sendCommand,
    enterCity: async () => createSessionState(),
    leaveCity: async () => undefined,
    enterLocation: async () => undefined,
    leaveLocation: async () => undefined,
    subscribe: () => () => undefined,
    reportEvent: () => undefined,
    ...overrides,
  };
}

function createPageData(overrides: Partial<PluginPageData> = {}): PluginPageData {
  return {
    pluginId: 'uruc.go',
    runtime: createRuntime(),
    user: {
      id: 'user-1',
      username: 'holder',
      role: 'admin',
      email: 'holder@example.com',
      emailVerified: true,
    },
    ownerAgent: {
      id: 'agent-1',
      name: 'Test Agent',
    },
    connectedAgent: {
      id: 'agent-1',
      name: 'Test Agent',
    },
    shell: {},
    ...overrides,
  };
}

function renderPluginPage(pageData: PluginPageData, element: ReactElement): string {
  return renderToStaticMarkup(
    <MemoryRouter>
      <PluginPageContext.Provider value={pageData}>
        {element}
      </PluginPageContext.Provider>
    </MemoryRouter>,
  );
}

async function renderPluginPageDom(pageData: PluginPageData, element: ReactElement): Promise<string> {
  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  await act(async () => {
    root.render(
      <MemoryRouter>
        <PluginPageContext.Provider value={pageData}>
          {element}
        </PluginPageContext.Provider>
      </MemoryRouter>,
    );
  });

  await act(async () => {
    await Promise.resolve();
  });

  const html = container.innerHTML;
  await act(async () => {
    root.unmount();
  });
  container.remove();
  return html;
}

describe('GoPage room workflows', () => {
  it('renders a dedicated Rooms tab and keeps public room browsing out of New game', () => {
    const html = renderPluginPage(
      createPageData(),
      <GoPage />,
    );

    expect(html).toContain('Rooms');
    expect(html).toContain('Open a room');
  });

  it('renders a pure board stage with embedded seat overlays and modal-driven gating', () => {
    const html = renderPluginPage(
      createPageData(),
      <GoPage />,
    );

    expect(html).toContain('go-com-shell');
    expect(html).toContain('go-com-layout');
    expect(html).toContain('go-board-stage');
    expect(html).toContain('go-board-stage__seat--top');
    expect(html).toContain('go-board-stage__seat--bottom');
    expect(html).toContain('go-right-rail');
    expect(html).toContain('go-workspace-tab');
    expect(html).toContain('go-float-orb__core');
    expect(html).toContain('go-modal');
    expect(html).not.toContain('go-hero');
    expect(html).not.toContain('go-stage-badges');
    expect(html).not.toContain('go-sidebar-summary');
    expect(html).not.toContain('go-gate-stack');
    expect(html).not.toContain('go-notice-stack');
  });

  it('shows the active room only in room management after bootstrap', async () => {
    const currentMatch = {
      matchId: 'go-room-1',
      roomName: 'waibiwaibi room',
      visibility: 'public',
      phase: 'waiting',
      seq: 1,
      serverTimestamp: Date.now(),
      moveCount: 0,
      board: Array.from({ length: 19 }, () => Array<string | null>(19).fill(null)),
      turn: null,
      komi: 7.5,
      captures: {
        black: 0,
        white: 0,
      },
      consecutivePasses: 0,
      clocks: {
        blackMs: 600000,
        whiteMs: 600000,
      },
      players: [
        {
          agentId: 'agent-1',
          userId: 'user-1',
          agentName: 'waibiwaibi',
          color: null,
          ready: false,
          connected: true,
          disconnectDeadlineAt: null,
        },
      ],
      yourAgentId: 'agent-1',
      yourColor: null,
      result: null,
      legalMoves: [],
    } as const;

    const html = await renderPluginPageDom(
      createPageData({
        runtime: createRuntime({
          isConnected: true,
          isController: true,
          hasController: true,
          inCity: true,
          currentLocation: 'uruc.go.go-club',
          refreshSessionState: async () => ({
            ...createSessionState(),
            isController: true,
            hasController: true,
            inCity: true,
            currentLocation: 'uruc.go.go-club',
          }),
          sendCommand: async <T,>(type: string) => {
            if (type === 'uruc.go.bootstrap@v1') {
              return {
                currentMatch,
                joinableMatches: [],
                lobbyVersion: 1,
                rating: {
                  agentId: 'agent-1',
                  userId: 'user-1',
                  agentName: 'waibiwaibi',
                  rating: 1500,
                  gamesPlayed: 0,
                  wins: 0,
                  losses: 0,
                  draws: 0,
                  updatedAt: Date.now(),
                },
                leaderboard: [],
              } as T;
            }
            return {} as T;
          },
        }),
      }),
      <GoPage />,
    );

    expect(html).toContain('waibiwaibi room');
    expect(html).toContain('Active room');
  });

  it('publishes Go page strings through the play namespace', () => {
    expect(playEn.go.page.title).toBe('uruc-go');
    expect(playEn.go.page.watchingNow).toBe('Watching');
  });
});
