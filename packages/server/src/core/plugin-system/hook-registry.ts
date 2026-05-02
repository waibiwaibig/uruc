import type { IncomingMessage, ServerResponse } from 'http';
import type { WebSocket } from 'ws';

export interface HookDisposable {
  dispose(): void;
}

export interface LocationDef {
  id: string;
  name: string;
  description?: string;
  pluginName?: string;
}

// =============================================
// WebSocket types
// =============================================

/**
 * Public interface for WSGateway — exposed to plugin handlers
 * so they can send messages without referencing the WSGateway class.
 */
export interface WSGatewayPublic {
  send(ws: WebSocket, msg: WSMessage): void;
  broadcast(msg: WSMessage): void;
  sendToAgent(agentId: string, msg: WSMessage): void;
  pushToOwner(userId: string, msg: WSMessage): void;
  getOnlineAgentIds(): string[];
}

export interface WSContext {
  ws: WebSocket;
  session: {
    userId: string;
    agentId: string;
    agentName: string;
    role: 'owner' | 'agent';
    trustMode?: 'confirm' | 'full';
    allowedLocations?: string[];
  } | null;
  inCity: boolean;
  currentLocation: string | null;
  isController: boolean;
  hasController: boolean;
  currentTable: string | null;
  /** Public gateway methods for sending messages */
  gateway: WSGatewayPublic;
  /** Update the client's current location */
  setLocation(locationId: string | null): void;
  /** Update the client's city status */
  setInCity(value: boolean): void;
}

export interface WSMessage {
  id: string;
  type: string;
  payload?: unknown;
}

export type WSHandler = (ctx: WSContext, msg: WSMessage) => Promise<void> | void;

// =============================================
// WS error envelope (machine-readable)
// =============================================

/**
 * Standardized error payload for WS responses.
 * Always includes `error` (human) + `code` (machine) for agent-friendly parsing.
 */
export interface WSErrorPayload {
  /** Human-readable error message */
  error: string;
  /** Concise protocol-facing text for resident receipts */
  text?: string;
  /** Stable machine-readable code (e.g. 'RATE_LIMITED', 'UNKNOWN_COMMAND') */
  code: string;
  /** Whether the client can retry this request */
  retryable?: boolean;
  /** Suggested next action for recovering (e.g. 'auth', 'leave_location') */
  action?: string;
  /** Protocol-facing next action. `action` remains for current runtime clients until consumer migration is complete. */
  nextAction?: string;
  /** Additional structured details */
  details?: Record<string, unknown>;
}

/**
 * Context passed to 'ws.command' before/after hooks.
 * - before hooks can set `cancelled = true` to block execution.
 * - before hooks SHOULD set `blockReason` when cancelling to give structured feedback.
 * - after hooks observe only (command already executed).
 */
export interface WSCommandHookContext {
  /** The command type being dispatched (e.g. 'bet', 'call') */
  command: string;
  /** The WS context (session, location, gateway, etc.) */
  ctx: WSContext;
  /** The original message */
  msg: WSMessage;
  /** Set to true in a before-hook to cancel command execution */
  cancelled: boolean;
  /** Structured reason for cancellation (set by before-hook that cancels) */
  blockReason?: WSErrorPayload;
}

/**
 * Result of dispatching a WS command through handleWSCommand.
 */
export type WSDispatchResult =
  | { handled: false }
  | { handled: true; blocked?: WSErrorPayload };

export type ResidentProtocolReceiptStatus =
  | 'accepted'
  | 'rejected'
  | 'delivered'
  | 'expired'
  | 'duplicate'
  | 'require_approval';

export interface ResidentProtocolRequestMetadata {
  type: string;
  version?: number;
  requiredCapabilities?: string[];
}

export interface ResidentProtocolReceiptMetadata {
  type?: string;
  statuses?: ResidentProtocolReceiptStatus[];
}

export interface ResidentProtocolVenueMetadata {
  id?: string;
  moduleId?: string;
}

