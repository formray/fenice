# CLAUDE.md — FENICE AI Agent Context

## Project Overview

**FENICE** is an AI-native, production-ready backend platform built on the 2026 Golden Stack. It provides a complete foundation for building REST APIs with authentication, user management, and AI agent discovery via the Model Context Protocol (MCP).

- **Repository:** `https://github.com/formray/fenice`
- **Organization:** Formray
- **Version:** 0.4.0 (latest on `main`)
- **License:** MIT
- **Author:** Giuseppe Albrizio

## Tech Stack

| Layer          | Technology                      | Version |
| -------------- | ------------------------------- | ------- |
| Runtime        | Node.js                         | 22 LTS  |
| Framework      | Hono + `@hono/zod-openapi`      | 4.x     |
| Validation     | Zod v4                          | 4.x     |
| Database       | MongoDB via Mongoose v9         | 9.x     |
| Auth           | JWT (jsonwebtoken + bcryptjs)   | -       |
| Logging        | Pino                            | 10.x    |
| Observability  | OpenTelemetry (auto-instrument) | -       |
| Testing        | Vitest + fast-check             | 4.x     |
| API Docs       | Scalar + LLM markdown           | -       |
| AI Discovery   | MCP (Model Context Protocol)    | -       |
| Language       | TypeScript (strict mode)        | 5.x     |
| Module System  | ESM (`"type": "module"`)        | -       |

## Key Commands

```bash
# Development
npm run dev            # Start dev server (tsx watch + OTel instrumentation)
npm run dev:typecheck  # Typecheck in watch mode

# Quality
npm run lint           # ESLint (src + tests)
npm run lint:fix       # ESLint with auto-fix
npm run format         # Prettier format all
npm run format:check   # Prettier check only
npm run typecheck      # tsc --noEmit
npm run validate       # lint + typecheck + test (run before every PR)

# Testing
npm run test           # Vitest run (single pass)
npm run test:watch     # Vitest interactive watch
npm run test:coverage  # Vitest with v8 coverage

# Build & Production
npm run build          # TypeScript compilation to dist/
npm run start          # Run compiled output (node dist/server.js)

# Shell scripts (four-script pattern)
./setup.sh             # Install deps, create .env, check prerequisites
./dev.sh               # Start MongoDB (Docker) + dev server
./stop.sh              # Stop all Docker services
./reset.sh             # Full clean: node_modules, dist, Docker volumes
```

## Code Style & Conventions

### TypeScript
- Strict mode enabled (`strict: true` in tsconfig.json)
- `exactOptionalPropertyTypes: true` — use `undefined` explicitly for optional props
- `noUncheckedIndexedAccess: true` — indexed access returns `T | undefined`
- `noImplicitReturns: true`
- Target: ES2022, Module: NodeNext

### ESM
- All local imports **must** end in `.js` extension: `import { foo } from './bar.js';`
- `"type": "module"` in package.json
- No CommonJS `require()` — use `import` exclusively

### Naming
- Files: `kebab-case` (e.g., `auth.routes.ts`, `user.model.ts`, `console.adapter.ts`)
- Classes: `PascalCase` (e.g., `AuthService`, `ConsoleEmailAdapter`)
- Variables/functions: `camelCase`
- Constants: `SCREAMING_SNAKE_CASE` for env-derived values
- Schemas: `PascalCase` with `Schema` suffix (e.g., `UserSchema`, `LoginSchema`)

### Commits
- **Conventional Commits** required: `feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`
- Co-Author line: `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`
- Husky + lint-staged pre-commit hooks run ESLint + Prettier automatically

## Architecture

### Request Flow
```
Client Request
  -> Hono Middleware (requestId, requestLogger)
  -> Security (secureHeaders, CORS, bodyLimit, timeout)
  -> Rate Limiter (per-route windows)
  -> API Version (extracts from URL path)
  -> Auth Middleware (JWT verification, on protected routes)
  -> RBAC (role check, on admin-only routes)
  -> OpenAPI Route Handler (Zod validation via @hono/zod-openapi)
  -> Service Layer (business logic)
  -> Mongoose Model (MongoDB operations)
  -> JSON Response (with toJSON transform)
```

