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

The `createAdapters()` factory in `src/adapters/index.ts` returns the appropriate set. In development, console/local implementations log operations without requiring external credentials.

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

## Testing Strategy

- **Unit tests** (`tests/unit/`) -- Test schemas, error classes, config validation, and adapters in isolation
- **Integration tests** (`tests/integration/`) -- Test full HTTP request/response cycles via Hono's test client
- **Property tests** (`tests/properties/`) -- Use fast-check to verify schema invariants with generated input
- **Coverage thresholds** -- 80% minimum for lines, branches, functions, and statements
- **Lazy initialization** -- Services and middleware use lazy-init patterns to avoid calling `loadEnv()` at import time, which would break test environments

## Database Design

The current schema is a single `User` collection with:
- Email and username uniqueness (compound index)
- bcrypt password hashing via pre-save hook
- `toJSON` transform that removes sensitive fields (`password`, `refreshToken`, `resetPasswordToken`, `resetPasswordExpires`, `__v`) and maps `_id` to `id`
- Role-based access via `RoleEnum`: `superAdmin`, `admin`, `employee`, `client`, `vendor`, `user`
- Timestamps managed by Mongoose (`createdAt`, `updatedAt`)
