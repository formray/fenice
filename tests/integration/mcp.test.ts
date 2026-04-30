import { describe, it, expect, beforeEach } from 'vitest';
import { app } from '../../src/index.js';
import { resetMcpServer } from '../../src/routes/mcp.routes.js';

describe('MCP Discovery Endpoint (legacy GET /api/v1/mcp)', () => {
  beforeEach(() => {
    resetMcpServer();
  });

  it('returns capability advertisement', async () => {
    const res = await app.request('/api/v1/mcp');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { name: string; transport: { jsonrpc: string } };
    expect(body.name).toBe('fenice');
    expect(body.transport.jsonrpc).toBe('POST /api/v1/mcp/rpc');
  });

  it('lists the operational tools from the dispatcher registry', async () => {
    const res = await app.request('/api/v1/mcp');
    const body = (await res.json()) as { tools: { name: string }[] };
    const toolNames = body.tools.map((t) => t.name);

    // Read-only tools available to any role >= agent
    expect(toolNames).toContain('list_endpoints');
    expect(toolNames).toContain('get_schema');
    expect(toolNames).toContain('check_health');
    expect(toolNames).toContain('list_agents');
    expect(toolNames).toContain('query_logs');
    expect(toolNames).toContain('builder_get_job');
    expect(toolNames).toContain('builder_list_jobs');

    // Mutating / admin tools
    expect(toolNames).toContain('create_endpoint');
    expect(toolNames).toContain('modify_endpoint');
    expect(toolNames).toContain('run_tests');

    expect(body.tools.length).toBe(10);
  });

  it('includes the OpenAPI resource', async () => {
    const res = await app.request('/api/v1/mcp');
    const body = (await res.json()) as { resources: { uri: string }[] };
    const uris = body.resources.map((r) => r.uri);
    expect(uris).toContain('fenice://docs/openapi');
  });
});
