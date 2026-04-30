import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '../../../../src/services/mcp/server.js';
import { SessionManager } from '../../../../src/services/mcp/session-manager.js';
import { LogRingBuffer } from '../../../../src/services/mcp/log-buffer.js';
import type { McpToolContext, CallerIdentity } from '../../../../src/services/mcp/types.js';

const SAMPLE_OPENAPI = {
  openapi: '3.1.0',
  info: { title: 'Test', version: '1.0' },
  paths: {
    '/api/v1/health': {
      get: { tags: ['Health'], summary: 'Health check' },
    },
    '/api/v1/users': {
      get: { tags: ['Users'], summary: 'List users', security: [{ Bearer: [] }] },
      post: {
        tags: ['Users'],
        summary: 'Create user',
        security: [{ Bearer: [] }],
        requestBody: { content: {} },
      },
    },
    '/api/v1/users/{id}': {
      get: {
        tags: ['Users'],
        summary: 'Get user',
        security: [{ Bearer: [] }],
        parameters: [{ name: 'id', in: 'path', required: true }],
      },
    },
  },
};

function buildContext(
  sessionManager: SessionManager,
  overrides: Partial<McpToolContext> = {}
): McpToolContext {
  return {
    getOpenApiDocument: () => SAMPLE_OPENAPI,
    getHealthSummary: async () => ({
      status: 'ok',
      timestamp: '2026-04-30T00:00:00.000Z',
      uptime: 12.5,
      mongo: 'ok',
    }),
    listAgentSessions: () => sessionManager.list(),
    logBuffer: new LogRingBuffer(50),
    ...overrides,
  };
}

const TEST_CALLER: CallerIdentity = { userId: 'u1', userRole: 'agent' };

async function initialize(
  server: McpServer,
  caller: CallerIdentity = TEST_CALLER
): Promise<string> {
  const res = await server.dispatch(
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        clientInfo: { name: 'test-agent', version: '0.1.0' },
        agentRole: 'monitor',
      },
    },
    caller
  );
  if (!('result' in res)) throw new Error('initialize failed');
  return (res.result as { sessionId: string }).sessionId;
}

function buildServer(): { server: McpServer; sessionManager: SessionManager; ctx: McpToolContext } {
  const sessionManager = new SessionManager(() => null, {
    ttlMs: 60_000,
    throttlePerSec: 100,
    cleanupIntervalMs: 60_000,
  });
  const ctx = buildContext(sessionManager);
  const server = new McpServer(ctx, sessionManager);
  return { server, sessionManager, ctx };
}

