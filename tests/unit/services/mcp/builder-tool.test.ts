import { describe, it, expect, beforeEach } from 'vitest';
import { McpServer } from '../../../../src/services/mcp/server.js';
import { SessionManager } from '../../../../src/services/mcp/session-manager.js';
import { LogRingBuffer } from '../../../../src/services/mcp/log-buffer.js';
import type { McpToolContext, CallerIdentity } from '../../../../src/services/mcp/types.js';

interface FakeJob {
  _id: { toString(): string };
  toJSON(): unknown;
}

class FakeBuilderService {
  generateCalls: { prompt: string; userId: string; options?: unknown }[] = [];
  getJobCalls: string[] = [];
  listJobsCalls: { filter: Record<string, unknown>; opts: unknown }[] = [];
  shouldThrow = false;

  async generate(prompt: string, userId: string, options?: unknown): Promise<FakeJob> {
    this.generateCalls.push({ prompt, userId, ...(options !== undefined ? { options } : {}) });
    if (this.shouldThrow) throw new Error('builder boom');
    return {
      _id: { toString: () => 'job-fake-id' },
      toJSON: () => ({ id: 'job-fake-id', status: 'queued', prompt }),
    };
  }

  async getJob(jobId: string): Promise<FakeJob> {
    this.getJobCalls.push(jobId);
    return {
      _id: { toString: () => jobId },
      toJSON: () => ({ id: jobId, status: 'plan_ready', prompt: 'whatever' }),
    };
  }

  async listJobs(
    filter: Record<string, unknown>,
    opts: { cursor?: string; limit?: number }
  ): Promise<{
    data: FakeJob[];
    pagination: { hasNext: boolean; nextCursor: string | null };
  }> {
    this.listJobsCalls.push({ filter, opts });
    return {
      data: [
        {
          _id: { toString: () => 'job-1' },
          toJSON: () => ({ id: 'job-1', status: 'completed' }),
        },
      ],
      pagination: { hasNext: false, nextCursor: null },
    };
  }
}

function buildContext(
  sessionManager: SessionManager,
  builder: FakeBuilderService | null,
  validatorImpl?: McpToolContext['runValidator']
): McpToolContext {
  const ctx: McpToolContext = {
    getOpenApiDocument: () => ({ openapi: '3.1.0', info: {}, paths: {} }),
    getHealthSummary: async () => ({
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: 0,
      mongo: 'ok',
    }),
    listAgentSessions: () => sessionManager.list(),
    logBuffer: new LogRingBuffer(50),
  };
  if (builder) {
    ctx.getBuilderService = () =>
      builder as unknown as ReturnType<NonNullable<McpToolContext['getBuilderService']>>;
  }
  if (validatorImpl) {
    ctx.runValidator = validatorImpl;
  }
  return ctx;
}

async function initialize(server: McpServer, role: 'agent' | 'admin' = 'admin'): Promise<string> {
  const res = await server.dispatch(
    {
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: {
        protocolVersion: '2025-03-26',
        clientInfo: { name: 'test-bot', version: '0.1.0' },
        agentRole: 'generic',
      },
    },
    { userId: 'u1', userRole: role } satisfies CallerIdentity
  );
  if (!('result' in res)) throw new Error('init failed');
  return (res.result as { sessionId: string }).sessionId;
}

