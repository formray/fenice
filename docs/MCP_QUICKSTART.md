# MCP Quickstart — Connecting an Agent to FENICE

> Status: M7.1 + M7.2 + M7.3 (read-only tool surface, agent presence in cosmos)

FENICE speaks the [Model Context Protocol](https://modelcontextprotocol.io)
over JSON-RPC 2.0. Any agent that can do an authenticated HTTP POST can
connect, discover the FENICE capabilities, and stream presence into the
3D cosmos.

## 1. Get a token

You need a JWT for a user with role `agent`, `admin`, or `superAdmin`.

```bash
# Sign up (first-time setup)
curl -X POST http://localhost:3000/api/v1/auth/signup \
  -H 'content-type: application/json' \
  -d '{"email":"agent@example.com","username":"agent","fullName":"Agent","password":"SuperSecret1!"}'

# Promote that user to role=agent in the database (Mongo shell):
#   db.users.updateOne({ email: 'agent@example.com' }, { $set: { role: 'agent' } })

# Log in to get an access token
curl -X POST http://localhost:3000/api/v1/auth/login \
  -H 'content-type: application/json' \
  -d '{"email":"agent@example.com","password":"SuperSecret1!"}'
# -> { tokens: { access: "eyJ..." } }
```

For development, the seed admin (`admin@formray.io`) already has the
`admin` role and can call all MCP routes.

## 2. Initialize a session

```bash
TOKEN="eyJ..."

curl -X POST http://localhost:3000/api/v1/mcp/rpc \
  -H "authorization: Bearer $TOKEN" \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2025-03-26",
      "clientInfo": { "name": "my-bot", "version": "0.1.0" },
      "agentRole": "monitor"
    }
  }'
```

Response:

```json
{
  "jsonrpc": "2.0",
  "id": 1,
  "result": {
    "protocolVersion": "2025-03-26",
    "serverInfo": { "name": "fenice", "version": "0.4.0" },
    "capabilities": { "tools": { "listChanged": false }, "resources": { "listChanged": false } },
    "sessionId": "0e12a3b4-..."
  }
}
```

Save the `sessionId` — every subsequent call must include it as the
`Mcp-Session-Id` header.

## 3. Call a tool

```bash
SESSION="0e12a3b4-..."

curl -X POST http://localhost:3000/api/v1/mcp/rpc \
  -H "authorization: Bearer $TOKEN" \
  -H "mcp-session-id: $SESSION" \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/call",
    "params": { "name": "check_health", "arguments": {} }
  }'
```

## Available tools (M7 complete — 10 total)

### Read-only (role >= agent)

| Tool                | Description                                                                                            |
| ------------------- | ------------------------------------------------------------------------------------------------------ |
| `list_endpoints`    | API surface (filter by service or method)                                                              |
| `get_schema`        | OpenAPI operation for a (path, method)                                                                 |
| `check_health`      | Same payload as GET /health/detailed                                                                   |
| `list_agents`       | Active MCP sessions                                                                                    |
| `query_logs`        | Search the in-memory ring buffer (last 200 records)                                                    |
| `builder_get_job`   | Status, plan, and result of a builder job by id                                                        |
| `builder_list_jobs` | Paginated list of builder jobs with optional status filter                                             |

### Mutating (role >= admin)

| Tool              | Description                                                                                                |
| ----------------- | ---------------------------------------------------------------------------------------------------------- |
| `create_endpoint` | Triggers a builder job. Returns `jobId`. Plan must be approved by a human before code is generated.       |
| `modify_endpoint` | Same as above but the prompt is enriched with the target path/method.                                      |
| `run_tests`       | Runs `npm run validate` (typecheck + lint + test) and returns per-step pass/fail with truncated output.    |

## Available resources

- `fenice://docs/openapi` — full OpenAPI 3.1 JSON specification

```bash
curl -X POST http://localhost:3000/api/v1/mcp/rpc \
  -H "authorization: Bearer $TOKEN" \
  -H "mcp-session-id: $SESSION" \
  -H 'content-type: application/json' \
  -d '{
    "jsonrpc": "2.0",
    "id": 3,
    "method": "resources/read",
    "params": { "uri": "fenice://docs/openapi" }
  }'
```

## 3D presence

When you `initialize`, FENICE emits an `agent.connected` delta on the
world WebSocket channel. The 3D client renders your agent as a glowing
octahedron probe orbiting near the cosmos rim, color-coded by role:

| Role        | Color     |
| ----------- | --------- |
| `generator` | cyan      |
| `reviewer`  | magenta   |
| `tester`    | amber     |
| `monitor`   | violet    |
| `generic`   | white     |

Every `tools/call` emits an `agent.activity` event with status
`started` / `completed` / `failed`. The probe pulses while busy and the
HUD's Agent Panel surfaces the current tool and a rolling 20-event feed.

## Demo script

A ready-made TypeScript demo is in [`scripts/mcp-demo.ts`](../scripts/mcp-demo.ts):

```bash
npx tsx scripts/mcp-demo.ts <your-jwt> http://localhost:3000
```

Watch the 3D client at the same time to see the agent appear, orbit,
and pulse as the demo calls each tool.

## Configuration

Environment variables relevant to the MCP server:

| Variable                         | Default | Description                                                |
| -------------------------------- | ------- | ---------------------------------------------------------- |
| `MCP_ENABLED`                    | `true`  | Set to `false` to return 503 on `/mcp/rpc`                 |
| `MCP_SESSION_TTL_MS`             | 90000   | Sessions inactive beyond this are dropped                  |
| `MCP_ACTIVITY_THROTTLE_PER_SEC`  | 10      | Max activity deltas per agent per second                   |
| `MCP_LOG_BUFFER_SIZE`            | 200     | Records kept for the `query_logs` tool                     |

## Roadmap

- **M8 Observability** — `query_logs` and a new `get_metrics` tool powered
  by real OTel data, planet heatmaps reflect endpoint health, anomaly
  detection with visual alerts in the cosmos
- **M9 Agent Swarm** — multi-agent orchestration (Generator, Reviewer,
  Tester, Monitor) with A2A communication via the FENICE hub
