export const ARCADE_PLUGIN_NAME = 'arcade';
export const ARCADE_LOCATION_ID = 'arcade';
export const ARCADE_GAME_API_VERSION = '1.0.0';
export const ARCADE_STARTING_CHIPS = 1000;
export const ARCADE_IDLE_TABLE_TIMEOUT_MS = 5 * 60 * 1000;
export const ARCADE_DEFAULT_RECONNECT_GRACE_MS = 60 * 1000;
export const ARCADE_TABLE_HISTORY_LIMIT = 64;

export type ArcadeScoreResult = 'win' | 'loss' | 'draw';
export type ArcadeLeaveReason = 'voluntary' | 'disconnect' | 'kicked' | 'timeout' | 'location_leave';
export type ArcadeSessionStatus = 'waiting' | 'playing' | 'finished';
export type ArcadeActionParamType = 'string' | 'number' | 'boolean';
export type ArcadeActionStyle = 'primary' | 'secondary' | 'danger';
export type ArcadePresentationLayout = 'card-table' | 'generic';
export type ArcadeNoticeKind = 'info' | 'success' | 'warning' | 'danger' | 'turn';

export interface ArcadePlayerIdentity {
  agentId: string;
  userId: string;
  agentName: string;
  isHost?: boolean;
}

export interface ArcadeGameCapabilities {
  reconnect: boolean;
  reconnectGraceMs: number;
  minPlayersToContinue: number;
  spectators: boolean;
  midGameJoin: boolean;
}

export interface ArcadeGameCatalog {
  name: string;
  description: string;
  minPlayers: number;
  maxPlayers: number;
  tags: string[];
  capabilities: ArcadeGameCapabilities;
}

export interface ArcadeGameManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  main: string;
  apiVersion: string;
  dependencies?: string[];
  absolutePath?: string;
}

export interface ArcadeGameConfig {
  enabled: boolean;
  autoLoad: boolean;
}

export interface ArcadeGameDiscoveryConfig {
  enabled: boolean;
  paths: string[];
  exclude: string[];
}

export interface ArcadeGamesConfigFile {
  games: Record<string, ArcadeGameConfig>;
  discovery: ArcadeGameDiscoveryConfig;
}

export interface ArcadeGameDiagnostic {
  name: string;
  version?: string;
  state: 'loaded' | 'initialized' | 'started' | 'skipped' | 'failed';
  reason?: string;
}

export interface ArcadeGameLogger {
  log(
    actionType: string,
    payload?: unknown,
    actor?: Partial<ArcadePlayerIdentity> & {
      tableId?: string;
      gameId?: string;
      result?: 'success' | 'failure';
      detail?: string;
    },
  ): Promise<void>;
}

export interface ArcadeClock {
  now(): number;
  setTimeout(handler: () => void, timeoutMs: number): ReturnType<typeof setTimeout>;
  clearTimeout(timer?: ReturnType<typeof setTimeout>): void;
}

export interface ArcadeGameHostContext {
  logger: ArcadeGameLogger;
  clock: ArcadeClock;
}

export interface ArcadeTableContext {
  tableId: string;
  gameId: string;
  name: string;
  maxPlayers: number;
  createdBy: string | null;
  syncPlayerLeave(agentId: string, event?: unknown): void;
}

export interface ArcadeGameWalletPort {
  freeze(agentId: string, amount: number, reason: string): Promise<boolean>;
  unfreeze(agentId: string, amount: number, reason: string): Promise<void>;
  forfeit(agentId: string, amount: number, reason: string): Promise<void>;
  reward(agentId: string, amount: number, reason: string): Promise<boolean>;
  getBalance(agentId: string): Promise<number>;
}

export interface ArcadeGameStatsPort {
  recordResult(
    agentId: string,
    gameId: string,
    result: ArcadeScoreResult,
    wagered: number,
    won: number,
    scoreDelta?: number,
  ): void | Promise<void>;
}

export interface ArcadeGameEventPort {
  emit(event: unknown): void;
}

export interface ArcadeGameSessionContext {
  table: ArcadeTableContext;
  wallet: ArcadeGameWalletPort;
  stats: ArcadeGameStatsPort;
  events: ArcadeGameEventPort;
  logger: ArcadeGameLogger;
  clock: ArcadeClock;
}

export interface ArcadeGameAction {
  type: string;
  [key: string]: unknown;
}

export interface ArcadeGameActionParamSchema {
  type: ArcadeActionParamType;
  description?: string;
  required?: boolean;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
  defaultValue?: string | number | boolean;
}

export interface ArcadeGameActionSchema {
  type: string;
  label?: string;
  description: string;
  style?: ArcadeActionStyle;
  helperText?: string;
  params: Record<string, ArcadeGameActionParamSchema>;
}

export interface ArcadeJoinResult {
  ok: boolean;
  error?: string;
}

export interface ArcadeLeaveResult {
  keepSlot: boolean;
}

export interface ArcadeGameResult {
  ok: boolean;
  data?: unknown;
  error?: string;
}

export interface ArcadeGameActionReceipt {
  message: string;
}

export interface ArcadeSessionPlayerState {
  agentId: string;
  agentName: string;
  isHost?: boolean;
  status?: string;
  connected?: boolean;
  cardCount?: number;
  hand?: string[];
  total?: number;
  bet?: number;
  committed?: number;
  stack?: number;
  readyForNextHand?: boolean;
  sittingOut?: boolean;
  folded?: boolean;
  allIn?: boolean;
  [key: string]: unknown;
}

export interface ArcadeTableChange {
  kind: string;
  actorId?: string;
  actorName?: string;
  message: string;
  detail?: string;
  createdAt: number;
}

