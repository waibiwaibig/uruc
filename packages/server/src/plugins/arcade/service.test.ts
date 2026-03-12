import { afterEach, describe, expect, it, vi } from 'vitest';
import { sql } from 'drizzle-orm';

import { createDb } from '../../core/database/index.js';
import { ArcadeService } from './service.js';

async function createServiceHarness() {
  const sent: Array<{ agentId: string; msg: unknown }> = [];
  const gateway = {
    send() {},
    broadcast() {},
    sendToAgent(agentId: string, msg: unknown) {
      sent.push({ agentId, msg });
    },
    pushToOwner() {},
    getOnlineAgentIds() {
      return [];
    },
  };

  const service = new ArcadeService(createDb(':memory:'), gateway);
  service.init();
  await service.loadGames();
  return { service, sent };
}

async function createService() {
  const harness = await createServiceHarness();
  return harness.service;
}

function sentTableEvents(sent: Array<{ agentId: string; msg: unknown }>, agentId: string) {
  return sent.filter((entry) => (
    entry.agentId === agentId
      && typeof entry.msg === 'object'
      && entry.msg !== null
      && 'type' in entry.msg
      && (entry.msg as { type?: string }).type === 'arcade_table_event'
  ));
}

function sentTablePayloads(sent: Array<{ agentId: string; msg: unknown }>, agentId: string) {
  return sentTableEvents(sent, agentId)
    .map((entry) => (entry.msg as {
      payload?: {
        seq?: number;
        snapshotVersion?: number;
        change?: { kind?: string; message?: string };
        state?: {
          phase?: string;
          prompt?: string;
          legalActions?: Array<{ type?: string }>;
          deadlineAt?: number | null;
        };
      };
    }).payload)
    .filter((payload): payload is NonNullable<typeof payload> => Boolean(payload));
}

