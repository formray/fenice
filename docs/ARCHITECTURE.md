# FENICE Architecture

This document describes the key architecture decisions and patterns used in FENICE.

## Overview

FENICE is structured as a layered backend application with clear separation of concerns:

```
                        +------------------+
                        |     Client       |
                        +--------+---------+
                                 |
                        +--------v---------+
                        |   Hono Server    |
                        | (@hono/node-server)
                        +--------+---------+
                                 |
                    +------------v-------------+
                    |     Global Middleware     |
                    |  requestId, requestLogger |
                    |  secureHeaders, cors,     |
                    |  timeout, bodyLimit       |
                    +------------+-------------+
                                 |
              +------------------v------------------+
              |          Route Matching              |
              |  /api/v1/health  /api/v1/auth  ...  |
              +------------------+------------------+
                                 |
                    +------------v-------------+
                    |    Auth Middleware        |
                    | (JWT, on /users/* only)   |
                    +------------+-------------+
                                 |
                    +------------v-------------+
                    |   OpenAPI Route Handler   |
                    | (Zod request validation)  |
                    +------------+-------------+
                                 |
                    +------------v-------------+
                    |     Service Layer         |
                    | (AuthService, UserService)|
                    +------------+-------------+
                                 |
                    +------------v-------------+
                    |    Mongoose Model         |
                    | (MongoDB operations)      |
                    +------------+-------------+
                                 |
                    +------------v-------------+
                    |       MongoDB            |
                    +--------------------------+
```

## Why Hono Over Express

Express was the original framework (in the legacy codebase). FENICE migrated to Hono for several reasons:

1. **First-class OpenAPI support** -- `@hono/zod-openapi` generates OpenAPI specs directly from route definitions. No separate Swagger configuration needed.
2. **Type safety** -- Hono's type system integrates deeply with TypeScript. Route parameters, request bodies, and responses are all type-checked.
3. **Modern design** -- Built for ESM, supports Web Standards API (Request/Response), works on edge runtimes.
4. **Performance** -- Hono's router is significantly faster than Express with lower memory overhead.
5. **Minimal surface area** -- No need for body-parser, express-validator, or other middleware packages that Express requires.

## Zod as Single Source of Truth

One of FENICE's core principles is that **Zod schemas are the single source of truth** for three concerns that traditionally drift apart:

### 1. Runtime Validation
```typescript
// The schema validates incoming data at the route level
const SignupSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});
```

### 2. TypeScript Types
```typescript
// Types are derived from schemas -- never defined separately
export type Signup = z.infer<typeof SignupSchema>;
```

### 3. OpenAPI Documentation
```typescript
// @hono/zod-openapi uses the same schema for API spec generation
const signupRoute = createRoute({
  request: { body: { content: { 'application/json': { schema: SignupSchema } } } },
  // ...
});
```

This eliminates the common problem of documentation, types, and validation getting out of sync.

**Important Zod v4 note:** Error handling uses `.issues` (not `.errors` from v3). The `ZodError` object exposes issues via `err.issues`.

## Adapter Pattern

External services are abstracted behind interfaces to achieve vendor independence:

```
                    +-------------------+
                    |   Business Logic  |
                    +--------+----------+
                             |
                    +--------v----------+
                    |  Adapter Interface |  (e.g., EmailAdapter)
                    +--------+----------+
                             |
              +--------------+--------------+
              |                             |
    +---------v---------+       +-----------v-----------+
    | Console Adapter   |       | Production Adapter    |
    | (dev/test)        |       | (Resend, GCS, FCM)    |
    +-------------------+       +-----------------------+
```

### Current Adapters

| Domain    | Interface          | Dev Adapter              | Prod Adapter      |
| --------- | ------------------ | ------------------------ | ----------------- |
| Email     | `EmailAdapter`     | `ConsoleEmailAdapter`    | `ResendAdapter`   |
| Storage   | `StorageAdapter`   | `LocalStorageAdapter`    | `GCSAdapter`      |
| Messaging | `MessagingAdapter` | `ConsoleMessagingAdapter`| `FCMAdapter`      |

The `createAdapters()` factory in `src/adapters/index.ts` returns the appropriate set. The factory uses lazy initialization -- it calls `loadEnv()` inside the function body, never at module level, so importing the module has no side effects.

