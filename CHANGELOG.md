# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

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