export interface ResidentProtocolMigrationMetadata {
  currentTerm?: string;
  removalIssue?: string;
  note?: string;
}

/**
 * Transitional protocol metadata for the Resident-based city model.
 *
 * This annotates today's command schemas with Resident / Request / Receipt /
 * Venue vocabulary without registering alternate handlers or changing dispatch.
 */
export interface ResidentProtocolMetadata {
  subject: 'resident';
  request?: ResidentProtocolRequestMetadata;
  receipt?: ResidentProtocolReceiptMetadata;
  venue?: ResidentProtocolVenueMetadata;
  migration?: ResidentProtocolMigrationMetadata;
}

/**
 * Command schema — describes a WS or HTTP command for discoverability.
 */
export interface CommandSchema {
  type: string;
  description: string;
  /** Plugin that registered this command (e.g. 'core', 'friend', 'venue') */
  pluginName?: string;
  params: Record<string, {
    type: string;
    description?: string;
    required?: boolean;
  }>;
  /** If true, the action requires owner confirmation in 'confirm' trust mode */
  requiresConfirmation?: boolean;
  resultSchema?: Record<string, unknown>;
  authPolicy?: 'agent' | 'user' | 'admin';
  locationPolicy?: {
    scope?: 'any' | 'outside' | 'city' | 'in-city' | 'location';
    locations?: string[];
  };
  controlPolicy?: {
    controllerRequired?: boolean;
  };
  confirmationPolicy?: {
    required?: boolean;
  };
  rateLimitPolicy?: {
    bucket?: string;
    maxPerMinute?: number;
  };
  errorCodes?: string[];
  protocol?: ResidentProtocolMetadata;
}

// =============================================
// HTTP types
// =============================================

export interface HttpContext {
  req: IncomingMessage;
  res: ServerResponse;
  path: string;
  method: string;
  session?: { userId: string; role: string };
  /** Access to all registered services */
  services: { tryGet<T = unknown>(key: string): T | undefined };
}

export type HttpHandler = (ctx: HttpContext) => Promise<boolean> | boolean;

// =============================================
// Hook types
// =============================================

/**
 * Hook handler for before/after interception chains.
 * Receives a mutable context and can modify it or cancel processing.
 */
export type HookHandler<T = any> = (context: T) => void | Promise<void>;

/** Internal prioritized hook entry. */
interface PrioritizedHook<T = any> {
  handler: HookHandler<T>;
  priority: number;
}

/** Internal WS command registration. */
interface WSCommandEntry {
  handler: WSHandler;
  schema?: CommandSchema;
}

// =============================================
// HookRegistry
// =============================================

export class HookRegistry {
  private wsHandlers = new Map<string, WSCommandEntry[]>();
  private httpHandlers: HttpHandler[] = [];
  private beforeHooks = new Map<string, PrioritizedHook[]>();
  private afterHooks = new Map<string, PrioritizedHook[]>();
  private locations = new Map<string, LocationDef>();

  // === Location registration ===

  /**
   * Register a location that agents can visit.
   * Plugins call this in init() to declare "places".
   */
  registerLocation(location: LocationDef): HookDisposable {
    this.locations.set(location.id, location);
    return {
      dispose: () => {
        this.locations.delete(location.id);
      },
    };
  }

  /**
   * Get all registered locations.
   */
  getLocations(): LocationDef[] {
    return Array.from(this.locations.values());
  }

  /**
   * Check if a location ID is registered.
   */
  hasLocation(locationId: string): boolean {
    return this.locations.has(locationId);
  }

  /**
   * Get a specific location by ID.
   */
  getLocation(locationId: string): LocationDef | undefined {
    return this.locations.get(locationId);
  }

  // === WS command registration ===

