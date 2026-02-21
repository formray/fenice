# AGENTS.md — Machine-Readable Instructions for AI Coding Agents

## Discovery

FENICE exposes structured metadata for AI agents via two discovery mechanisms:

### MCP Endpoint
```
GET /api/v1/mcp
```
Returns an MCP-compatible manifest describing available tools, resources, and instructions. This is the primary discovery mechanism for AI agents using the Model Context Protocol.

### OpenAPI Specification
```
GET /openapi
```
Returns the full OpenAPI 3.1 JSON specification. Use this for structured API exploration.

### LLM Documentation
```
GET /docs/llm
```
Returns a Markdown-formatted API reference optimized for LLM consumption. Includes all endpoints, request/response schemas, and authentication requirements.

## Authentication Flow

FENICE uses JWT Bearer token authentication. All `/api/v1/users/*` endpoints require authentication.

### Step 1: Obtain Tokens
```http
POST /api/v1/auth/signup
Content-Type: application/json

{
  "email": "agent@example.com",
  "username": "agent",
  "fullName": "AI Agent",
  "password": "securepassword123"
}
```

Or login with existing credentials:
```http
POST /api/v1/auth/login
Content-Type: application/json

{
  "email": "agent@example.com",
  "password": "securepassword123"
}
```

Response includes `tokens.accessToken` and `tokens.refreshToken`.

### Step 2: Use Access Token
```http
GET /api/v1/users/me
Authorization: Bearer <accessToken>
```

### Step 3: Refresh When Expired
```http
POST /api/v1/auth/refresh
Content-Type: application/json

{
  "refreshToken": "<refreshToken>"
}
```

Access tokens expire after 15 minutes. Refresh tokens expire after 7 days.

## Available Endpoints

| Method | Path                    | Auth | Description                        |
| ------ | ----------------------- | ---- | ---------------------------------- |
| GET    | /api/v1/health          | No   | Liveness check                     |
| GET    | /api/v1/health/detailed | No   | Readiness check with dependencies  |
| POST   | /api/v1/auth/signup     | No   | Register new user                  |
| POST   | /api/v1/auth/login      | No   | Authenticate user                  |
| POST   | /api/v1/auth/refresh    | No   | Refresh access token               |
| GET    | /api/v1/users/me        | Yes  | Get current user profile           |
| GET    | /api/v1/users/:id       | Yes  | Get user by ID                     |
| PATCH  | /api/v1/users/:id       | Yes  | Update user profile                |
| DELETE | /api/v1/users/:id       | Yes  | Delete user (admin/superAdmin only)|
| GET    | /api/v1/mcp             | No   | MCP discovery manifest             |
| GET    | /openapi                | No   | OpenAPI 3.1 JSON specification     |
| GET    | /docs                   | No   | Scalar interactive API docs        |
| GET    | /docs/llm               | No   | LLM-optimized Markdown docs        |

## Error Format

All errors follow a consistent JSON structure:
```json
{
  "error": {
    "code": "NOT_FOUND",
    "message": "User not found",
    "requestId": "uuid-v4",
    "details": [
      { "field": "email", "message": "Invalid email" }
    ]
  }
}
```

Error codes: `VALIDATION_ERROR`, `NOT_AUTHORIZED`, `FORBIDDEN`, `NOT_FOUND`, `CONFLICT`, `INTERNAL_ERROR`.

## Testing Requirements

When making code changes, agents must ensure:

1. **All existing tests pass:** `npm run test`
2. **Lint passes:** `npm run lint`
3. **Type check passes:** `npm run typecheck`
4. **Full validation:** `npm run validate` (runs all three above)
5. **Coverage thresholds met:** 80% for lines, branches, functions, statements
6. **TDD preferred:** Write or update tests alongside changes

Test locations:
- Unit tests: `tests/unit/`
- Integration tests: `tests/integration/`
- Property tests: `tests/properties/`

## Code Conventions

- ESM with `.js` extensions on all local imports
- Zod schemas are the single source of truth for types, validation, and OpenAPI
- Conventional Commits required for all commit messages
- TypeScript strict mode with `exactOptionalPropertyTypes`
- Adapter pattern for external service integrations

## Development Tools

```bash
./setup.sh    # First-time setup (install deps, create .env)
./dev.sh      # Start MongoDB + dev server
./stop.sh     # Stop all services
./reset.sh    # Full clean and reinstall
```

## Key Files for Context

- `src/index.ts` — Main Hono app with all route mounts
- `src/config/env.ts` — Environment variable schema (Zod-validated)
- `src/schemas/` — All Zod schemas (validation + types + OpenAPI)
- `src/routes/` — OpenAPI route definitions
- `src/services/` — Business logic layer
- `src/models/user.model.ts` — Mongoose User model
- `src/adapters/` — Email, storage, messaging abstractions
- `vitest.config.ts` — Test configuration with coverage thresholds
