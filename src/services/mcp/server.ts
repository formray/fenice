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
import type { McpToolContext, ToolHandler, AgentIdentity } from './types.js';

import { listEndpointsTool } from './tools/list-endpoints.js';
import { getSchemaTool } from './tools/get-schema.js';
import { checkHealthTool } from './tools/check-health.js';
import { listAgentsTool } from './tools/list-agents.js';
import { queryLogsTool } from './tools/query-logs.js';
import { createEndpointTool, modifyEndpointTool } from './tools/builder-stubs.js';

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
  private readonly initializedSessions = new Set<string>();

  constructor(private readonly ctx: McpToolContext) {
    this.registerTool(listEndpointsTool);
    this.registerTool(getSchemaTool);
    this.registerTool(checkHealthTool);
    this.registerTool(listAgentsTool);
    this.registerTool(queryLogsTool);
    this.registerTool(createEndpointTool);
    this.registerTool(modifyEndpointTool);
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
   * @param identity  The authenticated caller's identity (from JWT + session header).
   *                  `null` is acceptable for `initialize` requests where no session exists yet.
   */
  async dispatch(raw: unknown, identity: AgentIdentity | null): Promise<JsonRpcResponse> {
    const parsed = JsonRpcRequestSchema.safeParse(raw);
    if (!parsed.success) {
      return this.errorResponse(null, JSON_RPC_ERROR.INVALID_REQUEST, 'Invalid JSON-RPC request');
    }

    const request: JsonRpcRequest = parsed.data;
    const id = request.id ?? null;

    try {
      switch (request.method) {
        case 'initialize':
          return await this.handleInitialize(request, id);
        case 'ping':
          return { jsonrpc: '2.0', id, result: {} };
        case 'tools/list':
          this.requireInitialized(identity);
          return { jsonrpc: '2.0', id, result: { tools: this.listToolDefinitions() } };
        case 'tools/call':
          this.requireInitialized(identity);
          return await this.handleToolCall(request, id, identity);
        case 'resources/list':
          this.requireInitialized(identity);
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
        case 'resources/read':
          this.requireInitialized(identity);
          return await this.handleResourceRead(request, id);
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
    id: JsonRpcRequest['id']
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
    this.initializedSessions.add(sessionId);

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
    identity: AgentIdentity | null
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
    const callerLevel = identity ? this.roleLevel(identity.userRole) : 0;
    const requiredLevel = ROLE_HIERARCHY[handler.definition.minRole];
    if (callerLevel < requiredLevel) {
      return this.errorResponse(
        id ?? null,
        JSON_RPC_ERROR.FORBIDDEN,
        `Tool ${handler.definition.name} requires role >= ${handler.definition.minRole}`
      );
    }

    const result = await handler.handle(params.data.arguments, this.ctx);
    return { jsonrpc: '2.0', id: id ?? null, result };
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

  private requireInitialized(identity: AgentIdentity | null): void {
    if (!identity || !this.initializedSessions.has(identity.sessionId)) {
      throw new McpProtocolError(
        JSON_RPC_ERROR.NOT_INITIALIZED,
        'Session not initialized — call initialize first'
      );
    }
  }

  private roleLevel(role: string): number {
    return role in ROLE_HIERARCHY ? ROLE_HIERARCHY[role as Role] : 0;
  }

  /** Test-only: forget all sessions. */
  resetSessions(): void {
    this.initializedSessions.clear();
  }

  /** For session-manager (M7.2) to deregister sessions on disconnect. */
  forgetSession(sessionId: string): void {
    this.initializedSessions.delete(sessionId);
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
