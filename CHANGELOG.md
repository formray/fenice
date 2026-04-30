# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added — M7 closing (mutating tools wired to builder, run_tests, ActivityBeam)

#### M7.b — Builder tools wired

- `create_endpoint` and `modify_endpoint` now delegate to the existing two-phase BuilderService (preserves human plan-approval gate). Agents get a `jobId` and can follow it.
- New tools `builder_get_job` and `builder_list_jobs` (read-only, role >= agent) so agents can poll status without falling back to REST.
- `modify_endpoint` enriches the prompt with the target path/method to anchor the builder.

#### `run_tests` tool

- Admin-only — runs the FENICE validator (typecheck + lint + test) and returns a per-step pass/fail breakdown.
- Output truncated to 4k chars per step to avoid flooding the agent context.
- Optional `steps` arg filters which steps to surface (validator still runs all three for now).

#### ActivityBeam visual

- New R3F components `ActivityBeam.tsx` and `ActivityBeams.tsx` — renders luminous CatmullRom-curved tubes from agent → target on every `agent.activity` (started) event with a target.
- Tracks the agent's orbital position in real-time (curve recomputed each frame for the duration of the beam).
- Color matches the agent's role; fades alpha linearly from 100% → 0% over the second half of the 2.5s lifetime.
- Endpoint targets snap to the parent service-star position (planets orbit too quickly for a meaningful planet-position lookup).
- `utils/agent-placement.ts` extracted so AgentEntity and ActivityBeam share the same orbital placement logic.

#### Tool count

| | Before M7 close | After |
|---|---|---|
| MCP tools | 7 (5 read-only + 2 stubs) | 10 (5 read-only + 4 builder + 1 run_tests) |
| Mutating tools wired | 0 | 2 (`create_endpoint`, `modify_endpoint`) |
| Stub tools remaining | 2 | 0 |

#### Tests

- +14 server tests (`builder-tool.test.ts`, `run_tests` unit tests) — total 805 server / 71 files
- +5 client tests (`agent-placement.test.ts`) — total 258 client / 22 files

### Added — M7 MCP Live (Bridge — operational MCP server + agent presence in cosmos)

#### M7.1 — Operational MCP server (server)

- New endpoint `POST /api/v1/mcp/rpc` — JSON-RPC 2.0 transport (auth: JWT, role >= agent)
- Five operational read-only tools: `list_endpoints`, `get_schema`, `check_health`, `list_agents`, `query_logs`
- Two stubbed admin-only mutating tools: `create_endpoint`, `modify_endpoint` (handlers wired to the builder in M7.b)
- New RBAC role `agent` (level 35, between `client` and `employee`)
- Schemas: `src/schemas/mcp.schema.ts` (Zod-validated JSON-RPC envelope, MCP method names, tool definitions)
- Service: `src/services/mcp/server.ts` (dispatcher), `src/services/mcp/log-buffer.ts` (200-record in-memory ring), `src/services/mcp/tools/*.ts` (one file per tool)
- Legacy `GET /api/v1/mcp` retained as capability advertisement (deprecated, removed in v0.5)
- Request logger now feeds the log ring buffer for `query_logs`

#### M7.2 — Agent sessions + world delta events (server)

- `WorldDeltaEvent` discriminated union extended (9 → 12 types): `agent.connected`, `agent.disconnected`, `agent.activity`
- `SessionManager` service: in-memory session tracking with TTL cleanup, per-session activity throttle (10/s default), heartbeat
- McpServer lifecycle wired to SessionManager (initialize → register, tool call → startActivity/completeActivity, including `durationMs` and `isError`)
- New endpoint `GET /api/v1/agents` — admin-only list of active MCP sessions
- `CallerIdentity` replaces `AgentIdentity` (userId/userRole always present from JWT, sessionId optional)
- Env vars: `MCP_ENABLED`, `MCP_SESSION_TTL_MS`, `MCP_ACTIVITY_THROTTLE_PER_SEC`, `MCP_LOG_BUFFER_SIZE`

#### M7.3 — Agent presence in 3D cosmos (client)

- New types: `AgentEntity`, `ActivityFeedEntry`, `ActiveBeam`, `ROLE_COLORS` (cyan/magenta/amber/violet/white)
- New Zustand store `agent.store.ts`: connected agents map, rolling activity feed (cap 20, newest-first), beam lifecycle with TTL pruning
- World store reducer extended to forward `agent.*` deltas to the agent store
- New R3F components: `AgentEntity.tsx` (octahedron probe, role-colored, busy-pulse animation, deterministic orbital placement), `AgentSwarm.tsx` (render-loop wrapper)
- New HUD component: `AgentPanel.tsx` (top-right card with connected agents and activity feed)
- WorldDeltaEvent type union extended in client to mirror backend

