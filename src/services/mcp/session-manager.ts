import type { WorldWsManager } from '../../ws/world-manager.js';
import type { WorldDeltaEvent, AgentRole } from '../../schemas/world-delta.schema.js';
import type { AgentSessionView } from './types.js';

/**
 * Stored representation of an agent session — superset of the public AgentSessionView.
 */
export interface AgentSession {
  id: string;
  name: string;
  version: string;
  role: AgentRole;
  userId: string;
  status: 'connected' | 'idle' | 'busy' | 'disconnected';
  connectedAt: Date;
  lastSeenAt: Date;
  currentTool?: string;
  currentTarget?: { type: 'service' | 'endpoint'; id: string };
}

export interface SessionManagerOptions {
  /** TTL in ms — sessions with no heartbeat for longer than this get cleaned up. */
  ttlMs: number;
  /** Max activity events emitted per session per second. Excess are dropped. */
  throttlePerSec: number;
  /** How often the cleanup pass runs. */
  cleanupIntervalMs: number;
}

const DEFAULT_OPTIONS: SessionManagerOptions = {
  ttlMs: Number(process.env['MCP_SESSION_TTL_MS'] ?? 90_000) || 90_000,
  throttlePerSec: Number(process.env['MCP_ACTIVITY_THROTTLE_PER_SEC'] ?? 10) || 10,
  cleanupIntervalMs: 30_000,
};

interface ThrottleWindow {
  windowStart: number;
  count: number;
}

/**
 * Tracks live MCP agent sessions. Each lifecycle event is mirrored as a
 * world-delta so the 3D client can render agent presence.
 *
 * In-memory by design — sessions don't survive a server restart. Agents are
 * expected to reconnect.
 */
export class SessionManager {
  private readonly sessions = new Map<string, AgentSession>();
  private readonly throttle = new Map<string, ThrottleWindow>();
  private cleanupTimer: NodeJS.Timeout | null = null;

  constructor(
    private readonly getWorldManager: () => WorldWsManager | null,
    private readonly options: SessionManagerOptions = DEFAULT_OPTIONS
  ) {}

  /** Start the periodic cleanup loop. Idempotent. */
  start(): void {
    if (this.cleanupTimer) return;
    this.cleanupTimer = setInterval(() => {
      this.cleanupOrphaned();
    }, this.options.cleanupIntervalMs);
    // Don't keep the Node process alive just for cleanup
    this.cleanupTimer.unref();
  }

  /** Stop the cleanup loop. Safe to call multiple times. */
  stop(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer);
      this.cleanupTimer = null;
    }
  }

  // ─── Lifecycle ───────────────────────────────────────────────────────────

  register(input: {
    sessionId: string;
    name: string;
    version: string;
    role: AgentRole;
    userId: string;
  }): AgentSession {
    const now = new Date();
    const session: AgentSession = {
      id: input.sessionId,
      name: input.name,
      version: input.version,
      role: input.role,
      userId: input.userId,
      status: 'connected',
      connectedAt: now,
      lastSeenAt: now,
    };
    this.sessions.set(session.id, session);

    this.emit({
      type: 'agent.connected',
      entityId: session.id,
      payload: {
        agentId: session.id,
        name: session.name,
        role: session.role,
      },
    });

    return session;
  }

  unregister(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    this.sessions.delete(sessionId);
    this.throttle.delete(sessionId);
    this.emit({ type: 'agent.disconnected', entityId: sessionId });
  }

  heartbeat(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.lastSeenAt = new Date();
    if (session.status === 'idle') session.status = 'connected';
  }

  // ─── Activity tracking ──────────────────────────────────────────────────

  startActivity(sessionId: string, tool: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.status = 'busy';
    session.currentTool = tool;
    session.lastSeenAt = new Date();

    this.emitActivity(session.id, {
      type: 'agent.activity',
      entityId: session.id,
      payload: { agentId: session.id, tool, status: 'started' },
    });
  }

  completeActivity(sessionId: string, tool: string, durationMs: number, isError: boolean): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;
    session.status = 'connected';
    delete session.currentTool;
    delete session.currentTarget;
    session.lastSeenAt = new Date();

    this.emitActivity(session.id, {
      type: 'agent.activity',
      entityId: session.id,
      payload: {
        agentId: session.id,
        tool,
        status: isError ? 'failed' : 'completed',
        durationMs,
      },
    });
  }

  // ─── Read-only views ────────────────────────────────────────────────────

  list(): AgentSessionView[] {
    return Array.from(this.sessions.values()).map((s) => {
      const view: AgentSessionView = {
        id: s.id,
        name: s.name,
        version: s.version,
        role: s.role,
        status: s.status,
        connectedAt: s.connectedAt.toISOString(),
        lastSeenAt: s.lastSeenAt.toISOString(),
      };
      if (s.currentTool) view.currentTool = s.currentTool;
      return view;
    });
  }

  size(): number {
    return this.sessions.size;
  }

  has(sessionId: string): boolean {
    return this.sessions.has(sessionId);
  }

  // ─── Internals ──────────────────────────────────────────────────────────

  /** Drop sessions that haven't sent a heartbeat or call within ttlMs. */
  private cleanupOrphaned(): void {
    const cutoff = Date.now() - this.options.ttlMs;
    for (const [id, session] of this.sessions) {
      if (session.lastSeenAt.getTime() < cutoff) {
        this.unregister(id);
      }
    }
  }

  /** Emit a non-activity event (always passes through). */
  private emit(event: WorldDeltaEvent): void {
    const wsManager = this.getWorldManager();
    if (!wsManager) return;
    wsManager.broadcastDelta([event]);
  }

  /** Emit an activity event subject to per-session throttling. */
  private emitActivity(sessionId: string, event: WorldDeltaEvent): void {
    if (!this.shouldEmitActivity(sessionId)) return;
    this.emit(event);
  }

  private shouldEmitActivity(sessionId: string): boolean {
    const now = Date.now();
    const window = this.throttle.get(sessionId);
    if (!window || now - window.windowStart >= 1000) {
      this.throttle.set(sessionId, { windowStart: now, count: 1 });
      return true;
    }
    if (window.count >= this.options.throttlePerSec) {
      return false;
    }
    window.count += 1;
    return true;
  }

  /** Test-only: drop all sessions and timers. */
  reset(): void {
    this.stop();
    this.sessions.clear();
    this.throttle.clear();
  }
}
