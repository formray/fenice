import { randomUUID } from 'node:crypto';
import {
  JSON_RPC_ERROR,
  JsonRpcRequestSchema,
  McpInitializeParamsSchema,
  McpToolsCallParamsSchema,
  McpResourcesReadParamsSchema,
  MCP_PROTOCOL_VERSION,
} from '../../schemas/mcp.schema.js';
import type {
  JsonRpcRequest,
  JsonRpcResponse,
  McpToolDefinition,
} from '../../schemas/mcp.schema.js';
import type { Role } from '../../middleware/rbac.js';
import { ROLE_HIERARCHY } from '../../middleware/rbac.js';
import type { McpToolContext, ToolHandler, CallerIdentity } from './types.js';
import type { SessionManager } from './session-manager.js';

import { listEndpointsTool } from './tools/list-endpoints.js';
import { getSchemaTool } from './tools/get-schema.js';
import { checkHealthTool } from './tools/check-health.js';
import { listAgentsTool } from './tools/list-agents.js';
import { queryLogsTool } from './tools/query-logs.js';
import {
  createEndpointTool,
  modifyEndpointTool,
  builderGetJobTool,
  builderListJobsTool,
} from './tools/builder.js';
import { runTestsTool } from './tools/run-tests.js';

/**
 * MCP server — handles JSON-RPC 2.0 requests over the wire protocol defined
 * by the Model Context Protocol spec. Decoupled from the HTTP transport so
 * the same dispatcher can serve different transports in the future (stdio,
 * SSE, websocket).
 *
 * Initialization is implicit per session: clients send `initialize` first,
 * receive a sessionId, then send subsequent requests with that sessionId
 * (forwarded by the transport layer through `AgentIdentity`).
 */
export class McpServer {
  private readonly tools = new Map<string, ToolHandler>();

  constructor(
    private readonly ctx: McpToolContext,
    private readonly sessionManager?: SessionManager
  ) {
    this.registerTool(listEndpointsTool);
    this.registerTool(getSchemaTool);
    this.registerTool(checkHealthTool);
    this.registerTool(listAgentsTool);
    this.registerTool(queryLogsTool);
    this.registerTool(createEndpointTool);
    this.registerTool(modifyEndpointTool);
    this.registerTool(builderGetJobTool);
    this.registerTool(builderListJobsTool);
    this.registerTool(runTestsTool);
  }

  registerTool(handler: ToolHandler): void {
    this.tools.set(handler.definition.name, handler);
  }

  listToolDefinitions(): McpToolDefinition[] {
    return Array.from(this.tools.values()).map((h) => h.definition);
  }

  /**
   * Dispatch a JSON-RPC request against this server.
   *
   * @param raw  The raw JSON value (already parsed from the body).
   * @param caller  The authenticated caller — userId/userRole always present
   *                (from JWT). `sessionId` is set on non-initialize requests.
   *                Pass `null` only for unauthenticated `ping` requests.
   */
  async dispatch(raw: unknown, caller: CallerIdentity | null): Promise<JsonRpcResponse> {
    const parsed = JsonRpcRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return this.errorResponse(null, JSON_RPC_ERROR.INVALID_REQUEST, 'Invalid JSON-RPC request');
    }

    const request: JsonRpcRequest = parsed.data;
    const id = request.id ?? null;