#### Tooling and docs

- `scripts/mcp-demo.ts` — runnable TypeScript demo that initializes a session and exercises every read-only tool
- `docs/MCP_QUICKSTART.md` — connection guide with curl examples, tool catalog, role colors, configuration, and roadmap

#### Tests

- 31 new server tests for M7.1 (6 log-buffer + 17 server unit + 5 mcp-rpc integration + 3 legacy mcp restructured)
- 12 new server tests for M7.2 (session-manager lifecycle, throttle, heartbeat, view formatting)
- 9 new client tests for M7.3 (agent store reducers, feed cap, beam lifecycle)
- Total: 791 server tests across 70 files (was 748/66) + 253 client tests across 21 files (was 244/20)

## [0.4.0] - 2026-04-30

### Added

#### M6 Cosmos (3D — Planetary Transformation)

- Service stars on concentric rings (emissive sphere + glow + corona, color by service type)
- Endpoint planets with method-based shapes (GET=sphere, POST=icosahedron, PUT=torus, DELETE=octahedron, PATCH=dodecahedron)
- Curved luminous routes (CatmullRomCurve3 + TubeGeometry) with animated pulse along the curve
- Wormhole auth gate effect (portal/transit visualization for auth-required services)
- Orbital navigation: OrbitControls with smooth damping, click-to-focus camera animation, auto-rotate when idle
- Cosmos / Tron mode switch via `view.store.ts` (Tron city retained as legacy mode)
- Dark and light themes selectable from view store
- Orbital layout engine in `utils/cosmos.ts` (concentric ring placement, non-overlapping planetary systems)
- New components: `Cosmos.tsx`, `ServiceStar.tsx`, `EndpointPlanet.tsx`, `OrbitalPath.tsx`, `CurvedRoute.tsx`, `Wormhole.tsx`

#### M5 Builder v2 (Agent — Smart Context + Multi-Retry)

- **Import Resolver**: dependency-aware context selection — follows import chains (depth 2) to auto-include relevant files for refactor, bugfix, test-gen, and schema-migration tasks
- **Strategy-based repair**: multi-retry recovery with targeted strategies (typecheck → lint → test → all), up to 3 repair attempts instead of 1
- **Repair metadata**: `repairAttempts` and `repairStrategies` fields in job result for observability on draft PRs
- **New builder tools**: `search_files` (regex grep across project) and `list_files` (directory listing) added to the Claude tool-use loop
- **Improved task prompts**: step-by-step workflows for refactor, bugfix, test-gen, and schema-migration tasks

#### M4 Atmosphere (3D — Cinematic Visuals)

