import { describe, it, expect, beforeEach, vi } from 'vitest';
import jwt from 'jsonwebtoken';

// Must mock env BEFORE importing the app — the auth middleware lazy-inits the secret.
vi.mock('../../src/config/env.js', () => ({
  loadEnv: () => ({ JWT_SECRET: 'test-secret-key-for-mcp-rpc-testing' }),
}));

const TEST_SECRET = 'test-secret-key-for-mcp-rpc-testing';

const { app } = await import('../../src/index.js');
const { resetMcpServer } = await import('../../src/routes/mcp.routes.js');

function tokenFor(role: 'agent' | 'admin' | 'user'): string {
  return jwt.sign({ userId: 'u-1', email: 'a@b.com', role }, TEST_SECRET);
}

async function rpc(
  body: unknown,
  opts: { token?: string; sessionId?: string } = {}
): Promise<Response> {
  const headers: Record<string, string> = { 'content-type': 'application/json' };
  if (opts.token) headers['authorization'] = `Bearer ${opts.token}`;
  if (opts.sessionId) headers['mcp-session-id'] = opts.sessionId;
  return app.request('/api/v1/mcp/rpc', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

describe('POST /api/v1/mcp/rpc — JSON-RPC transport', () => {
  beforeEach(() => {
    resetMcpServer();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await rpc({
      jsonrpc: '2.0',
      id: 1,
      method: 'initialize',
      params: { protocolVersion: '2025-03-26', clientInfo: { name: 'x', version: '1' } },
    });
    expect(res.status).toBe(401);
  });

  it('rejects users below agent role', async () => {
    const res = await rpc(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: { protocolVersion: '2025-03-26', clientInfo: { name: 'x', version: '1' } },
      },
      { token: tokenFor('user') }
    );
    expect(res.status).toBe(403);
  });

  it('full flow: initialize → tools/list → tools/call check_health', async () => {
    const token = tokenFor('agent');

    const initRes = await rpc(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          clientInfo: { name: 'demo-bot', version: '0.1.0' },
          agentRole: 'monitor',
        },
      },
      { token }
    );
    expect(initRes.status).toBe(200);
    const initBody = (await initRes.json()) as {
      result: { sessionId: string; serverInfo: { name: string } };
    };
    expect(initBody.result.serverInfo.name).toBe('fenice');
    const sessionId = initBody.result.sessionId;
    expect(sessionId).toMatch(/^[0-9a-f-]{36}$/);

    const listRes = await rpc(
      { jsonrpc: '2.0', id: 2, method: 'tools/list' },
      { token, sessionId }
    );
    const listBody = (await listRes.json()) as { result: { tools: { name: string }[] } };
    expect(listBody.result.tools.length).toBe(10);

    const callRes = await rpc(
      {
        jsonrpc: '2.0',
        id: 3,
        method: 'tools/call',
        params: { name: 'check_health', arguments: {} },
      },
      { token, sessionId }
    );
    const callBody = (await callRes.json()) as {
      result: { content: { data: { status: string } }[] };
    };
    expect(callBody.result.content[0]?.data.status).toBeDefined();
  });

  it('returns parse error for malformed JSON body', async () => {
    const res = await app.request('/api/v1/mcp/rpc', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        authorization: `Bearer ${tokenFor('agent')}`,
      },
      body: '{not json',
    });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32700);
  });

  it('returns NOT_INITIALIZED for tools/call without prior initialize', async () => {
    const res = await rpc(
      {
        jsonrpc: '2.0',
        id: 1,
        method: 'tools/call',
        params: { name: 'check_health', arguments: {} },
      },
      { token: tokenFor('agent'), sessionId: 'never-issued' }
    );
    const body = (await res.json()) as { error: { code: number } };
    expect(body.error.code).toBe(-32003);
  });
});