describe('Builder MCP tools', () => {
  let server: McpServer;
  let sessionManager: SessionManager;
  let builder: FakeBuilderService;
  const adminCaller = (sessionId: string): CallerIdentity => ({
    sessionId,
    userId: 'u1',
    userRole: 'admin',
  });
  const agentCaller = (sessionId: string): CallerIdentity => ({
    sessionId,
    userId: 'u1',
    userRole: 'agent',
  });

  beforeEach(() => {
    sessionManager = new SessionManager(() => null, {
      ttlMs: 60_000,
      throttlePerSec: 100,
      cleanupIntervalMs: 60_000,
    });
    builder = new FakeBuilderService();
    server = new McpServer(buildContext(sessionManager, builder), sessionManager);
  });

  describe('create_endpoint', () => {
    it('rejects callers below admin', async () => {
      const sessionId = await initialize(server, 'agent');
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'create_endpoint',
            arguments: { prompt: 'add a thing endpoint that returns hello' },
          },
        },
        agentCaller(sessionId)
      );
      expect(res).toMatchObject({ error: { code: -32002 } });
    });

    it('delegates to BuilderService.generate and returns the jobId', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'create_endpoint',
            arguments: {
              prompt: 'add a /things endpoint that returns the list of things',
              options: { dryRun: true },
            },
          },
        },
        adminCaller(sessionId)
      );
      if (!('result' in res)) throw new Error('expected result');
      const result = res.result as { content: { data: { jobId: string } }[]; isError: boolean };
      expect(result.isError).toBe(false);
      expect(result.content[0]?.data.jobId).toBe('job-fake-id');
      expect(builder.generateCalls).toHaveLength(1);
      expect(builder.generateCalls[0]?.userId).toBe('u1');
      expect(builder.generateCalls[0]?.prompt).toContain('/things');
    });

    it('returns isError when prompt is too short', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'create_endpoint', arguments: { prompt: 'short' } },
        },
        adminCaller(sessionId)
      );
      if (!('result' in res)) throw new Error('expected result');
      expect((res.result as { isError: boolean }).isError).toBe(true);
    });

    it('returns isError when builder throws', async () => {
      builder.shouldThrow = true;
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'create_endpoint',
            arguments: { prompt: 'add a normal length endpoint description' },
          },
        },
        adminCaller(sessionId)
      );
      if (!('result' in res)) throw new Error('expected result');
      expect((res.result as { isError: boolean }).isError).toBe(true);
    });

    it('returns isError when builder service is unavailable', async () => {
      const ctxNoBuilder = buildContext(sessionManager, null);
      const noBuilderServer = new McpServer(ctxNoBuilder, sessionManager);
      const sessionId = await initialize(noBuilderServer);
      const res = await noBuilderServer.dispatch(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'create_endpoint',
            arguments: { prompt: 'add a normal length endpoint description' },
          },
        },
        adminCaller(sessionId)
      );
      if (!('result' in res)) throw new Error('expected result');
      expect((res.result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('modify_endpoint', () => {
    it('enriches prompt with target path and method', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'modify_endpoint',
            arguments: {
              path: '/api/v1/users/{id}',
              method: 'patch',
              prompt: 'allow updating the avatar URL',
            },
          },
        },
        adminCaller(sessionId)
      );
      if (!('result' in res)) throw new Error('expected result');
      expect(builder.generateCalls).toHaveLength(1);
      expect(builder.generateCalls[0]?.prompt).toContain('PATCH /api/v1/users/{id}');
      expect(builder.generateCalls[0]?.prompt).toContain('allow updating the avatar URL');
    });

    it('requires path and prompt', async () => {
      const sessionId = await initialize(server);
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'modify_endpoint', arguments: { prompt: 'do a thing' } },
        },
        adminCaller(sessionId)
      );
      if (!('result' in res)) throw new Error('expected result');
      expect((res.result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('builder_get_job (agent role)', () => {
    it('returns the job document', async () => {
      const sessionId = await initialize(server, 'agent');
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'builder_get_job', arguments: { jobId: 'abc' } },
        },
        agentCaller(sessionId)
      );
      if (!('result' in res)) throw new Error('expected result');
      const result = res.result as { content: { data: { id: string } }[]; isError: boolean };
      expect(result.isError).toBe(false);
      expect(result.content[0]?.data.id).toBe('abc');
      expect(builder.getJobCalls).toEqual(['abc']);
    });

    it('errors when jobId missing', async () => {
      const sessionId = await initialize(server, 'agent');
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: { name: 'builder_get_job', arguments: {} },
        },
        agentCaller(sessionId)
      );
      if (!('result' in res)) throw new Error('expected result');
      expect((res.result as { isError: boolean }).isError).toBe(true);
    });
  });

  describe('builder_list_jobs (agent role)', () => {
    it('returns paginated jobs', async () => {
      const sessionId = await initialize(server, 'agent');
      const res = await server.dispatch(
        {
          jsonrpc: '2.0',
          id: 2,
          method: 'tools/call',
          params: {
            name: 'builder_list_jobs',
            arguments: { status: 'completed', limit: 10 },
          },
        },
        agentCaller(sessionId)
      );
      if (!('result' in res)) throw new Error('expected result');
      const result = res.result as {
        content: { data: { count: number; jobs: { id: string }[] } }[];
        isError: boolean;
      };
      expect(result.isError).toBe(false);
      expect(result.content[0]?.data.count).toBe(1);
      expect(builder.listJobsCalls[0]?.filter).toEqual({ status: 'completed' });
    });
  });
});