### Directory Structure
```
src/
  index.ts              # Hono app setup, route mounting, OpenAPI/Scalar/LLM docs
  server.ts             # Entry point: MongoDB connect, seed admin, @hono/node-server
  instrumentation.ts    # OpenTelemetry NodeSDK (imported via --import flag)
  config/env.ts         # Zod-validated environment variables (76 vars)
  schemas/
    common.schema.ts    # ErrorResponse, Pagination, SuccessResponse
    user.schema.ts      # User, UserCreate, UserUpdate, RoleEnum
    auth.schema.ts      # Login, Signup, AuthTokens, AuthResponse, PasswordReset, EmailVerify
    builder.schema.ts   # BuilderJob, BuilderPlan, BuilderStatus (11 states)
    upload.schema.ts    # UploadSession, UploadChunk
    world.schema.ts     # WorldService, WorldEndpoint, WorldEdge, WorldModel
    world-delta.schema.ts # WorldDeltaEvent discriminated union (9 event types)
    world-ws.schema.ts  # World WS protocol (subscribe, snapshot, delta, ping/pong, error)
    ws.schema.ts        # Generic WS message types
  models/
    user.model.ts       # Mongoose schema + bcrypt pre-save hook + comparePassword
    builder-job.model.ts # Builder job model with plan sub-schema + 11 status states
  services/
    auth.service.ts     # Signup, login, refresh, verify-email, password reset
    user.service.ts     # CRUD + pagination + search/filter
    upload.service.ts   # Chunked file upload (init, chunk, complete, cancel)
    projection.service.ts # OpenAPI 3.x to WorldModel transformation
    mock-delta-producer.ts # Mock event generation for dev/testing
    builder.service.ts  # AI Builder orchestrator (two-phase prompt-to-PR pipeline)
    builder/
      context-reader.ts   # Reads codebase as LLM context bundle
      code-generator.ts   # Claude API tool-use loop (generate + repair)
      scope-policy.ts     # Path whitelist/blacklist + content scanning
      prompt-templates.ts # System prompt + tool definitions
      file-writer.ts      # Writes generated files (scope-validated)
      git-ops.ts          # Branch/commit/push via simple-git
      github-pr.ts        # PR creation via Octokit
      validator.ts        # Runs typecheck/lint/test via child_process
      import-resolver.ts  # M5: dependency-aware context (import chain resolution)
      world-notifier.ts   # Emits builder progress + synthetic deltas via WebSocket
  routes/
    health.routes.ts    # GET /health, /health/detailed
    auth.routes.ts      # POST signup, login, refresh, logout, verify-email, password-reset
    user.routes.ts      # GET list, me, :id; PATCH :id; DELETE :id
    upload.routes.ts    # POST init, chunk, complete; DELETE cancel
    builder.routes.ts   # POST generate, approve, reject; GET job, list-jobs
    mcp.routes.ts       # GET /mcp (AI agent discovery)
    ws.routes.ts        # WS /ws (generic WebSocket messaging)
    world-ws.routes.ts  # WS /world-ws (3D world projection stream)
  middleware/
    auth.ts             # JWT Bearer token verification
    rbac.ts             # Role-based access control (6-level hierarchy)
    rate-limiter.ts     # Request throttling with configurable windows
    timeout.ts          # Request timeout middleware
    validate.ts         # Generic Zod request validation
    api-version.ts      # API versioning (extracts from URL path)
    errorHandler.ts     # Centralized error handling (AppError, ZodError)
    requestId.ts        # UUID per request
    requestLogger.ts    # Pino structured request logging
  ws/
    auth.ts             # WebSocket JWT authentication
    handlers.ts         # Generic WS message handlers
    manager.ts          # WsManager (connections, rooms, broadcast)
    world-handlers.ts   # World WS subscribe/resume/ping handlers
    world-manager.ts    # WorldWsManager (ring buffer, resume tokens, seq numbering)
  adapters/
    index.ts            # Adapter factory + type re-exports
    email/              # EmailAdapter interface + ConsoleEmailAdapter + ResendAdapter
    storage/            # StorageAdapter interface + LocalStorageAdapter + GCSAdapter
    messaging/          # MessagingAdapter interface + ConsoleMessagingAdapter + FCMAdapter
  utils/
    errors.ts           # AppError, NotFoundError, NotAuthorizedError, ForbiddenError, etc.
    logger.ts           # Pino logger factory with sensitive key redaction
    llm-docs.ts         # OpenAPI-to-Markdown generator for /docs/llm
    crypto.ts           # Token generation + SHA-256 hashing
    pagination.ts       # Cursor-based pagination with Base64 cursors
    query-builder.ts    # User search/filter query builder
    seed.ts             # Seed admin user on server start
```

