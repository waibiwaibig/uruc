import { nanoid } from 'nanoid';
import { sql } from 'drizzle-orm';

import type { UrucDb } from '../../core/database/index.js';
import type { LogService } from '../../core/logger/service.js';
import type { WSGatewayPublic } from '../../core/plugin-system/hook-registry.js';
import { ArcadeGameDiscovery } from './discovery.js';
import { ArcadeGameLoader } from './loader.js';
import { ArcadeGameRegistry } from './registry.js';
import {
  ARCADE_DEFAULT_RECONNECT_GRACE_MS,
  ARCADE_GAME_API_VERSION,
  ARCADE_IDLE_TABLE_TIMEOUT_MS,
  ARCADE_LOCATION_ID,
  ARCADE_STARTING_CHIPS,
  ARCADE_TABLE_HISTORY_LIMIT,
  type ArcadeGameAction,
  type ArcadeGameActionReceipt,
  type ArcadeGameDefinition,
  type ArcadeGameDiagnostic,
  type ArcadeGameLogger,
  type ArcadeGameSession,
  type ArcadeGameSessionContext,
  type ArcadeSessionResult,
  type ArcadeSessionState,
  type ArcadeGameStatsPort,
  type ArcadeGameWalletPort,
  type ArcadeActionResult,
  type ArcadeLobbyState,
  type ArcadePlayerIdentity,
  type ArcadePlayerLocation,
  type ArcadePlayerStats,
  type ArcadeScoreResult,
  type ArcadeTableChange,
  type ArcadeTableContext,
  type ArcadeTableEventPayload,
  type ArcadeTableHistory,
  type ArcadeTableHistoryEntry,
  type ArcadeTableState,
  type ArcadeTableSummary,
  type ArcadeWalletSnapshot,
} from './types.js';

interface ServiceError {
  error: string;
  code: string;
  action?: string;
  details?: Record<string, unknown>;
}

export type ArcadeServiceResult<T> =
  | { ok: true; data: T }
  | { ok: false; error: ServiceError };

interface WalletRow {
  agentId: string;
  userId: string;
  agentName: string;
  balance: number;
  frozen: number;
  createdAt: number;
  updatedAt: number;
}

interface StatsRow {
  agentId: string;
  userId: string;
  gameId: string;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  totalWagered: number;
  totalWon: number;
  score: number;
  updatedAt: number;
}

interface ManagedTable {
  summary: ArcadeTableSummary;
  session: ArcadeGameSession;
  game: ArcadeGameDefinition;
  seq: number;
  snapshotVersion: number;
  history: ArcadeTableHistoryEntry[];
  everOccupied: boolean;
  idleTimer?: ReturnType<typeof setTimeout>;
}

interface TableOccupancyChange {
  shouldCloseNow: boolean;
}

class TableManager {
  private readonly tables = new Map<string, ManagedTable>();
  private readonly agentOwnedTables = new Map<string, string>();

  constructor(private readonly onTableClosed: (table: ManagedTable, reason: string) => void) {}

  createTable(
    game: ArcadeGameDefinition,
    settings: {
      createdBy: string | null;
      name?: string;
      isPrivate?: boolean;
      whitelistAgentIds?: string[];
    },
    createSession: (tableContext: ArcadeTableContext) => ArcadeGameSession,
  ): ArcadeServiceResult<{ tableId: string }> {
    if (settings.createdBy && this.agentOwnedTables.has(settings.createdBy)) {
      return {
        ok: false,
        error: {
          error: 'You already own a table. Close it first.',
          code: 'TABLE_ALREADY_OWNED',
        },
      };
    }

    const tableId = nanoid(12);
    const name = settings.name?.trim() || `${game.catalog.name} #${tableId.slice(0, 4)}`;
    const whitelistAgentIds = settings.isPrivate
      ? Array.from(new Set([settings.createdBy, ...(settings.whitelistAgentIds ?? [])].filter(Boolean) as string[]))
      : [];

    const summary: ArcadeTableSummary = {
      tableId,
      gameId: game.id,
      gameName: game.catalog.name,
      name,
      status: 'waiting',
      players: [],
      spectators: [],
      maxPlayers: game.catalog.maxPlayers,
      createdBy: settings.createdBy,
      createdAt: Date.now(),
      isPrivate: !!settings.isPrivate,
      whitelistAgentIds,
      playerNames: {},
      spectatorNames: {},
    };

    const session = createSession({
      tableId,
      gameId: game.id,
      name,
      maxPlayers: game.catalog.maxPlayers,
      createdBy: settings.createdBy,
      syncPlayerLeave() {},
    });

    const table: ManagedTable = {
      summary,
      session,
      game,
      seq: 0,
      snapshotVersion: 0,
      history: [],
      everOccupied: false,
    };
    this.tables.set(tableId, table);
    if (settings.createdBy) {
      this.agentOwnedTables.set(settings.createdBy, tableId);
    }
    this.syncIdleTimer(tableId);

    return { ok: true, data: { tableId } };
  }

  getTable(tableId: string): ManagedTable | undefined {
    return this.tables.get(tableId);
  }

  listTables(): ManagedTable[] {
    return Array.from(this.tables.values());
  }

  async closeTable(tableId: string, requestedBy?: string, reason = 'closed'): Promise<ArcadeServiceResult<{ tableId: string }>> {
    const table = this.tables.get(tableId);
    if (!table) {
      return {
        ok: false,
        error: {
          error: 'Table not found',
          code: 'TABLE_NOT_FOUND',
        },
      };
    }

    if (requestedBy && table.summary.createdBy !== requestedBy) {
      return {
        ok: false,
        error: {
          error: 'Only the table host can close the table',
          code: 'NOT_TABLE_OWNER',
        },
      };
    }

    await this.destroyTable(tableId, reason);
    return { ok: true, data: { tableId } };
  }

  addPlayer(tableId: string, player: ArcadePlayerIdentity): void {
    const table = this.tables.get(tableId);
    if (!table) return;
    if (!table.summary.players.includes(player.agentId)) {
      table.summary.players.push(player.agentId);
    }
    table.everOccupied = true;
    table.summary.playerNames[player.agentId] = player.agentName;
    this.syncIdleTimer(tableId);
  }

  removePlayer(tableId: string, agentId: string): TableOccupancyChange | null {
    const table = this.tables.get(tableId);
    if (!table) return null;

    const previousOwner = table.summary.createdBy;
    table.summary.players = table.summary.players.filter((item) => item !== agentId);
    delete table.summary.playerNames[agentId];

    return this.resolveOwnershipAfterOccupancyChange(table, previousOwner);
  }

