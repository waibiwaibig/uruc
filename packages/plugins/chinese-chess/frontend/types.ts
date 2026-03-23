export type ChineseChessSide = 'red' | 'black';
export type ChineseChessMatchPhase = 'waiting' | 'playing' | 'finished';
export type ChineseChessRoomVisibility = 'public' | 'private';
export type ChineseChessResultType = 'red_win' | 'black_win' | 'draw';
export type ChineseChessResultReason =
  | 'checkmate'
  | 'stalemate'
  | 'timeout'
  | 'resignation'
  | 'draw_agreement'
  | 'disconnect_timeout'
  | 'draw';

export interface ChineseChessGuideField {
  field: string;
  meaning: string;
}

export interface ChineseChessGuide {
  summary: string;
  whyYouReceivedThis: string;
  whatToDoNow: string;
  recommendedCommands: string[];
  fieldGlossary?: ChineseChessGuideField[];
}

export interface ChineseChessLegalMove {
  iccs: string;
  from: string;
  to: string;
  display: string;
  isCapture: boolean;
}

export interface ChineseChessMoveRecord {
  iccs: string;
  from: string;
  to: string;
  display: string;
  isCapture: boolean;
}

export interface ChineseChessPlayer {
  agentId: string;
  userId: string;
  agentName: string;
  side: ChineseChessSide | null;
  ready: boolean;
  connected: boolean;
  disconnectDeadlineAt: number | null;
}

export interface ChineseChessRoomPlayerSummary {
  agentId: string;
  agentName: string;
  side: ChineseChessSide | null;
  ready: boolean;
  connected: boolean;
}

export interface ChineseChessRoomSummary {
  matchId: string;
  roomName: string;
  visibility: ChineseChessRoomVisibility;
  phase: ChineseChessMatchPhase;
  playerCount: number;
  seatsRemaining: number;
  readyCount: number;
  spectatorCount: number;
  players: ChineseChessRoomPlayerSummary[];
  createdAt: number;
}

export interface ChineseChessRating {
  agentId: string;
  userId: string;
  agentName?: string;
  rating: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
  draws: number;
  updatedAt: number;
}

export interface ChineseChessMatchResult {
  result: ChineseChessResultType;
  reason: ChineseChessResultReason;
  winnerAgentId: string | null;
  ratingChanges: Record<string, number>;
  endedAt: number;
}

export interface ChineseChessMatchState {
  matchId: string;
  roomName: string;
  visibility: ChineseChessRoomVisibility;
  phase: ChineseChessMatchPhase;
  seq: number;
  serverTimestamp: number;
  moveCount: number;
  positionFen: string;
  sideToMove: ChineseChessSide;
  inCheck: boolean;
  clocks: {
    redMs: number;
    blackMs: number;
  };
  drawOfferBy: string | null;
  players: ChineseChessPlayer[];
  yourAgentId?: string;
  yourSide: ChineseChessSide | null;
  result: ChineseChessMatchResult | null;
  legalMoves: ChineseChessLegalMove[];
  moveHistory: ChineseChessMoveRecord[];
}

export interface ChineseChessBootstrapPayload {
  currentMatch: ChineseChessMatchState | null;
  joinableMatches: ChineseChessRoomSummary[];
  lobbyVersion: number;
  rating: ChineseChessRating;
  leaderboard: ChineseChessRating[];
  guide?: ChineseChessGuide;
}

export interface ChineseChessRoomDirectoryPayload {
  rooms: ChineseChessRoomSummary[];
  directoryVersion: number;
  query: string | null;
  guide?: ChineseChessGuide;
}

export type ChineseChessLobbyDeltaKind = 'room_added' | 'room_updated' | 'room_removed';

export interface ChineseChessLobbyDeltaPayload {
  kind: ChineseChessLobbyDeltaKind;
  version: number;
  matchId: string;
  needsBootstrap?: boolean;
  wakeText?: string;
  room?: ChineseChessRoomSummary;
  guide?: ChineseChessGuide;
}

export type ChineseChessRoomDirectoryDeltaKind = 'room_added' | 'room_updated' | 'room_removed';

export interface ChineseChessRoomDirectoryDeltaPayload {
  kind: ChineseChessRoomDirectoryDeltaKind;
  version: number;
  matchId: string;
  needsRoomDirectoryRefresh?: boolean;
  wakeText?: string;
  room?: ChineseChessRoomSummary;
  guide?: ChineseChessGuide;
}

export type ChineseChessMatchDeltaKind =
  | 'player_joined'
  | 'player_ready'
  | 'player_unready'
  | 'player_left_waiting'
  | 'player_disconnected'
  | 'player_reconnected'
  | 'game_started'
  | 'move_made'
  | 'draw_offered'
  | 'draw_declined'
  | 'game_finished';

export interface ChineseChessMatchDeltaPayload {
  matchId: string;
  seq: number;
  kind: ChineseChessMatchDeltaKind;
  phase?: ChineseChessMatchPhase;
  serverTimestamp: number;
  needsBootstrap?: boolean;
  needsMatchRefresh?: boolean;
  wakeText?: string;
  player?: ChineseChessPlayer;
  agentId?: string;
  sideToMove?: ChineseChessSide | null;
  clocks?: {
    redMs: number;
    blackMs: number;
  };
  move?: ChineseChessMoveRecord;
  inCheck?: boolean;
  drawOfferBy?: string | null;
  result?: ChineseChessMatchResult;
  reconnectDeadlineAt?: number | null;
  state?: ChineseChessMatchState;
  guide?: ChineseChessGuide;
}

export interface ChineseChessTurnPromptPayload {
  matchId: string;
  seq: number;
  serverTimestamp: number;
  promptKind: 'turn' | 'reminder';
  reminder: boolean;
  yourSide: ChineseChessSide;
  remainingMs: number;
  positionFen?: string;
  moveCount?: number;
  needsMatchRefresh?: boolean;
  wakeText?: string;
  state?: ChineseChessMatchState;
  legalMoves: ChineseChessLegalMove[];
  guide?: ChineseChessGuide;
}

export interface ChineseChessWatchRoomPayload {
  room: ChineseChessRoomSummary;
  state: ChineseChessMatchState;
  guide?: ChineseChessGuide;
}

export interface ChineseChessUnwatchRoomPayload {
  matchId: string | null;
  guide?: ChineseChessGuide;
}

export interface ChineseChessRoomDeltaPayload {
  matchId: string;
  seq: number;
  phase: ChineseChessMatchPhase;
  serverTimestamp: number;
  spectatorCount: number;
  needsWatchedRoomRefresh?: boolean;
  wakeText?: string;
  state?: ChineseChessMatchState;
  guide?: ChineseChessGuide;
}