  /**
   * Register a WebSocket command handler.
   * Each command name must have exactly ONE handler (unique registration).
   * For cross-cutting concerns (logging, interception), use before/after('ws.command') hooks.
   *
   * @throws if a handler is already registered for this command
   */
  registerWSCommand(command: string, handler: WSHandler, schema?: CommandSchema): HookDisposable {
    if (this.wsHandlers.has(command)) {
      throw new Error(
        `WS command '${command}' is already registered. ` +
        `Use before/after('ws.command') hooks for cross-cutting concerns.`
      );
    }
    const entry = { handler, schema };
    this.wsHandlers.set(command, [entry]);
    return {
      dispose: () => {
        const entries = this.wsHandlers.get(command);
        if (!entries) return;
        this.wsHandlers.delete(command);
      },
    };
  }

  /**
   * Dispatch a WS command to its registered handler(s).
   *
   * Lifecycle:
   *  1. Fire 'ws.command' before-hooks (any plugin can cancel)
   *  2. If not cancelled, execute the command handler(s)
   *  3. Fire 'ws.command' after-hooks (observe / log / side-effects)
   *
   * Returns a `WSDispatchResult`:
   *  - `{ handled: false }` if no handler registered
   *  - `{ handled: true }` if executed normally
   *  - `{ handled: true, blocked: { ... } }` if cancelled by a before-hook
   */
  async handleWSCommand(command: string, ctx: WSContext, msg: WSMessage): Promise<WSDispatchResult> {
    const entries = this.wsHandlers.get(command);
    if (!entries || entries.length === 0) return { handled: false };

    // --- Before hooks: permission checks, location restrictions ---
    const hookCtx: WSCommandHookContext = { command, ctx, msg, cancelled: false };
    await this.runHook('ws.command', hookCtx);

    if (hookCtx.cancelled) {
      return {
        handled: true,
        blocked: hookCtx.blockReason ?? {
          error: `Command '${command}' was blocked`,
          code: 'COMMAND_BLOCKED',
        },
      };
    }

    // --- Execute handler(s) ---
    for (const entry of entries) {
      await entry.handler(ctx, msg);
    }

    // --- After hooks: logging, analytics, achievements ---
    await this.runAfterHook('ws.command', hookCtx);

    return { handled: true };
  }

  /**
   * List all registered WS command names.
   */
  listWSCommands(): string[] {
    return Array.from(this.wsHandlers.keys());
  }

  hasWSCommand(command: string): boolean {
    return this.wsHandlers.has(command);
  }

  getWSCommandSchema(command: string): CommandSchema | undefined {
    const entries = this.wsHandlers.get(command);
    return entries?.find((entry) => entry.schema)?.schema;
  }

  /**
   * Get all registered WS command schemas (for the 'what_can_i_do' discovery endpoint).
   */
  getWSCommandSchemas(): CommandSchema[] {
    const schemas: CommandSchema[] = [];
    for (const entries of this.wsHandlers.values()) {
      for (const entry of entries) {
        if (entry.schema) {
          schemas.push(entry.schema);
        }
      }
    }
    return schemas;
  }

  getAvailableWSCommandSchemas(ctx: Pick<WSContext, 'session' | 'inCity' | 'currentLocation' | 'isController' | 'hasController'>): CommandSchema[] {
    return this.getWSCommandSchemas().filter((schema) => this.isCommandAvailable(schema, ctx));
  }

  // === HTTP route registration ===

  /**
   * Register an HTTP route handler.
   * The handler should return true if it handled the request, false otherwise.
   */
  registerHttpRoute(handler: HttpHandler): HookDisposable {
    this.httpHandlers.push(handler);
    return {
      dispose: () => {
        const index = this.httpHandlers.indexOf(handler);
        if (index >= 0) {
          this.httpHandlers.splice(index, 1);
        }
      },
    };
  }

  /**
   * Try to handle an HTTP request through registered handlers.
   * Returns true if a handler processed the request.
   */
  async handleHttpRequest(ctx: HttpContext): Promise<boolean> {
    for (const handler of this.httpHandlers) {
      const handled = await handler(ctx);
      if (handled) return true;
    }
    return false;
  }