  addSpectator(tableId: string, player: ArcadePlayerIdentity): void {
    const table = this.tables.get(tableId);
    if (!table) return;
    if (!table.summary.spectators.includes(player.agentId)) {
      table.summary.spectators.push(player.agentId);
    }
    table.everOccupied = true;
    table.summary.spectatorNames[player.agentId] = player.agentName;
    this.syncIdleTimer(tableId);
  }

  removeSpectator(tableId: string, agentId: string): TableOccupancyChange | null {
    const table = this.tables.get(tableId);
    if (!table) return null;

    const previousOwner = table.summary.createdBy;
    table.summary.spectators = table.summary.spectators.filter((item) => item !== agentId);
    delete table.summary.spectatorNames[agentId];

    return this.resolveOwnershipAfterOccupancyChange(table, previousOwner);
  }

  async destroyAll(): Promise<void> {
    for (const tableId of [...this.tables.keys()]) {
      await this.destroyTable(tableId, 'shutdown');
    }
  }

  private async destroyTable(tableId: string, reason: string): Promise<void> {
    const table = this.tables.get(tableId);
    if (!table) return;

    this.clearIdleTimer(tableId);
    try {
      await table.session.abort?.(reason);
    } finally {
      table.session.dispose();
      this.clearOwnership(tableId);
      this.tables.delete(tableId);
      this.onTableClosed(table, reason);
    }
  }

  private resetIdleTimer(tableId: string): void {
    this.clearIdleTimer(tableId);
    const table = this.tables.get(tableId);
    if (!table) return;
    table.idleTimer = setTimeout(() => {
      void this.destroyTable(tableId, 'idle_timeout');
    }, ARCADE_IDLE_TABLE_TIMEOUT_MS);
  }

  private syncIdleTimer(tableId: string): void {
    const table = this.tables.get(tableId);
    if (!table) return;

    const occupied = table.summary.players.length > 0 || table.summary.spectators.length > 0;
    if (occupied) {
      this.clearIdleTimer(tableId);
      return;
    }

    this.resetIdleTimer(tableId);
  }

  private resolveOwnershipAfterOccupancyChange(
    table: ManagedTable,
    previousOwner: string | null,
  ): TableOccupancyChange {
    const hasOccupants = table.summary.players.length > 0 || table.summary.spectators.length > 0;
    if (!hasOccupants) {
      this.clearIdleTimer(table.summary.tableId);
      if (table.everOccupied) {
        this.clearOwnership(table.summary.tableId);
      } else {
        this.resetIdleTimer(table.summary.tableId);
      }
      return { shouldCloseNow: table.everOccupied };
    }

    const ownerStillInside = table.summary.createdBy != null && (
      table.summary.players.includes(table.summary.createdBy)
      || table.summary.spectators.includes(table.summary.createdBy)
    );
    const nextOwner = ownerStillInside
      ? table.summary.createdBy
      : (table.summary.players[0] ?? table.summary.spectators[0] ?? null);

    table.summary.createdBy = nextOwner;
    this.syncOwnership(table.summary.tableId, previousOwner, nextOwner);
    this.clearIdleTimer(table.summary.tableId);
    return { shouldCloseNow: false };
  }

  private clearIdleTimer(tableId: string): void {
    const table = this.tables.get(tableId);
    if (table?.idleTimer) {
      clearTimeout(table.idleTimer);
      table.idleTimer = undefined;
    }
  }

  private clearOwnership(tableId: string): void {
    for (const [agentId, ownedTableId] of this.agentOwnedTables.entries()) {
      if (ownedTableId === tableId) {
        this.agentOwnedTables.delete(agentId);
      }
    }
  }

  private syncOwnership(tableId: string, previousOwner: string | null, nextOwner: string | null): void {
    if (previousOwner && previousOwner !== nextOwner && this.agentOwnedTables.get(previousOwner) === tableId) {
      this.agentOwnedTables.delete(previousOwner);
    }

    if (nextOwner) {
      this.agentOwnedTables.set(nextOwner, tableId);
    } else {
      this.clearOwnership(tableId);
    }
  }
}

export class ArcadeService {
  private readonly registry = new ArcadeGameRegistry();
  private readonly loader = new ArcadeGameLoader(new ArcadeGameDiscovery(), this.registry);
  private readonly tables = new TableManager((table, reason) => this.handleTableClosed(table, reason));
  private readonly agentLocations = new Map<string, ArcadePlayerLocation>();
  private readonly graceTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private readonly userIdMap = new Map<string, string>();
  private readonly agentNameMap = new Map<string, string>();

  constructor(
    private readonly db: UrucDb,
    private readonly gateway: WSGatewayPublic,
    private readonly logger?: LogService,
  ) {}

  init(): void {
    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS arcade_wallets (
        agent_id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        agent_name TEXT NOT NULL,
        balance INTEGER NOT NULL DEFAULT 0,
        frozen INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL
      )
    `);

    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS arcade_chip_ledger (
        id TEXT PRIMARY KEY,
        agent_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        game_id TEXT,
        table_id TEXT,
        change_type TEXT NOT NULL,
        amount INTEGER NOT NULL,
        balance_after INTEGER NOT NULL,
        frozen_after INTEGER NOT NULL,
        reason TEXT NOT NULL,
        created_at INTEGER NOT NULL
      )
    `);

    this.db.run(sql`
      CREATE TABLE IF NOT EXISTS arcade_player_stats (
        agent_id TEXT NOT NULL,
        user_id TEXT NOT NULL,
        game_id TEXT NOT NULL,
        games_played INTEGER NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        losses INTEGER NOT NULL DEFAULT 0,
        draws INTEGER NOT NULL DEFAULT 0,
        total_wagered INTEGER NOT NULL DEFAULT 0,
        total_won INTEGER NOT NULL DEFAULT 0,
        score INTEGER NOT NULL DEFAULT 0,
        created_at INTEGER NOT NULL,
        updated_at INTEGER NOT NULL,
        PRIMARY KEY(agent_id, game_id)
      )
    `);

