import { Hono } from 'hono';
import { resolve } from 'node:path';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { McpServer } from '../services/mcp/server.js';
import { SessionManager } from '../services/mcp/session-manager.js';
import { logBuffer } from '../services/mcp/log-buffer.js';
import { computeHealthSummary } from '../utils/health.js';
import { validateProject } from '../services/builder/validator.js';
import type { McpToolContext, CallerIdentity } from '../services/mcp/types.js';
import type { JsonRpcRequest } from '../schemas/mcp.schema.js';
import type { WorldWsManager } from '../ws/world-manager.js';
import type { BuilderService } from '../services/builder.service.js';

type AuthEnv = {
  Variables: {
    userId: string;
    email: string;
    role: string;
  };
};

const mcpRouter = new Hono<AuthEnv>();

/**
 * Lazy-init the MCP server with a context bound to the live Hono app.
 * `setMcpProviders()` must be called once at app boot from index.ts so
 * `getOpenApiDocument()` returns the right spec and the SessionManager
 * has a valid WorldWsManager reference (without a circular import).
 */
let openApiProvider: () => unknown = () => ({ openapi: '3.1.0', info: {}, paths: {} });
let worldWsProvider: () => WorldWsManager | null = () => null;
let builderProvider: () => BuilderService | null = () => null;

export function setMcpProviders(providers: {
  getOpenApiDocument: () => unknown;
  getWorldWsManager?: () => WorldWsManager | null;
  getBuilderService?: () => BuilderService | null;
}): void {
  openApiProvider = providers.getOpenApiDocument;
  if (providers.getWorldWsManager) {
    worldWsProvider = providers.getWorldWsManager;
  }
  if (providers.getBuilderService) {
    builderProvider = providers.getBuilderService;
  }
}

let sessionManagerInstance: SessionManager | null = null;
let serverInstance: McpServer | null = null;

function getSessionManager(): SessionManager {
  if (!sessionManagerInstance) {
    sessionManagerInstance = new SessionManager(() => worldWsProvider());
    sessionManagerInstance.start();
  }
  return sessionManagerInstance;
}

function getServer(): McpServer {
  if (!serverInstance) {
    const sessionManager = getSessionManager();
    const ctx: McpToolContext = {
      getOpenApiDocument: () => openApiProvider(),
      getHealthSummary: () => computeHealthSummary(),
      listAgentSessions: () => sessionManager.list(),
      logBuffer,
      runValidator: async (steps) => {
        const projectRoot = resolve(process.cwd());
        const start = Date.now();
        const result = await validateProject(projectRoot);
        const filtered = steps?.length
          ? result.errors.filter((s) => steps.includes(s.step))
          : result.errors;
        return {
          passed: filtered.every((s) => s.passed),
          steps: filtered.map((s) => ({ step: s.step, passed: s.passed, output: s.output })),
          durationMs: Date.now() - start,
        };
      },
    };
    const builder = builderProvider();
    if (builder) {
      ctx.getBuilderService = (): BuilderService => builder;
    }
    serverInstance = new McpServer(ctx, sessionManager);
  }
  return serverInstance;
}

/** Test-only — drop singletons so each test starts fresh. */
export function resetMcpServer(): void {
  sessionManagerInstance?.reset();
  sessionManagerInstance = null;
  serverInstance = null;
}

/** Test-only — get the active server (for direct dispatch in tests). */
export function getMcpServerForTest(): McpServer {
  return getServer();
}

/** Test-only — get the active session manager. */
export function getSessionManagerForTest(): SessionManager {
  return getSessionManager();
}

// ─── GET /mcp — legacy capability discovery (deprecated, removed in v0.5) ───

mcpRouter.get('/mcp', async (c) => {
  const server = getServer();
  return c.json({
    name: 'fenice',
    version: '0.4.0',
    description:
      'AI-native backend API — FENICE. The static manifest below is deprecated; clients should use POST /mcp/rpc with JSON-RPC 2.0 (initialize, tools/list, tools/call, resources/list).',
    transport: {
      jsonrpc: 'POST /api/v1/mcp/rpc',
      protocolVersion: '2025-03-26',
    },
    capabilities: {
      tools: true,
      resources: true,
    },
    tools: server.listToolDefinitions(),
    resources: [
      {
        uri: 'fenice://docs/openapi',
        name: 'OpenAPI Specification',
        description: 'Full OpenAPI 3.1 JSON specification',
        mimeType: 'application/json',
      },
    ],
    instructions:
      'Connect via POST /api/v1/mcp/rpc with a JWT bearer token (role >= agent). Send `initialize` first, then use `tools/list` and `tools/call`. The `Mcp-Session-Id` header carries the session id returned by initialize.',
  });
});

// ─── GET /agents — admin-only list of active MCP sessions ──────────────────

mcpRouter.get('/agents', authMiddleware, requireRole('admin'), (c) => {
  const sm = getSessionManager();
  return c.json({
    count: sm.size(),
    agents: sm.list(),
  });
});

// ─── POST /mcp/rpc — operational JSON-RPC dispatcher ───────────────────────

mcpRouter.post('/mcp/rpc', authMiddleware, requireRole('agent'), async (c) => {
  if (process.env['MCP_ENABLED'] === 'false') {
    return c.json(
      { jsonrpc: '2.0', id: null, error: { code: -32004, message: 'MCP server disabled' } },
      503
    );
  }

  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json(
      { jsonrpc: '2.0', id: null, error: { code: -32700, message: 'Parse error' } },
      400
    );
  }

  // Caller bound to the JWT-verified context. The session id (if present)
  // comes from the Mcp-Session-Id header set by clients after `initialize`.
  const sessionId = c.req.header('mcp-session-id');
  const userId = c.get('userId');
  const userRole = c.get('role');

  const caller: CallerIdentity = sessionId ? { userId, userRole, sessionId } : { userId, userRole };

  // Surface the method here only to keep the import-aware lint quiet about
  // unused JsonRpcRequest type — the dispatcher does its own validation.
  void (body as JsonRpcRequest | undefined)?.method;

  const server = getServer();
  const response = await server.dispatch(body, caller);

  // JSON-RPC error responses are still HTTP 200 per spec; errors are signalled
  // by the `error` field, not the status code.
  return c.json(response);
});

export { mcpRouter };
