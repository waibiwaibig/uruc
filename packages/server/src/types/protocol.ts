// === Venue Protocol ===

export interface Action {
  type: string;
  payload?: unknown;
}

export interface ActionResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface ParamDef {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
}

export interface ActionSchema {
  type: string;
  description: string;
  params: Record<string, ParamDef>;
  requiresConfirmation?: boolean;
}

export interface VenueState {
  venueId: string;
  data: unknown;
}

export interface AgentSession {
  agentId: string;
  userId: string;
  agentName: string;
  role: 'owner' | 'agent';
  trustMode: 'confirm' | 'full';
  allowedLocations: string[];
}

// === Game Template Protocol (for Arcade) ===

export interface ConfigSchema {
  [key: string]: ParamDef;
}

export interface RoomConfig {
  templateId: string;
  name: string;
  settings: Record<string, unknown>;
}

export interface GameRoom {
  id: string;
  templateId: string;
  name: string;
  status: 'waiting' | 'running' | 'finished' | 'closed';
  onAgentJoin(agent: AgentSession): Promise<void>;
  onAgentLeave(agent: AgentSession): Promise<void>;
  onAction(agent: AgentSession, action: Action): Promise<ActionResult>;
  getState(viewer?: AgentSession): unknown;
  getActionSchema(): ActionSchema[];
}

export interface GameTemplate {
  id: string;
  name: string;
  getConfigSchema(): ConfigSchema;
  createRoom(config: RoomConfig): GameRoom;
}

// === LeaderboardEntry ===

export interface LeaderboardEntry {
  agentId: string;
  userId: string;
  gameType: string;
  score: number;
  gamesPlayed: number;
  wins: number;
  losses: number;
}

// === WebSocket Messages ===

export interface WSMessage {
  id: string;
  type: string;
  payload: unknown;
}

// === Logging ===

export interface LogEntry {
  userId: string;
  agentId: string;
  locationId?: string;
  actionType: string;
  payload: unknown;
  result: 'success' | 'failure';
  detail?: string;
  timestamp?: number;
}

// === Broadcasting ===

export interface BroadcastEvent {
  type: 'trade' | 'game_result' | 'agent_join' | 'agent_leave' | 'system' | 'announcement' | 'economy' | 'system_message';
  venueId?: string;
  data: unknown;
  timestamp: number;
}

// === Pending Operation (for owner confirmation) ===

export interface PendingOperation {
  id: string;
  userId: string;
  agentId: string;
  venueId: string;
  actionType: string;
  payload: unknown;
  status: 'pending' | 'approved' | 'rejected' | 'expired';
  createdAt: number;
  expiresAt: number;
}

// === Admin Panel Protocol (Venue micro-control) ===

export type AdminWidget =
  | { type: 'stat'; id: string; title: string; icon?: string; color?: 'ok' | 'warn' | 'err' | 'accent' }
  | { type: 'table'; id: string; title: string; columns: { key: string; label: string; type?: 'string' | 'number' | 'date' | 'badge' }[]; pageSize?: number }
  | { type: 'action'; id: string; title: string; description?: string; variant?: 'default' | 'danger'; confirm?: string; params?: { key: string; label: string; type: 'string' | 'number' | 'select'; options?: string[] }[] }
  | { type: 'config'; id: string; title: string; fields: { key: string; label: string; type: 'string' | 'number' | 'boolean'; description?: string }[] };

export interface AdminPanelSchema {
  sections: { id: string; title: string; widgets: AdminWidget[] }[];
}

export interface AdminDataQuery {
  widgetId: string;
  page?: number;
  params?: Record<string, unknown>;
}

export interface AdminActionRequest {
  widgetId: string;
  params?: Record<string, unknown>;
}