describe('ArcadeService', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('creates a starter wallet on first arcade entry', async () => {
    const service = await createService();

    const entered = await service.enterArcade({
      agentId: 'agent-a',
      userId: 'user-a',
      agentName: 'Alpha',
    });

    expect(entered.wallet.balance).toBe(1000);
    expect(entered.wallet.frozen).toBe(0);
    expect(service.listGames().map((item) => item.id)).toContain('blackjack');
  });

  it('allows claiming chips only after the wallet is empty', async () => {
    const db = createDb(':memory:');
    const gateway = {
      send() {},
      broadcast() {},
      sendToAgent() {},
      pushToOwner() {},
      getOnlineAgentIds() {
        return [];
      },
    };
    const service = new ArcadeService(db, gateway);
    service.init();
    await service.loadGames();

    await service.enterArcade({
      agentId: 'agent-a',
      userId: 'user-a',
      agentName: 'Alpha',
    });

    db.run(sql`
      UPDATE arcade_wallets
      SET balance = 0, frozen = 0
      WHERE agent_id = 'agent-a'
    `);

    const claimed = await service.claimChips({
      agentId: 'agent-a',
      userId: 'user-a',
      agentName: 'Alpha',
    });

    expect(claimed.ok).toBe(true);
    if (!claimed.ok) return;
    expect(claimed.data.wallet.balance).toBe(1000);
  });

  it('can create a blackjack table, join it, and place a bet through the generic action interface', async () => {
    const service = await createService();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    const created = await service.createTable(alpha, { gameId: 'blackjack', name: 'Alpha Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);
    expect((await service.joinTable(beta, tableId)).ok).toBe(true);

    expect((await service.handleGameAction(alpha, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'ready' })).ok).toBe(true);
    const started = await service.handleGameAction(alpha, tableId, { type: 'start_round' });
    expect(started.ok).toBe(true);

    const bet = await service.handleGameAction(alpha, tableId, { type: 'bet', amount: 50 });
    expect(bet.ok).toBe(true);
    if (!bet.ok) return;

    const wallet = service.getWalletSnapshot(alpha.agentId);
    expect(wallet).not.toBeNull();
    expect((wallet?.balance ?? 0) + (wallet?.frozen ?? 0)).toBeGreaterThanOrEqual(950);
    expect(bet.data.message).toContain('bet');
    expect(bet.data.eventSeq).toBeGreaterThan(0);
    expect(bet.data.snapshotVersion).toBeGreaterThan(0);
    expect('table' in bet.data).toBe(false);

    const tableState = service.getTableState(tableId, alpha.agentId);
    expect(tableState.ok).toBe(true);
    if (!tableState.ok) return;
    expect(tableState.data.table.gameId).toBe('blackjack');
  });

  it('returns frozen chips when a table is closed mid-round', async () => {
    const service = await createService();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    const created = await service.createTable(alpha, { gameId: 'blackjack', name: 'Alpha Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);
    expect((await service.joinTable(beta, tableId)).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'start_round' })).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'bet', amount: 50 })).ok).toBe(true);

    const beforeClose = service.getWalletSnapshot(alpha.agentId);
    expect(beforeClose?.balance).toBe(950);
    expect(beforeClose?.frozen).toBe(50);

    const closed = await service.closeTable(tableId, alpha.agentId);
    expect(closed.ok).toBe(true);

    const afterClose = service.getWalletSnapshot(alpha.agentId);
    expect(afterClose?.balance).toBe(1000);
    expect(afterClose?.frozen).toBe(0);
  });

  it('transfers table ownership bookkeeping when the owner leaves', async () => {
    const service = await createService();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    const created = await service.createTable(alpha, { gameId: 'blackjack', name: 'Shared Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const originalTableId = created.data.tableId;
    expect((await service.joinTable(alpha, originalTableId)).ok).toBe(true);
    expect((await service.joinTable(beta, originalTableId)).ok).toBe(true);

    const left = await service.leaveTable(alpha);
    expect(left.ok).toBe(true);

    const alphaSecondTable = await service.createTable(alpha, { gameId: 'blackjack', name: 'Alpha New Table' });
    expect(alphaSecondTable.ok).toBe(true);

    const betaClosed = await service.closeTable(originalTableId, beta.agentId);
    expect(betaClosed.ok).toBe(true);
  });

  it('auto closes an empty table immediately after the last seated player leaves', async () => {
    const service = await createService();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };

    await service.enterArcade(alpha);

    const created = await service.createTable(alpha, { gameId: 'blackjack', name: 'Owner Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);

    const left = await service.leaveTable(alpha);
    expect(left.ok).toBe(true);
    if (!left.ok) return;

    expect(left.data.lobby.tables.some((table) => table.tableId === tableId)).toBe(false);

    const gone = service.getTableState(tableId, alpha.agentId);
    expect(gone.ok).toBe(false);
    if (gone.ok) return;
    expect(gone.error.code).toBe('TABLE_NOT_FOUND');

    const createdAgain = await service.createTable(alpha, { gameId: 'blackjack', name: 'Replacement Table' });
    expect(createdAgain.ok).toBe(true);
  });

  it('only closes a table once every player and spectator has left the room', async () => {
    const service = await createService();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    const created = await service.createTable(alpha, { gameId: 'blackjack', name: 'Cleanup Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);
    expect(service.watchTable(beta, tableId).ok).toBe(true);

    const left = await service.leaveTable(alpha);
    expect(left.ok).toBe(true);
    expect(service.getLocation(beta.agentId)).toEqual({ place: 'watching', tableId });

    const stillThere = service.getTableState(tableId, beta.agentId);
    expect(stillThere.ok).toBe(true);
    expect(service.getLocation(beta.agentId)).toEqual({ place: 'watching', tableId });

    const unwatched = await service.unwatchTable(beta.agentId);
    expect(unwatched.ok).toBe(true);

    const gone = service.getTableState(tableId, alpha.agentId);
    expect(gone.ok).toBe(false);
    if (gone.ok) return;
    expect(gone.error.code).toBe('TABLE_NOT_FOUND');
    expect(service.getLocation(beta.agentId)).toEqual({ place: 'lobby' });
  });

  it('notifies the departing owner when the last player leaving auto-closes the table', async () => {
    const { service, sent } = await createServiceHarness();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };

    await service.enterArcade(alpha);

    const created = await service.createTable(alpha, { gameId: 'blackjack', name: 'Idle Notice Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);
    expect((await service.leaveTable(alpha)).ok).toBe(true);

    const closeNotice = sent.find((entry) => (
      entry.agentId === alpha.agentId
      && typeof entry.msg === 'object'
      && entry.msg !== null
      && 'type' in entry.msg
      && (entry.msg as { type?: string }).type === 'arcade_table_closed'
    ));

    expect(closeNotice).toBeTruthy();
    expect((closeNotice?.msg as {
      payload?: { tableId?: string; reason?: string };
    }).payload?.tableId).toBe(tableId);
    expect((closeNotice?.msg as {
      payload?: { tableId?: string; reason?: string };
    }).payload?.reason).toBe('empty_room');
  });

  it('keeps blackjack players seated when betting times out and preserves a recap', async () => {
    vi.useFakeTimers();

    const service = await createService();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    const created = await service.createTable(alpha, { gameId: 'blackjack', name: 'Timeout Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);
    expect((await service.joinTable(beta, tableId)).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'start_round' })).ok).toBe(true);

    await vi.advanceTimersByTimeAsync(30_000);

    expect(service.getLocation(alpha.agentId)).toEqual({ place: 'table', tableId });
    expect(service.getLocation(beta.agentId)).toEqual({ place: 'table', tableId });

    const tableState = service.getTableState(tableId, alpha.agentId);
    expect(tableState.ok).toBe(true);
    if (!tableState.ok) return;
    expect(tableState.data.table.players).toEqual([alpha.agentId, beta.agentId]);
    expect(tableState.data.state.phase).toBe('between_hands');
    expect(tableState.data.state.result).not.toBeNull();
    expect(tableState.data.state.result?.summary).toContain('Fewer than 2 players remained after betting');

    const hostView = service.getTableState(tableId, alpha.agentId);
    expect(hostView.ok).toBe(true);
    if (!hostView.ok) return;
    expect(hostView.data.state.legalActions.map((action) => action.type)).toContain('ready');
  });

  it('only shows host-start to the table owner and enforces the new 2-player minimum for blackjack', async () => {
    const service = await createService();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    const created = await service.createTable(alpha, { gameId: 'blackjack', name: 'Rules Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);

    const firstStart = await service.handleGameAction(alpha, tableId, { type: 'start_round' });
    expect(firstStart.ok).toBe(false);

    expect((await service.joinTable(beta, tableId)).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'ready' })).ok).toBe(true);

    const hostView = service.getTableState(tableId, alpha.agentId);
    const guestView = service.getTableState(tableId, beta.agentId);
    expect(hostView.ok).toBe(true);
    expect(guestView.ok).toBe(true);
    if (!hostView.ok || !guestView.ok) return;

    expect(hostView.data.state.legalActions.map((action) => action.type)).toContain('start_round');
    expect(guestView.data.state.legalActions.map((action) => action.type)).not.toContain('start_round');

    const guestStart = await service.handleGameAction(beta, tableId, { type: 'start_round' });
    expect(guestStart.ok).toBe(false);
  });

  it('allows the table owner to kick a seated player while waiting', async () => {
    const service = await createService();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    const created = await service.createTable(alpha, { gameId: 'blackjack', name: 'Kick Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);
    expect((await service.joinTable(beta, tableId)).ok).toBe(true);

    const kicked = service.kickPlayer(alpha.agentId, beta.agentId);
    expect(kicked.ok).toBe(true);
    if (!kicked.ok) return;

    expect(kicked.data.table.table.players).toEqual([alpha.agentId]);
    expect(service.getLocation(beta.agentId)).toEqual({ place: 'lobby' });
  });

  it('loads texas holdem as a standard game package and exposes poker actions through the shared surface', async () => {
    const service = await createService();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    expect(service.listGames().map((item) => item.id)).toContain('texas-holdem');

    const created = await service.createTable(alpha, { gameId: 'texas-holdem', name: 'Holdem Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);
    expect((await service.joinTable(beta, tableId)).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'start_round' })).ok).toBe(true);

    const state = service.getTableState(tableId, alpha.agentId);
    expect(state.ok).toBe(true);
    if (!state.ok) return;

    expect(state.data.table.gameId).toBe('texas-holdem');
    expect(state.data.state.legalActions.map((action) => action.type)).toEqual(
      expect.arrayContaining(['call', 'raise', 'all_in', 'fold']),
    );
    expect(state.data.state.toCall).toBe(5);
    expect(state.data.state.minRaiseTo).toBeGreaterThan(10);
    expect(state.data.state.prompt).toContain('It is your turn');
  });

  it('loads gomoku as a discoverable arcade game and resolves a five-in-a-row victory', async () => {
    const service = await createService();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    expect(service.listGames().map((item) => item.id)).toContain('gomoku');

    const created = await service.createTable(alpha, { gameId: 'gomoku', name: 'Gomoku Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);
    expect((await service.joinTable(beta, tableId)).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'ready' })).ok).toBe(true);

    const before = service.getTableState(tableId, alpha.agentId);
    expect(before.ok).toBe(true);
    if (!before.ok) return;
    expect(before.data.state.phase).toBe('playing');
    expect(before.data.state.currentTurn).toBe(alpha.agentId);

    const moves = [
      [alpha, { from: [0, 0], to: [0, 0] }],
      [beta, { from: [0, 1], to: [0, 1] }],
      [alpha, { from: [1, 0], to: [1, 0] }],
      [beta, { from: [1, 1], to: [1, 1] }],
      [alpha, { from: [2, 0], to: [2, 0] }],
      [beta, { from: [2, 1], to: [2, 1] }],
      [alpha, { from: [3, 0], to: [3, 0] }],
      [beta, { from: [3, 1], to: [3, 1] }],
      [alpha, { from: [4, 0], to: [4, 0] }],
    ] as const;

    for (const [player, move] of moves) {
      const result = await service.handleGameAction(player, tableId, {
        type: 'place_stone',
        x: move.to[0],
        y: move.to[1],
      });
      expect(result.ok).toBe(true);
    }

    const finalState = service.getTableState(tableId, alpha.agentId);
    expect(finalState.ok).toBe(true);
    if (!finalState.ok) return;
    expect(finalState.data.state.phase).toBe('between_matches');
    expect(finalState.data.state.result?.summary).toContain('Alpha');
    expect(finalState.data.state.winningLine).toHaveLength(5);

    const stats = service.getPlayerStats(alpha.agentId, 'gomoku')[0];
    expect(stats?.wins).toBe(1);
    expect(stats?.totalWagered).toBe(0);
  });

  it('loads love letter and keeps hands private per viewer while exposing compact multi-round state', async () => {
    const service = await createService();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    expect(service.listGames().map((item) => item.id)).toContain('love-letter');

    const created = await service.createTable(alpha, { gameId: 'love-letter', name: 'Love Letter Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);
    expect((await service.joinTable(beta, tableId)).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'ready' })).ok).toBe(true);

    const alphaView = service.getTableState(tableId, alpha.agentId);
    const betaView = service.getTableState(tableId, beta.agentId);
    expect(alphaView.ok).toBe(true);
    expect(betaView.ok).toBe(true);
    if (!alphaView.ok || !betaView.ok) return;

    expect(alphaView.data.state.phase).toBe('playing');
    expect(alphaView.data.state.tokensToWin).toBe(6);
    const alphaSeat = alphaView.data.state.players.find((player) => player.agentId === alpha.agentId);
    const betaSeatFromAlpha = alphaView.data.state.players.find((player) => player.agentId === beta.agentId);
    expect(alphaSeat?.hand?.length).toBeGreaterThan(0);
    expect(betaSeatFromAlpha?.hand).toBeUndefined();

    const currentPlayer = alphaView.data.state.currentPlayer as string;
    const actor = currentPlayer === alpha.agentId ? alpha : beta;
    const actorView = service.getTableState(tableId, actor.agentId);
    expect(actorView.ok).toBe(true);
    if (!actorView.ok) return;
    const firstMove = await service.handleGameAction(actor, tableId, { type: 'play_card', cardIndex: 0 });
    const secondMove = firstMove.ok ? firstMove : await service.handleGameAction(actor, tableId, { type: 'play_card', cardIndex: 1 });
    expect(secondMove.ok).toBe(true);
  });

  it('loads xiangqi, allows legal moves, and supports draw offers under the compact protocol', async () => {
    const service = await createService();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    expect(service.listGames().map((item) => item.id)).toContain('xiangqi');

    const created = await service.createTable(alpha, { gameId: 'xiangqi', name: 'Xiangqi Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);
    expect((await service.joinTable(beta, tableId)).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'ready' })).ok).toBe(true);

    const state = service.getTableState(tableId, alpha.agentId);
    expect(state.ok).toBe(true);
    if (!state.ok) return;
    expect(state.data.state.phase).toBe('playing');
    expect(state.data.state.sideToMove).toBe('red');

    expect((await service.handleGameAction(alpha, tableId, {
      type: 'move',
      fromX: 0,
      fromY: 6,
      toX: 0,
      toY: 5,
    })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'offer_draw' })).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'accept_draw' })).ok).toBe(true);

    const finalState = service.getTableState(tableId, alpha.agentId);
    expect(finalState.ok).toBe(true);
    if (!finalState.ok) return;
    expect(finalState.data.state.phase).toBe('between_matches');
    expect(finalState.data.state.result?.summary).toContain('和棋');
  });

  it('loads uno with compact hidden-hand state and exposes playable actions without touching chips', async () => {
    const service = await createService();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    expect(service.listGames().map((item) => item.id)).toContain('uno');

    const created = await service.createTable(alpha, { gameId: 'uno', name: 'UNO Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);
    expect((await service.joinTable(beta, tableId)).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'ready' })).ok).toBe(true);

    const alphaView = service.getTableState(tableId, alpha.agentId);
    const betaView = service.getTableState(tableId, beta.agentId);
    expect(alphaView.ok).toBe(true);
    expect(betaView.ok).toBe(true);
    if (!alphaView.ok || !betaView.ok) return;

    expect(alphaView.data.state.phase).toBe('playing');
    expect(alphaView.data.state.topCard).toBeTruthy();
    const alphaSeat = alphaView.data.state.players.find((player) => player.agentId === alpha.agentId);
    const betaSeatFromAlpha = alphaView.data.state.players.find((player) => player.agentId === beta.agentId);
    expect(alphaSeat?.hand?.length).toBe(7);
    expect(betaSeatFromAlpha?.hand).toBeUndefined();
    const matchScore = alphaView.data.state.matchScore as Record<string, number> | undefined;
    expect(matchScore?.[alpha.agentId]).toBe(0);

    const currentPlayer = alphaView.data.state.currentPlayer as string;
    const actor = currentPlayer === alpha.agentId ? alpha : beta;
    const actorState = service.getTableState(tableId, actor.agentId);
    expect(actorState.ok).toBe(true);
    if (!actorState.ok) return;
    const legalTypes = actorState.data.state.legalActions.map((entry) => entry.type);
    expect(legalTypes.length).toBeGreaterThan(0);
    expect(legalTypes.some((type) => ['play_card', 'draw'].includes(type))).toBe(true);

    const stats = service.getPlayerStats(alpha.agentId, 'uno');
    expect(stats[0]?.totalWagered ?? 0).toBe(0);
  });

  it('pushes compact blackjack table events with change, state, and version counters', async () => {
    const { service, sent } = await createServiceHarness();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    const created = await service.createTable(alpha, { gameId: 'blackjack', name: 'Signal Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);
    expect((await service.joinTable(beta, tableId)).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'start_round' })).ok).toBe(true);

    const latest = sentTablePayloads(sent, alpha.agentId).find((payload) => (
      payload.state?.phase === 'betting' && payload.state.deadlineAt != null
    ));

    expect(latest?.seq).toBeGreaterThan(0);
    expect(latest?.snapshotVersion).toBeGreaterThan(0);
    expect(latest?.change?.message).toMatch(/hand 1|bet|wager/i);
    expect(latest?.state?.prompt?.toLowerCase()).toMatch(/bet|wager/);
    expect(latest?.state?.legalActions?.map((action) => action.type)).toContain('bet');
    expect(latest?.state?.deadlineAt).toBeTypeOf('number');
    expect(latest && 'actions' in latest).toBe(false);
    expect(latest?.state && 'presentation' in latest.state).toBe(false);
    expect(latest?.state && 'timeline' in latest.state).toBe(false);
  });

  it('keeps showdown explanations and result details after a full texas holdem hand', async () => {
    const service = await createService();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    const created = await service.createTable(alpha, { gameId: 'texas-holdem', name: 'Showdown Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);
    expect((await service.joinTable(beta, tableId)).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'ready' })).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'start_round' })).ok).toBe(true);

    expect((await service.handleGameAction(alpha, tableId, { type: 'call' })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'check' })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'check' })).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'check' })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'check' })).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'check' })).ok).toBe(true);
    expect((await service.handleGameAction(beta, tableId, { type: 'check' })).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'check' })).ok).toBe(true);
    await new Promise((resolve) => setTimeout(resolve, 0));

    const finalState = service.getTableState(tableId, alpha.agentId);
    expect(finalState.ok).toBe(true);
    if (!finalState.ok) return;

    expect(finalState.data.state.phase).toBe('between_hands');
    expect(finalState.data.state.result).not.toBeNull();
    expect(finalState.data.state.result?.detail?.length).toBeGreaterThan(0);
    expect(finalState.data.state.result?.items.every((item) => item.label)).toBe(true);
    expect(finalState.data.state.result?.items.some((item) => /beat|split|collected|did not win/i.test(item.summary))).toBe(true);
  });

  it('keeps a compact server-side history for later playback', async () => {
    const service = await createService();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    const created = await service.createTable(alpha, { gameId: 'blackjack', name: 'History Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(alpha, tableId)).ok).toBe(true);
    expect((await service.joinTable(beta, tableId)).ok).toBe(true);
    expect((await service.handleGameAction(alpha, tableId, { type: 'ready' })).ok).toBe(true);

    const history = service.getTableHistory(tableId, alpha.agentId);
    expect(history.ok).toBe(true);
    if (!history.ok) return;

    expect(history.data.history.length).toBeGreaterThan(0);
    expect(history.data.history[0]?.change.message).toContain('is ready for the next hand');
    expect(history.data.history.every((entry) => entry.seq > 0)).toBe(true);
    expect(history.data.history.every((entry) => entry.snapshotVersion > 0)).toBe(true);
  });

  it('broadcasts table updates to the owner even while they remain in the lobby', async () => {
    const { service, sent } = await createServiceHarness();
    const alpha = { agentId: 'agent-a', userId: 'user-a', agentName: 'Alpha' };
    const beta = { agentId: 'agent-b', userId: 'user-b', agentName: 'Beta' };

    await service.enterArcade(alpha);
    await service.enterArcade(beta);

    const created = await service.createTable(alpha, { gameId: 'blackjack', name: 'Remote Owner Table' });
    expect(created.ok).toBe(true);
    if (!created.ok) return;

    const tableId = created.data.tableId;
    expect((await service.joinTable(beta, tableId)).ok).toBe(true);

    const ownerPayload = sentTablePayloads(sent, alpha.agentId).find((payload) => (
      payload.change?.kind === 'player_joined'
    ));

    expect(ownerPayload?.change?.message).toContain('sat down at the table');
    expect(ownerPayload?.state?.phase).toBe('waiting');
  });
});