### Zod as Single Source of Truth
Zod schemas define:
1. **Runtime validation** — request bodies, query params
2. **TypeScript types** — via `z.infer<typeof Schema>`
3. **OpenAPI documentation** — via `@hono/zod-openapi` integration

### Adapter Pattern
Vendor-independent abstractions for external services:
- **Email:** `EmailAdapter` interface with `ConsoleEmailAdapter` (dev) and `ResendAdapter` (prod)
- **Storage:** `StorageAdapter` interface with `LocalStorageAdapter` (dev) and `GCSAdapter` (prod)
- **Messaging:** `MessagingAdapter` interface with `ConsoleMessagingAdapter` (dev) and `FCMAdapter` (prod)

### AI Builder (M3 + M3.1)
The builder pipeline generates production-ready API endpoints from natural language prompts using a two-phase approach:

```
POST /api/v1/builder/generate  (JWT + admin + rate limit 5/hour)
  Phase 1 — Planning:
  1. Read context (CLAUDE.md, schemas, models, services, routes)
  2. Generate plan via Claude API (single JSON call, no tools)
  3. Return plan to user for review (status: plan_ready)

  POST /api/v1/builder/jobs/:id/approve  (or /reject)
  Phase 2 — Generation (after user approves plan):
  4. Read context (slimmed for generation: ~40-50% fewer tokens)
  5. Generate code via Claude API (tool-use loop: write_file, modify_file, read_file)
  6. Scope policy validation (path whitelist/blacklist, content scanning)
  7. Write files + create git branch (conventional commit + Co-Authored-By)
  8. Validate (typecheck + lint + test)
  9. Self-repair if validation fails (1 retry via Claude)
  10. Push branch + create PR via Octokit
  11. Emit synthetic deltas to 3D world via WebSocket
```

- **Two-phase:** Plan approval gate between planning and generation (11 pipeline states)
- **Safety:** Scope policy (ALLOWED_WRITE_PREFIXES, FORBIDDEN_PATHS, dangerous pattern scanning), PR-only (never merges)
- **Kill switch:** `BUILDER_ENABLED=false` returns 503
- **Timeouts:** 10-minute guard on both planning and generation phases
- **M5 Smart context:** Import resolver follows dependency chains (depth 2) for refactor/bugfix/test-gen tasks
- **M5 Multi-retry:** Strategy-based repair (typecheck -> lint -> test -> all), up to 3 attempts
- **M5 Tools:** `search_files` (regex grep) + `list_files` (directory listing) added to Claude tool-use loop
- **World integration:** `builder.progress` delta events + synthetic `service.upserted`/`endpoint.upserted` deltas
- **Deps:** `@anthropic-ai/sdk`, `simple-git`, `@octokit/rest`

### 3D World (M4 Atmosphere + M6 Cosmos)
The client is a React 19 + R3F application that renders the API surface as a navigable cosmic universe.

