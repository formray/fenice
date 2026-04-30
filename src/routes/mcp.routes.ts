import { Hono } from 'hono';
import { authMiddleware } from '../middleware/auth.js';
import { requireRole } from '../middleware/rbac.js';
import { McpServer } from '../services/mcp/server.js';
import { logBuffer } from '../services/mcp/log-buffer.js';
import { computeHealthSummary } from '../utils/health.js';
import type { McpToolContext, AgentIdentity, AgentSessionView } from '../services/mcp/types.js';
import type { JsonRpcRequest } from '../schemas/mcp.schema.js';

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
 * `setOpenApiProvider()` must be called once at app boot from index.ts so
 * `getOpenApiDocument()` returns the right spec without a circular import.
 */
let openApiProvider: () => unknown = () => ({ openapi: '3.1.0', info: {}, paths: {} });
let agentSessionsProvider: () => AgentSessionView[] = () => [];

export function setMcpProviders(providers: {
  getOpenApiDocument: () => unknown;
  listAgentSessions?: () => AgentSessionView[];
}): void {
  openApiProvider = providers.getOpenApiDocument;
  if (providers.listAgentSessions) {
    agentSessionsProvider = providers.listAgentSessions;
  }
}

let serverInstance: McpServer | null = null;
function getServer(): McpServer {
  if (!serverInstance) {
    const ctx: McpToolContext = {
      getOpenApiDocument: () => openApiProvider(),
      getHealthSummary: () => computeHealthSummary(),
      listAgentSessions: () => agentSessionsProvider(),
      logBuffer,
    };
    serverInstance = new McpServer(ctx);
  }
  return serverInstance;
}

/** Test-only — drop the singleton so each test starts fresh. */
export function resetMcpServer(): void {
  serverInstance = null;
}

/** Test-only — get the active server (for direct dispatch in tests). */
export function getMcpServerForTest(): McpServer {
  return getServer();
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

  // Identity bound to the JWT-verified context. Sessions begin on `initialize`
  // and are looked up via the `Mcp-Session-Id` header on subsequent calls.
  const sessionId = c.req.header('mcp-session-id') ?? '';
  const userId = c.get('userId');
  const userRole = c.get('role');

  const isInitialize =
    typeof body === 'object' && body !== null && (body as JsonRpcRequest).method === 'initialize';

  const identity: AgentIdentity | null = isInitialize
    ? null
    : sessionId
      ? { sessionId, userId, userRole }
      : null;

  const server = getServer();
  const response = await server.dispatch(body, identity);

  // JSON-RPC error responses are still HTTP 200 per spec; errors are signalled
  // by the `error` field, not the status code.
  return c.json(response);
});

export { mcpRouter };
