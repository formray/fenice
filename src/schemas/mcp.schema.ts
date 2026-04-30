import { z } from 'zod';

// ─── JSON-RPC 2.0 envelope ──────────────────────────────────────────────────

export const JsonRpcIdSchema = z.union([z.string(), z.number(), z.null()]);
export type JsonRpcId = z.infer<typeof JsonRpcIdSchema>;

export const JsonRpcRequestSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: JsonRpcIdSchema.optional(),
  method: z.string().min(1),
  params: z.unknown().optional(),
});
export type JsonRpcRequest = z.infer<typeof JsonRpcRequestSchema>;

export const JsonRpcErrorSchema = z.object({
  code: z.number().int(),
  message: z.string(),
  data: z.unknown().optional(),
});
export type JsonRpcError = z.infer<typeof JsonRpcErrorSchema>;

export const JsonRpcSuccessResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: JsonRpcIdSchema,
  result: z.unknown(),
});

export const JsonRpcErrorResponseSchema = z.object({
  jsonrpc: z.literal('2.0'),
  id: JsonRpcIdSchema,
  error: JsonRpcErrorSchema,
});

export const JsonRpcResponseSchema = z.union([
  JsonRpcSuccessResponseSchema,
  JsonRpcErrorResponseSchema,
]);
export type JsonRpcResponse = z.infer<typeof JsonRpcResponseSchema>;

// JSON-RPC standard error codes (https://www.jsonrpc.org/specification#error_object)
export const JSON_RPC_ERROR = {
  PARSE_ERROR: -32700,
  INVALID_REQUEST: -32600,
  METHOD_NOT_FOUND: -32601,
  INVALID_PARAMS: -32602,
  INTERNAL_ERROR: -32603,
  // MCP-specific extensions (server-defined error range -32000..-32099)
  UNAUTHORIZED: -32001,
  FORBIDDEN: -32002,
  NOT_INITIALIZED: -32003,
  RATE_LIMITED: -32004,
} as const;

// ─── MCP method names ───────────────────────────────────────────────────────

export const McpMethodSchema = z.enum([
  'initialize',
  'tools/list',
  'tools/call',
  'resources/list',
  'resources/read',
  'ping',
]);
export type McpMethod = z.infer<typeof McpMethodSchema>;

// ─── MCP initialize ─────────────────────────────────────────────────────────

export const McpClientInfoSchema = z.object({
  name: z.string().min(1).max(100),
  version: z.string().min(1).max(50),
});
export type McpClientInfo = z.infer<typeof McpClientInfoSchema>;

export const McpInitializeParamsSchema = z.object({
  protocolVersion: z.string(),
  clientInfo: McpClientInfoSchema,
  capabilities: z
    .object({
      tools: z.unknown().optional(),
      resources: z.unknown().optional(),
      sampling: z.unknown().optional(),
    })
    .optional(),
  // FENICE extension — agents declare their role on initialize
  agentRole: z.enum(['generator', 'reviewer', 'tester', 'monitor', 'generic']).default('generic'),
});
export type McpInitializeParams = z.infer<typeof McpInitializeParamsSchema>;

export const McpServerInfoSchema = z.object({
  name: z.string(),
  version: z.string(),
});

export const McpInitializeResultSchema = z.object({
  protocolVersion: z.string(),
  serverInfo: McpServerInfoSchema,
  capabilities: z.object({
    tools: z.object({ listChanged: z.boolean().optional() }).optional(),
    resources: z.object({ listChanged: z.boolean().optional() }).optional(),
  }),
  sessionId: z.string(),
});
export type McpInitializeResult = z.infer<typeof McpInitializeResultSchema>;

// ─── MCP tools ──────────────────────────────────────────────────────────────

export const McpToolDefinitionSchema = z.object({
  name: z.string(),
  description: z.string(),
  inputSchema: z.unknown(),
  // FENICE-specific metadata
  minRole: z.enum(['agent', 'admin']).default('agent'),
  readOnly: z.boolean().default(true),
});
export type McpToolDefinition = z.infer<typeof McpToolDefinitionSchema>;

export const McpToolsListResultSchema = z.object({
  tools: z.array(McpToolDefinitionSchema),
});

export const McpToolsCallParamsSchema = z.object({
  name: z.string().min(1),
  arguments: z.record(z.string(), z.unknown()).optional(),
});
export type McpToolsCallParams = z.infer<typeof McpToolsCallParamsSchema>;

export const McpToolContentSchema = z.union([
  z.object({ type: z.literal('text'), text: z.string() }),
  z.object({ type: z.literal('json'), data: z.unknown() }),
]);
export type McpToolContent = z.infer<typeof McpToolContentSchema>;

export const McpToolsCallResultSchema = z.object({
  content: z.array(McpToolContentSchema),
  isError: z.boolean().default(false),
});
export type McpToolsCallResult = z.infer<typeof McpToolsCallResultSchema>;

// ─── MCP resources ──────────────────────────────────────────────────────────

export const McpResourceSchema = z.object({
  uri: z.string(),
  name: z.string(),
  description: z.string().optional(),
  mimeType: z.string().optional(),
});
export type McpResource = z.infer<typeof McpResourceSchema>;

export const McpResourcesListResultSchema = z.object({
  resources: z.array(McpResourceSchema),
});

export const McpResourcesReadParamsSchema = z.object({
  uri: z.string().min(1),
});

export const McpResourceContentSchema = z.object({
  uri: z.string(),
  mimeType: z.string(),
  text: z.string().optional(),
  blob: z.string().optional(), // base64 if binary
});

export const McpResourcesReadResultSchema = z.object({
  contents: z.array(McpResourceContentSchema),
});

// ─── Protocol version this server speaks ────────────────────────────────────

export const MCP_PROTOCOL_VERSION = '2025-03-26';
