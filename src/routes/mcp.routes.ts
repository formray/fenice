import { Hono } from 'hono';

const mcpRouter = new Hono();

// MCP Discovery endpoint — describes API capabilities for AI agents
mcpRouter.get('/mcp', async (c) => {
  return c.json({
    name: 'fenice',
    version: '0.3.0',
    description: 'AI-native backend API — FENICE',
    capabilities: {
      tools: true,
      resources: true,
    },
    tools: [
      {
        name: 'auth_signup',
        description: 'Register a new user account',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            username: { type: 'string', minLength: 2, maxLength: 50 },
            fullName: { type: 'string', minLength: 1, maxLength: 100 },
            password: { type: 'string', minLength: 8, maxLength: 128 },
          },
          required: ['email', 'username', 'fullName', 'password'],
        },
      },
      {
        name: 'auth_login',
        description: 'Authenticate with email and password',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
            password: { type: 'string' },
          },
          required: ['email', 'password'],
        },
      },
      {
        name: 'auth_refresh',
        description: 'Refresh an expired access token',
        inputSchema: {
          type: 'object',
          properties: {
            refreshToken: { type: 'string' },
          },
          required: ['refreshToken'],
        },
      },
      {
        name: 'user_get_me',
        description: 'Get the currently authenticated user profile',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'user_get_by_id',
        description: 'Get a user by their ID',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
      },
      {
        name: 'user_update',
        description: 'Update user profile fields',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            fullName: { type: 'string', minLength: 1, maxLength: 100 },
            pictureUrl: { type: 'string', format: 'uri' },
          },
          required: ['id'],
        },
      },
      {
        name: 'user_delete',
        description: 'Delete a user (admin only)',
        inputSchema: {
          type: 'object',
          properties: {
            id: { type: 'string' },
          },
          required: ['id'],
        },
      },
      {
        name: 'user_list',
        description: 'List users with cursor pagination and optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            cursor: { type: 'string', description: 'Pagination cursor from previous response' },
            limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
            sort: {
              type: 'string',
              enum: ['createdAt', 'email', 'username'],
              default: 'createdAt',
            },
            order: { type: 'string', enum: ['asc', 'desc'], default: 'desc' },
            search: { type: 'string', description: 'Search across email, username, fullName' },
            role: {
              type: 'string',
              enum: ['superAdmin', 'admin', 'employee', 'client', 'vendor', 'user'],
            },
            active: { type: 'boolean' },
          },
        },
      },
      {
        name: 'auth_verify_email',
        description: 'Verify email address using token from verification email',
        inputSchema: {
          type: 'object',
          properties: {
            token: { type: 'string' },
          },
          required: ['token'],
        },
      },
      {
        name: 'auth_resend_verification',
        description: 'Resend email verification link (requires auth)',
        inputSchema: { type: 'object', properties: {} },
      },
      {
        name: 'auth_request_password_reset',
        description: 'Request a password reset email',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', format: 'email' },
          },
          required: ['email'],
        },
      },
      {
        name: 'auth_reset_password',
        description: 'Reset password using token from reset email',
        inputSchema: {
          type: 'object',
          properties: {
            token: { type: 'string' },
            newPassword: { type: 'string', minLength: 8, maxLength: 128 },
          },
          required: ['token', 'newPassword'],
        },
      },
      {
        name: 'upload_init',
        description: 'Initialize a chunked file upload session (requires auth)',
        inputSchema: {
          type: 'object',
          properties: {
            filename: { type: 'string' },
            contentType: { type: 'string' },
            totalSize: { type: 'number', description: 'File size in bytes (max 100MB)' },
          },
          required: ['filename', 'contentType', 'totalSize'],
        },
      },
      {
        name: 'upload_chunk',
        description: 'Upload a single chunk of a file (requires auth)',
        inputSchema: {
          type: 'object',
          properties: {
            uploadId: { type: 'string' },
            index: { type: 'number', description: 'Zero-based chunk index' },
          },
          required: ['uploadId', 'index'],
        },
      },
      {
        name: 'upload_complete',
        description: 'Complete a chunked upload and assemble the file (requires auth)',
        inputSchema: {
          type: 'object',
          properties: {
            uploadId: { type: 'string' },
          },
          required: ['uploadId'],
        },
      },
      {
        name: 'upload_cancel',
        description: 'Cancel an upload and clean up chunks (requires auth)',
        inputSchema: {
          type: 'object',
          properties: {
            uploadId: { type: 'string' },
          },
          required: ['uploadId'],
        },
      },
      {
        name: 'ws_connect',
        description: 'Connect to WebSocket endpoint for real-time messaging',
        inputSchema: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'JWT access token for authentication' },
          },
          required: ['token'],
        },
      },
      {
        name: 'world_ws_connect',
        description: 'Connect to World WebSocket endpoint for 3D city snapshot/resume stream',
        inputSchema: {
          type: 'object',
          properties: {
            token: { type: 'string', description: 'JWT access token for authentication' },
            resumeToken: { type: 'string', description: 'Optional token for stream resume' },
            lastSeq: { type: 'number', minimum: 0, description: 'Optional last applied sequence' },
          },
          required: ['token'],
        },
      },
    ],
    resources: [
      {
        uri: 'fenice://docs/openapi',
        name: 'OpenAPI Specification',
        description: 'Full OpenAPI 3.1 JSON specification',
        mimeType: 'application/json',
      },
      {
        uri: 'fenice://docs/llm',
        name: 'LLM Documentation',
        description: 'Markdown documentation optimized for AI consumption',
        mimeType: 'text/markdown',
      },
    ],
    instructions:
      'FENICE is an AI-native REST API. Use the tools above to interact with authentication, user management, file uploads, world projection, and real-time WebSocket messaging. All tool calls map to REST endpoints. Authentication required for most operations — obtain tokens via auth_login first. WebSocket connections require a valid JWT token.',
  });
});

export { mcpRouter };