Production adapter selection is based on which environment variables are present at call time:

- **Email** -- `RESEND_API_KEY` present --> `ResendEmailAdapter` (uses Resend SDK)
- **Storage** -- `GCS_BUCKET_NAME` + `GCS_PROJECT_ID` present --> `GcsStorageAdapter` (uses `@google-cloud/storage`)
- **Messaging** -- `FCM_PROJECT_ID` + `GOOGLE_APPLICATION_CREDENTIALS` present --> `FcmMessagingAdapter` (uses `firebase-admin`)
- **Otherwise** --> Console/local dev adapters (log operations without requiring external credentials)

### Why This Matters

- **Testability** -- Console adapters make integration tests fast and deterministic
- **Vendor flexibility** -- Swapping from Resend to SendGrid means implementing one adapter, not refactoring business logic
- **Environment parity** -- Development and production use the same interfaces; only the implementations differ

## MCP for AI-Native Discovery

FENICE includes a Model Context Protocol (MCP) endpoint at `GET /api/v1/mcp`. This endpoint returns a structured manifest that AI agents can use to discover and interact with the API without reading human documentation.

The manifest includes:
- **Tools** -- Available operations mapped to REST endpoints (auth_signup, auth_login, user_get_me, etc.)
- **Resources** -- Links to OpenAPI spec and LLM documentation
- **Instructions** -- Plain-text guidance for AI agents on how to use the API

This makes FENICE an "AI-native" backend -- AI agents can self-service their integration without human intervention.

## OpenTelemetry for Observability

Instrumentation is loaded before the application starts via Node.js `--import`:

```bash
tsx watch --import ./src/instrumentation.ts src/server.ts
```

Key implementation details:
- Uses `resourceFromAttributes()` from `@opentelemetry/resources` (not the deprecated `Resource` constructor)
- Uses `ATTR_SERVICE_NAME` from `@opentelemetry/semantic-conventions` (not the old `SemanticResourceAttributes`)
- Filesystem instrumentation disabled (`@opentelemetry/instrumentation-fs: { enabled: false }`) to reduce trace noise
- Traces exported via OTLP HTTP to a configurable endpoint (default: `http://localhost:4318/v1/traces`)

## Authentication Flow

```
Client                          FENICE                         MongoDB
  |                               |                               |
  |  POST /auth/signup            |                               |
  |  {email, username, password}  |                               |
  |------------------------------>|                               |
  |                               |  Check for existing user      |
  |                               |------------------------------>|
  |                               |  Create user (bcrypt hash)    |
  |                               |------------------------------>|
  |                               |  Generate JWT tokens          |
  |                               |  Store refresh token          |
  |  {user, tokens}               |------------------------------>|
  |<------------------------------|                               |
  |                               |                               |
  |  GET /users/me                |                               |
  |  Authorization: Bearer <JWT>  |                               |
  |------------------------------>|                               |
  |                               |  Verify JWT                   |
  |                               |  Extract userId, email, role  |
  |                               |  Fetch user from DB           |
  |  {user}                       |------------------------------>|
  |<------------------------------|                               |
```

JWT tokens carry `userId`, `email`, and `role` claims. Access tokens expire after 15 minutes by default. Refresh tokens expire after 7 days and are stored on the user document for validation.

## Error Handling

Errors follow a consistent structure throughout the application:

1. **Typed error classes** -- `AppError`, `NotFoundError`, `NotAuthorizedError`, `ForbiddenError`, `ValidationError` in `src/utils/errors.ts`
2. **Centralized handler** -- `handleError` in `src/middleware/errorHandler.ts` catches all errors
3. **Zod integration** -- `ZodError` instances are caught and transformed into the standard error format with field-level details
4. **Request correlation** -- Every error response includes a `requestId` for tracing