  // === Before/After hook system ===

  /**
   * Register a handler to run BEFORE a named hook point.
   * Higher priority runs first. Default priority is 0.
   */
  before<T = any>(hookName: string, handler: HookHandler<T>, priority = 0): HookDisposable {
    if (!this.beforeHooks.has(hookName)) {
      this.beforeHooks.set(hookName, []);
    }
    const list = this.beforeHooks.get(hookName)!;
    const entry = { handler, priority };
    list.push(entry);
    list.sort((a, b) => b.priority - a.priority);
    return {
      dispose: () => {
        const hookList = this.beforeHooks.get(hookName);
        if (!hookList) return;
        const index = hookList.indexOf(entry);
        if (index >= 0) {
          hookList.splice(index, 1);
        }
        if (hookList.length === 0) {
          this.beforeHooks.delete(hookName);
        }
      },
    };
  }

  /**
   * Register a handler to run AFTER a named hook point.
   * Higher priority runs first. Default priority is 0.
   */
  after<T = any>(hookName: string, handler: HookHandler<T>, priority = 0): HookDisposable {
    if (!this.afterHooks.has(hookName)) {
      this.afterHooks.set(hookName, []);
    }
    const list = this.afterHooks.get(hookName)!;
    const entry = { handler, priority };
    list.push(entry);
    list.sort((a, b) => b.priority - a.priority);
    return {
      dispose: () => {
        const hookList = this.afterHooks.get(hookName);
        if (!hookList) return;
        const index = hookList.indexOf(entry);
        if (index >= 0) {
          hookList.splice(index, 1);
        }
        if (hookList.length === 0) {
          this.afterHooks.delete(hookName);
        }
      },
    };
  }

  /**
   * Execute before-handlers for a hook point, returning the (possibly modified) context.
   */
  async runHook<T>(hookName: string, context: T): Promise<T> {
    const beforeList = this.beforeHooks.get(hookName);
    if (beforeList) {
      for (const { handler } of beforeList) {
        await handler(context);
      }
    }
    return context;
  }

  /**
   * Run the after-handlers for a hook point.
   */
  async runAfterHook<T>(hookName: string, context: T): Promise<void> {
    const afterList = this.afterHooks.get(hookName);
    if (afterList) {
      for (const { handler } of afterList) {
        await handler(context);
      }
    }
  }

  /**
   * List all registered hook names (before + after).
   */
  listHooks(): { before: string[]; after: string[] } {
    return {
      before: Array.from(this.beforeHooks.keys()),
      after: Array.from(this.afterHooks.keys()),
    };
  }

  private isCommandAvailable(
    schema: CommandSchema,
    ctx: Pick<WSContext, 'session' | 'inCity' | 'currentLocation' | 'isController' | 'hasController'>,
  ): boolean {
    const locationScope = schema.locationPolicy?.scope ?? 'any';
    const locationAllowList = schema.locationPolicy?.locations;

    if (schema.confirmationPolicy?.required && ctx.session?.trustMode === 'confirm') {
      return false;
    }

    if (schema.requiresConfirmation && ctx.session?.trustMode === 'confirm') {
      return false;
    }

    if ((schema.controlPolicy?.controllerRequired ?? true) && ctx.hasController && !ctx.isController) {
      return false;
    }

    if (locationScope === 'outside' && ctx.inCity) {
      return false;
    }

    if (locationScope === 'city' && (!ctx.inCity || ctx.currentLocation !== null)) {
      return false;
    }

    if (locationScope === 'in-city' && !ctx.inCity) {
      return false;
    }

    if (locationScope === 'location' && ctx.currentLocation === null) {
      return false;
    }

    if (locationAllowList && locationAllowList.length > 0) {
      if (!ctx.currentLocation || !locationAllowList.includes(ctx.currentLocation)) {
        return false;
      }
    }

    return true;
  }
}
