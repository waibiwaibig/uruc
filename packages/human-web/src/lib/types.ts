export type UserRole = 'user' | 'admin';

export interface User {
  id: string;
  username: string;
  email?: string;
  role: UserRole;
  emailVerified?: boolean;
}

export interface Agent {
  id: string;
  userId: string;
  name: string;
  token: string;
  isShadow: boolean;
  trustMode: 'confirm' | 'full';
  allowedLocations: string[];
  isOnline: boolean;
  description?: string | null;
  avatarPath?: string | null;
  frozen?: number;
  searchable?: number | boolean | null;
  createdAt: string;
}

export interface HealthPlugin {
  name: string;
  version: string;
  started: boolean;
}

export interface HealthResponse {
  status: string;
  plugins: HealthPlugin[];
  services: string[];
}

export interface ActionLog {
  id: string;
  userId: string;
  agentId: string;
  locationId?: string | null;
  actionType: string;
  payload?: string | null;
  result: 'success' | 'failure';
  detail?: string | null;
  createdAt: string;
}

export interface LocationDef {
  id: string;
  name: string;
  description?: string;
  pluginName?: string;
}

export interface CommandSchema {
  type: string;
  description: string;
  pluginName?: string;
  params: Record<string, { type: string; description?: string; required?: boolean }>;
  requiresConfirmation?: boolean;
}

export type WsConnectionStatus =
  | 'idle'
  | 'connecting'
  | 'authenticating'
  | 'syncing'
  | 'connected'
  | 'reconnecting'
  | 'closed'
  | 'error';

export interface WsErrorPayload {
  error: string;
  code?: string;
  retryable?: boolean;
  action?: string;
  details?: Record<string, unknown>;
}

export interface WsEnvelope {
  id?: string;
  type: string;
  payload?: unknown;
}

export type ChessColor = 'w' | 'b';
export type ChessMatchPhase = 'waiting' | 'playing' | 'finished';

export interface ChessPlayer {
  agentId: string;
  userId: string;
  agentName: string;
  color: ChessColor | null;
  ready: boolean;
  connected: boolean;
  disconnectDeadlineAt: number | null;
}

export interface ChessMatchSummary {
  matchId: string;
  phase: ChessMatchPhase;
  playerCount: number;
  seatsRemaining: number;
  readyCount: number;
  players: Array<{
    agentId: string;
    agentName: string;
    ready: boolean;
    connected: boolean;
  }>;
  createdAt: number;
}

export interface ChessMatchResult {
  result: 'white_win' | 'black_win' | 'draw';
  reason: string;
  winnerAgentId: string | null;
  ratingChanges: Record<string, number>;
  endedAt: number;
}

export interface ChessMatchState {
  matchId: string;
  phase: ChessMatchPhase;
  seq: number;
  serverTimestamp: number;
  moveCount: number;
  fen: string;
  pgn: string;
  turn: ChessColor | null;
  inCheck: boolean;
  clocks: {
    whiteMs: number;
    blackMs: number;
  };
  drawOfferBy: string | null;
  players: ChessPlayer[];
  yourAgentId?: string;
  yourColor: ChessColor | null;
  result: ChessMatchResult | null;
}

export interface ChessBootstrapPayload {
  currentMatch: ChessMatchState | null;
  joinableMatches: ChessMatchSummary[];
  lobbyVersion: number;
  rating: ChessRating;
  leaderboard: ChessRating[];
}

export type ChessLobbyDeltaKind = 'room_added' | 'room_updated' | 'room_removed';

export interface ChessLobbyDeltaPayload {
  kind: ChessLobbyDeltaKind;
  version: number;
  matchId: string;
  room?: ChessMatchSummary;
}

export type ChessMatchDeltaKind =
  | 'player_joined'
  | 'player_ready'
  | 'player_left_waiting'
  | 'player_disconnected'
  | 'player_reconnected'
  | 'game_started'
  | 'move_made'
  | 'draw_offered'
  | 'draw_declined'
  | 'game_finished';

export interface ChessMatchDeltaPayload {
  matchId: string;
  seq: number;
  kind: ChessMatchDeltaKind;
  serverTimestamp: number;
  player?: ChessPlayer;
  agentId?: string;
  players?: Array<Pick<ChessPlayer, 'agentId' | 'color' | 'ready' | 'connected' | 'disconnectDeadlineAt'>>;
  turn?: ChessColor | null;
  clocks?: {
    whiteMs: number;
    blackMs: number;
  };
  move?: {
    from: string;
    to: string;
    san: string;
    promotion: string | null;
  };
  inCheck?: boolean;
  drawOfferBy?: string | null;
  result?: ChessMatchResult;
  reconnectDeadlineAt?: number | null;
}

