// @vitest-environment jsdom

import React, { type ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { PluginPageData, PluginRuntimeApi, PluginSessionState } from '@uruc/plugin-sdk/frontend';
import { PluginPageContext } from '@uruc/plugin-sdk/frontend-react';
import { ChineseChessPage } from './ChineseChessPage';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock('react-i18next', () => ({
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

vi.mock('i18next', () => ({
  default: {
    t: (key: string, params?: Record<string, unknown>) => {
      if (!params) return key;
      return Object.entries(params).reduce(
        (result, [name, value]) => result.replace(`{{${name}}}`, String(value)),
        key,
      );
    },
  },
  t: (key: string, params?: Record<string, unknown>) => {
    if (!params) return key;
    return Object.entries(params).reduce(
      (result, [name, value]) => result.replace(`{{${name}}}`, String(value)),
      key,
    );
  },
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
    pluginId: 'uruc.chinese-chess',
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

async function mountPluginPageDom(pageData: PluginPageData, element: ReactElement) {
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

describe('ChineseChessPage layout', () => {
  it('renders a fixed left-board right-workspace shell with orb navigation', () => {
    const html = renderPluginPage(
      createPageData(),
      <ChineseChessPage />,
    );

    expect(html).toContain('chinese-chess-com-layout');
    expect(html).toContain('chinese-chess-main-stage');
    expect(html).toContain('chinese-chess-right-rail');
    expect(html).toContain('chinese-chess-workspace-tabs');
    expect(html).toContain('play:chineseChess.tabs.newGame');
    expect(html).toContain('play:chineseChess.tabs.rooms');
    expect(html).toContain('chinese-chess-float-orb');
    expect(html).toContain('chinese-chess-scroll');
  });

  it('opens selected room details in a closable floating panel', async () => {
    const roomSummary = {
      matchId: 'xiangqi-room-1',
      roomName: '楚河汉界',
      visibility: 'public',
      phase: 'waiting',
      playerCount: 1,
      seatsRemaining: 1,
      readyCount: 0,
      spectatorCount: 0,
      players: [
        {
          agentId: 'agent-1',
          agentName: 'waibiwaibi',
          side: 'red',
          ready: false,
          connected: true,
        },
      ],
      createdAt: Date.now(),
    } as const;

    const roomState = {
      matchId: 'xiangqi-room-1',
      roomName: '楚河汉界',
      visibility: 'public',
      phase: 'waiting',
      seq: 1,
      serverTimestamp: Date.now(),
      moveCount: 0,
      positionFen: 'rnbakabnr/9/1c5c1/p1p1p1p1p/9/9/P1P1P1P1P/1C5C1/9/RNBAKABNR r',
      sideToMove: 'red',
      inCheck: false,
      clocks: {
        redMs: 600000,
        blackMs: 600000,
      },
      drawOfferBy: null,
      players: [
        {
          agentId: 'agent-1',
          userId: 'user-1',
          agentName: 'waibiwaibi',
          side: 'red',
          ready: false,
          connected: true,
          disconnectDeadlineAt: null,
        },
      ],
      yourAgentId: 'agent-1',
      yourSide: 'red',
      result: null,
      legalMoves: [],
      moveHistory: [],
    } as const;

    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          isConnected: true,
          isController: true,
          hasController: true,
          inCity: true,
          currentLocation: 'uruc.chinese-chess.chinese-chess-club',
          refreshSessionState: async () => ({
            ...createSessionState(),
            isController: true,
            hasController: true,
            inCity: true,
            currentLocation: 'uruc.chinese-chess.chinese-chess-club',
          }),
          sendCommand: async <T,>(type: string, payload?: unknown) => {
            if (type === 'uruc.chinese-chess.bootstrap@v1') {
              return {
                currentMatch: null,
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
            if (type === 'uruc.chinese-chess.list_rooms@v1') {
              return {
                rooms: [roomSummary],
                directoryVersion: 1,
                query: null,
              } as T;
            }
            if (type === 'uruc.chinese-chess.watch_room@v1' && (payload as { matchId?: string } | undefined)?.matchId === roomSummary.matchId) {
              return {
                room: roomSummary,
                state: roomState,
              } as T;
            }
            return {} as T;
          },
        }),
      }),
      <ChineseChessPage />,
    );

    try {
      const roomsTab = Array.from(mounted.container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('play:chineseChess.tabs.rooms'),
      );

      expect(roomsTab).toBeTruthy();
      if (!roomsTab) {
        throw new Error('Missing Rooms tab button');
      }

      await act(async () => {
        roomsTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();
      });

      const roomCard = Array.from(mounted.container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes(roomSummary.roomName),
      );

      expect(roomCard).toBeTruthy();
      if (!roomCard) {
        throw new Error('Missing room card button');
      }

      await act(async () => {
        roomCard.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mounted.container.innerHTML).toContain('chinese-chess-room-detail-modal');
      expect(mounted.container.innerHTML).toContain('play:chineseChess.page.selectedRoomTitle');

      const closeButton = mounted.container.querySelector('button[aria-label="play:chineseChess.page.closeRoomPanel"]');
      expect(closeButton).toBeTruthy();
      if (!closeButton) {
        throw new Error('Missing close button');
      }

      await act(async () => {
        closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
      });

      expect(mounted.container.innerHTML).not.toContain('chinese-chess-room-detail-modal');
      expect(mounted.container.innerHTML).toContain('play:chineseChess.page.roomsTitle');
    } finally {
      await mounted.unmount();
    }
  });
});
