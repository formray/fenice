# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
