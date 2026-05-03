// @vitest-environment jsdom

import React, { type ReactElement } from 'react';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { renderToStaticMarkup } from 'react-dom/server';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import type { PluginPageData, PluginRuntimeApi, PluginSessionState } from '@uruc/plugin-sdk/frontend';
import { PluginPageContext } from '@uruc/plugin-sdk/frontend-react';
import { ChessPage } from './ChessPage';

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
    hasActionLease: false,
    isActionLeaseHolder: false,
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
    hasActionLease: false,
    isActionLeaseHolder: false,
    error: '',
    inCity: false,
    currentLocation: null,
    agentId: 'agent-1',
    agentName: 'Test Agent',
    connect: async () => undefined,
    disconnect: () => undefined,
    acquireActionLease: async () => createSessionState(),
    releaseActionLease: async () => createSessionState(),
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
    pluginId: 'uruc.chess',
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

describe('ChessPage room workflows', () => {
  it('renders a dedicated Rooms tab and keeps public room browsing out of New game', () => {
    const html = renderPluginPage(
      createPageData(),
      <ChessPage />,
    );

    expect(html).toContain('chess.page.tabRooms');
    expect(html).not.toContain('chess.page.joinableMatches');
  });

  it('shows the active room only in room management after bootstrap', async () => {
    const currentMatch = {
      matchId: '60eb0e51-5',
      roomName: 'waibiwaibi room',
      visibility: 'public',
      phase: 'waiting',
      seq: 1,
      serverTimestamp: Date.now(),
      moveCount: 0,
      fen: 'rn1qkbnr/pppbpppp/8/3p4/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '',
      turn: null,
      inCheck: false,
      clocks: {
        whiteMs: 600000,
        blackMs: 600000,
      },
      drawOfferBy: null,
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
          isActionLeaseHolder: true,
          hasActionLease: true,
          inCity: true,
          currentLocation: 'uruc.chess.chess-club',
          refreshSessionState: async () => ({
            ...createSessionState(),
            isActionLeaseHolder: true,
            hasActionLease: true,
            inCity: true,
            currentLocation: 'uruc.chess.chess-club',
          }),
          sendCommand: async <T,>(type: string) => {
            if (type === 'uruc.chess.bootstrap@v1') {
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
      <ChessPage />,
    );

    expect((html.match(/waibiwaibi room/g) ?? []).length).toBe(1);
    expect(html).not.toContain('Optional custom room name');
  });

  it('does not render an empty detail placeholder before a room is selected', async () => {
    const commandTypes: string[] = [];
    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          isConnected: true,
          isActionLeaseHolder: true,
          hasActionLease: true,
          inCity: true,
          currentLocation: 'uruc.chess.chess-club',
          refreshSessionState: async () => ({
            ...createSessionState(),
            isActionLeaseHolder: true,
            hasActionLease: true,
            inCity: true,
            currentLocation: 'uruc.chess.chess-club',
          }),
          sendCommand: async <T,>(type: string) => {
            commandTypes.push(type);
            if (type === 'uruc.chess.bootstrap@v1') {
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
            if (type === 'uruc.chess.list_rooms@v1') {
              return {
                rooms: [],
                directoryVersion: 1,
                query: null,
              } as T;
            }
            return {} as T;
          },
        }),
      }),
      <ChessPage />,
    );

    try {
      const roomsTab = Array.from(mounted.container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('chess.page.tabRooms'),
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

      expect(mounted.container.innerHTML).not.toContain('chess.page.roomsEmptyState');
      expect(mounted.container.innerHTML).not.toContain('chess.page.hallJournal');
      expect(commandTypes.filter((type) => type === 'uruc.chess.list_rooms@v1')).toHaveLength(1);
    } finally {
      await mounted.unmount();
    }
  });

  it('opens selected room details in a closable floating panel', async () => {
    const roomSummary = {
      matchId: '34e9d2d3-f',
      roomName: 'waibi',
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
          ready: false,
          connected: true,
        },
      ],
      createdAt: Date.now(),
    } as const;

    const roomState = {
      matchId: '34e9d2d3-f',
      roomName: 'waibi',
      visibility: 'public',
      phase: 'waiting',
      seq: 1,
      serverTimestamp: Date.now(),
      moveCount: 0,
      fen: 'rn1qkbnr/pppbpppp/8/3p4/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '',
      turn: null,
      inCheck: false,
      clocks: {
        whiteMs: 600000,
        blackMs: 600000,
      },
      drawOfferBy: null,
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

    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          isConnected: true,
          isActionLeaseHolder: true,
          hasActionLease: true,
          inCity: true,
          currentLocation: 'uruc.chess.chess-club',
          refreshSessionState: async () => ({
            ...createSessionState(),
            isActionLeaseHolder: true,
            hasActionLease: true,
            inCity: true,
            currentLocation: 'uruc.chess.chess-club',
          }),
          sendCommand: async <T,>(type: string, payload?: unknown) => {
            if (type === 'uruc.chess.bootstrap@v1') {
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
            if (type === 'uruc.chess.list_rooms@v1') {
              return {
                rooms: [roomSummary],
                directoryVersion: 1,
                query: null,
              } as T;
            }
            if (type === 'uruc.chess.watch_room@v1' && (payload as { matchId?: string } | undefined)?.matchId === roomSummary.matchId) {
              return {
                room: roomSummary,
                state: roomState,
              } as T;
            }
            return {} as T;
          },
        }),
      }),
      <ChessPage />,
    );

    try {
      const roomsTab = Array.from(mounted.container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('chess.page.tabRooms'),
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

      expect(mounted.container.innerHTML).toContain('chess-room-detail-modal');
      expect(mounted.container.innerHTML).toContain('chess.page.selectedRoomTitle');

      const closeButton = mounted.container.querySelector('button[aria-label="chess.page.closeRoomPanel"]');
      expect(closeButton).toBeTruthy();
      if (!closeButton) {
        throw new Error('Missing close button');
      }

      await act(async () => {
        closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
      });

      expect(mounted.container.innerHTML).not.toContain('chess-room-detail-modal');
      expect(mounted.container.innerHTML).toContain('chess.page.roomsListTitle');
    } finally {
      await mounted.unmount();
    }
  });

  it('shows cancel ready for a ready seat and sends the unready command', async () => {
    const commandTypes: string[] = [];
    const readyMatch = {
      matchId: '34e9d2d3-f',
      roomName: 'waibi',
      visibility: 'public',
      phase: 'waiting',
      seq: 3,
      serverTimestamp: Date.now(),
      moveCount: 0,
      fen: 'rn1qkbnr/pppbpppp/8/3p4/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '',
      turn: null,
      inCheck: false,
      clocks: {
        whiteMs: 600000,
        blackMs: 600000,
      },
      drawOfferBy: null,
      players: [
        {
          agentId: 'agent-1',
          userId: 'user-1',
          agentName: 'waibiwaibi',
          color: null,
          ready: true,
          connected: true,
          disconnectDeadlineAt: null,
        },
      ],
      yourAgentId: 'agent-1',
      yourColor: null,
      result: null,
      legalMoves: [],
    } as const;

    const unreadyMatch = {
      ...readyMatch,
      seq: 4,
      players: readyMatch.players.map((player) => ({ ...player, ready: false })),
    };

    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          isConnected: true,
          isActionLeaseHolder: true,
          hasActionLease: true,
          inCity: true,
          currentLocation: 'uruc.chess.chess-club',
          refreshSessionState: async () => ({
            ...createSessionState(),
            isActionLeaseHolder: true,
            hasActionLease: true,
            inCity: true,
            currentLocation: 'uruc.chess.chess-club',
          }),
          sendCommand: async <T,>(type: string) => {
            commandTypes.push(type);
            if (type === 'uruc.chess.bootstrap@v1') {
              return {
                currentMatch: readyMatch,
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
            if (type === 'uruc.chess.unready@v1') {
              return {
                state: unreadyMatch,
              } as T;
            }
            return {} as T;
          },
        }),
      }),
      <ChessPage />,
    );

    try {
      const unreadyButton = Array.from(mounted.container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('chess.commands.unready'),
      );

      expect(unreadyButton).toBeTruthy();
      if (!unreadyButton) {
        throw new Error('Missing unready button');
      }

      await act(async () => {
        unreadyButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(commandTypes).toContain('uruc.chess.unready@v1');
      expect(mounted.container.innerHTML).toContain('chess.commands.ready');
    } finally {
      await mounted.unmount();
    }
  });

  it('shows active spectator status and lets the user stop watching', async () => {
    const commandTypes: string[] = [];
    const roomSummary = {
      matchId: 'watch-room-1',
      roomName: 'Spectator table',
      visibility: 'public',
      phase: 'playing',
      playerCount: 2,
      seatsRemaining: 0,
      readyCount: 2,
      spectatorCount: 3,
      players: [
        {
          agentId: 'agent-a',
          agentName: 'Alpha',
          ready: true,
          connected: true,
        },
        {
          agentId: 'agent-b',
          agentName: 'Beta',
          ready: true,
          connected: true,
        },
      ],
      createdAt: Date.now(),
    } as const;

    const roomState = {
      matchId: 'watch-room-1',
      roomName: 'Spectator table',
      visibility: 'public',
      phase: 'playing',
      seq: 8,
      serverTimestamp: Date.now(),
      moveCount: 4,
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 2 3',
      pgn: '1. e4 e5 2. Nf3 Nc6',
      turn: 'w',
      inCheck: false,
      clocks: {
        whiteMs: 300000,
        blackMs: 240000,
      },
      drawOfferBy: null,
      players: [
        {
          agentId: 'agent-a',
          userId: 'user-a',
          agentName: 'Alpha',
          color: 'w',
          ready: true,
          connected: true,
          disconnectDeadlineAt: null,
        },
        {
          agentId: 'agent-b',
          userId: 'user-b',
          agentName: 'Beta',
          color: 'b',
          ready: true,
          connected: true,
          disconnectDeadlineAt: null,
        },
      ],
      yourAgentId: 'agent-1',
      yourColor: null,
      result: null,
      legalMoves: [],
    } as const;

    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          isConnected: true,
          isActionLeaseHolder: true,
          hasActionLease: true,
          inCity: true,
          currentLocation: 'uruc.chess.chess-club',
          refreshSessionState: async () => ({
            ...createSessionState(),
            isActionLeaseHolder: true,
            hasActionLease: true,
            inCity: true,
            currentLocation: 'uruc.chess.chess-club',
          }),
          sendCommand: async <T,>(type: string, payload?: unknown) => {
            commandTypes.push(type);
            if (type === 'uruc.chess.bootstrap@v1') {
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
            if (type === 'uruc.chess.list_rooms@v1') {
              return {
                rooms: [roomSummary],
                directoryVersion: 1,
                query: null,
              } as T;
            }
            if (type === 'uruc.chess.watch_room@v1' && (payload as { matchId?: string } | undefined)?.matchId === roomSummary.matchId) {
              return {
                room: roomSummary,
                state: roomState,
              } as T;
            }
            if (type === 'uruc.chess.unwatch_room@v1') {
              return {
                matchId: roomSummary.matchId,
              } as T;
            }
            return {} as T;
          },
        }),
      }),
      <ChessPage />,
    );

    try {
      const roomsTab = Array.from(mounted.container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('chess.page.tabRooms'),
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

      expect(mounted.container.innerHTML).toContain('chess.page.watchingNow');
      expect(mounted.container.innerHTML).toContain(roomSummary.matchId);

      const stopWatchingButton = Array.from(mounted.container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('chess.page.stopWatching'),
      );

      expect(stopWatchingButton).toBeTruthy();
      if (!stopWatchingButton) {
        throw new Error('Missing stop watching button');
      }

      await act(async () => {
        stopWatchingButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(commandTypes).toContain('uruc.chess.unwatch_room@v1');
      expect(mounted.container.innerHTML).not.toContain('chess.page.watchingNow');
    } finally {
      await mounted.unmount();
    }
  });

  it('does not rewind spectator clocks when the same room snapshot arrives again', async () => {
    vi.useFakeTimers();
    let currentNow = 1000;
    const performanceSpy = vi.spyOn(performance, 'now').mockImplementation(() => currentNow);
    let roomDeltaListener: ((payload: unknown) => void) | null = null;

    const roomSummary = {
      matchId: 'watch-room-2',
      roomName: 'Clock table',
      visibility: 'public',
      phase: 'playing',
      playerCount: 2,
      seatsRemaining: 0,
      readyCount: 2,
      spectatorCount: 1,
      players: [
        {
          agentId: 'agent-a',
          agentName: 'Alpha',
          ready: true,
          connected: true,
        },
        {
          agentId: 'agent-b',
          agentName: 'Beta',
          ready: true,
          connected: true,
        },
      ],
      createdAt: Date.now(),
    } as const;

    const roomState = {
      matchId: 'watch-room-2',
      roomName: 'Clock table',
      visibility: 'public',
      phase: 'playing',
      seq: 12,
      serverTimestamp: Date.now(),
      moveCount: 10,
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/2P2N2/PP3PPP/RNBQKB1R w KQkq - 0 4',
      pgn: '1. e4 e5 2. Nf3 Nc6 3. c3',
      turn: 'w',
      inCheck: false,
      clocks: {
        whiteMs: 300000,
        blackMs: 240000,
      },
      drawOfferBy: null,
      players: [
        {
          agentId: 'agent-a',
          userId: 'user-a',
          agentName: 'Alpha',
          color: 'w',
          ready: true,
          connected: true,
          disconnectDeadlineAt: null,
        },
        {
          agentId: 'agent-b',
          userId: 'user-b',
          agentName: 'Beta',
          color: 'b',
          ready: true,
          connected: true,
          disconnectDeadlineAt: null,
        },
      ],
      yourAgentId: 'agent-1',
      yourColor: null,
      result: null,
      legalMoves: [],
    } as const;

    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          isConnected: true,
          isActionLeaseHolder: true,
          hasActionLease: true,
          inCity: true,
          currentLocation: 'uruc.chess.chess-club',
          refreshSessionState: async () => ({
            ...createSessionState(),
            isActionLeaseHolder: true,
            hasActionLease: true,
            inCity: true,
            currentLocation: 'uruc.chess.chess-club',
          }),
          subscribe: (event, handler) => {
            if (event === 'chess_room_delta') {
              roomDeltaListener = handler;
            }
            return () => undefined;
          },
          sendCommand: async <T,>(type: string, payload?: unknown) => {
            if (type === 'uruc.chess.bootstrap@v1') {
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
            if (type === 'uruc.chess.list_rooms@v1') {
              return {
                rooms: [roomSummary],
                directoryVersion: 1,
                query: null,
              } as T;
            }
            if (type === 'uruc.chess.watch_room@v1' && (payload as { matchId?: string } | undefined)?.matchId === roomSummary.matchId) {
              return {
                room: roomSummary,
                state: roomState,
              } as T;
            }
            return {} as T;
          },
        }),
      }),
      <ChessPage />,
    );

    try {
      const roomsTab = Array.from(mounted.container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('chess.page.tabRooms'),
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

      expect(mounted.container.innerHTML).toContain('05:00');

      currentNow += 1000;
      await act(async () => {
        vi.advanceTimersByTime(1000);
        await Promise.resolve();
      });

      expect(mounted.container.innerHTML).toContain('04:59');
      expect(roomDeltaListener).toBeTruthy();

      if (!roomDeltaListener) {
        throw new Error('Missing room delta listener');
      }

      await act(async () => {
        roomDeltaListener({
          matchId: roomSummary.matchId,
          seq: roomState.seq,
          phase: roomState.phase,
          serverTimestamp: roomState.serverTimestamp,
          spectatorCount: roomSummary.spectatorCount,
          state: roomState,
        });
        await Promise.resolve();
      });

      expect(mounted.container.innerHTML).toContain('04:59');
      expect(mounted.container.innerHTML).not.toContain('05:00');
    } finally {
      performanceSpy.mockRestore();
      vi.useRealTimers();
      await mounted.unmount();
    }
  });

  it('resyncs the current match once when slim match delta and turn prompt arrive together', async () => {
    vi.useFakeTimers();
    let matchDeltaListener: ((payload: unknown) => void) | null = null;
    let turnPromptListener: ((payload: unknown) => void) | null = null;
    const commandTypes: string[] = [];

    const initialMatch = {
      matchId: 'live-match-1',
      roomName: 'Live table',
      visibility: 'public',
      phase: 'playing',
      seq: 3,
      serverTimestamp: Date.now(),
      moveCount: 0,
      fen: 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1',
      pgn: '',
      turn: 'w',
      inCheck: false,
      clocks: {
        whiteMs: 600000,
        blackMs: 600000,
      },
      drawOfferBy: null,
      players: [
        {
          agentId: 'agent-1',
          userId: 'user-1',
          agentName: 'Alpha',
          color: 'w',
          ready: true,
          connected: true,
          disconnectDeadlineAt: null,
        },
        {
          agentId: 'agent-2',
          userId: 'user-2',
          agentName: 'Beta',
          color: 'b',
          ready: true,
          connected: true,
          disconnectDeadlineAt: null,
        },
      ],
      yourAgentId: 'agent-1',
      yourColor: 'w',
      result: null,
      legalMoves: [
        { from: 'e2', to: 'e4', san: 'e4', promotion: null },
      ],
    } as const;

    const resyncedMatch = {
      ...initialMatch,
      seq: 4,
      serverTimestamp: initialMatch.serverTimestamp + 1000,
      moveCount: 1,
      fen: 'rnbqkbnr/pppppppp/8/8/4P3/8/PPPP1PPP/RNBQKBNR b KQkq - 0 1',
      pgn: '1. e4',
      turn: 'b',
      legalMoves: [],
    } as const;

    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          isConnected: true,
          isActionLeaseHolder: true,
          hasActionLease: true,
          inCity: true,
          currentLocation: 'uruc.chess.chess-club',
          refreshSessionState: async () => ({
            ...createSessionState(),
            isActionLeaseHolder: true,
            hasActionLease: true,
            inCity: true,
            currentLocation: 'uruc.chess.chess-club',
          }),
          subscribe: (event, handler) => {
            if (event === 'chess_match_delta') matchDeltaListener = handler;
            if (event === 'chess_turn_prompt') turnPromptListener = handler;
            return () => undefined;
          },
          sendCommand: async <T,>(type: string) => {
            commandTypes.push(type);
            if (type === 'uruc.chess.bootstrap@v1') {
              return {
                currentMatch: initialMatch,
                joinableMatches: [],
                lobbyVersion: 1,
                rating: {
                  agentId: 'agent-1',
                  userId: 'user-1',
                  agentName: 'Alpha',
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
            if (type === 'uruc.chess.state@v1') {
              return resyncedMatch as T;
            }
            return {} as T;
          },
        }),
      }),
      <ChessPage />,
    );

    try {
      expect(matchDeltaListener).toBeTruthy();
      expect(turnPromptListener).toBeTruthy();

      if (!matchDeltaListener || !turnPromptListener) {
        throw new Error('Missing realtime listeners');
      }

      await act(async () => {
        matchDeltaListener({
          matchId: initialMatch.matchId,
          seq: 4,
          kind: 'move_made',
          phase: 'playing',
          serverTimestamp: resyncedMatch.serverTimestamp,
          needsMatchRefresh: true,
        });
        turnPromptListener({
          matchId: initialMatch.matchId,
          seq: 4,
          serverTimestamp: resyncedMatch.serverTimestamp,
          promptKind: 'turn',
          reminder: false,
          yourColor: 'b',
          remainingMs: 600000,
          legalMoves: [],
          needsMatchRefresh: true,
        });
        vi.advanceTimersByTime(60);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(commandTypes.filter((type) => type === 'uruc.chess.state@v1')).toHaveLength(1);
      expect(mounted.container.innerHTML).toContain('e4');
    } finally {
      vi.useRealTimers();
      await mounted.unmount();
    }
  });

  it('resyncs a watched room when a slim room delta arrives without state', async () => {
    vi.useFakeTimers();
    let roomDeltaListener: ((payload: unknown) => void) | null = null;
    const stateCalls: Array<unknown> = [];

    const roomSummary = {
      matchId: 'watch-room-slim',
      roomName: 'Slim watch',
      visibility: 'public',
      phase: 'playing',
      playerCount: 2,
      seatsRemaining: 0,
      readyCount: 2,
      spectatorCount: 1,
      players: [
        {
          agentId: 'agent-a',
          agentName: 'Alpha',
          ready: true,
          connected: true,
        },
        {
          agentId: 'agent-b',
          agentName: 'Beta',
          ready: true,
          connected: true,
        },
      ],
      createdAt: Date.now(),
    } as const;

    const watchedState = {
      matchId: roomSummary.matchId,
      roomName: roomSummary.roomName,
      visibility: 'public',
      phase: 'playing',
      seq: 5,
      serverTimestamp: Date.now(),
      moveCount: 2,
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/8/PPPP1PPP/RNBQKBNR w KQkq - 0 2',
      pgn: '1. e4 e5',
      turn: 'w',
      inCheck: false,
      clocks: {
        whiteMs: 300000,
        blackMs: 300000,
      },
      drawOfferBy: null,
      players: [
        {
          agentId: 'agent-a',
          userId: 'user-a',
          agentName: 'Alpha',
          color: 'w',
          ready: true,
          connected: true,
          disconnectDeadlineAt: null,
        },
        {
          agentId: 'agent-b',
          userId: 'user-b',
          agentName: 'Beta',
          color: 'b',
          ready: true,
          connected: true,
          disconnectDeadlineAt: null,
        },
      ],
      yourAgentId: 'agent-1',
      yourColor: null,
      result: null,
      legalMoves: [],
    } as const;

    const resyncedState = {
      ...watchedState,
      seq: 6,
      serverTimestamp: watchedState.serverTimestamp + 1000,
      moveCount: 3,
      fen: 'rnbqkbnr/pppp1ppp/8/4p3/4P3/5N2/PPPP1PPP/RNBQKB1R b KQkq - 1 2',
      pgn: '1. e4 e5 2. Nf3',
      turn: 'b',
    } as const;

    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          isConnected: true,
          isActionLeaseHolder: true,
          hasActionLease: true,
          inCity: true,
          currentLocation: 'uruc.chess.chess-club',
          refreshSessionState: async () => ({
            ...createSessionState(),
            isActionLeaseHolder: true,
            hasActionLease: true,
            inCity: true,
            currentLocation: 'uruc.chess.chess-club',
          }),
          subscribe: (event, handler) => {
            if (event === 'chess_room_delta') roomDeltaListener = handler;
            return () => undefined;
          },
          sendCommand: async <T,>(type: string, payload?: unknown) => {
            if (type === 'uruc.chess.bootstrap@v1') {
              return {
                currentMatch: null,
                joinableMatches: [],
                lobbyVersion: 1,
                rating: {
                  agentId: 'agent-1',
                  userId: 'user-1',
                  agentName: 'Alpha',
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
            if (type === 'uruc.chess.list_rooms@v1') {
              return {
                rooms: [roomSummary],
                directoryVersion: 1,
                query: null,
              } as T;
            }
            if (type === 'uruc.chess.watch_room@v1') {
              return {
                room: roomSummary,
                state: watchedState,
              } as T;
            }
            if (type === 'uruc.chess.state@v1') {
              stateCalls.push(payload);
              return resyncedState as T;
            }
            return {} as T;
          },
        }),
      }),
      <ChessPage />,
    );

    try {
      const roomsTab = Array.from(mounted.container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('chess.page.tabRooms'),
      );
      expect(roomsTab).toBeTruthy();
      if (!roomsTab) throw new Error('Missing Rooms tab button');

      await act(async () => {
        roomsTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();
      });

      const roomCard = Array.from(mounted.container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes(roomSummary.roomName),
      );
      expect(roomCard).toBeTruthy();
      if (!roomCard) throw new Error('Missing room card button');

      await act(async () => {
        roomCard.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(roomDeltaListener).toBeTruthy();
      if (!roomDeltaListener) throw new Error('Missing room delta listener');

      await act(async () => {
        roomDeltaListener({
          matchId: roomSummary.matchId,
          seq: 6,
          phase: 'playing',
          serverTimestamp: resyncedState.serverTimestamp,
          spectatorCount: 3,
          needsWatchedRoomRefresh: true,
        });
        vi.advanceTimersByTime(60);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(stateCalls).toEqual([{ matchId: roomSummary.matchId }]);
    } finally {
      vi.useRealTimers();
      await mounted.unmount();
    }
  });

  it('refreshes the room directory when a slim room-directory delta arrives without a room summary', async () => {
    vi.useFakeTimers();
    let roomDirectoryListener: ((payload: unknown) => void) | null = null;
    const listRoomCalls: Array<unknown> = [];

    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          isConnected: true,
          isActionLeaseHolder: true,
          hasActionLease: true,
          inCity: true,
          currentLocation: 'uruc.chess.chess-club',
          refreshSessionState: async () => ({
            ...createSessionState(),
            isActionLeaseHolder: true,
            hasActionLease: true,
            inCity: true,
            currentLocation: 'uruc.chess.chess-club',
          }),
          subscribe: (event, handler) => {
            if (event === 'chess_room_directory_delta') roomDirectoryListener = handler;
            return () => undefined;
          },
          sendCommand: async <T,>(type: string, payload?: unknown) => {
            if (type === 'uruc.chess.bootstrap@v1') {
              return {
                currentMatch: null,
                joinableMatches: [],
                lobbyVersion: 1,
                rating: {
                  agentId: 'agent-1',
                  userId: 'user-1',
                  agentName: 'Alpha',
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
            if (type === 'uruc.chess.list_rooms@v1') {
              listRoomCalls.push(payload);
              return {
                rooms: [],
                directoryVersion: 1,
                query: null,
              } as T;
            }
            return {} as T;
          },
        }),
      }),
      <ChessPage />,
    );

    try {
      const roomsTab = Array.from(mounted.container.querySelectorAll('button')).find((button) =>
        button.textContent?.includes('chess.page.tabRooms'),
      );
      expect(roomsTab).toBeTruthy();
      if (!roomsTab) throw new Error('Missing Rooms tab button');

      await act(async () => {
        roomsTab.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
        await Promise.resolve();
      });

      listRoomCalls.length = 0;
      expect(roomDirectoryListener).toBeTruthy();
      if (!roomDirectoryListener) throw new Error('Missing room directory listener');

      await act(async () => {
        roomDirectoryListener({
          kind: 'room_updated',
          version: 2,
          matchId: 'room-2',
          needsRoomDirectoryRefresh: true,
        });
        vi.advanceTimersByTime(60);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(listRoomCalls).toEqual([{ query: undefined, limit: 40 }]);
    } finally {
      vi.useRealTimers();
      await mounted.unmount();
    }
  });

  it('shows a closable board-center result overlay when the current match finishes', async () => {
    vi.useFakeTimers();

    let matchDeltaListener: ((payload: unknown) => void) | null = null;
    let currentMatchState = {
      matchId: 'result-room-1',
      roomName: 'Result room',
      visibility: 'public',
      phase: 'playing',
      seq: 7,
      serverTimestamp: Date.now(),
      moveCount: 4,
      fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 2 3',
      pgn: '1. e4 e5 2. Nf3 Nc6',
      turn: 'w',
      inCheck: false,
      clocks: {
        whiteMs: 300000,
        blackMs: 240000,
      },
      drawOfferBy: null,
      players: [
        {
          agentId: 'agent-1',
          userId: 'user-1',
          agentName: 'Alpha',
          color: 'w',
          ready: true,
          connected: true,
          disconnectDeadlineAt: null,
        },
        {
          agentId: 'agent-b',
          userId: 'user-b',
          agentName: 'Beta',
          color: 'b',
          ready: true,
          connected: true,
          disconnectDeadlineAt: null,
        },
      ],
      yourAgentId: 'agent-1',
      yourColor: 'w',
      result: null,
      legalMoves: [],
    } as const;

    const finishedMatchState = {
      ...currentMatchState,
      phase: 'finished',
      seq: 8,
      turn: null,
      result: {
        result: 'black_win',
        reason: 'checkmate',
        winnerAgentId: 'agent-b',
        ratingChanges: {
          'agent-1': -14,
        },
        endedAt: 1_710_000_000_000,
      },
      legalMoves: [],
    } as const;

    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          isConnected: true,
          isActionLeaseHolder: true,
          hasActionLease: true,
          inCity: true,
          currentLocation: 'uruc.chess.chess-club',
          refreshSessionState: async () => ({
            ...createSessionState(),
            isActionLeaseHolder: true,
            hasActionLease: true,
            inCity: true,
            currentLocation: 'uruc.chess.chess-club',
          }),
          subscribe: (event, handler) => {
            if (event === 'chess_match_delta') matchDeltaListener = handler;
            return () => undefined;
          },
          sendCommand: async <T,>(type: string) => {
            if (type === 'uruc.chess.bootstrap@v1') {
              return {
                currentMatch: currentMatchState,
                joinableMatches: [],
                lobbyVersion: 1,
                rating: {
                  agentId: 'agent-1',
                  userId: 'user-1',
                  agentName: 'Alpha',
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
            if (type === 'uruc.chess.state@v1') {
              return currentMatchState as T;
            }
            return {} as T;
          },
        }),
      }),
      <ChessPage />,
    );

    try {
      expect(mounted.container.querySelector('.chess-result-overlay')).toBeNull();
      expect(matchDeltaListener).toBeTruthy();
      if (!matchDeltaListener) throw new Error('Missing match delta listener');

      currentMatchState = finishedMatchState;

      await act(async () => {
        matchDeltaListener({
          matchId: currentMatchState.matchId,
          seq: finishedMatchState.seq,
          kind: 'game_finished',
          serverTimestamp: finishedMatchState.serverTimestamp,
          result: finishedMatchState.result,
        });
        vi.advanceTimersByTime(80);
        await Promise.resolve();
        await Promise.resolve();
      });

      const overlay = mounted.container.querySelector('.chess-result-overlay');
      expect(overlay).toBeTruthy();
      expect(overlay?.textContent).toContain('chess.page.resultLabel');
      expect(overlay?.textContent).toContain('chess.result.blackWin');
      expect(overlay?.textContent).toContain('chess.page.yourEloDelta');

      const closeButton = mounted.container.querySelector('button[aria-label="chess.page.dismissResultOverlay"]');
      expect(closeButton).toBeTruthy();
      if (!closeButton) throw new Error('Missing result overlay close button');

      await act(async () => {
        closeButton.dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();
      });

      expect(mounted.container.querySelector('.chess-result-overlay')).toBeNull();
      expect(mounted.container.querySelector('.chess-board')).toBeTruthy();

      await act(async () => {
        matchDeltaListener({
          matchId: currentMatchState.matchId,
          seq: finishedMatchState.seq,
          kind: 'game_finished',
          serverTimestamp: finishedMatchState.serverTimestamp,
          result: finishedMatchState.result,
        });
        vi.advanceTimersByTime(80);
        await Promise.resolve();
        await Promise.resolve();
      });

      expect(mounted.container.querySelector('.chess-result-overlay')).toBeNull();
      expect(mounted.container.querySelector('.chess-board')).toBeTruthy();
    } finally {
      vi.useRealTimers();
      await mounted.unmount();
    }
  });

  it('distinguishes the latest move origin and destination on the board', async () => {
    const mounted = await mountPluginPageDom(
      createPageData({
        runtime: createRuntime({
          isConnected: true,
          isActionLeaseHolder: true,
          hasActionLease: true,
          inCity: true,
          currentLocation: 'uruc.chess.chess-club',
          refreshSessionState: async () => ({
            ...createSessionState(),
            isActionLeaseHolder: true,
            hasActionLease: true,
            inCity: true,
            currentLocation: 'uruc.chess.chess-club',
          }),
          sendCommand: async <T,>(type: string) => {
            if (type === 'uruc.chess.bootstrap@v1') {
              return {
                currentMatch: {
                  matchId: 'highlight-room-1',
                  roomName: 'Highlight room',
                  visibility: 'public',
                  phase: 'playing',
                  seq: 7,
                  serverTimestamp: Date.now(),
                  moveCount: 4,
                  fen: 'r1bqkbnr/pppp1ppp/2n5/4p3/3PP3/5N2/PPP2PPP/RNBQKB1R w KQkq - 2 3',
                  pgn: '1. e4 e5 2. Nf3 Nc6',
                  turn: 'w',
                  inCheck: false,
                  clocks: {
                    whiteMs: 300000,
                    blackMs: 240000,
                  },
                  drawOfferBy: null,
                  players: [
                    {
                      agentId: 'agent-1',
                      userId: 'user-1',
                      agentName: 'Alpha',
                      color: 'w',
                      ready: true,
                      connected: true,
                      disconnectDeadlineAt: null,
                    },
                    {
                      agentId: 'agent-b',
                      userId: 'user-b',
                      agentName: 'Beta',
                      color: 'b',
                      ready: true,
                      connected: true,
                      disconnectDeadlineAt: null,
                    },
                  ],
                  yourAgentId: 'agent-1',
                  yourColor: 'w',
                  result: null,
                  legalMoves: [],
                },
                joinableMatches: [],
                lobbyVersion: 1,
                rating: {
                  agentId: 'agent-1',
                  userId: 'user-1',
                  agentName: 'Alpha',
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
      <ChessPage />,
    );

    try {
      const fromSquare = mounted.container.querySelector('button[title="b8"]');
      const toSquare = mounted.container.querySelector('button[title="c6"]');

      expect(fromSquare).toBeTruthy();
      expect(toSquare).toBeTruthy();
      expect(fromSquare?.className).toContain('last-move-from');
      expect(fromSquare?.className).not.toContain('last-move-to');
      expect(toSquare?.className).toContain('last-move-to');
      expect(toSquare?.className).not.toContain('last-move-from');
    } finally {
      await mounted.unmount();
    }
  });

});
