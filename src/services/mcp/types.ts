import type { McpToolDefinition, McpToolsCallResult } from '../../schemas/mcp.schema.js';
import type { LogRingBuffer } from './log-buffer.js';

/**
 * Context passed to every tool handler. Decouples tools from the Hono app
 * instance — handlers only see the dependencies they need.
 */
export interface McpToolContext {
  /** Returns the current OpenAPI 3.1 document. Recomputed on each call. */
  getOpenApiDocument(): unknown;
  /** Health check function — returns the same payload as GET /health/detailed. */
  getHealthSummary(): Promise<HealthSummary>;
  /** Active agent sessions (read-only view). Empty in M7.1, populated in M7.2. */
  listAgentSessions(): AgentSessionView[];
  /** Log ring buffer for query_logs. */
  logBuffer: LogRingBuffer;
}

export interface HealthSummary {
  status: 'ok' | 'degraded' | 'down';
  timestamp: string;
  uptime: number;
  mongo: 'ok' | 'down' | 'unknown';
}

export interface AgentSessionView {
  id: string;
  name: string;
  version: string;
  role: 'generator' | 'reviewer' | 'tester' | 'monitor' | 'generic';
  status: 'connected' | 'idle' | 'busy' | 'disconnected';
  connectedAt: string;
  lastSeenAt: string;
  currentTool?: string;
}

export interface ToolHandler {
  definition: McpToolDefinition;
  handle(
    args: Record<string, unknown> | undefined,
    ctx: McpToolContext
  ): Promise<McpToolsCallResult>;
}

/**
 * The authenticated caller. `sessionId` is populated for non-initialize
 * requests (extracted from the `Mcp-Session-Id` header). On `initialize`
 * the server mints a new sessionId and binds it to this caller.
 */
export interface CallerIdentity {
  userId: string;
  userRole: string;
  sessionId?: string;
}
