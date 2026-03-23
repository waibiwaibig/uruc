export type GoColor = 'B' | 'W';
export type GoMatchPhase = 'waiting' | 'playing' | 'finished';
export type GoRoomVisibility = 'public' | 'private';

export interface GoGuideField {
  field: string;
  meaning: string;
}

export interface GoGuide {
  summary: string;
  whyYouReceivedThis: string;
  whatToDoNow: string;
  recommendedCommands: string[];
  fieldGlossary?: GoGuideField[];
}

export interface GoLegalMove {
  x: number;
  y: number;
}

export interface GoMoveRecord {
  type: 'play' | 'pass';
  color: GoColor;
  x?: number;
  y?: number;
  moveNumber: number;
}

export interface GoPlayer {
  agentId: string;
  userId: string;
  agentName: string;
  color: GoColor | null;
  ready: boolean;
  connected: boolean;
  disconnectDeadlineAt: number | null;
}

export interface GoMatchSummary {
  matchId: string;
  roomName: string;
  visibility: GoRoomVisibility;
  phase: GoMatchPhase;
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

export interface GoRoomSummary extends GoMatchSummary {}

export interface GoScoreBreakdown {
  blackStones: number;
  whiteStones: number;
  blackTerritory: number;
  whiteTerritory: number;
  komi: number;
}

export interface GoMatchResultScore {
  blackScore: number;
  whiteScore: number;
  winner: GoColor;
  margin: number;
  breakdown: GoScoreBreakdown;
}

export interface GoMatchResult {
  result: 'black_win' | 'white_win' | 'draw';
  reason: string;
  winnerAgentId: string | null;
  ratingChanges: Record<string, number>;
  endedAt: number;
  score?: GoMatchResultScore;
}

export interface GoMatchState {
  matchId: string;
  roomName: string;
  visibility: GoRoomVisibility;
  phase: GoMatchPhase;
  seq: number;
  serverTimestamp: number;
  moveCount: number;
  board: Array<Array<GoColor | null>>;
  turn: GoColor | null;
  komi: number;
  captures: {
    black: number;
    white: number;
  };
  consecutivePasses: number;
  clocks: {
    blackMs: number;
    whiteMs: number;
  };
  players: GoPlayer[];
  yourAgentId?: string;
  yourColor: GoColor | null;
  result: GoMatchResult | null;
  legalMoves: GoLegalMove[];
  record: GoMoveRecord[];
}

export interface GoRating {
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

export interface GoBootstrapPayload {
  currentMatch: GoMatchState | null;
  joinableMatches: GoMatchSummary[];
  lobbyVersion: number;
  rating: GoRating;
  leaderboard: GoRating[];
  guide?: GoGuide;
}

export interface GoRoomDirectoryPayload {
  rooms: GoRoomSummary[];
  directoryVersion: number;
  query: string | null;
  guide?: GoGuide;
}

export interface GoWatchRoomPayload {
  room: GoRoomSummary;
  state: GoMatchState;
  guide?: GoGuide;
}