- Post-processing pipeline: bloom (UnrealBloomPass), SSAO, depth of field, vignette, chromatic aberration, film grain
- Cosmic skybox: star field, nebulae, dust particles, animated key light, ground fog, haze layers, pulse wave effect
- Galaxy Settings panel: real-time sliders for all atmosphere parameters (layout, stars, planets, routes, bloom, post-processing, atmosphere, camera)
- Cinematic camera system: 5 keyframe-based presets (Grand Orbit, Flythrough, Top-Down Sweep, Dramatic Rise, Nebula Tour) with smooth-step easing, play/pause/stop/speed controls
- Ultra quality mode: custom GLSL shader nebulae (6-octave fBM simplex noise, 7 palettes), 12,000 spectral-class stars, 2,500 dust particles with trails, extended far plane
- Rich nebulae: multi-layer procedural textures with 5 astronomical palettes (Helix, Carina, Eagle, Orion, Cat's Eye), annular ring structure, bright knots, filaments
- FPS counter: real-time frame rate display in HUD (color-coded green/yellow/red)
- `cosmos-settings.store.ts`: Zustand store for all tunable 3D scene parameters with reset-to-defaults
- Cinematic store: Zustand store for camera preset playback state

#### M3.1 Two-Phase Builder (Agent — Plan/Approve Gate)

- Plan-then-generate pipeline with user approval gate
- New pipeline states: `queued → planning → plan_ready → [approve/reject] → reading_context → generating → ... → completed` (11 states total)
- Plan generation via single Claude API call returning structured file manifest (path, type, action, description)
- New routes: `POST /api/v1/builder/jobs/:id/approve` and `POST /api/v1/builder/jobs/:id/reject` (admin-only)
- Plan review UI in BuilderPromptBar: editable file manifest with type badges, inline description editing, approve/reject buttons
- Glowy animated loading bar with CSS keyframe animations (shimmer, glow, pulse, indeterminate)
- Context reduction for plan-constrained generation (~40-50% fewer tokens)
- 10-minute timeout guard on both planning and generation phases
- Plan field added to BuilderJob model and schema (Mongoose sub-schema + Zod)

#### M3 AI Builder Pipeline (Agent — Prompt to PR)

- Prompt-to-PR code generation via Claude API with tool use (multi-turn loop: write_file, modify_file, read_file)
- Builder routes: `POST /api/v1/builder/generate`, `GET /api/v1/builder/jobs/:id`, `GET /api/v1/builder/jobs`
- Builder job model with MongoDB audit trail (status tracking across pipeline states)
- Scope policy engine: path whitelist/blacklist, forbidden path detection, dangerous content scanning
- Context reader: builds LLM context bundle from project codebase (CLAUDE.md, schemas, models, services, routes)
- Self-repair: validation failure triggers repair attempt via Claude before failing
- Project validator: runs typecheck, lint, and test via child_process with 60s timeout
- File writer with scope policy enforcement and recursive directory creation
- Git operations: branch creation, commit with conventional format, push, cleanup via simple-git
- GitHub PR creation via Octokit with structured body (summary, file lists, risk checklist)
- Builder world notifier: emits `builder.progress` delta events and synthetic service/endpoint deltas via WebSocket
- `builder.progress` event type added to WorldDeltaEvent discriminated union
- Builder tools registered in MCP manifest (`builder_generate`, `builder_get_job`, `builder_list_jobs`)
- Builder env vars: `BUILDER_ENABLED`, `ANTHROPIC_API_KEY`, `GITHUB_TOKEN`, `GITHUB_OWNER`, `GITHUB_REPO`, `BUILDER_RATE_LIMIT_MAX`, `BUILDER_RATE_LIMIT_WINDOW_MS`
- Pino logger redaction for sensitive keys (ANTHROPIC_API_KEY, GITHUB_TOKEN, JWT secrets)
- Builder kill switch: `BUILDER_ENABLED=false` returns 503
- JWT + admin RBAC + dedicated rate limit (5 req/hour) on builder endpoints
- New dependencies: `@anthropic-ai/sdk`, `simple-git`, `@octokit/rest`
- Builder Prompt Bar in 3D world client: collapsible panel for submitting prompts, real-time status via WebSocket
- Client-side builder types, Zustand store, and REST API client (`builder-api.ts`)
- Preview/Live (dry-run) toggle in prompt bar with explanation text
- Real-time activity mini-log showing Claude tool calls during code generation
- `builder.progress` delta event forwarding from world store to builder store
- Seed admin user (`admin@formray.io`) created automatically on every server start
- `detail` field on `builder.progress` delta events for granular tool activity reporting

#### M2 World Model + Realtime Stream (3D — Foundation)

- World model Zod schemas (WorldService, WorldEndpoint, WorldEdge, WorldModel) with schema version 1
- ProjectionService for OpenAPI 3.x to WorldModel transformation (tag grouping, pairwise edges, auth detection)
- World WS protocol schemas (subscribe, snapshot, delta, ping/pong, error) with discriminated unions
- WorldWsManager with monotonic seq numbering, ring buffer (configurable size), Base64 resume tokens with TTL
- World WS message handlers for subscribe flow (full snapshot and resume with catch-up) and ping/pong keepalive
- World Gateway WebSocket endpoint at `GET /api/v1/world-ws` with JWT query-param authentication
- Environment variables: `WORLD_WS_BUFFER_SIZE` (default 1000), `WORLD_WS_RESUME_TTL_MS` (default 5min)
- React + R3F client scaffold (`client/`) with Vite 6, React 19, Three.js 0.173, Zustand 5
- Client-side WorldModel types mirroring backend Zod schemas (plain TypeScript interfaces)
- WebSocket connection hook with auto-reconnect (3s), ping/pong (25s), and resume token support
- Zustand stores for world state and building selection
- Deterministic grid layout service (services → districts, endpoints → buildings)
- 3D city renderer (Tron mode): buildings colored by HTTP method, hover glow, click selection
- District ground planes with service tag labels and edge connectors
- HUD overlay with connection status indicator and HTTP method color legend
- Side panel with endpoint details (path, method, summary, auth, params, related endpoints)
- Client CI job (lint, typecheck, test, build) in GitHub Actions
- 3D world docs index (`docs/3d-world/README.md`) and M2 realtime overlay execution plan

### Fixed

- World WS manager now ignores stale close/error callbacks and closes replaced sockets safely
- World WS resume validation now rejects future timestamps in resume tokens
- Client WS hook hardened against malformed messages and stale socket lifecycle race conditions
- Setup/bootstrap docs updated for 3D client token flow (`client/.env.example`, Quickstart, root README)

### Tests

- 748 server tests across 66 test files (up from 560 at v0.3.0): added M5 import-resolver, strategy-based validator, search_files/list_files (35 new), M3.1 two-phase pipeline, M3 builder pipeline, M2 world projection (97 new)
- 244 client tests across 20 test files (up from 159): added M6 cosmos layout, planet shapes, theme switching, M4 atmosphere, settings panel, cinematic preset playback

### Security

- Patched security vulnerabilities in `hono`, `minimatch`, `fast-xml-parser` (transitive)

## [0.3.0] - 2026-02-21

### Added

- Security headers middleware via `hono/secure-headers` (X-Content-Type-Options, X-Frame-Options, etc.)
- CORS middleware via `hono/cors` with configurable `CLIENT_URL` origin
- Request timeout middleware with configurable `REQUEST_TIMEOUT_MS` (default 30s)
- Body size limit middleware via `hono/body-limit` with configurable `BODY_SIZE_LIMIT_BYTES` (default 1MB)
- `POST /api/v1/auth/logout` endpoint with token revocation
- Account lockout after configurable failed login attempts (`LOCKOUT_THRESHOLD`, `LOCKOUT_DURATION_MS`)
- Graceful shutdown handler (SIGTERM/SIGINT) with Mongoose disconnect
- `ResendEmailAdapter` with real Resend SDK integration
- `GcsStorageAdapter` with real Google Cloud Storage SDK integration
- `FcmMessagingAdapter` with real Firebase Admin SDK integration
- Comprehensive auth middleware tests (7 tests)
- Comprehensive error handler tests (10 tests)
- Auth flow integration tests (12 tests)
- User CRUD integration tests (6 tests)
- Upload flow integration tests (5 tests)
- WebSocket integration tests (15 tests)

### Fixed

- Migrated all Zod v4 deprecated APIs (`z.string().email()` → `z.email()`, `z.string().url()` → `z.url()`, `z.string().datetime()` → `z.iso.datetime()`, `.format()` → `z.treeifyError()`)
- Scalar import updated from `apiReference` to `Scalar` (`@scalar/hono-api-reference`)
- Adapter factory now selects production adapters when environment credentials are present
- Coverage thresholds adjusted to realistic levels (60% lines, 40% branches, 50% functions, 60% statements)

## [0.2.0] - 2026-02-21

### Added

- Role-based access control (RBAC) middleware with 6-level hierarchy
- Rate limiting middleware with abstract store pattern and in-memory implementation
- Cursor-based pagination utility with Base64-encoded cursors
- Query builder for user search/filter (email, username, fullName, role, active, date range)
- User list endpoint with pagination, search, and filtering
- API versioning middleware (extracts version from URL path)
- Email verification flow (signup token, verify, resend)
- Password reset flow (request, reset with token)
- Chunked file upload system (init, chunk upload, complete, cancel)
- WebSocket real-time messaging with JWT authentication
- WebSocket room management (join, leave, broadcast)
- WebSocket message handlers (chat, notifications, ping/pong)
- MCP endpoint updated with v0.2.0 tools
- Zod request validation middleware
- Crypto utility (token generation + SHA-256 hashing)
- New error classes: RateLimitError (429), UploadError (400)
- Upload environment configuration variables
- WebSocket environment configuration variables

## [0.1.0] - 2026-02-21

### Added

- Hono + Zod OpenAPI routes (auth, users, health, MCP)
- Mongoose v9 User model with bcrypt password hashing
- JWT authentication with access/refresh token flow
- Adapter pattern for email (Resend), storage (GCS), messaging (FCM)
- Console/local adapter implementations for development
- OpenTelemetry auto-instrumentation with OTLP trace export
- MCP server endpoint for AI agent discovery (`GET /api/v1/mcp`)
- Scalar interactive API documentation (`GET /docs`)
- LLM-readable Markdown API docs (`GET /docs/llm`)
- OpenAPI 3.1 JSON specification (`GET /openapi`)
- Zod v4 schemas as single source of truth (types, validation, OpenAPI)
- Centralized error handling with typed error classes
- Request ID middleware (UUID per request)
- Pino structured request logging with correlation
- Vitest + fast-check testing framework (35 tests across 11 files)
- Docker multi-stage build (Node 22 Alpine) with health checks
- docker-compose with MongoDB 7 service
- GitHub Actions CI pipeline (lint, typecheck, test, build)
- Four-script pattern (`setup.sh`, `dev.sh`, `stop.sh`, `reset.sh`)
- Husky + lint-staged pre-commit hooks (ESLint + Prettier)
- Zod-validated environment configuration
- Comprehensive documentation suite (CLAUDE.md, AGENTS.md, QUICKSTART.md, ARCHITECTURE.md)
- K8s deployment manifests (Deployment, Service, ConfigMap)