describe('McpServer', () => {
  let server: McpServer;
  let sessionManager: SessionManager;
  let ctx: McpToolContext;

  beforeEach(() => {
    ({ server, sessionManager, ctx } = buildServer());
  });

  describe('protocol mechanics', () => {
    it('rejects malformed JSON-RPC requests', async () => {
      const res = await server.dispatch({ wrong: 'shape' }, null);
      expect(res).toMatchObject({
        jsonrpc: '2.0',
        error: { code: -32600, message: expect.any(String) as string },
      });
    });

    it('returns method-not-found for unknown methods after initialize', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch({ jsonrpc: '2.0', id: 2, method: 'totally/made_up' }, {
        sessionId,
        userId: 'u1',
        userRole: 'agent',
      } satisfies CallerIdentity);
      expect(res).toMatchObject({ error: { code: -32601 } });
    });

    it('responds to ping without requiring initialization', async () => {
      const res = await server.dispatch({ jsonrpc: '2.0', id: 99, method: 'ping' }, null);
      expect(res).toMatchObject({ jsonrpc: '2.0', id: 99, result: {} });
    });

    it('blocks tools/list before initialize', async () => {
      const res = await server.dispatch({ jsonrpc: '2.0', id: 1, method: 'tools/list' }, null);
      expect(res).toMatchObject({ error: { code: -32003 } });
    });

    it('initialize returns a session id and allows subsequent calls', async () => {
      const sessionId = await initialize(server);
      expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);

      const res = await server.dispatch({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, {
        sessionId,
        userId: 'u1',
        userRole: 'agent',
      } satisfies CallerIdentity);
      expect('result' in res).toBe(true);
    });
  });

  describe('tools/list', () => {
    it('returns 10 tools (5 read-only + 4 builder + run_tests)', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch({ jsonrpc: '2.0', id: 2, method: 'tools/list' }, {
        sessionId,
        userId: 'u1',
        userRole: 'agent',
      } satisfies CallerIdentity);
      if (!('result' in res)) throw new Error('expected result');
      const tools = (res.result as { tools: { name: string }[] }).tools;
      expect(tools).toHaveLength(10);
      expect(tools.map((t) => t.name).sort()).toEqual([
        'builder_get_job',
        'builder_list_jobs',
        'check_health',
        'create_endpoint',
        'get_schema',
        'list_agents',
        'list_endpoints',
        'modify_endpoint',
        'query_logs',
        'run_tests',
      ]);
    });
  });

  describe('list_endpoints tool', () => {
    it('returns all endpoints when no filter', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 3,
          method: 'tools/call',
          params: { name: 'list_endpoints', arguments: {} },
        },
        { sessionId, userId: 'u1', userRole: 'agent' } satisfies CallerIdentity
      );
      if (!('result' in res)) throw new Error('expected result');
      const result = res.result as { content: { data: { count: number } }[] };
      const first = result.content[0];
      if (!first) throw new Error('expected at least one content item');
      const data = first.data;
      expect(data.count).toBe(4);
    });

    it('filters by service tag', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 4,
          method: 'tools/call',
          params: { name: 'list_endpoints', arguments: { service: 'Users' } },
        },
        { sessionId, userId: 'u1', userRole: 'agent' } satisfies CallerIdentity
      );
      if (!('result' in res)) throw new Error('expected result');
      const result = res.result as { content: { data: { count: number } }[] };
      const first = result.content[0];
      if (!first) throw new Error('expected at least one content item');
      const data = first.data;
      expect(data.count).toBe(3);
    });

    it('filters by HTTP method', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 5,
          method: 'tools/call',
          params: { name: 'list_endpoints', arguments: { method: 'POST' } },
        },
        { sessionId, userId: 'u1', userRole: 'agent' } satisfies CallerIdentity
      );
      if (!('result' in res)) throw new Error('expected result');
      const result = res.result as { content: { data: { count: number } }[] };
      const first = result.content[0];
      if (!first) throw new Error('expected at least one content item');
      const data = first.data;
      expect(data.count).toBe(1);
    });
  });

  describe('get_schema tool', () => {
    it('returns the operation for an existing path/method', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 6,
          method: 'tools/call',
          params: {
            name: 'get_schema',
            arguments: { path: '/api/v1/users/{id}', method: 'GET' },
          },
        },
        { sessionId, userId: 'u1', userRole: 'agent' } satisfies CallerIdentity
      );
      if (!('result' in res)) throw new Error('expected result');
      const result = res.result as { content: { data: { operation: { summary: string } } }[] };
      const first = result.content[0];
      if (!first) throw new Error('expected content');
      expect(first.data.operation.summary).toBe('Get user');
    });

    it('returns isError for unknown path', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 7,
          method: 'tools/call',
          params: { name: 'get_schema', arguments: { path: '/does/not/exist' } },
        },
        { sessionId, userId: 'u1', userRole: 'agent' } satisfies CallerIdentity
      );
      if (!('result' in res)) throw new Error('expected result');
      expect((res.result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('check_health tool', () => {
    it('returns the health summary', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 8,
          method: 'tools/call',
          params: { name: 'check_health', arguments: {} },
        },
        { sessionId, userId: 'u1', userRole: 'agent' } satisfies CallerIdentity
      );
      if (!('result' in res)) throw new Error('expected result');
      const result = res.result as { content: { data: { status: string } }[] };
      const first = result.content[0];
      if (!first) throw new Error('expected health content');
      expect(first.data.status).toBe('ok');
    });

    it('marks isError when status is down', async () => {
      const downSessionManager = new SessionManager(() => null, {
        ttlMs: 60_000,
        throttlePerSec: 100,
        cleanupIntervalMs: 60_000,
      });
      const downCtx = buildContext(downSessionManager, {
        getHealthSummary: async () => ({
          status: 'down',
          timestamp: 'now',
          uptime: 0,
          mongo: 'down',
        }),
      });
      const downServer = new McpServer(downCtx, downSessionManager);
      const sessionId = await initialize(downServer);
      const res = await downServer.dispatch(
        {
          jsonrpc: '2.0',
          id: 9,
          method: 'tools/call',
          params: { name: 'check_health', arguments: {} },
        },
        { sessionId, userId: 'u1', userRole: 'agent' } satisfies CallerIdentity
      );
      if (!('result' in res)) throw new Error('expected result');
      expect((res.result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('query_logs tool', () => {
    it('returns records from the buffer', async () => {
      ctx.logBuffer.push({ timestamp: 't', level: 'info', message: 'hello', fields: {} });
      ctx.logBuffer.push({ timestamp: 't', level: 'error', message: 'boom', fields: {} });
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 10,
          method: 'tools/call',
          params: { name: 'query_logs', arguments: { level: 'error' } },
        },
        { sessionId, userId: 'u1', userRole: 'agent' } satisfies CallerIdentity
      );
      if (!('result' in res)) throw new Error('expected result');
      const result = res.result as { content: { data: { count: number } }[] };
      const first = result.content[0];
      if (!first) throw new Error('expected at least one content item');
      const data = first.data;
      expect(data.count).toBe(1);
    });
  });

  describe('list_agents tool', () => {
    it('returns the calling agent when only one session is registered', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 11,
          method: 'tools/call',
          params: { name: 'list_agents', arguments: {} },
        },
        { sessionId, userId: 'u1', userRole: 'agent' } satisfies CallerIdentity
      );
      if (!('result' in res)) throw new Error('expected result');
      const result = res.result as { content: { data: { count: number } }[] };
      const first = result.content[0];
      if (!first) throw new Error('expected at least one content item');
      const data = first.data;
      expect(data.count).toBe(1);
      expect(sessionManager.size()).toBe(1);
    });
  });

  describe('RBAC enforcement', () => {
    it('blocks create_endpoint for agent role (admin required)', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 12,
          method: 'tools/call',
          params: { name: 'create_endpoint', arguments: { prompt: 'create a foo endpoint' } },
        },
        { sessionId, userId: 'u1', userRole: 'agent' } satisfies CallerIdentity
      );
      expect(res).toMatchObject({ error: { code: -32002 } });
    });

    it('allows admin to invoke create_endpoint (returns stubbed not-implemented)', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 13,
          method: 'tools/call',
          params: { name: 'create_endpoint', arguments: { prompt: 'create a foo endpoint' } },
        },
        { sessionId, userId: 'u1', userRole: 'admin' } satisfies CallerIdentity
      );
      if (!('result' in res)) throw new Error('expected result');
      expect((res.result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('resources', () => {
    it('lists the OpenAPI resource', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch({ jsonrpc: '2.0', id: 14, method: 'resources/list' }, {
        sessionId,
        userId: 'u1',
        userRole: 'agent',
      } satisfies CallerIdentity);
      if (!('result' in res)) throw new Error('expected result');
      const resources = (res.result as { resources: { uri: string }[] }).resources;
      expect(resources.map((r) => r.uri)).toContain('fenice://docs/openapi');
    });

    it('reads the OpenAPI resource', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 15,
          method: 'resources/read',
          params: { uri: 'fenice://docs/openapi' },
        },
        { sessionId, userId: 'u1', userRole: 'agent' } satisfies CallerIdentity
      );
      if (!('result' in res)) throw new Error('expected result');
      const contents = (res.result as { contents: { text: string }[] }).contents;
      expect(contents).toHaveLength(1);
      const first = contents[0];
      if (!first) throw new Error('expected resource content');
      expect(JSON.parse(first.text)).toMatchObject({ openapi: '3.1.0' });
    });

    it('returns INVALID_PARAMS for unknown resource URI', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 16,
          method: 'resources/read',
          params: { uri: 'fenice://nope' },
        },
        { sessionId, userId: 'u1', userRole: 'agent' } satisfies CallerIdentity
      );
      expect(res).toMatchObject({ error: { code: -32602 } });
    });
  });
});