describe('run_tests tool', () => {
  let server: McpServer;
  let sessionManager: SessionManager;

  beforeEach(() => {
    sessionManager = new SessionManager(() => null, {
      ttlMs: 60_000,
      throttlePerSec: 100,
      cleanupIntervalMs: 60_000,
    });
  });

  it('rejects callers below admin', async () => {
    server = new McpServer(buildContext(sessionManager, null), sessionManager);
    const sessionId = await initialize(server, 'agent');
    const res = await server.dispatch(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'run_tests', arguments: {} },
      },
      { sessionId, userId: 'u1', userRole: 'agent' } satisfies CallerIdentity
    );
    expect(res).toMatchObject({ error: { code: -32002 } });
  });

  it('returns isError when validator missing from context', async () => {
    server = new McpServer(buildContext(sessionManager, null), sessionManager);
    const sessionId = await initialize(server);
    const res = await server.dispatch(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'run_tests', arguments: {} },
      },
      { sessionId, userId: 'u1', userRole: 'admin' } satisfies CallerIdentity
    );
    if (!('result' in res)) throw new Error('expected result');
    expect((res.result as { isError: boolean }).isError).toBe(true);
  });

  it('returns isError when at least one step failed', async () => {
    server = new McpServer(
      buildContext(sessionManager, null, async () => ({
        passed: false,
        durationMs: 12,
        steps: [
          { step: 'typecheck', passed: true, output: '' },
          { step: 'lint', passed: false, output: 'lint failure detail' },
          { step: 'test', passed: true, output: '' },
        ],
      })),
      sessionManager
    );
    const sessionId = await initialize(server);
    const res = await server.dispatch(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'run_tests', arguments: {} },
      },
      { sessionId, userId: 'u1', userRole: 'admin' } satisfies CallerIdentity
    );
    if (!('result' in res)) throw new Error('expected result');
    const result = res.result as {
      content: { data: { passed: boolean; steps: { step: string; passed: boolean }[] } }[];
      isError: boolean;
    };
    expect(result.isError).toBe(true);
    expect(result.content[0]?.data.passed).toBe(false);
    expect(result.content[0]?.data.steps).toHaveLength(3);
  });

  it('truncates long step output to 4k chars', async () => {
    const longOutput = 'x'.repeat(10_000);
    server = new McpServer(
      buildContext(sessionManager, null, async () => ({
        passed: false,
        durationMs: 1,
        steps: [{ step: 'test', passed: false, output: longOutput }],
      })),
      sessionManager
    );
    const sessionId = await initialize(server);
    const res = await server.dispatch(
      {
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: { name: 'run_tests', arguments: {} },
      },
      { sessionId, userId: 'u1', userRole: 'admin' } satisfies CallerIdentity
    );
    if (!('result' in res)) throw new Error('expected result');
    const result = res.result as {
      content: { data: { steps: { output: string }[] } }[];
    };
    expect(result.content[0]?.data.steps[0]?.output.length).toBe(4_000);
  });
});