    try {
      switch (request.method) {
        case 'initialize':
          if (!caller) {
            return this.errorResponse(
              id,
              JSON_RPC_ERROR.UNAUTHORIZED,
              'initialize requires authentication'
            );
          }
          return await this.handleInitialize(request, id, caller);
        case 'ping':
          return { jsonrpc: '2.0', id, result: {} };
        case 'tools/list': {
          const initCaller = this.requireInitialized(caller);
          this.touchSession(initCaller);
          return { jsonrpc: '2.0', id, result: { tools: this.listToolDefinitions() } };
        }
        case 'tools/call': {
          const initCaller = this.requireInitialized(caller);
          return await this.handleToolCall(request, id, initCaller);
        }
        case 'resources/list': {
          const initCaller = this.requireInitialized(caller);
          this.touchSession(initCaller);
          return {
            jsonrpc: '2.0',
            id,
            result: {
              resources: [
                {
                  uri: 'fenice://docs/openapi',
                  name: 'OpenAPI Specification',
                  description: 'Full OpenAPI 3.1 JSON specification',
                  mimeType: 'application/json',
                },
              ],
            },
          };
        }
        case 'resources/read': {
          const initCaller = this.requireInitialized(caller);
          this.touchSession(initCaller);
          return await this.handleResourceRead(request, id);
        }
        default:
          return this.errorResponse(
            id,
            JSON_RPC_ERROR.METHOD_NOT_FOUND,
            `Method not found: ${request.method}`
          );
      }
    } catch (err) {
      if (err instanceof McpProtocolError) {
        return this.errorResponse(id, err.code, err.message, err.data);
      }
      const message = err instanceof Error ? err.message : 'Internal error';
      return this.errorResponse(id, JSON_RPC_ERROR.INTERNAL_ERROR, message);
    }
  }

  // ─── Method handlers ─────────────────────────────────────────────────────

  private async handleInitialize(
    request: JsonRpcRequest,
    id: JsonRpcRequest['id'],
    caller: CallerIdentity
  ): Promise<JsonRpcResponse> {
    const params = McpInitializeParamsSchema.safeParse(request.params);
    if (!params.success) {
      return this.errorResponse(
        id ?? null,
        JSON_RPC_ERROR.INVALID_PARAMS,
        'Invalid initialize params',
        params.error.issues
      );
    }

    const sessionId = randomUUID();

    if (this.sessionManager) {
      this.sessionManager.register({
        sessionId,
        name: params.data.clientInfo.name,
        version: params.data.clientInfo.version,
        role: params.data.agentRole,
        userId: caller.userId,
      });
    }

    return {
      jsonrpc: '2.0',
      id: id ?? null,
      result: {
        protocolVersion: MCP_PROTOCOL_VERSION,
        serverInfo: { name: 'fenice', version: '0.4.0' },
        capabilities: {
          tools: { listChanged: false },
          resources: { listChanged: false },
        },
        sessionId,
      },
    };
  }

  private async handleToolCall(
    request: JsonRpcRequest,
    id: JsonRpcRequest['id'],
    caller: CallerIdentity
  ): Promise<JsonRpcResponse> {
    const params = McpToolsCallParamsSchema.safeParse(request.params);
    if (!params.success) {
      return this.errorResponse(
        id ?? null,
        JSON_RPC_ERROR.INVALID_PARAMS,
        'Invalid tools/call params',
        params.error.issues
      );
    }

    const handler = this.tools.get(params.data.name);
    if (!handler) {
      return this.errorResponse(
        id ?? null,
        JSON_RPC_ERROR.METHOD_NOT_FOUND,
        `Unknown tool: ${params.data.name}`
      );
    }

    // Per-tool RBAC check
    const callerLevel = this.roleLevel(caller.userRole);
    const requiredLevel = ROLE_HIERARCHY[handler.definition.minRole];
    if (callerLevel < requiredLevel) {
      return this.errorResponse(
        id ?? null,
        JSON_RPC_ERROR.FORBIDDEN,
        `Tool ${handler.definition.name} requires role >= ${handler.definition.minRole}`
      );
    }

    // Lifecycle: emit started → handler runs → emit completed/failed
    const sessionId = caller.sessionId;
    const start = Date.now();
    if (sessionId && this.sessionManager) {
      this.sessionManager.startActivity(sessionId, handler.definition.name);
    }

    try {
      const result = await handler.handle(params.data.arguments, this.ctx, caller);
      if (sessionId && this.sessionManager) {
        this.sessionManager.completeActivity(
          sessionId,
          handler.definition.name,
          Date.now() - start,
          result.isError
        );
      }
      return { jsonrpc: '2.0', id: id ?? null, result };
    } catch (err) {
      if (sessionId && this.sessionManager) {
        this.sessionManager.completeActivity(
          sessionId,
          handler.definition.name,
          Date.now() - start,
          true
        );
      }
      throw err;
    }
  }

  private async handleResourceRead(
    request: JsonRpcRequest,
    id: JsonRpcRequest['id']
  ): Promise<JsonRpcResponse> {
    const params = McpResourcesReadParamsSchema.safeParse(request.params);
    if (!params.success) {
      return this.errorResponse(
        id ?? null,
        JSON_RPC_ERROR.INVALID_PARAMS,
        'Invalid resources/read params'
      );
    }

    if (params.data.uri === 'fenice://docs/openapi') {
      return {
        jsonrpc: '2.0',
        id: id ?? null,
        result: {
          contents: [
            {
              uri: params.data.uri,
              mimeType: 'application/json',
              text: JSON.stringify(this.ctx.getOpenApiDocument()),
            },
          ],
        },
      };
    }

    return this.errorResponse(
      id ?? null,
      JSON_RPC_ERROR.INVALID_PARAMS,
      `Unknown resource URI: ${params.data.uri}`
    );
  }

  // ─── Helpers ─────────────────────────────────────────────────────────────

  private errorResponse(
    id: JsonRpcRequest['id'] | null,
    code: number,
    message: string,
    data?: unknown
  ): JsonRpcResponse {
    return {
      jsonrpc: '2.0',
      id: id ?? null,
      error: data !== undefined ? { code, message, data } : { code, message },
    };
  }

  private requireInitialized(
    caller: CallerIdentity | null
  ): CallerIdentity & { sessionId: string } {
    const sessionId = caller?.sessionId;
    if (!caller || !sessionId || !this.sessionManager?.has(sessionId)) {
      throw new McpProtocolError(
        JSON_RPC_ERROR.NOT_INITIALIZED,
        'Session not initialized — call initialize first'
      );
    }
    return { ...caller, sessionId };
  }

  /** Refresh lastSeenAt on a known session — for non-tool-call methods. */
  private touchSession(caller: CallerIdentity & { sessionId: string }): void {
    this.sessionManager?.heartbeat(caller.sessionId);
  }

  private roleLevel(role: string): number {
    return role in ROLE_HIERARCHY ? ROLE_HIERARCHY[role as Role] : 0;
  }
}

class McpProtocolError extends Error {
  constructor(
    public readonly code: number,
    message: string,
    public readonly data?: unknown
  ) {
    super(message);
    this.name = 'McpProtocolError';
  }
}
