# FENICE Roadmap

## Backend Foundation

### v0.1.0 — Foundation Layer ✅

- Hono + Zod OpenAPI routes (auth, users, health, MCP)
- JWT authentication with access/refresh tokens
- Mongoose v9 User model with bcrypt
- Adapter pattern (email, storage, messaging)
- OpenTelemetry auto-instrumentation
- MCP endpoint for AI agent discovery
- Scalar interactive docs + LLM-readable docs
- Vitest + fast-check testing
- Docker multi-stage build + docker-compose
- GitHub Actions CI pipeline
- Four-script development workflow

### v0.2.0 — Advanced Backend Features ✅

- WebSocket Support (Hono adapter + rooms + broadcast)
- Rate Limiting (configurable windows per endpoint)
- RBAC Middleware (6-level hierarchy)
- Chunked File Upload (init, chunk, complete, cancel)
- Cursor-based Pagination (Base64-encoded cursors)
- Search & Filtering (user listing with query params)
- Email Verification + Password Reset flows
- Request Validation Middleware (generic Zod)
- API Versioning (path-based via middleware)

### v0.3.0 — Security & Production Adapters ✅

- Security Headers, CORS, Request Timeout, Body Size Limit
- Account Lockout (configurable threshold + duration)
- Logout with token revocation
- Graceful Shutdown (SIGTERM/SIGINT)
- Production adapters: Resend (email), GCS (storage), FCM (messaging)

---

## 3D World + AI Platform

Two complementary tracks evolving together. See [design doc](docs/plans/2026-02-24-fenice-evolution-design.md) for full details.

### Completed

| Milestone | Track | Description |
|-----------|-------|-------------|
| M1 | 3D | Static city from OpenAPI |
| M2A | 3D | Typed deltas + reducer + resync guard |
| M2B | 3D | Semantic contract (ok/degraded/blocked/unknown, zoning, auth gate) |
| M2C | 3D | Tron visual language (radial corridors, gate pulse/haze, HUD legend) |
| M2D | 3D | Visual clarity + KPI safety pass |
| M3 | Agent | AI Builder: prompt-to-PR with safety gates, validation, self-repair |
| M3.1 | Agent | Two-phase builder: plan-then-generate with user approval gate |
| M4 | 3D | Atmosphere — Post-processing, skybox, material upgrade, dark cosmic palette, ultra quality mode, cinematic camera, Galaxy Settings panel |
| M5 | Agent | Builder v2 — Smart context (import resolver), multi-retry recovery (strategy-based), search_files + list_files tools, improved task prompts |
| M6 | 3D | Cosmos — Service stars on concentric rings, endpoint planets with method-based shapes, curved luminous routes with pulse animation, wormhole auth gate, orbital navigation, cosmos/tron mode switch, dark/light themes, Galaxy Settings panel |
| M7 | Bridge | MCP Live — Operational JSON-RPC 2.0 server, 5 read-only tools (list_endpoints, get_schema, check_health, list_agents, query_logs), agent role in RBAC, agent sessions with TTL/throttle, agent.connected/disconnected/activity world deltas, 3D agent presence (octahedron probes, role colors), agent HUD panel with rolling activity feed |

### Active Roadmap

```
Track A (3D Visual)            Track B (Agent)

  M4: Atmosphere ✅               M5: Builder v2 ✅
       |                              |
  M6: Cosmos ✅ ───────────── M7: MCP Live ✅       ← first bridge done
       |             ╲                |
  M8: Observability ──────── M9: Agent Swarm        ← full integration (NEXT)
       |                              |
  M10: Interactive Design      M11: Team Enterprise
```

| Milestone | Track | Status | Dependencies | Description |
|-----------|-------|--------|--------------|-------------|
| **M5** | Agent | Done | M3.1 | **Builder v2** — Smart context (import resolver), multi-retry recovery (3 strategies), search_files/list_files tools, improved task prompts |
| **M6** | 3D | Done | M4 | **Cosmos** — Service stars on concentric rings, endpoint planets (method-based shapes), curved luminous routes with pulse, wormhole auth gate, orbital navigation, cosmos/tron mode switch, dark/light themes |
| **M7** | Bridge | Done | M5 + M6 | **MCP Live** — Operational JSON-RPC 2.0 MCP server, agent connection protocol, agent presence in 3D cosmos, activity-aware HUD. Mutating tools (create_endpoint, modify_endpoint) stubbed — wired to builder in M7.b |
| **M8** | Bridge | — | M6 + M7 | **Observability** — OTel data pipeline to 3D, traffic particles on routes, planet heatmaps (latency/errors), anomaly detection with visual alerts |
| **M9** | Agent | — | M7 + M8 | **Agent Swarm** — Multi-agent orchestration (Generator, Reviewer, Tester, Monitor), task decomposition, A2A via FENICE hub, swarm visualization |
| **M10** | 3D | — | M6 + M9 | **Interactive Design** — Drag & drop planet creation, visual schema editor, agent-assisted design, undo/redo timeline, template gallery |
| **M11** | Agent | — | M9 | **Team Enterprise** — Multi-user presence, agent teams per user, permission model, shared code review in 3D |

**Next up:** M8 (Observability) — depends on M6 + M7 (both done). Sequential from here.

### Future — Scale & Optimize (Backlog)

Infrastructure improvements to be scheduled as needed:

- Redis Caching (response cache + session store)
- Queue Workers (background job processing)
- Database Indexing (performance-tuned MongoDB indexes)
- Metrics Endpoint (Prometheus-compatible export)
- Audit Logging (structured audit trail)

---

## Execution Tracking

- Design doc: [docs/plans/2026-02-24-fenice-evolution-design.md](docs/plans/2026-02-24-fenice-evolution-design.md)
- 3D world history: [docs/3d-world/FENICE_3D_World_Roadmap_v0.2.md](docs/3d-world/FENICE_3D_World_Roadmap_v0.2.md)

## Contributing

Want to help build the next version? See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
Proposals for new features should be discussed via GitHub Issues before implementation.
