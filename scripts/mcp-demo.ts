/* eslint-disable no-console -- this is a CLI demo where console output is the primary UX */
/**
 * MCP demo client — connects to FENICE's POST /api/v1/mcp/rpc and
 * exercises the read-only tool surface.
 *
 * Usage:
 *   npx tsx scripts/mcp-demo.ts <jwt-token> [base-url]
 *
 * Requires a JWT for a user with role >= agent. Generate one by signing
 * up + logging in via /api/v1/auth, or by minting one with JWT_SECRET
 * for testing.
 *
 * Watch the 3D world client at the same time — you should see:
 *   - an agent.connected delta land (probe appears in the cosmos)
 *   - agent.activity deltas with started → completed (probe pulses busy)
 */

interface RpcResponse {
  jsonrpc: '2.0';
  id: number;
  result?: unknown;
  error?: { code: number; message: string };
}

async function rpc(
  baseUrl: string,
  token: string,
  body: Record<string, unknown>,
  sessionId?: string
): Promise<RpcResponse> {
  const headers: Record<string, string> = {
    'content-type': 'application/json',
    authorization: `Bearer ${token}`,
  };
  if (sessionId) headers['mcp-session-id'] = sessionId;

  const res = await fetch(`${baseUrl}/api/v1/mcp/rpc`, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`HTTP ${res.status}: ${await res.text()}`);
  }

  return res.json() as Promise<RpcResponse>;
}

function printResult(label: string, response: RpcResponse): void {
  if (response.error) {
    console.error(`  ✗ ${label}: ${response.error.code} ${response.error.message}`);
  } else {
    console.log(`  ✓ ${label}:`);
    console.log(JSON.stringify(response.result, null, 2));
  }
}

async function main(): Promise<void> {
  const token = process.argv[2];
  const baseUrl = process.argv[3] ?? 'http://localhost:3000';

  if (!token) {
    console.error('Usage: tsx scripts/mcp-demo.ts <jwt-token> [base-url]');
    process.exit(1);
  }

  console.log(`Connecting to ${baseUrl} ...`);

  // 1) initialize
  const initResponse = await rpc(baseUrl, token, {
    jsonrpc: '2.0',
    id: 1,
    method: 'initialize',
    params: {
      protocolVersion: '2025-03-26',
      clientInfo: { name: 'demo-bot', version: '0.1.0' },
      agentRole: 'monitor',
    },
  });
  if (initResponse.error || !initResponse.result) {
    throw new Error(`initialize failed: ${JSON.stringify(initResponse.error)}`);
  }
  const initResult = initResponse.result as { sessionId: string; serverInfo: { name: string } };
  const sessionId = initResult.sessionId;
  console.log(`  ✓ initialized — session=${sessionId}, server=${initResult.serverInfo.name}`);
  console.log('');

  // 2) tools/list
  const listResponse = await rpc(
    baseUrl,
    token,
    { jsonrpc: '2.0', id: 2, method: 'tools/list' },
    sessionId
  );
  printResult('tools/list', listResponse);
  console.log('');

  // 3) tools/call check_health
  const healthResponse = await rpc(
    baseUrl,
    token,
    {
      jsonrpc: '2.0',
      id: 3,
      method: 'tools/call',
      params: { name: 'check_health', arguments: {} },
    },
    sessionId
  );
  printResult('check_health', healthResponse);
  console.log('');

  // 4) tools/call list_endpoints
  const endpointsResponse = await rpc(
    baseUrl,
    token,
    {
      jsonrpc: '2.0',
      id: 4,
      method: 'tools/call',
      params: { name: 'list_endpoints', arguments: { method: 'GET' } },
    },
    sessionId
  );
  printResult('list_endpoints (method=GET)', endpointsResponse);
  console.log('');

  // 5) tools/call list_agents — should include this demo bot itself
  const agentsResponse = await rpc(
    baseUrl,
    token,
    {
      jsonrpc: '2.0',
      id: 5,
      method: 'tools/call',
      params: { name: 'list_agents', arguments: {} },
    },
    sessionId
  );
  printResult('list_agents', agentsResponse);
  console.log('');

  console.log('Demo complete. Check the 3D world client to see the agent presence.');
}

main().catch((err: unknown) => {
  console.error('FATAL:', err);
  process.exit(1);
});
