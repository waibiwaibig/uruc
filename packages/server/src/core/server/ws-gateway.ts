/**
 * WSGateway — Pure Transport Layer.
 *
 * Responsibilities:
 * - WebSocket connection management
 * - Agent and Owner authentication
 * - Heartbeat and connection cleanup
 * - Message routing to hooks.handleWSCommand()
 * - Message sending/broadcasting (WSGatewayPublic interface)
 *
 * This file has ZERO domain logic. No city, no locations, no business commands.
 * All commands (including city gate) are registered via hooks.registerWSCommand().
 */

import type { IncomingMessage } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { nanoid } from 'nanoid';

import type { CommandSchema, HookRegistry, WSCommandHookContext, WSContext, WSGatewayPublic, WSDispatchResult } from '../plugin-system/hook-registry.js';
import type { ServiceRegistry } from '../plugin-system/service-registry.js';
import type { AuthService } from '../auth/service.js';
import type { PermissionCredential } from '../permission/service.js';
import type { AgentSession, WSMessage } from '../../types/index.js';
import { getCookieAuthUser, verifyToken } from './middleware.js';
import { AgentSessionService, type AgentSessionSnapshot } from './agent-session-service.js';
import { AppError, CORE_ERROR_CODES, compactErrorPayload, resolveError } from './errors.js';

/**
 * Typed interface for admin operations on the gateway.
 * Used by admin routes to avoid `as any` coupling.
 */
export interface IGatewayAdmin {
  getOnlineAgentIds(): string[];
  getAgentCurrentLocation(agentId: string): string | undefined;
  kickAgent(agentId: string): void;
}

declare module '../plugin-system/service-registry.js' {
  interface ServiceMap {
    'ws-gateway': WSGateway;
  }
}

// =============================================
// Connected client state
// =============================================

interface ConnectedClient {
  id: string;
  ws: WebSocket;
  session?: AgentSession;
  ownerSession?: { userId: string };
  cookieAuthUser?: { userId: string; role: string };
  msgTimestamps: number[];
  isAlive: boolean;
  lastPong: number;
}

// =============================================
// WSGateway
// =============================================

export class WSGateway implements WSGatewayPublic {
  private wss?: WebSocketServer;
  private clients = new Map<string, ConnectedClient>();
  private host?: string;
  private port: number;
  private hooks: HookRegistry;
  private services: ServiceRegistry;
  private auth: AuthService;
  private agentSessions: AgentSessionService;
  private heartbeatTimer?: ReturnType<typeof setInterval>;
  private startTime = Date.now();

  constructor(opts: { port: number; host?: string }, hooks: HookRegistry, services: ServiceRegistry, auth: AuthService) {
    this.host = opts.host;
    this.port = opts.port;
    this.hooks = hooks;
    this.services = services;
    this.auth = auth;
    this.agentSessions = new AgentSessionService();
  }

  async start() {
    this.wss = new WebSocketServer({ port: this.port, host: this.host });
    this.wss.on('connection', (ws, req) => this.handleConnection(ws, req));
    this.startHeartbeat();
  }

