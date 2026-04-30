# M7 MCP Live — Implementation Plan

> **Date:** 2026-04-30
> **Status:** In progress
> **Author:** Giuseppe Albrizio + Claude Opus 4.7 (1M context)
> **Depends on:** v0.4.0 (M5 Builder v2 + M6 Cosmos)

---

## 1. Goal

Replace the static MCP discovery manifest at `GET /api/v1/mcp` with an **operational MCP server** that:

1. Exposes the existing FENICE capabilities to AI agents via JSON-RPC 2.0
2. Tracks connected agents as first-class entities
3. Surfaces agent activity in the 3D cosmos via WebSocket deltas

This is the first **bridge milestone** between the 3D track (M4 + M6) and the Agent track (M3 + M5). It demands changes in both server and client.

## 2. Design decisions

### 2.1 Transport: JSON-RPC 2.0 over HTTP + SSE (no SDK lock-in)

We implement the MCP wire protocol directly using Hono routes and Zod-validated message schemas, instead of pulling in `@modelcontextprotocol/sdk` as a dependency.

**Reasoning:**
- The MCP spec is just JSON-RPC 2.0 with reserved method names (`initialize`, `tools/list`, `tools/call`, `resources/list`, etc.). Implementing it manually is ~200 lines and gives us full control.
- The official SDK targets Express / raw Node.js handlers; bridging into Hono's `Request`/`Response` API requires an adapter that's more code than the protocol itself.
- We already use Zod for everything else — keeping the same source-of-truth pattern is cleaner.
- We can adopt the SDK later (e.g., for stdio transport in CLI scenarios) without breaking anything: the protocol is identical.

**Endpoints:**
- `POST /api/v1/mcp/rpc` — JSON-RPC request/response (single round-trip calls)
- `GET /api/v1/mcp/sse` — Server-Sent Events stream (server-initiated notifications: `notifications/progress`, `tools/list_changed`, etc.)
- `GET /api/v1/mcp` — kept as legacy capability discovery; deprecated in v0.5

### 2.2 Authentication: JWT + new `agent` RBAC role

MCP itself is transport-agnostic about auth. We layer the existing JWT bearer middleware in front of the MCP routes.

**New RBAC role:** `agent`. Inserted into the existing 6-level hierarchy (see [src/middleware/rbac.ts](../../src/middleware/rbac.ts)).

Hierarchy proposal (ascending privilege):
1. `user`
2. `vendor`
3. `client`
4. `agent` *(new — between human role tiers and trusted operators)*
5. `employee`
6. `admin`
7. `superAdmin`

**Tool access matrix:**
| Tool | Min role | Notes |
|------|----------|-------|
| `list_endpoints` | `agent` | Read-only |
| `get_schema` | `agent` | Read-only |
| `check_health` | `agent` | Read-only |
| `list_agents` | `agent` | Read-only |
| `query_logs` | `agent` | Limited window (last 200 records) |
| `create_endpoint` | `admin` | Delegates to existing builder pipeline (plan-approve gate) |
| `modify_endpoint` | `admin` | Same |

The mutating tools are *registered* in M7.1 but their handlers return `errors.MethodNotImplemented` until M7.b delegates them to the builder. Safer to ship the surface first.

### 2.3 Agent identity

Each connected agent issues `initialize` with `clientInfo.name` + `clientInfo.version` (per MCP spec). We mint a session ID server-side. The session ID is a UUID v4 returned in the `initialize` response and required on subsequent calls via `Mcp-Session-Id` header.

**Session model (in-memory):**
```ts
interface AgentSession {
  id: string;                      // UUID v4
  name: string;                    // from clientInfo.name
  version: string;                 // from clientInfo.version
  role: AgentRole;                 // 'generator' | 'reviewer' | 'tester' | 'monitor' | 'generic'
  userId: string;                  // owning JWT user
  capabilities: string[];          // self-declared
  status: 'connected' | 'idle' | 'busy' | 'disconnected';
  connectedAt: Date;
  lastSeenAt: Date;
  currentTool?: string;
  currentTarget?: { type: 'service' | 'endpoint'; id: string };
}
```