```
client/src/
  components/
    Scene.tsx                # Root R3F canvas + post-processing pipeline
    Cosmos.tsx               # Cosmos mode: stars, orbits, planets, routes
    ServiceStar.tsx          # Service-as-star (emissive sphere + corona)
    EndpointPlanet.tsx       # Endpoint-as-planet (shape by HTTP method)
    OrbitalPath.tsx          # Semi-transparent orbital ellipses
    CurvedRoute.tsx          # CatmullRom-curved luminous edge with pulse
    Wormhole.tsx             # Auth gate as portal effect
    Nebulae.tsx              # Multi-layer procedural nebula sprites
    ShaderNebulae.tsx        # Ultra mode: GLSL fBM nebulae (7 palettes)
    DustParticles.tsx        # Floating dust with sin/cos drift
    CameraController.tsx     # OrbitControls + cinematic preset playback
    CosmosSettings.tsx       # Galaxy Settings panel (real-time sliders)
    HUD.tsx                  # Connection status, FPS, legend, prompt bar
    atmosphere/
      GroundFog.tsx          # FogExp2 + ground haze
      HazeLayers.tsx         # Multi-layer atmospheric haze
    builder/                 # Builder prompt bar + plan review UI
  stores/
    cosmos-settings.store.ts # Zustand store for tunable scene parameters
    view.store.ts            # Cosmos/Tron mode + dark/light theme
  utils/
    cosmos.ts                # Orbital layout math (concentric rings)
```

- **Visual modes:** `cosmos` (planetary) and `tron` (legacy city) toggleable via view store
- **Themes:** dark (default cosmic) and light
- **Quality tiers:** standard, ultra (custom GLSL nebulae + 12k spectral stars + 2.5k dust)
- **Cinematic camera:** 5 keyframe presets (Grand Orbit, Flythrough, Top-Down Sweep, Dramatic Rise, Nebula Tour)
- **Post-processing:** UnrealBloomPass, SSAO, depth of field, vignette, chromatic aberration, film grain

## Testing

- **Framework:** Vitest v4 with `globals: true`
- **Property testing:** fast-check for schema validation properties
- **Coverage:** v8 provider, thresholds at 60/40/50/60 (stmts/branches/funcs/lines). DB-dependent files (services, models, production adapters) excluded — need MongoDB integration tests.
- **Test structure:** `tests/unit/`, `tests/integration/`, `tests/properties/`
- **Current status:** 748 server tests across 66 test files + 244 client tests across 20 test files, all passing
- **TDD preferred:** Write tests alongside or before implementation

## Common Gotchas

1. **Zod v4 uses `.issues` not `.errors`** — When working with `ZodError`, access validation issues via `err.issues`, not the v3 `.errors` property.

2. **Mongoose v9 `_id.toString()`** — Always call `_id.toString()` to get the string ID. The `toJSON` transform handles this automatically via `ret['id'] = String(ret['_id'])`.

3. **`resourceFromAttributes()` for OTel** — OpenTelemetry resources now use `resourceFromAttributes()` from `@opentelemetry/resources` instead of the deprecated `Resource` constructor.

4. **Lazy-init pattern** — `loadEnv()` must not be called at module-level in auth middleware or route files, or it will break tests. Use lazy initialization (see `auth.routes.ts` and `middleware/auth.ts`).

5. **`exactOptionalPropertyTypes`** — Optional properties require explicit `undefined` in union types: `refreshToken?: string | undefined` (not just `refreshToken?: string`).

6. **OTel `@opentelemetry/instrumentation-fs` disabled** — The filesystem instrumentation is disabled to avoid excessive noise in traces.

7. **`ATTR_SERVICE_NAME` semantic convention** — Use `ATTR_SERVICE_NAME` from `@opentelemetry/semantic-conventions` (not the old `SemanticResourceAttributes.SERVICE_NAME`).

8. **Scalar `url` not `spec.url`** — `@scalar/hono-api-reference` uses `url: '/openapi'` at top level, not the deprecated `spec: { url: '/openapi' }`.

9. **fast-check `emailAddress()` vs Zod v4** — fast-check generates RFC-compliant emails with special chars that Zod v4 rejects. Filter generated emails through `z.string().email().safeParse()` in property tests.

## CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`): Lint → Typecheck → Test (with coverage) → Build
- Runs on: push to `main`/`development`, PRs to `main`/`development`
- MongoDB 7 service container for integration tests
- CI env vars: `NODE_ENV=test`, `MONGODB_URI`, `JWT_SECRET`, `JWT_REFRESH_SECRET` set in workflow
- `npm run test:coverage` enforces coverage thresholds in CI (not just `npm test`)

## Environment Variables

Required:
- `MONGODB_URI` — MongoDB connection string
- `JWT_SECRET` — JWT signing secret (min 32 chars)
- `JWT_REFRESH_SECRET` — Refresh token secret (min 32 chars)

Optional (with defaults):
- `NODE_ENV` — `development` | `production` | `test` (default: `development`)
- `HOST` — Server bind address (default: `0.0.0.0`)
- `PORT` — Server port (default: `3000`)
- `JWT_ACCESS_EXPIRY` — Access token lifetime (default: `15m`)
- `JWT_REFRESH_EXPIRY` — Refresh token lifetime (default: `7d`)
- `LOG_LEVEL` — `error` | `warn` | `info` | `debug` (default: `info`)
- `SERVICE_NAME` — Service identifier for logging/tracing (default: `fenice`)
- `CLIENT_URL` — CORS origin URL

Rate limiting:
- `RATE_LIMIT_WINDOW_MS` — Global rate limit window (default: `60000` / 1 min)
- `RATE_LIMIT_MAX_REQUESTS` — Max requests per window (default: `100`)

Upload:
- `UPLOAD_MAX_SIZE_BYTES` — Max upload size (default: `104857600` / 100MB)
- `UPLOAD_CHUNK_SIZE_BYTES` — Chunk size (default: `5242880` / 5MB)
- `UPLOAD_SESSION_TIMEOUT_MS` — Session timeout (default: `3600000` / 1 hour)
- `UPLOAD_MAX_CONCURRENT` — Max concurrent uploads (default: `3`)

WebSocket:
- `WS_HEARTBEAT_INTERVAL_MS` — Heartbeat interval (default: `30000`)
- `WS_HEARTBEAT_TIMEOUT_MS` — Heartbeat timeout (default: `10000`)
- `WS_MESSAGE_RATE_LIMIT` — Messages per minute (default: `60`)

Security:
- `LOCKOUT_THRESHOLD` — Failed logins before lockout (default: `5`)
- `LOCKOUT_DURATION_MS` — Lockout duration (default: `900000` / 15 min)
- `REQUEST_TIMEOUT_MS` — Request timeout (default: `30000`)
- `BODY_SIZE_LIMIT_BYTES` — Max body size (default: `1048576` / 1MB)

World WS:
- `WORLD_WS_BUFFER_SIZE` — Ring buffer size (default: `1000`)
- `WORLD_WS_RESUME_TTL_MS` — Resume token TTL (default: `300000` / 5 min)

Delta producer:
- `DELTA_METRICS_INTERVAL_MS` — Metrics emit interval (default: `5000`)
- `DELTA_DIFF_INTERVAL_MS` — Diff emit interval (default: `30000`)

Seed:
- `SEED_ADMIN_EMAIL` — Admin seed email (default: `admin@formray.io`)
- `SEED_ADMIN_PASSWORD` — Admin seed password (default: `change-me-in-production`)

Production adapters (optional):
- `RESEND_API_KEY` — Resend email service API key
- `GCS_BUCKET_NAME`, `GCS_PROJECT_ID`, `GOOGLE_APPLICATION_CREDENTIALS` — Google Cloud Storage
- `FCM_PROJECT_ID` — Firebase Cloud Messaging

AI Builder (optional):
- `BUILDER_ENABLED` — Enable builder endpoints (default: `false`)
- `ANTHROPIC_API_KEY` — Claude API key for code generation
- `GITHUB_TOKEN` — GitHub personal access token for PR creation
- `GITHUB_OWNER` — GitHub repository owner
- `GITHUB_REPO` — GitHub repository name
- `BUILDER_RATE_LIMIT_MAX` — Max builder requests per window (default: `5`)
- `BUILDER_RATE_LIMIT_WINDOW_MS` — Rate limit window in ms (default: `3600000` / 1 hour)