    this.db.run(sql`CREATE INDEX IF NOT EXISTS arcade_wallets_user_idx ON arcade_wallets(user_id)`);
    this.db.run(sql`CREATE INDEX IF NOT EXISTS arcade_chip_ledger_agent_created_idx ON arcade_chip_ledger(agent_id, created_at DESC)`);
    this.db.run(sql`CREATE INDEX IF NOT EXISTS arcade_player_stats_game_score_idx ON arcade_player_stats(game_id, score DESC, games_played DESC)`);
  }

  async loadGames(): Promise<void> {
    const logger: ArcadeGameLogger = {
      log: async (actionType, payload, actor) => {
        if (!this.logger) return;
        const wallet = actor?.agentId ? this.getWalletRow(actor.agentId) : undefined;
        if (!wallet && !actor?.userId && !actor?.agentId) return;
        await this.logger.log({
          userId: actor?.userId ?? wallet?.userId ?? 'arcade-system',
          agentId: actor?.agentId ?? wallet?.agentId ?? 'arcade-system',
          locationId: ARCADE_LOCATION_ID,
          actionType,
          payload,
          result: actor?.result ?? 'success',
          detail: actor?.detail,
        });
      },
    };

    await this.loader.discoverAndLoadAll({
      logger,
      clock: {
        now: () => Date.now(),
        setTimeout: (handler, timeoutMs) => setTimeout(handler, timeoutMs),
        clearTimeout: (timer) => {
          if (timer) clearTimeout(timer);
        },
      },
    });
  }

  async dispose(): Promise<void> {
    for (const timer of this.graceTimers.values()) {
      clearTimeout(timer);
    }
    this.graceTimers.clear();
    await this.tables.destroyAll();
    await this.loader.destroyAll();
  }

  getDiagnostics(): ArcadeGameDiagnostic[] {
    return this.loader.getDiagnostics();
  }

  listGames(): ReturnType<ArcadeGameRegistry['list']> {
    return this.registry.list();
  }

  getLocation(agentId: string): ArcadePlayerLocation {
    return this.agentLocations.get(agentId) ?? { place: 'lobby' };
  }

  isAgentBusy(agentId: string): boolean {
    return this.getLocation(agentId).place !== 'lobby';
  }

  async enterArcade(player: ArcadePlayerIdentity): Promise<{
    wallet: ArcadeWalletSnapshot;
    reconnected: boolean;
    currentTableId?: string;
  }> {
    this.trackIdentity(player);
    const wallet = this.ensureWalletRow(player);
    const location = this.agentLocations.get(player.agentId);

    if (location?.place === 'disconnected') {
      const table = this.tables.getTable(location.tableId);
      if (table?.session.onReconnect) {
        const result = table.session.onReconnect(player);
        if (result.ok) {
          this.clearGraceTimer(player.agentId);
          this.agentLocations.set(player.agentId, { place: 'table', tableId: location.tableId });
          this.pushTableEvent(table, {
            type: 'player_reconnected',
            agentId: player.agentId,
            agentName: player.agentName,
          });
          return { wallet, reconnected: true, currentTableId: location.tableId };
        }
      }
    }

    // Already seated at a table or watching — preserve their location so re-entering
    // the arcade location (e.g. from syncArcade on the table page) doesn't evict them.
    if (location?.place === 'table' || location?.place === 'watching') {
      return { wallet, reconnected: false, currentTableId: location.tableId };
    }

    this.agentLocations.set(player.agentId, { place: 'lobby' });
    return { wallet, reconnected: false };
  }

  onLeaveLocation(agentId: string): void {
    if (this.getLocation(agentId).place === 'lobby') {
      this.agentLocations.set(agentId, { place: 'lobby' });
    }
  }

  onConnectionClosed(agentId: string): void {
    const location = this.getLocation(agentId);
    if (location.place === 'watching') {
      const removed = this.tables.removeSpectator(location.tableId, agentId);
      this.agentLocations.set(agentId, { place: 'lobby' });
      if (removed?.shouldCloseNow) {
        void this.tables.closeTable(location.tableId, undefined, 'empty_room');
      }
      return;
    }

    if (location.place !== 'table') return;
    const table = this.tables.getTable(location.tableId);
    if (!table) {
      this.agentLocations.set(agentId, { place: 'lobby' });
      return;
    }

    const player = this.buildPlayerIdentity(agentId, table.summary.createdBy === agentId);
    const leaveResult = table.session.onLeave(player, 'disconnect');
    if (leaveResult?.keepSlot) {
      this.agentLocations.set(agentId, { place: 'disconnected', tableId: location.tableId });
      this.startGraceTimer(agentId, table);
      this.pushTableEvent(table, {
        type: 'player_disconnected',
        agentId,
        agentName: player.agentName,
      });
      return;
    }

    const removed = this.tables.removePlayer(location.tableId, agentId);
    this.agentLocations.set(agentId, { place: 'lobby' });
    if (removed?.shouldCloseNow) {
      void this.tables.closeTable(location.tableId, undefined, 'empty_room');
    }
  }

  async claimChips(player: ArcadePlayerIdentity): Promise<ArcadeServiceResult<{ wallet: ArcadeWalletSnapshot }>> {
    this.trackIdentity(player);
    const wallet = this.ensureWalletRow(player);
    const location = this.getLocation(player.agentId);

    if (location.place !== 'lobby') {
      return this.fail('Return to the arcade lobby before claiming chips.', 'CLAIM_CHIPS_NOT_ALLOWED', 'arcade_leave_table');
    }

    if (wallet.balance !== 0 || wallet.frozen !== 0) {
      return this.fail('You can only claim chips when both balance and frozen chips are 0.', 'CHIPS_NOT_EMPTY');
    }

    const updated = this.adjustWallet(player.agentId, {
      balanceDelta: ARCADE_STARTING_CHIPS,
      frozenDelta: 0,
      reason: 'claim_chips',
      changeType: 'claim',
    });

    await this.logAction('arcade_claim_chips', { amount: ARCADE_STARTING_CHIPS }, player);
    return { ok: true, data: { wallet: updated } };
  }

  async createTable(
    player: ArcadePlayerIdentity,
    input: {
      gameId: string;
      name?: string;
      isPrivate?: boolean;
      whitelistAgentIds?: string[];
    },
  ): Promise<ArcadeServiceResult<{ tableId: string; table: ArcadeTableState }>> {
    this.trackIdentity(player);
    if (this.getLocation(player.agentId).place !== 'lobby') {
      return this.fail('Return to the arcade lobby before creating a table.', 'PLAYER_NOT_IN_LOBBY', 'arcade_leave_table');
    }

    const game = this.registry.get(input.gameId);
    if (!game) {
      return this.fail(`Game '${input.gameId}' does not exist.`, 'GAME_NOT_FOUND');
    }

    const created = this.tables.createTable(
      game,
      {
        createdBy: player.agentId,
        name: input.name,
        isPrivate: input.isPrivate,
        whitelistAgentIds: input.whitelistAgentIds,
      },
      (tableContext) => this.createGameSession(game, tableContext),
    );

    if (!created.ok) return created;

    const table = this.tables.getTable(created.data.tableId);
    if (!table) {
      return this.fail('Failed to create table', 'TABLE_CREATE_FAILED');
    }

    await this.logAction(
      'arcade_create_table',
      { tableId: created.data.tableId, gameId: input.gameId, isPrivate: !!input.isPrivate },
      player,
    );

    return {
      ok: true,
      data: {
        tableId: created.data.tableId,
        table: this.buildTableState(table, player.agentId),
      },
    };
  }

  listTables(viewerAgentId?: string, gameId?: string): ArcadeTableSummary[] {
    return this.tables.listTables()
      .filter((table) => !gameId || table.summary.gameId === gameId)
      .filter((table) => this.canAccessTable(table.summary, viewerAgentId))
      .map((table) => this.buildTableSummary(table));
  }

  getLobbyState(agentId?: string): ArcadeLobbyState {
    const wallet = agentId ? this.getWalletSnapshot(agentId) : null;
    return {
      wallet,
      games: this.listGames(),
      tables: this.listTables(agentId),
      diagnostics: this.getDiagnostics(),
      yourLocation: agentId ? this.getLocation(agentId) : { place: 'lobby' },
    };
  }

  getWalletSnapshot(agentId: string): ArcadeWalletSnapshot | null {
    const row = this.getWalletRow(agentId);
    return row ? this.toWalletSnapshot(row) : null;
  }

  getTableState(tableId: string, viewerAgentId?: string): ArcadeServiceResult<ArcadeTableState> {
    const table = this.tables.getTable(tableId);
    if (!table) {
      return this.fail('Table not found', 'TABLE_NOT_FOUND');
    }

    if (!this.canAccessTable(table.summary, viewerAgentId)) {
      return this.fail('You do not have permission to view this table.', 'TABLE_NOT_VISIBLE');
    }

    return {
      ok: true,
      data: this.buildTableState(table, viewerAgentId),
    };
  }

  getTableHistory(tableId: string, viewerAgentId?: string): ArcadeServiceResult<ArcadeTableHistory> {
    const table = this.tables.getTable(tableId);
    if (!table) {
      return this.fail('Table not found', 'TABLE_NOT_FOUND');
    }

    if (!this.canAccessTable(table.summary, viewerAgentId)) {
      return this.fail('You do not have permission to view this table.', 'TABLE_NOT_VISIBLE');
    }

    return {
      ok: true,
      data: {
        table: this.buildTableSummary(table),
        seq: table.seq,
        snapshotVersion: table.snapshotVersion,
        history: table.history.map((entry) => ({
          ...entry,
          change: { ...entry.change },
        })),
      },
    };
  }

  async joinTable(player: ArcadePlayerIdentity, tableId: string): Promise<ArcadeServiceResult<ArcadeTableState>> {
    this.trackIdentity(player);
    const location = this.getLocation(player.agentId);

    if (location.place === 'table' || location.place === 'disconnected') {
      return this.fail('You are already seated at a table. Leave it first.', 'PLAYER_ALREADY_AT_TABLE', 'arcade_leave_table');
    }
    if (location.place === 'watching' && location.tableId !== tableId) {
      return this.fail('Stop your current spectating session first.', 'PLAYER_ALREADY_WATCHING', 'arcade_unwatch_table');
    }

    const table = this.tables.getTable(tableId);
    if (!table) {
      return this.fail('Table not found', 'TABLE_NOT_FOUND');
    }

    if (!this.canAccessTable(table.summary, player.agentId)) {
      return this.fail('You do not have permission to enter this table.', 'TABLE_NOT_VISIBLE');
    }

    if (!table.game.catalog.capabilities.midGameJoin && table.session.status !== 'waiting') {
      return this.fail('This table has already started. Mid-game joins are not allowed.', 'TABLE_ALREADY_STARTED');
    }

    const sessionPlayer: ArcadePlayerIdentity = {
      ...player,
      isHost: table.summary.createdBy === player.agentId,
    };
    const joined = table.session.onJoin(sessionPlayer);
    if (!joined.ok) {
      return this.fail(joined.error ?? 'Failed to join the table', 'TABLE_JOIN_REJECTED');
    }

    this.tables.removeSpectator(tableId, player.agentId);
    this.tables.addPlayer(tableId, player);
    this.agentLocations.set(player.agentId, { place: 'table', tableId });

    this.pushTableEvent(table, {
      type: 'player_joined',
      agentId: player.agentId,
      agentName: player.agentName,
    });
    await this.logAction('arcade_join_table', { tableId }, player);

    return {
      ok: true,
      data: this.buildTableState(table, player.agentId),
    };
  }

  async leaveTable(player: ArcadePlayerIdentity): Promise<ArcadeServiceResult<{ lobby: ArcadeLobbyState }>> {
    this.trackIdentity(player);
    const location = this.getLocation(player.agentId);
    if (location.place !== 'table') {
      return this.fail('You are not currently seated at a table.', 'PLAYER_NOT_AT_TABLE');
    }

    const table = this.tables.getTable(location.tableId);
    if (!table) {
      this.agentLocations.set(player.agentId, { place: 'lobby' });
      return { ok: true, data: { lobby: this.getLobbyState(player.agentId) } };
    }

    table.session.onLeave(
      {
        ...player,
        isHost: table.summary.createdBy === player.agentId,
      },
      'voluntary',
    );
    const removed = this.tables.removePlayer(location.tableId, player.agentId);
    this.agentLocations.set(player.agentId, { place: 'lobby' });

    if (removed?.shouldCloseNow) {
      await this.tables.closeTable(location.tableId, undefined, 'empty_room');
    } else {
      this.pushTableEvent(table, {
        type: 'player_left',
        agentId: player.agentId,
        agentName: player.agentName,
      });
    }

    return {
      ok: true,
      data: { lobby: this.getLobbyState(player.agentId) },
    };
  }

  watchTable(player: ArcadePlayerIdentity, tableId: string): ArcadeServiceResult<ArcadeTableState> {
    this.trackIdentity(player);
    const location = this.getLocation(player.agentId);
    if (location.place === 'table' || location.place === 'disconnected') {
      return this.fail('You are currently seated at a table. Leave it first.', 'PLAYER_ALREADY_AT_TABLE', 'arcade_leave_table');
    }
    if (location.place === 'watching' && location.tableId !== tableId) {
      return this.fail('Stop your current spectating session first.', 'PLAYER_ALREADY_WATCHING', 'arcade_unwatch_table');
    }

    const table = this.tables.getTable(tableId);
    if (!table) {
      return this.fail('Table not found', 'TABLE_NOT_FOUND');
    }

    if (!table.game.catalog.capabilities.spectators) {
      return this.fail('This game does not support spectators.', 'SPECTATORS_NOT_SUPPORTED');
    }

    if (!this.canAccessTable(table.summary, player.agentId)) {
      return this.fail('You do not have permission to enter this table.', 'TABLE_NOT_VISIBLE');
    }

    this.tables.addSpectator(tableId, player);
    this.agentLocations.set(player.agentId, { place: 'watching', tableId });

    return {
      ok: true,
      data: this.buildTableState(table, player.agentId),
    };
  }

  async unwatchTable(agentId: string): Promise<ArcadeServiceResult<{ lobby: ArcadeLobbyState }>> {
    const location = this.getLocation(agentId);
    if (location.place !== 'watching') {
      return this.fail('You are not currently spectating.', 'PLAYER_NOT_WATCHING');
    }

    const removed = this.tables.removeSpectator(location.tableId, agentId);
    this.agentLocations.set(agentId, { place: 'lobby' });
    if (removed?.shouldCloseNow) {
      await this.tables.closeTable(location.tableId, undefined, 'empty_room');
    }
    return {
      ok: true,
      data: { lobby: this.getLobbyState(agentId) },
    };
  }

  async closeTable(tableId: string, agentId: string): Promise<ArcadeServiceResult<{ lobby: ArcadeLobbyState }>> {
    const closed = await this.tables.closeTable(tableId, agentId, 'closed_by_owner');
    if (!closed.ok) return closed;
    return {
      ok: true,
      data: { lobby: this.getLobbyState(agentId) },
    };
  }

  kickPlayer(actorAgentId: string, targetAgentId: string): ArcadeServiceResult<{ table: ArcadeTableState }> {
    const actorLocation = this.getLocation(actorAgentId);
    if (actorLocation.place !== 'table') {
      return this.fail('You are not currently seated at a table.', 'PLAYER_NOT_AT_TABLE');
    }

    const table = this.tables.getTable(actorLocation.tableId);
    if (!table) {
      return this.fail('Table not found', 'TABLE_NOT_FOUND');
    }

    if (table.summary.createdBy !== actorAgentId) {
      return this.fail('Only the table host can remove players.', 'NOT_TABLE_OWNER');
    }

    if (targetAgentId === actorAgentId) {
      return this.fail('You cannot remove yourself.', 'INVALID_TARGET');
    }

    const targetLocation = this.getLocation(targetAgentId);
    if (targetLocation.place !== 'table' || targetLocation.tableId !== table.summary.tableId) {
      return this.fail('The target player is not at your table.', 'TARGET_NOT_IN_TABLE');
    }

    const player = this.buildPlayerIdentity(targetAgentId, false);
    table.session.onLeave(player, 'kicked');
    this.tables.removePlayer(table.summary.tableId, targetAgentId);
    this.agentLocations.set(targetAgentId, { place: 'lobby' });

    this.pushTableEvent(table, {
      type: 'player_kicked',
      agentId: targetAgentId,
      agentName: player.agentName,
    });

    return {
      ok: true,
      data: { table: this.buildTableState(table, actorAgentId) },
    };
  }

  async handleGameAction(
    player: ArcadePlayerIdentity,
    tableId: string,
    action: ArcadeGameAction,
  ): Promise<ArcadeServiceResult<ArcadeActionResult>> {
    this.trackIdentity(player);
    const location = this.getLocation(player.agentId);
    if (location.place !== 'table' || location.tableId !== tableId) {
      return this.fail('You are not currently at this table.', 'PLAYER_NOT_AT_TABLE', 'arcade_join_table');
    }

    const table = this.tables.getTable(tableId);
    if (!table) {
      return this.fail('Table not found', 'TABLE_NOT_FOUND');
    }

    const previousSeq = table.seq;
    const result = await table.session.onAction(
      {
        ...player,
        isHost: table.summary.createdBy === player.agentId,
      },
      action,
    );
    table.summary.status = table.session.status;

    if (!result.ok) {
      return this.fail(result.error ?? 'Game action failed', 'GAME_ACTION_REJECTED');
    }

    const message = this.extractActionMessage(result.data);
    return {
      ok: true,
      data: {
        message,
        eventSeq: table.seq > previousSeq ? table.seq : previousSeq,
        snapshotVersion: table.snapshotVersion,
      },
    };
  }

  getPlayerStats(agentId: string, gameId?: string): ArcadePlayerStats[] {
    if (gameId) {
      return this.db.all(sql<StatsRow>`
        SELECT
          agent_id AS agentId,
          user_id AS userId,
          game_id AS gameId,
          games_played AS gamesPlayed,
          wins,
          losses,
          draws,
          total_wagered AS totalWagered,
          total_won AS totalWon,
          score,
          updated_at AS updatedAt
        FROM arcade_player_stats
        WHERE agent_id = ${agentId} AND game_id = ${gameId}
      `) as ArcadePlayerStats[];
    }

    return this.db.all(sql<StatsRow>`
      SELECT
        agent_id AS agentId,
        user_id AS userId,
        game_id AS gameId,
        games_played AS gamesPlayed,
        wins,
        losses,
        draws,
        total_wagered AS totalWagered,
        total_won AS totalWon,
        score,
        updated_at AS updatedAt
      FROM arcade_player_stats
      WHERE agent_id = ${agentId}
      ORDER BY game_id ASC
    `) as ArcadePlayerStats[];
  }

  getLeaderboard(limit = 20, gameId?: string): Record<string, ArcadePlayerStats[]> {
    const gameIds = gameId ? [gameId] : this.listGames().map((item) => item.id);
    const result: Record<string, ArcadePlayerStats[]> = {};

    for (const id of gameIds) {
      result[id] = this.db.all(sql<StatsRow>`
        SELECT
          agent_id AS agentId,
          user_id AS userId,
          game_id AS gameId,
          games_played AS gamesPlayed,
          wins,
          losses,
          draws,
          total_wagered AS totalWagered,
          total_won AS totalWon,
          score,
          updated_at AS updatedAt
        FROM arcade_player_stats
        WHERE game_id = ${id}
        ORDER BY score DESC, games_played DESC, updated_at DESC
        LIMIT ${limit}
      `) as ArcadePlayerStats[];
    }

    return result;
  }

  private createGameSession(game: ArcadeGameDefinition, tableContext: ArcadeTableContext): ArcadeGameSession {
    let session!: ArcadeGameSession;
    const walletPort: ArcadeGameWalletPort = {
      freeze: async (agentId, amount, reason) => this.freezeChips(agentId, amount, reason, tableContext),
      unfreeze: async (agentId, amount, reason) => {
        this.adjustWallet(agentId, {
          balanceDelta: amount,
          frozenDelta: -amount,
          reason,
          changeType: 'unfreeze',
          tableContext,
        });
      },
      forfeit: async (agentId, amount, reason) => {
        this.adjustWallet(agentId, {
          balanceDelta: 0,
          frozenDelta: -amount,
          reason,
          changeType: 'forfeit',
          tableContext,
        });
      },
      reward: async (agentId, amount, reason) => {
        this.adjustWallet(agentId, {
          balanceDelta: amount,
          frozenDelta: 0,
          reason,
          changeType: 'reward',
          tableContext,
        });
        return true;
      },
      getBalance: async (agentId) => this.getWalletRow(agentId)?.balance ?? 0,
    };

    const statsPort: ArcadeGameStatsPort = {
      recordResult: (agentId, gameId, result, wagered, won, scoreDelta) => {
        this.recordResult(agentId, gameId, result, wagered, won, scoreDelta);
      },
    };

    const logger: ArcadeGameLogger = {
      log: (actionType, payload, actor) => this.logAction(actionType, payload, actor),
    };

    const sessionContext: ArcadeGameSessionContext = {
      table: {
        ...tableContext,
        syncPlayerLeave: (agentId, event) => {
          this.syncSessionPlayerLeave(tableContext.tableId, agentId, event);
        },
      },
      wallet: walletPort,
      stats: statsPort,
      events: {
        emit: (event) => {
          const table = this.tables.getTable(tableContext.tableId);
          if (table) {
            this.pushTableEvent(table, event);
          }
        },
      },
      logger,
      clock: {
        now: () => Date.now(),
        setTimeout: (handler, timeoutMs) => setTimeout(handler, timeoutMs),
        clearTimeout: (timer) => {
          if (timer) clearTimeout(timer);
        },
      },
    };

    session = game.createSession(sessionContext, {
      tableId: tableContext.tableId,
      gameId: tableContext.gameId,
    });
    return session;
  }

  private syncSessionPlayerLeave(tableId: string, agentId: string, event?: unknown): void {
    const table = this.tables.getTable(tableId);
    if (!table) return;

    const location = this.getLocation(agentId);
    this.clearGraceTimer(agentId);
    const removed = this.tables.removePlayer(tableId, agentId);

    if (location.place === 'table' || location.place === 'disconnected') {
      this.agentLocations.set(agentId, { place: 'lobby' });
    }

    if (removed?.shouldCloseNow) {
      void this.tables.closeTable(tableId, undefined, 'empty_room');
      return;
    }

    if (event !== undefined) {
      this.pushTableEvent(table, event, [agentId]);
    }
  }

  private handleTableClosed(table: ManagedTable, reason: string): void {
    const recipients = new Set<string>([
      ...(table.summary.createdBy ? [table.summary.createdBy] : []),
      ...table.summary.players,
      ...table.summary.spectators,
    ]);

    for (const agentId of recipients) {
      this.clearGraceTimer(agentId);
      this.agentLocations.set(agentId, { place: 'lobby' });
    }

    for (const agentId of recipients) {
      this.gateway.sendToAgent(agentId, {
        id: '',
        type: 'arcade_table_closed',
        payload: {
          tableId: table.summary.tableId,
          gameId: table.summary.gameId,
          reason,
          lobby: this.getLobbyState(agentId),
        },
      });
    }
  }

  private pushTableEvent(table: ManagedTable, event: unknown, extraRecipients: string[] = []): ArcadeTableHistoryEntry {
    table.summary.status = table.session.status;
    table.seq += 1;
    table.snapshotVersion += 1;
    const change = this.normalizeTableChange(event);
    const historyEntry: ArcadeTableHistoryEntry = {
      seq: table.seq,
      snapshotVersion: table.snapshotVersion,
      change,
    };
    table.history = [historyEntry, ...table.history].slice(0, ARCADE_TABLE_HISTORY_LIMIT);
    const recipients = new Set<string>([
      ...(table.summary.createdBy ? [table.summary.createdBy] : []),
      ...table.summary.players,
      ...table.summary.spectators,
      ...extraRecipients,
    ]);

    for (const agentId of recipients) {
      const state = this.buildSessionState(table, agentId);
      const payload: ArcadeTableEventPayload = {
        tableId: table.summary.tableId,
        gameId: table.summary.gameId,
        seq: table.seq,
        snapshotVersion: table.snapshotVersion,
        change,
        state,
      };
      this.gateway.sendToAgent(agentId, {
        id: '',
        type: 'arcade_table_event',
        payload,
      });
    }

    return historyEntry;
  }

  private startGraceTimer(agentId: string, table: ManagedTable): void {
    this.clearGraceTimer(agentId);
    const graceMs = table.game.catalog.capabilities.reconnect
      ? table.game.catalog.capabilities.reconnectGraceMs
      : ARCADE_DEFAULT_RECONNECT_GRACE_MS;

    this.graceTimers.set(
      agentId,
      setTimeout(() => {
        this.graceTimers.delete(agentId);
        const location = this.getLocation(agentId);
        if (location.place !== 'disconnected' || location.tableId !== table.summary.tableId) {
          return;
        }

        const player = this.buildPlayerIdentity(agentId, table.summary.createdBy === agentId);
        table.session.onLeave(player, 'timeout');
        const removed = this.tables.removePlayer(table.summary.tableId, agentId);
        this.agentLocations.set(agentId, { place: 'lobby' });
        if (removed?.shouldCloseNow) {
          void this.tables.closeTable(table.summary.tableId, undefined, 'empty_room');
          return;
        }
        this.pushTableEvent(table, {
          type: 'player_timeout',
          agentId,
          agentName: player.agentName,
        });
      }, graceMs),
    );
  }

  private clearGraceTimer(agentId: string): void {
    const timer = this.graceTimers.get(agentId);
    if (timer) clearTimeout(timer);
    this.graceTimers.delete(agentId);
  }

  private freezeChips(
    agentId: string,
    amount: number,
    reason: string,
    tableContext?: ArcadeTableContext,
  ): Promise<boolean> {
    if (!Number.isFinite(amount) || amount <= 0) return Promise.resolve(false);
    const wallet = this.getWalletRow(agentId);
    if (!wallet || wallet.balance < amount) return Promise.resolve(false);

    this.adjustWallet(agentId, {
      balanceDelta: -amount,
      frozenDelta: amount,
      reason,
      changeType: 'freeze',
      tableContext,
    });
    return Promise.resolve(true);
  }

  private recordResult(
    agentId: string,
    gameId: string,
    result: ArcadeScoreResult,
    wagered: number,
    won: number,
    scoreDelta?: number,
  ): void {
    const wallet = this.getWalletRow(agentId);
    if (!wallet) return;
    const now = Date.now();
    const existing = this.db.get(sql<StatsRow>`
      SELECT
        agent_id AS agentId,
        user_id AS userId,
        game_id AS gameId,
        games_played AS gamesPlayed,
        wins,
        losses,
        draws,
        total_wagered AS totalWagered,
        total_won AS totalWon,
        score,
        updated_at AS updatedAt
      FROM arcade_player_stats
      WHERE agent_id = ${agentId} AND game_id = ${gameId}
    `) as StatsRow | undefined;

    const appliedScoreDelta = scoreDelta ?? (result === 'win' ? 10 : result === 'loss' ? -5 : 0);
    if (existing) {
      this.db.run(sql`
        UPDATE arcade_player_stats
        SET
          user_id = ${wallet.userId},
          games_played = ${existing.gamesPlayed + 1},
          wins = ${existing.wins + (result === 'win' ? 1 : 0)},
          losses = ${existing.losses + (result === 'loss' ? 1 : 0)},
          draws = ${existing.draws + (result === 'draw' ? 1 : 0)},
          total_wagered = ${existing.totalWagered + wagered},
          total_won = ${existing.totalWon + won},
          score = ${Math.max(0, existing.score + appliedScoreDelta)},
          updated_at = ${now}
        WHERE agent_id = ${agentId} AND game_id = ${gameId}
      `);
      return;
    }

    this.db.run(sql`
      INSERT INTO arcade_player_stats (
        agent_id,
        user_id,
        game_id,
        games_played,
        wins,
        losses,
        draws,
        total_wagered,
        total_won,
        score,
        created_at,
        updated_at
      ) VALUES (
        ${agentId},
        ${wallet.userId},
        ${gameId},
        1,
        ${result === 'win' ? 1 : 0},
        ${result === 'loss' ? 1 : 0},
        ${result === 'draw' ? 1 : 0},
        ${wagered},
        ${won},
        ${Math.max(0, appliedScoreDelta)},
        ${now},
        ${now}
      )
    `);
  }

  private ensureWalletRow(player: ArcadePlayerIdentity): ArcadeWalletSnapshot {
    const existing = this.getWalletRow(player.agentId);
    const now = Date.now();

    if (existing) {
      if (existing.userId !== player.userId || existing.agentName !== player.agentName) {
        this.db.run(sql`
          UPDATE arcade_wallets
          SET
            user_id = ${player.userId},
            agent_name = ${player.agentName},
            updated_at = ${now}
          WHERE agent_id = ${player.agentId}
        `);
        return this.toWalletSnapshot({
          ...existing,
          userId: player.userId,
          agentName: player.agentName,
          updatedAt: now,
        });
      }
      return this.toWalletSnapshot(existing);
    }

    this.db.run(sql`
      INSERT INTO arcade_wallets (
        agent_id,
        user_id,
        agent_name,
        balance,
        frozen,
        created_at,
        updated_at
      ) VALUES (
        ${player.agentId},
        ${player.userId},
        ${player.agentName},
        ${ARCADE_STARTING_CHIPS},
        0,
        ${now},
        ${now}
      )
    `);

    this.db.run(sql`
      INSERT INTO arcade_chip_ledger (
        id,
        agent_id,
        user_id,
        game_id,
        table_id,
        change_type,
        amount,
        balance_after,
        frozen_after,
        reason,
        created_at
      ) VALUES (
        ${nanoid()},
        ${player.agentId},
        ${player.userId},
        NULL,
        NULL,
        'grant',
        ${ARCADE_STARTING_CHIPS},
        ${ARCADE_STARTING_CHIPS},
        0,
        'initial_grant',
        ${now}
      )
    `);

    return {
      agentId: player.agentId,
      userId: player.userId,
      agentName: player.agentName,
      balance: ARCADE_STARTING_CHIPS,
      frozen: 0,
      totalChips: ARCADE_STARTING_CHIPS,
      updatedAt: now,
    };
  }

  private getWalletRow(agentId: string): WalletRow | undefined {
    return this.db.get(sql<WalletRow>`
      SELECT
        agent_id AS agentId,
        user_id AS userId,
        agent_name AS agentName,
        balance,
        frozen,
        created_at AS createdAt,
        updated_at AS updatedAt
      FROM arcade_wallets
      WHERE agent_id = ${agentId}
    `) as WalletRow | undefined;
  }

  private adjustWallet(
    agentId: string,
    input: {
      balanceDelta: number;
      frozenDelta: number;
      reason: string;
      changeType: string;
      tableContext?: ArcadeTableContext;
    },
  ): ArcadeWalletSnapshot {
    const wallet = this.getWalletRow(agentId);
    if (!wallet) {
      throw new Error(`Arcade wallet for agent '${agentId}' not found`);
    }

    const nextBalance = wallet.balance + input.balanceDelta;
    const nextFrozen = wallet.frozen + input.frozenDelta;
    const now = Date.now();

    if (nextBalance < 0 || nextFrozen < 0) {
      throw new Error('Arcade wallet balance would become negative');
    }

    this.db.run(sql`
      UPDATE arcade_wallets
      SET
        balance = ${nextBalance},
        frozen = ${nextFrozen},
        updated_at = ${now}
      WHERE agent_id = ${agentId}
    `);

    this.db.run(sql`
      INSERT INTO arcade_chip_ledger (
        id,
        agent_id,
        user_id,
        game_id,
        table_id,
        change_type,
        amount,
        balance_after,
        frozen_after,
        reason,
        created_at
      ) VALUES (
        ${nanoid()},
        ${agentId},
        ${wallet.userId},
        ${input.tableContext?.gameId ?? null},
        ${input.tableContext?.tableId ?? null},
        ${input.changeType},
        ${Math.abs(input.balanceDelta) + Math.abs(input.frozenDelta)},
        ${nextBalance},
        ${nextFrozen},
        ${input.reason},
        ${now}
      )
    `);

    return {
      agentId,
      userId: wallet.userId,
      agentName: wallet.agentName,
      balance: nextBalance,
      frozen: nextFrozen,
      totalChips: nextBalance + nextFrozen,
      updatedAt: now,
    };
  }

  private buildTableState(table: ManagedTable, viewerAgentId?: string): ArcadeTableState {
    return {
      table: this.buildTableSummary(table),
      seq: table.seq,
      snapshotVersion: table.snapshotVersion,
      state: this.buildSessionState(table, viewerAgentId),
    };
  }

  private buildSessionState(table: ManagedTable, viewerAgentId?: string): ArcadeSessionState {
    const viewer = viewerAgentId ? this.buildPlayerIdentity(viewerAgentId, table.summary.createdBy === viewerAgentId) : undefined;
    const rawState = table.session.getState(viewer) as ArcadeSessionState & {
      viewerPrompt?: string;
      recap?: ArcadeSessionResult | null;
      turnDeadlineAt?: number | null;
      bettingDeadlineAt?: number | null;
      hero?: unknown;
      timeline?: unknown;
      presentation?: unknown;
    };
    const legalActions = table.session.getActionSchema(viewer, rawState);
    const {
      hero: _hero,
      viewerPrompt,
      timeline: _timeline,
      recap,
      turnDeadlineAt,
      bettingDeadlineAt,
      presentation: _presentation,
      prompt,
      needAction,
      legalActions: _rawLegalActions,
      deadlineAt,
      result,
      ...rest
    } = rawState;

    return {
      ...rest,
      status: rawState.status,
      phase: rawState.phase,
      players: Array.isArray(rawState.players) ? rawState.players : [],
      prompt: typeof prompt === 'string' && prompt.trim().length > 0
        ? prompt
        : typeof viewerPrompt === 'string' && viewerPrompt.trim().length > 0
          ? viewerPrompt
          : 'Table state updated.',
      needAction: typeof needAction === 'boolean' ? (needAction || legalActions.length > 0) : legalActions.length > 0,
      legalActions,
      deadlineAt: typeof deadlineAt === 'number' || deadlineAt === null
        ? deadlineAt
        : typeof turnDeadlineAt === 'number' || turnDeadlineAt === null
          ? turnDeadlineAt ?? null
          : typeof bettingDeadlineAt === 'number' || bettingDeadlineAt === null
            ? bettingDeadlineAt ?? null
            : null,
      result: result ?? recap ?? null,
    };
  }

  private normalizeTableChange(event: unknown): ArcadeTableChange {
    const fallbackCreatedAt = Date.now();
    if (typeof event !== 'object' || event === null) {
      return {
        kind: 'table_update',
        message: 'Table state updated.',
        createdAt: fallbackCreatedAt,
      };
    }

    const value = event as Record<string, unknown>;
    const kind = typeof value.kind === 'string'
      ? value.kind
      : typeof value.type === 'string'
        ? value.type
        : 'table_update';
    const actorId = typeof value.actorId === 'string'
      ? value.actorId
      : typeof value.agentId === 'string'
        ? value.agentId
        : undefined;
    const actorName = typeof value.actorName === 'string'
      ? value.actorName
      : typeof value.agentName === 'string'
        ? value.agentName
        : undefined;
    const message = typeof value.message === 'string' && value.message.trim().length > 0
      ? value.message
      : this.defaultTableChangeMessage(kind, actorName);
    const detail = typeof value.detail === 'string'
      ? value.detail
      : typeof value.viewerPrompt === 'string'
        ? value.viewerPrompt
        : undefined;
    const createdAt = typeof value.createdAt === 'number' ? value.createdAt : fallbackCreatedAt;

    return {
      kind,
      actorId,
      actorName,
      message,
      detail,
      createdAt,
    };
  }

  private defaultTableChangeMessage(kind: string, actorName?: string): string {
    const subject = actorName ?? 'Player';
    switch (kind) {
      case 'player_joined':
        return `${subject} joined the table`;
      case 'player_left':
        return `${subject} left the table`;
      case 'player_kicked':
        return `${subject} was removed from the table`;
      case 'player_timeout':
        return `${subject} timed out and left the table`;
      case 'player_disconnected':
        return `${subject} disconnected`;
      case 'player_reconnected':
        return `${subject} reconnected to the table`;
      default:
        return 'Table state updated.';
    }
  }

  private extractActionMessage(data: unknown): string {
    if (typeof data === 'object' && data !== null && 'message' in data && typeof (data as ArcadeGameActionReceipt).message === 'string') {
      return (data as ArcadeGameActionReceipt).message;
    }
    return 'Action completed successfully.';
  }

  private buildTableSummary(table: ManagedTable): ArcadeTableSummary {
    table.summary.status = table.session.status;
    const playerNames = { ...table.summary.playerNames };
    if (table.summary.createdBy && !playerNames[table.summary.createdBy]) {
      playerNames[table.summary.createdBy] = this.agentNameMap.get(table.summary.createdBy)
        ?? this.getWalletRow(table.summary.createdBy)?.agentName
        ?? table.summary.createdBy;
    }

    return {
      ...table.summary,
      players: [...table.summary.players],
      spectators: [...table.summary.spectators],
      whitelistAgentIds: [...table.summary.whitelistAgentIds],
      playerNames,
      spectatorNames: { ...table.summary.spectatorNames },
    };
  }

  private canAccessTable(table: ArcadeTableSummary, viewerAgentId?: string): boolean {
    if (!table.isPrivate) return true;
    if (!viewerAgentId) return false;
    return (
      table.createdBy === viewerAgentId ||
      table.whitelistAgentIds.includes(viewerAgentId) ||
      table.players.includes(viewerAgentId) ||
      table.spectators.includes(viewerAgentId)
    );
  }

  private buildPlayerIdentity(agentId: string, isHost: boolean): ArcadePlayerIdentity {
    return {
      agentId,
      userId: this.userIdMap.get(agentId) ?? this.getWalletRow(agentId)?.userId ?? '',
      agentName: this.agentNameMap.get(agentId) ?? this.getWalletRow(agentId)?.agentName ?? agentId,
      isHost,
    };
  }

  private trackIdentity(player: ArcadePlayerIdentity): void {
    this.userIdMap.set(player.agentId, player.userId);
    this.agentNameMap.set(player.agentId, player.agentName);
  }

  private toWalletSnapshot(row: WalletRow): ArcadeWalletSnapshot {
    return {
      agentId: row.agentId,
      userId: row.userId,
      agentName: row.agentName,
      balance: row.balance,
      frozen: row.frozen,
      totalChips: row.balance + row.frozen,
      updatedAt: row.updatedAt,
    };
  }

  private async logAction(
    actionType: string,
    payload: unknown,
    actor?: Partial<ArcadePlayerIdentity> & {
      tableId?: string;
      gameId?: string;
      result?: 'success' | 'failure';
      detail?: string;
    },
  ): Promise<void> {
    if (!this.logger) return;
    const wallet = actor?.agentId ? this.getWalletRow(actor.agentId) : undefined;
    if (!wallet && !actor?.userId && !actor?.agentId) return;
    await this.logger.log({
      userId: actor?.userId ?? wallet?.userId ?? 'arcade-system',
      agentId: actor?.agentId ?? wallet?.agentId ?? 'arcade-system',
      locationId: ARCADE_LOCATION_ID,
      actionType,
      payload,
      result: actor?.result ?? 'success',
      detail: actor?.detail,
    });
  }

  private fail<T>(error: string, code: string, action?: string, details?: Record<string, unknown>): ArcadeServiceResult<T> {
    return {
      ok: false,
      error: {
        error,
        code,
        action,
        details,
      },
    };
  }
}

export { ARCADE_GAME_API_VERSION, ARCADE_LOCATION_ID };
