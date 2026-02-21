import { Hono } from 'hono';

const mcpRouter = new Hono();

// MCP Discovery endpoint — describes API capabilities for AI agents
mcpRouter.get('/mcp', async (c) => {
  return c.json({
    name: 'fenice',
    version: '0.1.0',
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
      'FENICE is an AI-native REST API. Use the tools above to interact with authentication and user management. All tool calls map to REST endpoints. Authentication required for user operations — obtain tokens via auth_login first.',
  });
});

export { mcpRouter };