In-memory because sessions are ephemeral. If the server restarts, agents reconnect. No persistence needed for v1. (Phase M11 may persist some metadata for team workspaces.)

### 2.4 Tool implementations — selection rationale

5 read-only tools picked for M7.1 because they are **fully serviceable by existing infrastructure** with zero new business logic:

- `list_endpoints` → reuse `ProjectionService` from M2 (already converts OpenAPI → WorldModel)
- `get_schema` → reuse `app.getOpenAPI31Document()` + path lookup
- `check_health` → proxy to `/health/detailed`
- `list_agents` → reads from `SessionManager`
- `query_logs` → in-memory ring buffer of last 200 Pino records (new tiny utility)

Mutating tools (`create_endpoint`, `modify_endpoint`) are deferred because they require:
- Delegating to the existing two-phase builder (which has its own approval gate)
- Long-running async semantics (MCP `notifications/progress` for streaming back to the agent)
- Careful scope policy interaction

These come in a follow-up M7.b once M7.1+M7.2+M7.3 are stable.

### 2.5 Agent presence as world deltas

Every agent lifecycle and tool call emits a delta event on the existing `world-ws` channel, consumed by the 3D client.

**New delta event types** (extend the existing discriminated union in [src/schemas/world-delta.schema.ts](../../src/schemas/world-delta.schema.ts) — currently 9 types, becomes 12):

```ts
type AgentConnectedDelta = {
  type: 'agent.connected';
  agentId: string;
  name: string;
  role: AgentRole;
};

type AgentDisconnectedDelta = {
  type: 'agent.disconnected';
  agentId: string;
};

type AgentActivityDelta = {
  type: 'agent.activity';
  agentId: string;
  tool: string;
  target?: { type: 'service' | 'endpoint'; id: string };
  status: 'started' | 'completed' | 'failed';
  durationMs?: number;
};
```

Activity deltas are throttled at the session-manager level: **max 10 events/sec per agent**. Beyond that, `agent.activity` events are dropped (the broadcast still goes through; we just rate-limit the *visualization*).

## 3. Phase breakdown

### M7.1 — Operational MCP server (server-only)

**Scope:**
- Schemas: `src/schemas/mcp.schema.ts` (JSON-RPC envelope, MCP method names, tool definitions)
- Service: `src/services/mcp/server.ts` (request dispatcher, tool registry)
- Service: `src/services/mcp/tools/*.ts` (5 read-only tools)
- Service: `src/services/mcp/log-buffer.ts` (in-memory ring for `query_logs`)
- Routes: `POST /api/v1/mcp/rpc` (replaces static manifest behind feature flag)
- RBAC: add `agent` role
- Auth: lazy JWT verify on the new routes
- Tests: unit per tool, integration for the JSON-RPC dispatcher
- Legacy `GET /api/v1/mcp` retained (returns capabilities advertisement)

**Done definition:**
- Tools `tools/list` returns 7 tool descriptors (5 active + 2 stubbed mutators)
- `tools/call` for any of the 5 read-only tools returns valid responses
- Unauthenticated requests get `401`; non-`agent` roles get `403`
- Test coverage: ≥ 90% for `services/mcp/`

### M7.2 — Agent sessions + world deltas

**Scope:**
- Schema: `src/schemas/agent.schema.ts` (`AgentSession`, `AgentRole`)
- Service: `src/services/mcp/session-manager.ts` (in-memory map, heartbeat 30s, TTL cleanup, throttle)
- Schema extension: 3 new event types in `world-delta.schema.ts`
- Wiring: `mcp/server.ts` calls `sessionManager.recordActivity()` before/after each tool dispatch; SessionManager emits to `WorldWsManager.broadcast()`
- Route: `GET /api/v1/agents` (admin-only) — list active sessions
- Tests: TTL/heartbeat behaviour, delta emission, throttle correctness

