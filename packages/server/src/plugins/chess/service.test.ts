import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { createDb } from '../../core/database/index.js';
import { ChessService, CHESS_LOCATION_ID } from './service.js';

type SentMessage = {
  type: string;
  payload?: unknown;
};

function createHarness() {
  const inbox = new Map<string, SentMessage[]>();
  const locations = new Map<string, string>();

  const gateway = {
    send() {},
    broadcast() {},
    sendToAgent(agentId: string, msg: SentMessage) {
      const current = inbox.get(agentId) ?? [];
      current.push(msg);
      inbox.set(agentId, current);
    },
    pushToOwner() {},
    getOnlineAgentIds() {
      return Array.from(locations.keys());
    },
    getAgentCurrentLocation(agentId: string) {
      return locations.get(agentId);
    },
  };

  const service = new ChessService(createDb(':memory:'), gateway);
  service.init();

  return {
    service,
    setLocation(agentId: string, locationId: string | null) {
      if (locationId) locations.set(agentId, locationId);
      else locations.delete(agentId);
    },
    messages(agentId: string) {
      return inbox.get(agentId) ?? [];
    },
  };
}

describe('ChessService incremental protocol', () => {
  beforeEach(() => {
    vi.useRealTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('lists only joinable waiting rooms and emits lobby deltas', () => {
    const harness = createHarness();
    harness.setLocation('watcher', CHESS_LOCATION_ID);
    harness.setLocation('agent-a', CHESS_LOCATION_ID);
    harness.setLocation('agent-b', CHESS_LOCATION_ID);

    const created = harness.service.createMatch({
      agentId: 'agent-a',
      userId: 'user-a',
      agentName: 'Alpha',
    });

    expect(created.ok).toBe(true);
    expect(harness.service.listMatches()).toHaveLength(1);
    expect(harness.service.listMatches()[0]?.seatsRemaining).toBe(1);
    expect(harness.messages('watcher')[0]?.type).toBe('chess_lobby_delta');
    expect((harness.messages('watcher')[0]?.payload as { kind?: string })?.kind).toBe('room_added');

    const joined = harness.service.joinMatch({
      agentId: 'agent-b',
      userId: 'user-b',
      agentName: 'Beta',
    }, created.ok ? created.data.matchId : '');

    expect(joined.ok).toBe(true);
    expect(harness.service.listMatches()).toHaveLength(0);

    const lobbyKinds = harness.messages('watcher')
      .filter((message) => message.type === 'chess_lobby_delta')
      .map((message) => (message.payload as { kind: string }).kind);
    expect(lobbyKinds).toEqual(['room_added', 'room_removed']);
  });

  it('returns bootstrap snapshots while active pushes stay incremental', async () => {
    const harness = createHarness();
    harness.setLocation('agent-a', CHESS_LOCATION_ID);
    harness.setLocation('watcher', CHESS_LOCATION_ID);

    const created = harness.service.createMatch({
      agentId: 'agent-a',
      userId: 'user-a',
      agentName: 'Alpha',
    });
    expect(created.ok).toBe(true);

    const bootstrap = await harness.service.bootstrap('agent-a', 'user-a');
    expect(bootstrap.ok).toBe(true);
    if (!bootstrap.ok || !created.ok) return;

    expect(bootstrap.data.currentMatch?.matchId).toBe(created.data.matchId);
    expect(bootstrap.data.joinableMatches).toHaveLength(1);
    expect(bootstrap.data.rating.rating).toBe(1500);

    const joined = harness.service.joinMatch({
      agentId: 'agent-b',
      userId: 'user-b',
      agentName: 'Beta',
    }, created.data.matchId);
    expect(joined.ok).toBe(true);

    const delta = harness.messages('agent-a').find((message) => message.type === 'chess_match_delta');
    expect(delta).toBeTruthy();
    expect((delta?.payload as Record<string, unknown>).state).toBeUndefined();
    expect((delta?.payload as Record<string, unknown>).fen).toBeUndefined();
    expect((delta?.payload as { kind?: string }).kind).toBe('player_joined');
  });

  it('preserves waiting rooms during the reconnect grace window', () => {
    vi.useFakeTimers();
    const harness = createHarness();
    harness.setLocation('watcher', CHESS_LOCATION_ID);
    harness.setLocation('agent-a', CHESS_LOCATION_ID);

    const created = harness.service.createMatch({
      agentId: 'agent-a',
      userId: 'user-a',
      agentName: 'Alpha',
    });
    expect(created.ok).toBe(true);

    harness.service.onAgentDisconnected('agent-a');
    const afterDisconnect = harness.service.getState('agent-a');
    expect(afterDisconnect.ok).toBe(true);
    if (!afterDisconnect.ok) return;
    expect(afterDisconnect.data.players[0]?.connected).toBe(false);
    expect(harness.service.listMatches()[0]?.players[0]?.connected).toBe(false);

    const reconnected = harness.service.onAgentReconnected('agent-a');
    expect(reconnected.ok).toBe(true);
    if (!reconnected.ok) return;
    expect(reconnected.data.players[0]?.connected).toBe(true);

    vi.advanceTimersByTime(61_000);
    expect(harness.service.getAgentMatchPhase('agent-a')).toBe('waiting');
    expect(harness.service.listMatches()).toHaveLength(1);
  });

  it('removes waiting rooms only after disconnect grace expires', () => {
    vi.useFakeTimers();
    const harness = createHarness();
    harness.setLocation('watcher', CHESS_LOCATION_ID);
    harness.setLocation('agent-a', CHESS_LOCATION_ID);

    const created = harness.service.createMatch({
      agentId: 'agent-a',
      userId: 'user-a',
      agentName: 'Alpha',
    });
    expect(created.ok).toBe(true);

    harness.service.onAgentDisconnected('agent-a');
    vi.advanceTimersByTime(61_000);

    expect(harness.service.getAgentMatchPhase('agent-a')).toBeNull();
    expect(harness.service.listMatches()).toHaveLength(0);

    const lobbyKinds = harness.messages('watcher')
      .filter((message) => message.type === 'chess_lobby_delta')
      .map((message) => (message.payload as { kind: string }).kind);
    expect(lobbyKinds).toEqual(['room_added', 'room_updated', 'room_removed']);
  });

  it('increments match delta sequence numbers across waiting and playing events', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0);
    const harness = createHarness();

    const created = harness.service.createMatch({
      agentId: 'agent-a',
      userId: 'user-a',
      agentName: 'Alpha',
    });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    expect(harness.service.joinMatch({
      agentId: 'agent-b',
      userId: 'user-b',
      agentName: 'Beta',
    }, created.data.matchId).ok).toBe(true);

    expect(harness.service.ready('agent-a').ok).toBe(true);
    expect(harness.service.ready('agent-b').ok).toBe(true);
    const moved = await harness.service.move('agent-a', { from: 'e2', to: 'e4' });
    expect(moved.ok).toBe(true);

    const sequences = harness.messages('agent-a')
      .filter((message) => message.type === 'chess_match_delta')
      .map((message) => (message.payload as { seq: number }).seq);

    expect(sequences).toEqual([1, 2, 3, 4]);
  });
});
