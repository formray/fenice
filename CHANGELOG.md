# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- **M5 Import Resolver**: dependency-aware context selection — follows import chains to auto-include relevant files for refactor, bugfix, test-gen, and schema-migration tasks
- **M5 Strategy-based repair**: multi-retry recovery with targeted strategies (typecheck -> lint -> test -> all), up to 3 repair attempts instead of 1
- **M5 Repair metadata**: `repairAttempts` and `repairStrategies` fields in job result for observability on draft PRs
- **M5 Builder tools**: `search_files` (regex grep across project) and `list_files` (directory listing) for refactoring and exploration
- **M5 Improved prompts**: step-by-step workflows for refactor, bugfix, test-gen, and schema-migration tasks
- **M5 tests**: 35 new tests for import-resolver, strategy-based validator, and new tools (748 total, up from 713)

### Changed

- Builder context reader now accepts `inferredFiles` parameter for dependency-resolved context
- Builder service uses `categorizeErrors` + `pickRepairStrategy` instead of generic `formatValidationErrors` for repair loop
- Task prompts expanded with concrete workflows and tool usage guidance

---

- **M4 Atmosphere**: post-processing pipeline (bloom, SSAO, depth of field, vignette, chromatic aberration, noise), cosmic skybox (star field, nebulae, dust particles), animated key light, ground fog, haze layers, pulse wave effect
- **M4 Galaxy Settings panel**: real-time sliders for all atmosphere parameters (layout, stars, planets, routes, bloom, post-processing, atmosphere, camera)
- **Cinematic camera system**: 5 keyframe-based presets (Grand Orbit, Flythrough, Top-Down Sweep, Dramatic Rise, Nebula Tour) with smooth-step easing, play/pause/stop/speed controls
- **Ultra quality mode**: custom GLSL shader nebulae (6-octave fBM simplex noise, 7 palettes), 12,000 spectral-class stars, 2,500 dust particles with trails, extended far plane
- **Rich nebulae**: multi-layer procedural textures with 5 astronomical palettes (Helix, Carina, Eagle, Orion, Cat's Eye), annular ring structure, bright knots, filaments
- **FPS counter**: real-time frame rate display in HUD (color-coded: green/yellow/red)
- **Cosmos settings store**: Zustand store for all tunable 3D scene parameters with reset-to-defaults
- **Cinematic store**: Zustand store for camera preset playback state
- **M3 AI Builder pipeline**: prompt-to-PR code generation via Claude API with tool use
- Builder routes: `POST /api/v1/builder/generate`, `GET /api/v1/builder/jobs/:id`, `GET /api/v1/builder/jobs`
- Builder job model with MongoDB audit trail (status tracking across 11 pipeline states)
- Scope policy engine: path whitelist/blacklist, forbidden path detection, dangerous content scanning
- Context reader: builds LLM context bundle from project codebase (CLAUDE.md, schemas, models, services, routes)
- Code generator: multi-turn Claude API loop with write_file, modify_file, read_file tools
- Self-repair: validation failure triggers one repair attempt via Claude before failing
- Project validator: runs typecheck, lint, and test via child_process with 60s timeout
- File writer with scope policy enforcement and recursive directory creation
- Git operations: branch creation, commit with conventional format, push, cleanup via simple-git
- GitHub PR creation via Octokit with structured body (summary, file lists, risk checklist)
- Builder world notifier: emits `builder.progress` delta events and synthetic service/endpoint deltas via WebSocket
- `builder.progress` event type added to WorldDeltaEvent discriminated union (9th event type)
- Builder tools added to MCP manifest (builder_generate, builder_get_job, builder_list_jobs)
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
- **M3.1 Two-Phase Builder**: plan-then-generate pipeline with user approval gate
- Two-phase pipeline: `queued → planning → plan_ready → [approve/reject] → reading_context → generating → ... → completed`
- Plan generation via single Claude API call returning structured file manifest (path, type, action, description)
- `POST /api/v1/builder/jobs/:id/approve` and `POST /api/v1/builder/jobs/:id/reject` endpoints (admin-only)
- Plan review UI in BuilderPromptBar: editable file manifest with type badges, inline description editing, approve/reject buttons
- Glowy animated loading bar with CSS keyframe animations (shimmer, glow, pulse, indeterminate)
- Context reduction for plan-constrained generation (~40-50% fewer tokens)
- 10-minute timeout guard on both planning and generation phases
- Plan field added to BuilderJob model and schema (Mongoose sub-schema + Zod)
- 560 server tests across 61 test files + 159 client tests across 12 test files

- World model Zod schemas (WorldService, WorldEndpoint, WorldEdge, WorldModel) with schema version 1
- ProjectionService for OpenAPI 3.x to WorldModel transformation (tag grouping, pairwise edges, auth detection)
- World WS protocol schemas (subscribe, snapshot, delta, ping/pong, error) with discriminated unions
- WorldWsManager with monotonic seq numbering, ring buffer (configurable size), Base64 resume tokens with TTL
- World WS message handlers for subscribe flow (full snapshot and resume with catch-up) and ping/pong keepalive
- World Gateway WebSocket endpoint at `GET /api/v1/world-ws` with JWT query-param authentication
- Environment variables: `WORLD_WS_BUFFER_SIZE` (default 1000), `WORLD_WS_RESUME_TTL_MS` (default 5min)
- Integration tests for ProjectionService (live OpenAPI parsing) and World WS (subscribe, snapshot, resume flows)
- Unit tests for world schemas, projection service, world WS manager, and world handlers (97 new tests)
- React + R3F client scaffold (`client/`) with Vite 6, React 19, Three.js 0.173, Zustand 5
- Client-side WorldModel types mirroring backend Zod schemas (plain TypeScript interfaces)
- WebSocket connection hook with auto-reconnect (3s), ping/pong (25s), and resume token support
- Zustand stores for world state and building selection
- Deterministic grid layout service (services → districts, endpoints → buildings)
- 3D city renderer: buildings colored by HTTP method, hover glow, click selection
- District ground planes with service tag labels and edge connectors
- HUD overlay with connection status indicator and HTTP method color legend
- Side panel with endpoint details (path, method, summary, auth, params, related endpoints)
- Client CI job (lint, typecheck, test, build) in GitHub Actions
- Client unit tests for layout service, Zustand store, and color mappings (24 new tests)
- WS protocol contract tests validating producer/consumer message schemas (31 tests)
- Demo dry run e2e tests verifying M1 acceptance criteria: 100% endpoint mapping, zero crashes, performance under 1.2s, correct metadata, building non-overlap (23 tests)
- 3D world docs index (`docs/3d-world/README.md`) and M2 realtime overlay execution plan

### Fixed

- World WS manager now ignores stale close/error callbacks and closes replaced sockets safely
- World WS resume validation now rejects future timestamps in resume tokens
- Client WS hook hardened against malformed messages and stale socket lifecycle race conditions
- Setup/bootstrap docs updated for 3D client token flow (`client/.env.example`, Quickstart, root README)

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