**Done definition:**
- Connecting an MCP client triggers `agent.connected` delta visible in world-ws snapshot
- Calling a tool triggers `agent.activity` deltas with `started` and `completed/failed`
- Idle sessions (no heartbeat for 90s) are cleaned up and emit `agent.disconnected`
- Throttle drops events beyond 10/sec/agent (verified by unit test)

### M7.3 — Agent presence in 3D cosmos (client)

**Scope:**
- Type: `client/src/types/world.ts` add `AgentEntity`
- Store: `client/src/stores/agent.store.ts` (Map<id, AgentEntity>, reducer for the 3 new deltas)
- World store reducer extension: forward `agent.*` deltas to the agent store
- Component: `client/src/components/AgentEntity.tsx` (low-poly probe geometry, role-based color)
- Component: `client/src/components/ActivityBeam.tsx` (animated tube from agent → target planet, 2.5s fade)
- HUD: `client/src/components/AgentPanel.tsx` (list of connected agents)
- HUD: `client/src/components/ActivityFeed.tsx` (rolling log of last 20 events)
- Tests: store reducer, AgentEntity render, ActivityFeed pruning

**Role colors** (decided here so 3D and HUD stay consistent):
| Role | Color | Hex |
|------|-------|-----|
| `generator` | cyan | `#00f5ff` |
| `reviewer` | magenta | `#ff00aa` |
| `tester` | amber | `#ff8800` |
| `monitor` | violet | `#aa55ff` |
| `generic` | white | `#e0f0ff` |

### M7.4 — Integration + release

**Scope:**
- E2E demo script `scripts/mcp-demo.ts` — connects via JSON-RPC, registers as `monitor`, calls `list_endpoints` and `check_health`
- Doc: `docs/MCP_QUICKSTART.md` with curl examples and expected responses
- ROADMAP: M7 → Done
- CHANGELOG: M7 entry under `[Unreleased]`
- Final PR

## 4. Non-goals (explicit exclusions)

- ❌ stdio transport (HTTP/SSE only for v1)
- ❌ Multi-agent orchestration (M9)
- ❌ A2A communication (M9)
- ❌ Persistent agent registry (M11)
- ❌ Real OTel data feeding the cosmos (M8)
- ❌ Mutating tools wired to the builder (M7.b follow-up)
- ❌ Agent-issued PR approval (would need separate auth model)

## 5. Risks & mitigations

| Risk | Likelihood | Mitigation |
|------|------------|------------|
| MCP spec evolves before we ship the SDK migration | Medium | Spec is stable in 2026; we'll adopt SDK in M11 |
| SSE on Hono — node-server compatibility | Medium | Verified `@hono/node-server` supports streaming; fallback: long-polling |
| Adding `agent` to RBAC enum breaks existing tests | Low | Run full suite; the role enum has 12 references in tests, all using `admin`/`user` literals |
| Tool dispatch async errors crash the JSON-RPC handler | Low | Explicit try/catch around every tool invocation, mapped to JSON-RPC error codes |
| Activity deltas overwhelm world-ws ring buffer | Medium | Throttle at 10/s/agent + existing ring buffer (1000 events) |

## 6. Environment variables (new)

```
MCP_ENABLED=true                       # feature flag
MCP_SESSION_HEARTBEAT_MS=30000         # client heartbeat interval expectation
MCP_SESSION_TTL_MS=90000               # cleanup orphans after this
MCP_ACTIVITY_THROTTLE_PER_SEC=10       # max activity deltas per agent per sec
MCP_LOG_BUFFER_SIZE=200                # records kept for query_logs
```

## 7. Out-of-scope but worth flagging

- The legacy `GET /api/v1/mcp` static manifest will still work in v0.4.x. We deprecate it in CHANGELOG and remove it in v0.5.0. The new JSON-RPC dispatcher exposes the same information via the standard `tools/list` and `resources/list` methods — agents migrating to the new endpoint don't lose anything.