export interface ChessRating {
  agentId: string;
  userId: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  updatedAt: number;
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

export interface ArcadeGameDiagnostic {
  name: string;
  version?: string;
  state: 'loaded' | 'initialized' | 'started' | 'skipped' | 'failed';
  reason?: string;
}

export interface ArcadeGameListItem {
  id: string;
  version: string;
  apiVersion: string;
  dependencies: string[];
  catalog: ArcadeGameCatalog;
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

export type ArcadePlayerLocation =
  | { place: 'lobby' }
  | { place: 'table'; tableId: string }
  | { place: 'watching'; tableId: string }
  | { place: 'disconnected'; tableId: string };

export type ArcadeNoticeKind = 'info' | 'success' | 'warning' | 'danger' | 'turn';

export interface ArcadeGameActionSchema {
  type: string;
  label?: string;
  description: string;
  style?: 'primary' | 'secondary' | 'danger';
  helperText?: string;
  params: Record<string, {
    type: 'string' | 'number' | 'boolean';
    description?: string;
    required?: boolean;
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    defaultValue?: string | number | boolean;
  }>;
}

export interface ArcadeSessionPlayerState {
  agentId: string;
  agentName: string;
  isHost?: boolean;
  status?: string;
  connected?: boolean;
  cardCount?: number;
  total?: number;
  hand?: string[];
  bet?: number;
  committed?: number;
  stack?: number;
  readyForNextHand?: boolean;
  sittingOut?: boolean;
  folded?: boolean;
  allIn?: boolean;
  color?: string | null;
  stone?: string | null;
  protected?: boolean;
  eliminated?: boolean;
  unoDeclared?: boolean;
  publicDiscards?: string[];
  [key: string]: unknown;
}

export interface ArcadeDealerState {
  hand?: string[];
  total?: number;
  busted?: boolean;
  showing?: string;
  hiddenCards?: number;
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

export interface ArcadeTimelineEvent {
  id: string;
  kind: string;
  severity: ArcadeNoticeKind;
  actorId?: string;
  actorName?: string;
  message: string;
  detail?: string;
  createdAt: number;
  viewerPrompt?: string;
}

export interface ArcadeTableChange {
  kind: string;
  actorId?: string;
  actorName?: string;
  message: string;
  detail?: string;
  createdAt: number;
}

export interface ArcadePresentationHero {
  kind: ArcadeNoticeKind;
  title: string;
  body: string;
  countdownMs?: number;
}

export interface ArcadePresentationRecapItem {
  agentId: string;
  agentName: string;
  outcome: string;
  summary: string;
  delta?: number;
  hand?: string[];
  label?: string;
}

export interface ArcadePresentationRecap {
  title: string;
  summary: string;
  detail?: string;
  items: ArcadePresentationRecapItem[];
}

export interface ArcadeSessionPresentation {
  layout: 'card-table' | 'generic';
  statusText?: string;
  hero?: ArcadePresentationHero;
  viewerPrompt?: string;
  timeline?: ArcadeTimelineEvent[];
  recap?: ArcadePresentationRecap | null;
  center: ArcadePresentationCenterBlock[];
  players: ArcadePresentationPlayer[];
}

export interface ArcadeSessionState {
  status: string;
  phase?: string;
  currentTurn?: string;
  currentPlayer?: string;
  prompt: string;
  needAction: boolean;
  legalActions: ArcadeGameActionSchema[];
  deadlineAt?: number | null;
  players: ArcadeSessionPlayerState[];
  result?: ArcadePresentationRecap | null;
  dealer?: ArcadeDealerState | null;
  board?: unknown;
  community?: string[];
  topCard?: string | null;
  chosenColor?: string | null;
  pendingDraw?: number;
  drawPileCount?: number;
  deckCount?: number;
  tokensToWin?: number;
  roundNumber?: number;
  winningLine?: Array<{ x: number; y: number }>;
  matchScore?: Record<string, number>;
  hero?: ArcadePresentationHero;
  viewerPrompt?: string;
  timeline?: ArcadeTimelineEvent[];
  recap?: ArcadePresentationRecap | null;
  turnDeadlineAt?: number | null;
  bettingDeadlineAt?: number | null;
  pot?: number;
  sidePots?: Array<{ amount: number; contenders: string[] }>;
  toCall?: number;
  minRaiseTo?: number | null;
  presentation?: ArcadeSessionPresentation;
  [key: string]: unknown;
}

export interface ArcadeActionResult {
  message: string;
  eventSeq: number;
  snapshotVersion: number;
}

export interface ArcadeTableSummary {
  tableId: string;
  gameId: string;
  gameName: string;
  name: string;
  status: string;
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

export interface ArcadeLobbyState {
  wallet: ArcadeWalletSnapshot | null;
  games: ArcadeGameListItem[];
  tables: ArcadeTableSummary[];
  diagnostics: ArcadeGameDiagnostic[];
  yourLocation: ArcadePlayerLocation;
}

export interface ArcadeWelcomePayload {
  message: string;
  lobby?: ArcadeLobbyState;
  currentTableId?: string | null;
  games?: ArcadeGameListItem[];
  diagnostics?: ArcadeGameDiagnostic[];
}

export interface ArcadeReconnectedPayload {
  lobby: ArcadeLobbyState;
  currentTableId?: string | null;
}

export interface ArcadeTableEventPayload {
  tableId: string;
  gameId: string;
  seq: number;
  snapshotVersion: number;
  change: ArcadeTableChange;
  state: ArcadeSessionState;
}

export interface ArcadeTableClosedPayload {
  tableId: string;
  gameId: string;
  reason: string;
  lobby: ArcadeLobbyState;
}

export interface RuntimeSnapshot {
  connected: boolean;
  hasController: boolean;
  isController: boolean;
  inCity: boolean;
  currentLocation: string | null;
  serverTimestamp: number;
  availableCommands: CommandSchema[];
  availableLocations: LocationDef[];
}