export interface ArcadePresentationCard {
  id: string;
  label?: string;
  face?: string;
  hidden?: boolean;
  tone?: 'light' | 'dark' | 'accent';
}

export interface ArcadePresentationCenterBlock {
  id: string;
  title: string;
  value?: string | number;
  detail?: string;
  tone?: 'neutral' | 'cyan' | 'mint' | 'sun' | 'pink' | 'danger';
  cards?: ArcadePresentationCard[];
  items?: string[];
}

export interface ArcadePresentationPlayer {
  agentId: string;
  displayName: string;
  statusText?: string;
  badges?: string[];
  cards?: ArcadePresentationCard[];
  hiddenCardCount?: number;
  wager?: number;
  stack?: number;
  total?: number;
  isHost?: boolean;
  isCurrentTurn?: boolean;
  isViewer?: boolean;
  connected?: boolean;
}

export interface ArcadeTimelineEvent extends ArcadeTableChange {
  id: string;
  severity: ArcadeNoticeKind;
  viewerPrompt?: string;
}

export interface ArcadePresentationHero {
  kind: ArcadeNoticeKind;
  title: string;
  body: string;
  countdownMs?: number;
}

export interface ArcadeSessionResultItem {
  agentId: string;
  agentName: string;
  outcome: string;
  summary: string;
  delta?: number;
  hand?: string[];
  label?: string;
}

export interface ArcadeSessionResult {
  title: string;
  summary: string;
  detail?: string;
  items: ArcadeSessionResultItem[];
}

export type ArcadePresentationRecapItem = ArcadeSessionResultItem;
export type ArcadePresentationRecap = ArcadeSessionResult;

export interface ArcadeSessionPresentation {
  layout: ArcadePresentationLayout;
  statusText?: string;
  hero?: ArcadePresentationHero;
  viewerPrompt?: string;
  timeline?: ArcadeTimelineEvent[];
  recap?: ArcadeSessionResult | null;
  center: ArcadePresentationCenterBlock[];
  players: ArcadePresentationPlayer[];
}

export interface ArcadeSessionState {
  status: ArcadeSessionStatus;
  phase: string;
  prompt: string;
  needAction: boolean;
  legalActions: ArcadeGameActionSchema[];
  deadlineAt?: number | null;
  players: ArcadeSessionPlayerState[];
  result?: ArcadeSessionResult | null;
  [key: string]: unknown;
}

export interface ArcadeGameSession {
  readonly status: ArcadeSessionStatus;
  onJoin(player: ArcadePlayerIdentity): ArcadeJoinResult;
  onLeave(player: ArcadePlayerIdentity, reason: ArcadeLeaveReason): ArcadeLeaveResult | void;
  onReconnect?(player: ArcadePlayerIdentity): { ok: boolean; error?: string };
  onAction(player: ArcadePlayerIdentity, action: ArcadeGameAction): ArcadeGameResult | Promise<ArcadeGameResult>;
  getState(viewer?: ArcadePlayerIdentity): ArcadeSessionState;
  getActionSchema(viewer?: ArcadePlayerIdentity, state?: ArcadeSessionState): ArcadeGameActionSchema[];
  abort?(reason: string): Promise<void> | void;
  dispose(): void;
}

export interface ArcadeGameDefinition {
  id: string;
  version: string;
  apiVersion: string;
  dependencies?: string[];
  catalog: ArcadeGameCatalog;
  init(ctx: ArcadeGameHostContext): Promise<void> | void;
  start?(): Promise<void> | void;
  stop?(): Promise<void> | void;
  destroy?(): Promise<void> | void;
  createSession(ctx: ArcadeGameSessionContext, options?: Record<string, unknown>): ArcadeGameSession;
}

export interface ArcadeWalletSnapshot {
  agentId: string;
  userId: string;
  agentName: string;
  balance: number;
  frozen: number;
  totalChips: number;
  updatedAt: number;
}

export interface ArcadePlayerStats {
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

export interface ArcadeTableSummary {
  tableId: string;
  gameId: string;
  gameName: string;
  name: string;
  status: ArcadeSessionStatus;
  players: string[];
  spectators: string[];
  maxPlayers: number;
  createdBy: string | null;
  createdAt: number;
  isPrivate: boolean;
  whitelistAgentIds: string[];
  playerNames: Record<string, string>;
  spectatorNames: Record<string, string>;
}

export interface ArcadeActionResult {
  message: string;
  eventSeq: number;
  snapshotVersion: number;
}

export interface ArcadeTableState {
  table: ArcadeTableSummary;
  seq: number;
  snapshotVersion: number;
  state: ArcadeSessionState;
}

export interface ArcadeTableHistoryEntry {
  seq: number;
  snapshotVersion: number;
  change: ArcadeTableChange;
}

export interface ArcadeTableHistory {
  table: ArcadeTableSummary;
  seq: number;
  snapshotVersion: number;
  history: ArcadeTableHistoryEntry[];
}

export interface ArcadeTableEventPayload {
  tableId: string;
  gameId: string;
  seq: number;
  snapshotVersion: number;
  change: ArcadeTableChange;
  state: ArcadeSessionState;
}

export type ArcadePlayerLocation =
  | { place: 'lobby' }
  | { place: 'table'; tableId: string }
  | { place: 'watching'; tableId: string }
  | { place: 'disconnected'; tableId: string };

export interface ArcadeGameListItem {
  id: string;
  version: string;
  apiVersion: string;
  dependencies: string[];
  catalog: ArcadeGameCatalog;
}

export interface ArcadeLobbyState {
  wallet: ArcadeWalletSnapshot | null;
  games: ArcadeGameListItem[];
  tables: ArcadeTableSummary[];
  diagnostics: ArcadeGameDiagnostic[];
  yourLocation: ArcadePlayerLocation;
}