Response format:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "requestId": "uuid-v4",
    "details": []
  }
}
```

## Security Middleware Stack

Every request passes through a layered middleware pipeline before reaching the route handler. The middleware is applied in this order in `src/index.ts`:

```
Request → requestId → requestLogger → secureHeaders → CORS → timeout → bodyLimit → apiVersion → errorHandler → rateLimiter → authMiddleware → Route Handler
```

### Middleware Details

| Middleware        | Source                   | Purpose                                                                 |
| ----------------- | ------------------------ | ----------------------------------------------------------------------- |
| `requestId`       | Custom                   | Attaches a UUID v4 to every request for correlation                     |
| `requestLogger`   | Custom (Pino)            | Logs method, path, status, and duration                                 |
| `secureHeaders`   | `hono/secure-headers`    | Adds X-Content-Type-Options, X-Frame-Options, and other security headers|
| `cors`            | `hono/cors`              | Reads `CLIENT_URL` from `process.env` directly (lazy-init, no `loadEnv()` at module level) |
| `timeout`         | Custom                   | Uses `Promise.race` with `AbortController`; throws `AppError(408, 'REQUEST_TIMEOUT')` on timeout; default 30s via `REQUEST_TIMEOUT_MS` env var |
| `bodyLimit`       | `hono/body-limit`        | Global 1MB limit via `BODY_SIZE_LIMIT_BYTES` env var; upload routes get a separate limit via `UPLOAD_MAX_SIZE_BYTES` |
| `apiVersion`      | Custom                   | Injects API version prefix                                             |
| `errorHandler`    | Custom                   | Catches all thrown errors and returns the standard error format          |
| `rateLimiter`     | Custom                   | Auth routes: 10 req/min; general API: 100 req/min (defaults)           |
| `authMiddleware`  | Custom (JWT)             | Verifies Bearer token, attaches user context                           |

**Note:** `secureHeaders` comes from Hono's built-in `hono/secure-headers` module -- not the Express `helmet` package. Similarly, `cors` uses `hono/cors`, not a third-party CORS package.

## Account Lockout

To protect against brute-force attacks, FENICE implements account lockout on repeated failed login attempts:

- After **5 consecutive failed login attempts** (configurable via `LOCKOUT_THRESHOLD`), the account is locked for **15 minutes** (configurable via `LOCKOUT_DURATION_MS`)
- The User model tracks this with two fields:
  - `failedLoginAttempts` -- incremented on each failed login
  - `lockoutUntil` -- timestamp indicating when the lockout expires
- A **successful login resets** the `failedLoginAttempts` counter to zero and clears `lockoutUntil`
- Both fields are **excluded from `toJSON` transform** for security -- they never appear in API responses

## Token Revocation

FENICE supports explicit token revocation via a logout endpoint:

- **`POST /api/v1/auth/logout`** -- requires authentication (auth middleware is applied to this route)
- Sets `refreshToken = undefined` on the user document, invalidating any previously issued refresh token
- After logout, any subsequent refresh token requests return **401 Unauthorized**
- This provides a clean server-side logout mechanism rather than relying solely on token expiry

## Graceful Shutdown

The server process in `src/server.ts` registers handlers for `SIGTERM` and `SIGINT` signals:

- On receiving either signal, the handler **disconnects Mongoose** (`mongoose.disconnect()`) before exiting the process
- Shutdown events are **logged via Pino** so they appear in structured logs
- This ensures database connections are properly closed during deployments, container restarts, or manual stops

## Testing Strategy

Currently **222 tests across 40 files**.

- **Unit tests** (`tests/unit/`) -- Test schemas, error classes, config validation, and adapters in isolation
- **Integration tests** (`tests/integration/`) -- Test full HTTP request/response cycles using `app.request()` (Hono's test client -- no running server required)
- **Property tests** (`tests/properties/`) -- Use fast-check to verify schema invariants with generated input
- **WebSocket tests** -- Pure in-memory tests using `WsManager` + `handleMessage` (no real WebSocket connections)
- **Upload tests** -- Use real `UploadService` with `LocalStorageAdapter` and a temp directory
- **Coverage thresholds** -- lines: 60%, branches: 40%, functions: 50%, statements: 60%
- **Lazy initialization** -- Services and middleware use lazy-init patterns to avoid calling `loadEnv()` at import time, which would break test environments

## Database Design

The current schema is a single `User` collection with:
- Email and username uniqueness (compound index)
- bcrypt password hashing via pre-save hook
- `toJSON` transform that removes sensitive fields (`password`, `refreshToken`, `resetPasswordToken`, `resetPasswordExpires`, `__v`) and maps `_id` to `id`
- Role-based access via `RoleEnum`: `superAdmin`, `admin`, `employee`, `client`, `vendor`, `user`
- Timestamps managed by Mongoose (`createdAt`, `updatedAt`)
