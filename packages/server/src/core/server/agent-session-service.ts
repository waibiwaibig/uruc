import { nanoid } from 'nanoid';

export interface AgentSessionRecord {
  sessionId: string;
  agentId: string;
  controllerConnectionId: string | null;
  controllerConnected: boolean;
  inCity: boolean;
  currentLocation: string | null;
  disconnectGraceUntil: number | null;
}

export interface AgentSessionSnapshot {
  connected: boolean;
  hasController: boolean;
  isController: boolean;
  inCity: boolean;
  currentLocation: string | null;
  citytime: number;
}

interface ClaimResult {
  claimed: boolean;
  acquired?: boolean;
  restored: boolean;
  replacedConnectionId: string | null;
  snapshot: AgentSessionSnapshot;
}

export class AgentSessionService {
  private sessions = new Map<string, AgentSessionRecord>();

  // Keep the agent-level control session warm for 3 minutes after disconnect.
  // This is independent from plugin-specific reconnect windows such as chess.
  constructor(private readonly graceMs = 3 * 60_000) {}

  getSnapshot(agentId: string, connectionId?: string | null): AgentSessionSnapshot {
    const session = this.getOrCreate(agentId);
    this.expireDisconnectedSession(session);

    return {
      connected: Boolean(connectionId),
      hasController: session.controllerConnected,
      isController: Boolean(connectionId) && session.controllerConnectionId === connectionId && session.controllerConnected,
      inCity: session.inCity,
      currentLocation: session.currentLocation,
      citytime: Date.now(),
    };
  }

  getCurrentLocation(agentId: string): string | undefined {
    const session = this.sessions.get(agentId);
    if (!session) return undefined;
    return session.currentLocation ?? undefined;
  }

  isController(agentId: string, connectionId: string): boolean {
    const session = this.sessions.get(agentId);
    if (!session) return false;
    this.expireDisconnectedSession(session);
    return session.controllerConnectionId === connectionId && session.controllerConnected;
  }

  holdsActionLease(agentId: string, connectionId: string): boolean {
    return this.isController(agentId, connectionId);
  }

  acquireAvailableActionLease(agentId: string, connectionId: string): ClaimResult | null {
    const result = this.claimAvailable(agentId, connectionId);
    if (result) result.acquired = result.claimed;
    return result;
  }

  claimAvailable(agentId: string, connectionId: string): ClaimResult | null {
    const session = this.getOrCreate(agentId);
    this.expireDisconnectedSession(session);

    if (session.controllerConnectionId === connectionId && session.controllerConnected) {
      return {
        claimed: true,
        acquired: true,
        restored: false,
        replacedConnectionId: null,
        snapshot: this.getSnapshot(agentId, connectionId),
      };
    }

    if (session.controllerConnected && session.controllerConnectionId && session.controllerConnectionId !== connectionId) {
      return null;
    }

    const restored = Boolean(session.disconnectGraceUntil && session.disconnectGraceUntil > Date.now());
    session.controllerConnectionId = connectionId;
    session.controllerConnected = true;
    session.disconnectGraceUntil = null;

    return {
      claimed: true,
      acquired: true,
      restored,
      replacedConnectionId: null,
      snapshot: this.getSnapshot(agentId, connectionId),
    };
  }

  claimWithTakeover(agentId: string, connectionId: string): ClaimResult {
    const session = this.getOrCreate(agentId);
    this.expireDisconnectedSession(session);

    const restored = Boolean(!session.controllerConnected && session.disconnectGraceUntil && session.disconnectGraceUntil > Date.now());
    const replacedConnectionId =
      session.controllerConnected && session.controllerConnectionId && session.controllerConnectionId !== connectionId
        ? session.controllerConnectionId
        : null;

    session.controllerConnectionId = connectionId;
    session.controllerConnected = true;
    session.disconnectGraceUntil = null;

    return {
      claimed: true,
      restored,
      replacedConnectionId,
      snapshot: this.getSnapshot(agentId, connectionId),
    };
  }

  releaseControl(agentId: string, connectionId: string): AgentSessionSnapshot | null {
    const session = this.sessions.get(agentId);
    if (!session) return null;
    this.expireDisconnectedSession(session);

    if (session.controllerConnectionId !== connectionId) {
      return null;
    }

    session.controllerConnectionId = null;
    session.controllerConnected = false;
    session.disconnectGraceUntil = null;

    return this.getSnapshot(agentId, connectionId);
  }

  handleConnectionClosed(agentId: string, connectionId: string): { wasController: boolean } {
    const session = this.sessions.get(agentId);
    if (!session) return { wasController: false };

    if (session.controllerConnectionId === connectionId) {
      session.controllerConnected = false;
      session.disconnectGraceUntil = Date.now() + this.graceMs;
      return { wasController: true };
    }

    return { wasController: false };
  }

  updateState(agentId: string, patch: { inCity?: boolean; currentLocation?: string | null }): AgentSessionSnapshot {
    const session = this.getOrCreate(agentId);
    this.expireDisconnectedSession(session);

    if (patch.inCity !== undefined) session.inCity = patch.inCity;
    if (patch.currentLocation !== undefined) session.currentLocation = patch.currentLocation;
    if (!session.inCity) session.currentLocation = null;

    return this.getSnapshot(agentId, session.controllerConnectionId);
  }

  clear(agentId: string, resetState = false): void {
    const session = this.sessions.get(agentId);
    if (!session) return;
    session.controllerConnectionId = null;
    session.controllerConnected = false;
    session.disconnectGraceUntil = null;
    if (resetState) {
      session.inCity = false;
      session.currentLocation = null;
      session.sessionId = nanoid();
    }
  }

  private getOrCreate(agentId: string): AgentSessionRecord {
    const existing = this.sessions.get(agentId);
    if (existing) return existing;

    const created: AgentSessionRecord = {
      sessionId: nanoid(),
      agentId,
      controllerConnectionId: null,
      controllerConnected: false,
      inCity: false,
      currentLocation: null,
      disconnectGraceUntil: null,
    };
    this.sessions.set(agentId, created);
    return created;
  }

  private expireDisconnectedSession(session: AgentSessionRecord): void {
    if (!session.controllerConnected && session.disconnectGraceUntil && session.disconnectGraceUntil <= Date.now()) {
      session.controllerConnectionId = null;
      session.disconnectGraceUntil = null;
      session.inCity = false;
      session.currentLocation = null;
      session.sessionId = nanoid();
    }
  }
}
