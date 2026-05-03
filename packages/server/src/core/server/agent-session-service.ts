import { nanoid } from 'nanoid';

export interface AgentSessionRecord {
  sessionId: string;
  agentId: string;
  actionLeaseConnectionId: string | null;
  actionLeaseConnected: boolean;
  inCity: boolean;
  currentLocation: string | null;
  disconnectGraceUntil: number | null;
}

export interface AgentSessionSnapshot {
  connected: boolean;
  hasActionLease: boolean;
  isActionLeaseHolder: boolean;
  inCity: boolean;
  currentLocation: string | null;
  citytime: number;
}

interface AcquireActionLeaseResult {
  acquired: boolean;
  restored: boolean;
  replacedConnectionId: string | null;
  snapshot: AgentSessionSnapshot;
}

export class AgentSessionService {
  private sessions = new Map<string, AgentSessionRecord>();

  // Keep the same-resident action lease warm for 3 minutes after disconnect.
  // This is independent from plugin-specific reconnect windows such as chess.
  constructor(private readonly graceMs = 3 * 60_000) {}

  getSnapshot(agentId: string, connectionId?: string | null): AgentSessionSnapshot {
    const session = this.getOrCreate(agentId);
    this.expireDisconnectedSession(session);

    return {
      connected: Boolean(connectionId),
      hasActionLease: session.actionLeaseConnected,
      isActionLeaseHolder: Boolean(connectionId) && session.actionLeaseConnectionId === connectionId && session.actionLeaseConnected,
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

  isActionLeaseHolder(agentId: string, connectionId: string): boolean {
    const session = this.sessions.get(agentId);
    if (!session) return false;
    this.expireDisconnectedSession(session);
    return session.actionLeaseConnectionId === connectionId && session.actionLeaseConnected;
  }

  holdsActionLease(agentId: string, connectionId: string): boolean {
    return this.isActionLeaseHolder(agentId, connectionId);
  }

  acquireAvailableActionLease(agentId: string, connectionId: string): AcquireActionLeaseResult | null {
    const session = this.getOrCreate(agentId);
    this.expireDisconnectedSession(session);

    if (session.actionLeaseConnectionId === connectionId && session.actionLeaseConnected) {
      return {
        acquired: true,
        restored: false,
        replacedConnectionId: null,
        snapshot: this.getSnapshot(agentId, connectionId),
      };
    }

    if (session.actionLeaseConnected && session.actionLeaseConnectionId && session.actionLeaseConnectionId !== connectionId) {
      return null;
    }

    const restored = Boolean(session.disconnectGraceUntil && session.disconnectGraceUntil > Date.now());
    session.actionLeaseConnectionId = connectionId;
    session.actionLeaseConnected = true;
    session.disconnectGraceUntil = null;

    return {
      acquired: true,
      restored,
      replacedConnectionId: null,
      snapshot: this.getSnapshot(agentId, connectionId),
    };
  }

  acquireActionLease(agentId: string, connectionId: string): AcquireActionLeaseResult {
    const session = this.getOrCreate(agentId);
    this.expireDisconnectedSession(session);

    const restored = Boolean(!session.actionLeaseConnected && session.disconnectGraceUntil && session.disconnectGraceUntil > Date.now());
    const replacedConnectionId =
      session.actionLeaseConnected && session.actionLeaseConnectionId && session.actionLeaseConnectionId !== connectionId
        ? session.actionLeaseConnectionId
        : null;

    session.actionLeaseConnectionId = connectionId;
    session.actionLeaseConnected = true;
    session.disconnectGraceUntil = null;

    return {
      acquired: true,
      restored,
      replacedConnectionId,
      snapshot: this.getSnapshot(agentId, connectionId),
    };
  }

  releaseActionLease(agentId: string, connectionId: string): AgentSessionSnapshot | null {
    const session = this.sessions.get(agentId);
    if (!session) return null;
    this.expireDisconnectedSession(session);

    if (session.actionLeaseConnectionId !== connectionId) {
      return null;
    }

    session.actionLeaseConnectionId = null;
    session.actionLeaseConnected = false;
    session.disconnectGraceUntil = null;

    return this.getSnapshot(agentId, connectionId);
  }

  handleConnectionClosed(agentId: string, connectionId: string): { heldActionLease: boolean } {
    const session = this.sessions.get(agentId);
    if (!session) return { heldActionLease: false };

    if (session.actionLeaseConnectionId === connectionId) {
      session.actionLeaseConnected = false;
      session.disconnectGraceUntil = Date.now() + this.graceMs;
      return { heldActionLease: true };
    }

    return { heldActionLease: false };
  }

  updateState(agentId: string, patch: { inCity?: boolean; currentLocation?: string | null }): AgentSessionSnapshot {
    const session = this.getOrCreate(agentId);
    this.expireDisconnectedSession(session);

    if (patch.inCity !== undefined) session.inCity = patch.inCity;
    if (patch.currentLocation !== undefined) session.currentLocation = patch.currentLocation;
    if (!session.inCity) session.currentLocation = null;

    return this.getSnapshot(agentId, session.actionLeaseConnectionId);
  }

  clear(agentId: string, resetState = false): void {
    const session = this.sessions.get(agentId);
    if (!session) return;
    session.actionLeaseConnectionId = null;
    session.actionLeaseConnected = false;
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
      actionLeaseConnectionId: null,
      actionLeaseConnected: false,
      inCity: false,
      currentLocation: null,
      disconnectGraceUntil: null,
    };
    this.sessions.set(agentId, created);
    return created;
  }

  private expireDisconnectedSession(session: AgentSessionRecord): void {
    if (!session.actionLeaseConnected && session.disconnectGraceUntil && session.disconnectGraceUntil <= Date.now()) {
      session.actionLeaseConnectionId = null;
      session.disconnectGraceUntil = null;
      session.inCity = false;
      session.currentLocation = null;
      session.sessionId = nanoid();
    }
  }
}