  async stop() {
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);
    for (const [, client] of this.clients) client.ws.terminate();
    this.clients.clear();
    await new Promise<void>((resolve) => this.wss?.close(() => resolve()));
  }

  // === Public messaging API (WSGatewayPublic) ===

  send(ws: WebSocket, msg: WSMessage): void {
    if (ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify(msg));
  }

  broadcast(msg: WSMessage): void {
    const data = JSON.stringify(msg);
    for (const [, client] of this.clients) {
      if (client.ws.readyState === WebSocket.OPEN) client.ws.send(data);
    }
  }

  sendToAgent(agentId: string, msg: WSMessage): void {
    for (const [, client] of this.clients) {
      if (client.session?.agentId === agentId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(msg));
      }
    }
  }

  pushToOwner(userId: string, msg: WSMessage): void {
    for (const [, client] of this.clients) {
      if (client.ownerSession?.userId === userId && client.ws.readyState === WebSocket.OPEN) {
        client.ws.send(JSON.stringify(msg));
      }
    }
  }

  kickAgent(agentId: string): void {
    for (const [clientId, client] of this.clients) {
      if (client.session?.agentId === agentId) {
        this.sendCore(client.ws, { id: '', type: 'kicked', payload: { reason: 'Disconnected by an administrator.' } });
        this.cleanupClient(clientId, client);
        client.ws.close();
      }
    }
    this.agentSessions.clear(agentId, true);
  }

  getOnlineAgentIds(): string[] {
    const ids: string[] = [];
    for (const [, client] of this.clients) {
      if (client.session) ids.push(client.session.agentId);
    }
    return [...new Set(ids)];
  }

  getAgentCurrentLocation(agentId: string): string | undefined {
    return this.agentSessions.getCurrentLocation(agentId);
  }



  // NOTE: Event-bus subscription removed.
  // The event-bus plugin should subscribe itself via:
  //   const gateway = ctx.services.get('ws-gateway');
  //   eventBus.subscribe(event => gateway.broadcast({ id: '', type: 'event', payload: event }));


  // === Private: Connection lifecycle ===

  private startHeartbeat(): void {
    const INTERVAL = 30;
    const TIMEOUT = 60;
    this.heartbeatTimer = setInterval(() => {
      const now = Date.now();
      for (const [clientId, client] of this.clients) {
        if (now - client.lastPong > TIMEOUT * 1000) {
          this.cleanupClient(clientId, client);
          client.ws.terminate();
          continue;
        }
        if (client.ws.readyState === WebSocket.OPEN) client.ws.ping();
      }
    }, INTERVAL * 1000);
  }

  private handleConnection(ws: WebSocket, req: IncomingMessage): void {
    const clientId = nanoid();
    const client: ConnectedClient = {
      id: clientId,
      ws,
      cookieAuthUser: getCookieAuthUser(req) ?? undefined,
      msgTimestamps: [],
      isAlive: true,
      lastPong: Date.now(),
    };
    this.clients.set(clientId, client);

    ws.on('pong', () => { client.isAlive = true; client.lastPong = Date.now(); });

    ws.on('message', async (data) => {
      let msg: WSMessage;
      try {
        msg = JSON.parse(data.toString());
        if (!msg.type) throw new Error('Missing type');
      } catch {
        return this.sendCore(ws, {
          id: '',
          type: 'error',
          payload: { error: 'Invalid JSON', code: CORE_ERROR_CODES.INVALID_JSON },
        });
      }
      try {
        await this.handleMessage(clientId, msg);
      } catch (err) {
        console.error(`[WS] Unhandled error in handleMessage:`, (err as Error).message);
        this.sendCore(ws, { id: msg.id, type: 'error', payload: { error: 'Internal server error', code: 'INTERNAL_ERROR' } });
      }
    });

    ws.on('close', () => this.cleanupClient(clientId, client));

    ws.on('error', (err) => {
      if ((err as any).code !== 'ECONNRESET') {
        console.error(`[WS] Error for ${clientId}:`, (err as Error).message);
      }
    });
  }

  private cleanupClient(clientId: string, client: ConnectedClient): void {
    if (!this.clients.has(clientId)) return;

    this.clients.delete(clientId);

    if (client.session) {
      const { agentId, userId } = client.session;
      const sessionSnapshot = this.agentSessions.getSnapshot(agentId, clientId);
      const closed = this.agentSessions.handleConnectionClosed(agentId, clientId);

      if (closed.heldActionLease) {
        this.hooks.runHook('connection.close', {
          session: client.session,
          currentLocation: sessionSnapshot.currentLocation,
          gateway: this as WSGatewayPublic,
        }).catch((err) => { console.error('[WS] connection.close hook error:', (err as Error).message); });
      }

      const hasSameAgentClient = this.hasAuthenticatedClientForAgent(agentId);
      if (!hasSameAgentClient) {
        this.auth.setAgentOnline(agentId, false).catch((err) => {
          console.error('[WS] setAgentOnline(false) failed:', (err as Error).message);
        });

        this.pushToOwner(userId, {
          id: '', type: 'agent_status', payload: { agentId, isOnline: false, citytime: Date.now() },
        });
      }

      this.pushSessionState(agentId);
    }
  }

  // === Private: Message routing ===

  private async handleMessage(clientId: string, msg: WSMessage): Promise<void> {
    const client = this.clients.get(clientId);
    if (!client) return;

    // --- Rate limiting ---
    if (client.session) {
      const now = Date.now();
      client.msgTimestamps = client.msgTimestamps.filter(t => now - t < 60000);
      if (client.msgTimestamps.length >= 120) {
        return this.sendCore(client.ws, { id: msg.id, type: 'error', payload: { error: 'You are sending commands too quickly.', code: 'RATE_LIMITED', retryable: true } });
      }
      client.msgTimestamps.push(now);
    }

    // --- Owner auth ---
    if (msg.type === 'auth_owner') {
      return this.handleOwnerAuth(clientId, client, msg);
    }

    // --- Agent auth ---
    if (msg.type === 'auth') {
      return this.handleAgentAuth(clientId, client, msg);
    }

    // --- Owner messages ---
    if (msg.type === 'owner_send' && client.ownerSession) {
      const wsCtx = this.createWSContext(clientId, client);
      const result = await this.hooks.handleWSCommand('owner_send', wsCtx, msg);
      if (!result.handled) {
        this.sendCore(client.ws, { id: msg.id, type: 'error', payload: { error: 'owner_send handler not available', code: 'NO_HANDLER' } });
      } else if (result.blocked) {
        this.sendCore(client.ws, { id: msg.id, type: 'error', payload: result.blocked });
      }
      return;
    }

    // --- Agent messages require auth ---
    if (!client.session) {
      return this.sendCore(client.ws, { id: msg.id, type: 'error', payload: { error: 'Not authenticated. Send auth message first.', code: 'NOT_AUTHENTICATED', action: 'auth' } });
    }

    if (msg.type === 'what_state_am_i') {
      return this.handleStateQuery(clientId, client, msg);
    }

    if (msg.type === 'acquire_action_lease') {
      return this.handleAcquireActionLease(clientId, client, msg);
    }

    if (msg.type === 'release_action_lease') {
      return this.handleReleaseActionLease(clientId, client, msg);
    }

    const schema = this.hooks.getWSCommandSchema(msg.type);
    let permissionCredentials: PermissionCredential[] = [];
    if (schema) {
      if (this.hooks.requiresActionLease(schema)) {
        const acquired = await this.ensureActionLease(clientId, client, msg);
        if (!acquired) return;
      }

      const requiresConfirmation = schema.confirmationPolicy?.required ?? schema.requiresConfirmation ?? false;
      const requiredCapabilities = schema.protocol?.request?.requiredCapabilities ?? [];
      if (requiresConfirmation && requiredCapabilities.length === 0) {
        return this.sendCore(client.ws, {
          id: msg.id,
          type: 'error',
          payload: {
            error: 'Permission policy denies this request.',
            text: 'Permission policy denies this request.',
            code: 'PERMISSION_DENIED',
            action: 'deny',
            nextAction: 'deny',
            details: {
              command: msg.type,
              reason: 'confirmation_policy_without_capability',
            },
          },
        });
      }

      const canExecute = await this.canExecuteVenueRequest(client, schema, msg);
      if (!canExecute) return;
      permissionCredentials = canExecute.credentials;

      const domainDispatchService = this.services.tryGet('domain-dispatch');
      if (domainDispatchService?.isDomainVenueRequest(schema)) {
        const policyAllowed = await this.canPassRuntimePolicies(clientId, client, schema, msg);
        if (!policyAllowed) return;
      }
      const domainDispatch = await this.dispatchDomainVenueRequest(client, schema, msg, permissionCredentials);
      if (domainDispatch !== 'skipped') return;
    }

    const sessionStateBefore = client.session
      ? this.agentSessions.getSnapshot(client.session.agentId, clientId)
      : null;
    const wsCtx = this.createWSContext(clientId, client);
    const result: WSDispatchResult = await this.hooks.handleWSCommand(msg.type, wsCtx, msg);
    if (result.handled) {
      // If blocked by a before-hook, send the structured reason
      if (result.blocked) {
        return this.sendCore(client.ws, { id: msg.id, type: 'error', payload: result.blocked });
      }
      if (
        client.session &&
        sessionStateBefore &&
        this.didSessionStateChange(
          sessionStateBefore,
          this.agentSessions.getSnapshot(client.session.agentId, clientId),
        )
      ) {
        this.pushSessionState(client.session.agentId, clientId);
      }
      return;
    }

    return this.sendCore(client.ws, { id: msg.id, type: 'error', payload: { error: `Unknown command: ${msg.type}`, code: 'UNKNOWN_COMMAND' } });
  }

  // === Private: Auth handlers ===

  private async handleOwnerAuth(clientId: string, client: ConnectedClient, msg: WSMessage): Promise<void> {
    const decoded = verifyToken(msg.payload as string);
    if (!decoded) {
      return this.sendCore(client.ws, { id: msg.id, type: 'error', payload: { error: 'Invalid owner token', code: 'INVALID_TOKEN' } });
    }

    try {
      const owner = await this.auth.getUserById(decoded.userId);
      if (owner.banned) {
        return this.sendCore(client.ws, { id: msg.id, type: 'error', payload: { error: 'Account is banned', code: 'USER_BANNED' } });
      }
    } catch {
      return this.sendCore(client.ws, { id: msg.id, type: 'error', payload: { error: 'User not found', code: 'USER_NOT_FOUND' } });
    }

    client.ownerSession = { userId: decoded.userId };
    this.sendCore(client.ws, { id: msg.id, type: 'result', payload: { userId: decoded.userId } });

    const wsCtx = this.createWSContext(clientId, client);
    await this.hooks.runHook('owner.authenticated', { session: client.ownerSession, ctx: wsCtx });
  }

  private async handleAgentAuth(clientId: string, client: ConnectedClient, msg: WSMessage): Promise<void> {
    try {
      const session = await this.resolveAgentSession(client, msg.payload as string | undefined);

      // Check user banned
      try {
        const owner = await this.auth.getUserById(session.userId);
        if (owner.banned) {
          return this.sendCore(client.ws, { id: msg.id, type: 'error', payload: { error: 'Account is banned', code: 'USER_BANNED' } });
        }
      } catch { /* ignore */ }

      // Check agent frozen
      const agents = await this.auth.getAgentsByUser(session.userId);
      const agentRecord = agents.find((a: any) => a.id === session.agentId);
      if (agentRecord?.frozen) {
        return this.sendCore(client.ws, { id: msg.id, type: 'error', payload: { error: 'Agent is frozen', code: 'AGENT_FROZEN' } });
      }

      client.session = session;
      const sessionState = this.buildSessionState(session.agentId, clientId);
      await this.auth.setAgentOnline(session.agentId, true);

      this.pushToOwner(session.userId, {
        id: '', type: 'agent_status', payload: { agentId: session.agentId, isOnline: true, citytime: Date.now() },
      });

      const bootstrapData: Record<string, unknown> = {};
      const wsCtx = this.createWSContext(clientId, client);
      const authContext = { session, ctx: wsCtx, bootstrapData };
      await this.hooks.runHook('agent.authenticated', authContext);
      await this.hooks.runAfterHook('agent.authenticated', authContext);

      this.sendCore(client.ws, {
        id: msg.id,
        type: 'result',
        payload: {
          agentId: session.agentId,
          agentName: session.agentName,
          registrationType: session.registrationType,
          accountablePrincipalId: session.accountablePrincipalId,
          ...sessionState,
          ...bootstrapData,
        },
      });

    } catch (error) {
      return this.sendWsError(client.ws, msg.id, error, {
        status: 401,
        code: 'INVALID_TOKEN',
        error: 'Invalid token',
      });
    }
  }

  private async resolveAgentSession(client: ConnectedClient, authInput?: string): Promise<AgentSession> {
    if (authInput) {
      try {
        return await this.auth.authenticateAgent(authInput);
      } catch {
        const decoded = verifyToken(authInput);
        if (!decoded) {
          throw new AppError({ status: 401, code: 'INVALID_TOKEN', error: 'Invalid token' });
        }
        return this.auth.authenticateShadowAgent(decoded.userId);
      }
    }

    if (client.cookieAuthUser) {
      return this.auth.authenticateShadowAgent(client.cookieAuthUser.userId);
    }

    throw new AppError({ status: 401, code: 'INVALID_TOKEN', error: 'Invalid token' });
  }

  // === Helpers ===

  private handleStateQuery(clientId: string, client: ConnectedClient, msg: WSMessage): void {
    if (!client.session) return;
    this.sendCore(client.ws, {
      id: msg.id,
      type: 'result',
      payload: {
        ...this.buildSessionState(client.session.agentId, clientId),
        registrationType: client.session.registrationType,
        accountablePrincipalId: client.session.accountablePrincipalId,
      },
    });
  }

  private handleAcquireActionLease(clientId: string, client: ConnectedClient, msg: WSMessage): void {
    if (!client.session) return;

    const result = this.agentSessions.acquireActionLease(client.session.agentId, clientId);
    if (result.replacedConnectionId) {
      const replaced = this.clients.get(result.replacedConnectionId);
      if (replaced) {
        this.sendCore(replaced.ws, {
          id: '',
          type: 'action_lease_moved',
          payload: {
            ...this.buildSessionState(client.session.agentId, result.replacedConnectionId),
            error: 'This resident action lease moved to another session.',
            agentId: client.session.agentId,
            nextAction: 'acquire_action_lease',
            detailRequest: { type: 'what_state_am_i' },
          },
        });
      }
    }

    this.sendCore(client.ws, {
      id: msg.id,
      type: 'result',
      payload: {
        ...this.buildSessionState(client.session.agentId, clientId),
        actionLeaseAcquired: true,
        restored: result.restored,
      },
    });
    this.pushSessionState(client.session.agentId, clientId);
  }

  private handleReleaseActionLease(clientId: string, client: ConnectedClient, msg: WSMessage): void {
    if (!client.session) return;
    const snapshot = this.agentSessions.releaseActionLease(client.session.agentId, clientId);
    if (!snapshot) {
      return this.sendCore(client.ws, {
        id: msg.id,
        type: 'error',
        payload: {
          error: 'This session does not hold the active action lease.',
          code: 'NOT_ACTION_LEASE_HOLDER',
          action: 'acquire_action_lease',
        },
      });
    }
    this.sendCore(client.ws, {
      id: msg.id,
      type: 'result',
      payload: {
        ...this.buildSessionState(client.session.agentId, clientId),
        released: true,
      },
    });
    this.pushSessionState(client.session.agentId, clientId);
  }

  private async ensureActionLease(clientId: string, client: ConnectedClient, msg: WSMessage): Promise<boolean> {
    if (!client.session) return false;
    const { agentId } = client.session;

    if (this.agentSessions.holdsActionLease(agentId, clientId)) {
      return true;
    }

    const acquired = this.agentSessions.acquireAvailableActionLease(agentId, clientId);
    if (acquired) {
      this.pushSessionState(agentId, clientId);
      return true;
    }

    this.sendCore(client.ws, {
      id: msg.id,
      type: 'error',
      payload: {
        error: 'This resident already has an active action lease in another session.',
        code: 'ACTION_LEASE_HELD',
        action: 'acquire_action_lease',
        details: { agentId },
      },
    });
    return false;
  }

  private async canExecuteVenueRequest(
    client: ConnectedClient,
    schema: CommandSchema,
    msg: WSMessage,
  ): Promise<{ credentials: PermissionCredential[] } | null> {
    if (!client.session) return null;
    if (!schema.pluginName || schema.pluginName === 'core') return { credentials: [] };

    const requiredCapabilities = schema.protocol?.request?.requiredCapabilities ?? [];
    if (requiredCapabilities.length === 0) return { credentials: [] };

    const permissions = this.services.tryGet('permission');
    if (!permissions) {
      this.sendCore(client.ws, {
        id: msg.id,
        type: 'error',
        payload: {
          error: 'Permission service is not available.',
          text: 'Permission service is not available.',
          code: 'PERMISSION_SERVICE_UNAVAILABLE',
          action: 'retry',
          nextAction: 'retry',
          details: { command: msg.type },
        },
      });
      return null;
    }

    const decision = await permissions.canExecute(client.session, schema);
    if (decision.status === 'allow') return { credentials: decision.credentials };

    this.sendCore(client.ws, { id: msg.id, type: 'error', payload: decision.receipt });
    return null;
  }

  private async canPassRuntimePolicies(
    clientId: string,
    client: ConnectedClient,
    schema: CommandSchema,
    msg: WSMessage,
  ): Promise<boolean> {
    const wsCtx = this.createWSContext(clientId, client);
    const hookCtx: WSCommandHookContext = {
      command: msg.type,
      ctx: wsCtx,
      msg,
      cancelled: false,
    };
    await this.hooks.runHook('ws.command', hookCtx);
    if (!hookCtx.cancelled) return true;
    this.sendCore(client.ws, {
      id: msg.id,
      type: 'error',
      payload: hookCtx.blockReason ?? {
        error: `Command '${schema.type}' was blocked`,
        code: 'COMMAND_BLOCKED',
      },
    });
    return false;
  }

  private async dispatchDomainVenueRequest(
    client: ConnectedClient,
    schema: CommandSchema,
    msg: WSMessage,
    permissionCredentials: PermissionCredential[],
  ): Promise<'handled' | 'skipped'> {
    if (!client.session) return 'handled';
    const domainDispatch = this.services.tryGet('domain-dispatch');
    if (!domainDispatch) return 'skipped';

    const result = await domainDispatch.dispatchVenueRequest({
      schema,
      msg,
      session: client.session,
      permissionCredentials,
    });
    if (result.status === 'skipped') return 'skipped';

    this.sendCore(client.ws, {
      id: msg.id,
      type: result.receipt.ok ? 'result' : 'error',
      payload: result.receipt,
    });
    return 'handled';
  }

  private buildSessionState(agentId: string, connectionId: string): AgentSessionSnapshot {
    return this.agentSessions.getSnapshot(agentId, connectionId);
  }

  private didSessionStateChange(before: AgentSessionSnapshot, after: AgentSessionSnapshot): boolean {
    return before.hasActionLease !== after.hasActionLease
      || before.isActionLeaseHolder !== after.isActionLeaseHolder
      || before.inCity !== after.inCity
      || before.currentLocation !== after.currentLocation;
  }

  private pushSessionState(agentId: string, excludedClientId?: string): void {
    for (const [clientId, client] of this.clients) {
      if (client.session?.agentId !== agentId) continue;
      if (excludedClientId && clientId === excludedClientId) continue;
      this.sendCore(client.ws, {
        id: '',
        type: 'session_state',
        payload: {
          ...this.buildSessionState(agentId, clientId),
          registrationType: client.session.registrationType,
          accountablePrincipalId: client.session.accountablePrincipalId,
          detailRequest: { type: 'what_state_am_i' },
        },
      });
    }
  }

  private hasAuthenticatedClientForAgent(agentId: string): boolean {
    for (const [, client] of this.clients) {
      if (client.session?.agentId === agentId) return true;
    }
    return false;
  }

  private sendWsError(
    ws: WebSocket,
    id: string,
    error: unknown,
    fallback: { status: number; code: string; error: string; retryable?: boolean; action?: string; details?: Record<string, unknown> },
  ): void {
    const resolved = resolveError(error, fallback);
    this.sendCore(ws, { id, type: 'error', payload: resolved.payload });
  }

  private createWSContext(clientId: string, client: ConnectedClient): WSContext {
    const getSessionState = (): AgentSessionSnapshot => (
      client.session
        ? this.agentSessions.getSnapshot(client.session.agentId, clientId)
        : {
            connected: false,
            hasActionLease: false,
            isActionLeaseHolder: false,
            inCity: false,
            currentLocation: null,
            citytime: Date.now(),
          }
    );

    return {
      ws: client.ws,
      session: client.session ?? null,
      get inCity() {
        return getSessionState().inCity;
      },
      get currentLocation() {
        return getSessionState().currentLocation;
      },
      get isActionLeaseHolder() {
        return getSessionState().isActionLeaseHolder;
      },
      get hasActionLease() {
        return getSessionState().hasActionLease;
      },
      currentTable: null,
      gateway: this as WSGatewayPublic,
      setLocation: (locationId: string | null) => {
        if (!client.session) return;
        this.agentSessions.updateState(client.session.agentId, { currentLocation: locationId });
      },
      setInCity: (value: boolean) => {
        if (!client.session) return;
        this.agentSessions.updateState(client.session.agentId, { inCity: value });
      },
    };
  }

  private sendCore(ws: WebSocket, msg: WSMessage): void {
    this.send(ws, {
      ...msg,
      payload: this.attachCitytime(msg.payload),
    });
  }

  private attachCitytime(payload: unknown): unknown {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
      return payload;
    }

    const base = ('error' in (payload as Record<string, unknown>) && 'code' in (payload as Record<string, unknown>))
      ? compactErrorPayload(payload as any)
      : payload as Record<string, unknown>;

    if ('citytime' in (payload as Record<string, unknown>)) {
      return base;
    }

    return {
      ...base,
      citytime: Date.now(),
    };
  }
}
