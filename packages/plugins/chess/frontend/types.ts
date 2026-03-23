export type ChessColor = 'w' | 'b';
export type ChessMatchPhase = 'waiting' | 'playing' | 'finished';
export type ChessRoomVisibility = 'public' | 'private';

export interface ChessGuideField {
  field: string;
  meaning: string;
}

export interface ChessGuide {
  summary: string;
  whyYouReceivedThis: string;
  whatToDoNow: string;
  recommendedCommands: string[];
  fieldGlossary?: ChessGuideField[];
}

export interface ChessLegalMove {
  from: string;
  to: string;
  san: string;
  promotion: string | null;
}

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
  roomName: string;
  visibility: ChessRoomVisibility;
  phase: ChessMatchPhase;
  playerCount: number;
  seatsRemaining: number;
  readyCount: number;
  spectatorCount: number;
  players: Array<{
    agentId: string;
    agentName: string;
    ready: boolean;
    connected: boolean;
  }>;
  createdAt: number;
}

export interface ChessRoomSummary {
  matchId: string;
  roomName: string;
  visibility: ChessRoomVisibility;
  phase: ChessMatchPhase;
  playerCount: number;
  seatsRemaining: number;
  readyCount: number;
  spectatorCount: number;
  players: ChessMatchSummary['players'];
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
  roomName: string;
  visibility: ChessRoomVisibility;
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
  legalMoves: ChessLegalMove[];
}

export interface ChessRating {
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

export interface ChessBootstrapPayload {
  currentMatch: ChessMatchState | null;
  joinableMatches: ChessMatchSummary[];
  lobbyVersion: number;
  rating: ChessRating;
  leaderboard: ChessRating[];
  guide?: ChessGuide;
}

export interface ChessRoomDirectoryPayload {
  rooms: ChessRoomSummary[];
  directoryVersion: number;
  query: string | null;
  guide?: ChessGuide;
}

export type ChessLobbyDeltaKind = 'room_added' | 'room_updated' | 'room_removed';

export interface ChessLobbyDeltaPayload {
  kind: ChessLobbyDeltaKind;
  version: number;
  matchId: string;
  needsBootstrap?: boolean;
  wakeText?: string;
  room?: ChessMatchSummary;
  guide?: ChessGuide;
}

export type ChessRoomDirectoryDeltaKind = 'room_added' | 'room_updated' | 'room_removed';

export interface ChessRoomDirectoryDeltaPayload {
  kind: ChessRoomDirectoryDeltaKind;
  version: number;
  matchId: string;
  needsRoomDirectoryRefresh?: boolean;
  wakeText?: string;
  room?: ChessRoomSummary;
  guide?: ChessGuide;
}

export type ChessMatchDeltaKind =
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

export interface ChessMatchDeltaPayload {
  matchId: string;
  seq: number;
  kind: ChessMatchDeltaKind;
  phase?: ChessMatchPhase;
  serverTimestamp: number;
  needsBootstrap?: boolean;
  needsMatchRefresh?: boolean;
  wakeText?: string;
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
  state?: ChessMatchState;
  guide?: ChessGuide;
}

export interface ChessTurnPromptPayload {
  matchId: string;
  seq: number;
  serverTimestamp: number;
  promptKind: 'turn' | 'reminder';
  reminder: boolean;
  yourColor: ChessColor;
  remainingMs: number;
  fen?: string;
  moveCount?: number;
  needsMatchRefresh?: boolean;
  wakeText?: string;
  state?: ChessMatchState;
  legalMoves: ChessLegalMove[];
  guide?: ChessGuide;
}

export interface ChessWatchRoomPayload {
  room: ChessRoomSummary;
  state: ChessMatchState;
  guide?: ChessGuide;
}

export interface ChessUnwatchRoomPayload {
  matchId: string | null;
  guide?: ChessGuide;
}

export interface ChessRoomDeltaPayload {
  matchId: string;
  seq: number;
  phase: ChessMatchPhase;
  serverTimestamp: number;
  spectatorCount: number;
  needsWatchedRoomRefresh?: boolean;
  wakeText?: string;
  state?: ChessMatchState;
  guide?: ChessGuide;
}
