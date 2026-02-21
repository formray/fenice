# FENICE — Design Document

> **Date:** 2026-02-21
> **Status:** Approved
> **Author:** Giuseppe Albrizio + Claude Opus 4.6

---

## 1. Vision

**FENICE** (Italian for "Phoenix") is the rebirth of `typescript-rest-api-backend` — from a 2023 Express boilerplate into an AI-native, production-ready backend platform that doesn't exist yet.

The project has two phases:

- **Phase 1 — Foundation Layer:** An opinionated, AI-native backend starter built on the "Golden Stack" of 2026 (Hono + Zod + Scalar + OpenTelemetry), fully compliant with Formray Engineering Guidelines. A backend designed to be equally navigable by humans and AI agents, where a single Zod schema definition generates types, validation, documentation, and test fixtures automatically. Standalone value as the best TypeScript backend template available.

- **Phase 2 — 3D World:** An interactive 3D platform in the browser where you build, visualize, and operate your backend API as a living city. Buildings are endpoints, streets are routes, traffic is real requests. AI generates the code, the world reflects reality. Internet as a 3D world.

This document covers Phase 1. Phase 2 will have its own design document.

---

## 2. Core Thesis

In 2026, there are two kinds of backends:

1. **Backends for humans** — a developer reads docs, writes code, deploys manually.
2. **Backends for AI** — an agent discovers capabilities, generates code, deploys autonomously.

Almost every template is type 1. FENICE is the first true type 2 — a backend equally navigable by humans and AI agents, with an architecture where **a single definition generates everything else**.

---

## 3. The Golden Stack

### 3.1 Why Hono, not Express

| Aspect | Express | Hono |
|--------|---------|------|
| Size | ~200KB | ~14KB, zero dependencies |
| Standards | Node.js only | Web Standards (fetch, Request, Response) |
| Runtime | Node.js | Node, Bun, Deno, Cloudflare Workers, Lambda |
| TypeScript | Bolted on | First-class, typed routes |
| Zod-OpenAPI | Third-party | `@hono/zod-openapi` — native integration |
| Performance | Adequate | Fastest router in JS ecosystem |
| Future | Maintenance mode | Active development, growing ecosystem |

Express served this project well. But in 2026, Hono is Express done right. The native Zod-OpenAPI integration is the game changer: **the route definition IS the validation IS the documentation IS the type system**.

### 3.2 Full Stack

| Layer | Tool | Why |
|-------|------|-----|
| HTTP Framework | Hono | Web Standards, fastest router, universal runtime |
| Validation + Types + Docs | Zod + `@hono/zod-openapi` | Single source of truth |
| Database | MongoDB + Mongoose | Continuity with project history, Zod as bridge |
| API Documentation | Scalar | Microsoft's choice, interactive, LLM-friendly |
| Logging | Pino | Structured JSON, Formray standard |
| Testing | Vitest + fast-check | Unit + property-based testing |
| Observability | OpenTelemetry auto-instrumentation | Industry standard, vendor-agnostic |
| Dev Runner | tsx watch + tsc --noEmit (parallel) | Instant reload + type safety |
| Pre-commit | Husky + lint-staged | Formray quality gate |
| CI/CD | GitHub Actions | Formray standard |
| Linting | ESLint 9 flat config + strict TypeChecked | Formray standard |
| Formatting | Prettier | Formray standard |
| Module System | ESM (`"type": "module"`) | Modern standard |
| Node.js | 22 LTS | Formray standard |

### 3.3 What Gets Removed

| Removed | Replaced By | Reason |
|---------|-------------|--------|
| Express | Hono | Modern, faster, typed, Zod-native |
| GTS | ESLint 9 flat config + Prettier | Formray standard |
| Winston + Morgan | Pino | Structured JSON, Formray standard |
| Jest + ts-jest | Vitest | 10x faster, ESM native |
| nodemon + ts-node | tsx watch | Instant, zero-config |
| CircleCI | GitHub Actions | Formray standard |
| MySQL support | Removed | Focus on MongoDB, reduce complexity |
| Sparkpost (hardcoded) | Email adapter pattern | No vendor lock-in |
| MessageBird (hardcoded) | Messaging adapter pattern | No vendor lock-in |
| typedoc | Scalar (auto-generated from Zod) | Self-documenting API |

### 3.4 What Stays (Continuity)

- **MongoDB + Mongoose** — project history, proven choice
- **Passport.js** — auth strategy, modernized with Zod validation
- **Docker multi-stage** — updated to Node 22 alpine
- **Kubernetes manifests** — updated
- **Terraform** — updated
- **Route → Controller → Service → Model** pattern — refined, not replaced

---

## 4. Single Definition Architecture

The core innovation. Write ONE thing, get EVERYTHING.

### 4.1 Zod as Single Source of Truth

```typescript
// Define the schema ONCE:
const UserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email(),
  name: z.string().min(2).max(100),
  role: z.enum(['admin', 'user', 'viewer']),
  createdAt: z.string().datetime(),
});

// From this schema, AUTOMATICALLY generated:
// 1. TypeScript type         → type User = z.infer<typeof UserSchema>
// 2. Input validation        → route middleware via @hono/zod-openapi
// 3. OpenAPI specification   → GET /openapi.json
// 4. Scalar documentation    → GET /docs (interactive, beautiful)
// 5. LLM-readable docs       → GET /docs/llm (markdown for AI agents)
// 6. Mongoose schema bridge  → derived via zod-to-mongoose adapter
// 7. Test fixtures           → fast-check arbitraries from Zod schemas
// 8. MCP tool descriptions   → AI agents discover API capabilities
```

### 4.2 Route Definition Pattern

```typescript
import { createRoute, z } from '@hono/zod-openapi';

const getUserRoute = createRoute({
  method: 'get',
  path: '/api/v1/users/{id}',
  tags: ['Users'],
  summary: 'Get user by ID',
  request: {
    params: z.object({ id: z.string().uuid() }),
  },
  responses: {
    200: {
      description: 'User found',
      content: { 'application/json': { schema: UserSchema } },
    },
    404: {
      description: 'User not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

app.openapi(getUserRoute, async (c) => {
  const { id } = c.req.valid('param'); // type-safe, already validated
  const user = await userService.findById(id);
  if (!user) return c.json(errorResponse('NOT_FOUND', 'User not found'), 404);
  return c.json(user, 200);
});
```

**Zero duplication. Zero drift between code and docs. Zero type mismatch possibility.**

---

## 5. AI-Native Layer

### 5.1 MCP Server Endpoint

The backend exposes a Model Context Protocol server that allows any AI agent to discover and use the API:

```
GET /mcp → MCP server endpoint (JSON-RPC 2.0)
```

An AI agent connects and gets:
- List of all capabilities (endpoints) with semantic descriptions
- Input/output schema for each endpoint
- Usage examples
- Current health status

The AI **talks directly to the API** to understand what it can do.

### 5.2 AGENTS.md

A machine-readable file in the repo root that tells any AI coding agent:
- How to set up the project
- How to add an endpoint (which files, which pattern)
- How to add a model (create Zod schema, everything else generates)
- How to test
- How to deploy
- Which conventions to follow

Following the emerging AGENTS.md open standard (20,000+ GitHub repos adopted).

### 5.3 Triple Documentation

```
GET /docs      → Scalar interactive UI (for humans)
GET /docs/llm  → Markdown API reference (for AI agents)
GET /openapi   → OpenAPI 3.1 JSON spec (for tools)
```

Three formats of the same documentation, all generated from the same source (Zod schemas).

### 5.4 CLAUDE.md as Living Architecture

Not a simple "here are the commands". A document describing:
- Architecture and the decisions behind every choice
- Rigid conventions (where every type of file goes)
- Patterns to follow (with concrete examples)
- Commands for every operation
- Invariants that must never be violated

An AI agent reading CLAUDE.md can contribute like a senior developer from day zero.

---

## 6. Adapter Pattern for Services

Every external service is behind an interface. Config decides which implementation to use.

### 6.1 Pattern

```typescript
// adapters/email/types.ts
export interface EmailProvider {
  send(options: EmailOptions): Promise<EmailResult>;
}

// adapters/email/console.adapter.ts  — dev (logs to console)
// adapters/email/resend.adapter.ts   — prod (Resend provider)
```

### 6.2 Adapters

| Service | Dev Adapter | Prod Adapter |
|---------|-------------|-------------|
| Email | Console (logs) | Resend |
| Storage | Local filesystem | Google Cloud Storage |
| Messaging | Console (logs) | Firebase Cloud Messaging |
| PubSub | In-memory EventEmitter | Google Cloud PubSub |

To add a new provider: create one file, implement the interface. Zero changes elsewhere.

---

## 7. Testing Strategy

### 7.1 Vitest (Formray Standard)

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      thresholds: {
        lines: 80,
        branches: 80,
        functions: 80,
        statements: 80,
      },
    },
  },
});
```

### 7.2 Property-Based Testing with fast-check

Instead of writing individual test cases, define properties that must hold for ALL inputs:

```typescript
import fc from 'fast-check';
import { UserCreateSchema } from '../schemas/user.schema';

test('UserCreateSchema accepts all valid shapes', () => {
  fc.assert(
    fc.property(
      fc.record({
        email: fc.emailAddress(),
        name: fc.string({ minLength: 2, maxLength: 100 }),
        password: fc.string({ minLength: 8, maxLength: 128 }),
      }),
      (data) => {
        expect(() => UserCreateSchema.parse(data)).not.toThrow();
      }
    )
  );
});
```

fast-check finds edge cases no developer would think to test. When a test fails, it gives you the **minimal failing case**.

### 7.3 Test Structure

```
tests/
├── unit/           # Service and utility unit tests
├── integration/    # API endpoint integration tests
└── properties/     # fast-check property-based tests
```

---

## 8. Observability

### 8.1 OpenTelemetry Auto-Instrumentation

```typescript
// src/instrumentation.ts — runs BEFORE app code
import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  autoInstrumentations: getNodeAutoInstrumentations(),
});
sdk.start();
```

Zero application code changes. Traces, metrics, and logs are generated automatically for every HTTP request, database query, and external call.

### 8.2 Health Endpoints (Formray Standard)

```
GET /api/v1/health          → { status: "ok" }                    (liveness)
GET /api/v1/health/detailed → { status: "ok", dependencies: {} }  (readiness)
```

### 8.3 Structured Logging with Pino

```typescript
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  timestamp: pino.stdTimeFunctions.isoTime,
  base: {
    service: process.env.SERVICE_NAME || 'fenice',
    version: process.env.npm_package_version,
  },
});
```

### 8.4 Request ID Tracking

Every request gets an `x-request-id` that propagates through all logs and traces.

---

## 9. Security (Formray Standard)

| Area | Implementation |
|------|---------------|
| Input validation | Zod schemas on ALL external input |
| Password hashing | bcrypt, 12 salt rounds |
| JWT | HS256, access tokens 15m, refresh tokens 7d |
| Security headers | Helmet (HSTS, CSP, X-Frame-Options DENY, etc.) |
| Rate limiting | express-rate-limit: 100 req/15min, stricter on auth |
| Encryption at rest | AES-256-GCM |
| Encryption in transit | TLS 1.3 |
| Bot protection | Cloudflare Turnstile (optional) |
| Secrets | Never in code or logs, .env + Zod validation at startup |

---

## 10. Configuration (Formray Standard)

Zod-validated config at startup. Fail fast if any required env var is missing or invalid.

```typescript
// src/config/env.ts
import { z } from 'zod';

const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.coerce.number().default(3000),
  MONGODB_URI: z.string().url(),
  JWT_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  SERVICE_NAME: z.string().default('fenice'),
});

export const env = EnvSchema.parse(process.env);
```

---

## 11. Project Structure

```
fenice/
├── .github/
│   └── workflows/
│       └── ci.yml                    # Lint → Typecheck → Test → Build
├── .husky/
│   └── pre-commit                    # lint-staged
├── docs/
│   ├── ARCHITECTURE.md               # System architecture
│   ├── PROGRESS.md                   # Current work status
│   └── plans/                        # Design documents
│       └── 2026-02-21-fenice-design.md
├── scripts/
│   └── lib.sh                        # Shared shell utilities
├── src/
│   ├── adapters/                     # External service adapters
│   │   ├── email/
│   │   │   ├── types.ts
│   │   │   ├── console.adapter.ts
│   │   │   └── resend.adapter.ts
│   │   ├── storage/
│   │   │   ├── types.ts
│   │   │   ├── local.adapter.ts
│   │   │   └── gcs.adapter.ts
│   │   └── messaging/
│   │       ├── types.ts
│   │       ├── console.adapter.ts
│   │       └── fcm.adapter.ts
│   ├── config/
│   │   └── env.ts                    # Zod-validated config
│   ├── middleware/
│   │   ├── auth.ts                   # JWT verification
│   │   ├── errorHandler.ts           # Global error handler
│   │   ├── requestId.ts              # x-request-id tracking
│   │   └── requestLogger.ts          # Pino request logging
│   ├── models/                       # Mongoose models
│   │   └── user.model.ts
│   ├── routes/
│   │   ├── auth.routes.ts            # Hono OpenAPI route definitions
│   │   ├── user.routes.ts
│   │   └── health.routes.ts
│   ├── schemas/                      # Zod schemas (THE source of truth)
│   │   ├── user.schema.ts
│   │   ├── auth.schema.ts
│   │   └── common.schema.ts          # Error responses, pagination, etc.
│   ├── services/                     # Pure business logic
│   │   ├── auth.service.ts
│   │   └── user.service.ts
│   ├── utils/
│   │   ├── logger.ts                 # Pino setup
│   │   └── errors.ts                 # Custom error classes
│   ├── types/                        # Shared TypeScript types
│   │   └── index.ts
│   ├── instrumentation.ts            # OpenTelemetry setup
│   └── index.ts                      # Entry point
├── tests/
│   ├── unit/
│   ├── integration/
│   └── properties/                   # fast-check property tests
├── AGENTS.md                         # Machine-readable for AI coding agents
├── CHANGELOG.md                      # Keep a Changelog format
├── CLAUDE.md                         # AI agent context (first-class citizen)
├── CONTRIBUTING.md                   # How to contribute
├── LICENSE                           # AGPL-3.0
├── QUICKSTART.md                     # Zero to running in 2 minutes
├── README.md                         # Human-facing documentation
├── ROADMAP.md                        # What comes next
├── setup.sh                          # Install deps, copy .env, verify prereqs
├── dev.sh                            # Start MongoDB (Docker) + server
├── stop.sh                           # Stop everything
├── reset.sh                          # Clean slate
├── Dockerfile                        # Multi-stage Node 22 alpine
├── docker-compose.yml                # MongoDB + app for local dev
├── eslint.config.js                  # Flat config, strict TypeChecked
├── .prettierrc                       # Formray standard
├── vitest.config.ts                  # v8 coverage, 80% thresholds
├── tsconfig.json                     # ES2022, NodeNext, strict
├── .env.example                      # Environment template
├── .gitignore                        # Sensible defaults
└── package.json                      # "type": "module", full script set
```

---

## 12. npm Scripts (Formray Standard)

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "lint": "eslint src tests",
    "lint:fix": "eslint src tests --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "typecheck": "tsc --noEmit",
    "validate": "npm run lint && npm run typecheck && npm run test",
    "prepare": "husky"
  }
}
```

---

## 13. CI/CD Pipeline

```yaml
# .github/workflows/ci.yml
# Triggered on: push to main, pull requests
# Pipeline: Lint → Typecheck → Test (with coverage) → Build
# Node.js 22, npm ci
# Coverage uploaded to codecov
# Security: npm audit
```

---

## 14. API Design (Formray Standard)

### 14.1 Endpoints

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/v1/health` | Liveness check |
| GET | `/api/v1/health/detailed` | Readiness with dependency checks |
| POST | `/api/v1/auth/signup` | Register (Zod validated) |
| POST | `/api/v1/auth/login` | Login → JWT access + refresh |
| POST | `/api/v1/auth/refresh` | Refresh access token |
| GET | `/api/v1/users/me` | Current user profile |
| GET | `/api/v1/users/{id}` | Get user by ID |
| PATCH | `/api/v1/users/{id}` | Update user |
| DELETE | `/api/v1/users/{id}` | Delete user |
| GET | `/docs` | Scalar interactive API docs |
| GET | `/docs/llm` | Markdown API docs for LLMs |
| GET | `/openapi` | OpenAPI 3.1 JSON spec |

### 14.2 Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Invalid email format",
    "details": [
      { "field": "email", "message": "Must be a valid email address" }
    ],
    "requestId": "req_abc123def456"
  }
}
```

---

## 15. Git Conventions (Formray Standard)

- **Commits:** Conventional commits (`feat:`, `fix:`, `chore:`, `docs:`, `test:`, `refactor:`)
- **Breaking changes:** `feat!:` or `fix!:`
- **Co-Author:** `Claude Opus 4.6 <noreply@anthropic.com>`
- **Branches:** Feature branches, no direct commits to main
- **Never commit:** `.env`, credentials, `node_modules/`, `dist/`, `*.pem`, `*.key`

---

## 16. TypeScript Configuration (Formray Standard)

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

---

## 17. Phase 2 Preview — FENICE 3D World

> This is a preview. Full design document will be created separately.

Phase 2 transforms FENICE from a backend template into an interactive 3D platform:

- **React + React Three Fiber** — Declarative 3D in the browser
- **WebAssembly** — Native-performance compute for physics and type-checking
- **City metaphor** — Your API is a city: buildings are endpoints, streets are routes
- **AI Builder** — Click empty lot, describe to AI, endpoint generates
- **Live telemetry** — Real requests visualized as particle flow (OpenTelemetry → WebSocket → 3D)
- **Color-coded health** — Green buildings (200s), yellow (slow), red (errors)

Architecture:

```
┌─────────────────────────────────────────────┐
│         3D World (React Three Fiber)         │
│         Interactive city in the browser       │
├─────────────────────────────────────────────┤
│         AI Builder Layer                      │
│         Claude/LLM generates code from dialog │
├─────────────────────────────────────────────┤
│         FENICE Foundation Layer               │
│         Hono + Zod + MCP + OpenTelemetry      │
│         (the real backend being generated)    │
├─────────────────────────────────────────────┤
│         Live Telemetry Feed                   │
│         OpenTelemetry → WebSocket → 3D World  │
└─────────────────────────────────────────────┘
```

---

## 18. Success Criteria

### Phase 1 — Foundation Layer

- [ ] All Formray Engineering Guidelines quality gates pass
- [ ] `npm run validate` passes (lint + typecheck + test)
- [ ] Coverage > 80% on critical paths
- [ ] OpenAPI spec auto-generated from Zod schemas
- [ ] Scalar docs served at `/docs`
- [ ] LLM-readable docs at `/docs/llm`
- [ ] MCP endpoint functional
- [ ] CLAUDE.md comprehensive and accurate
- [ ] AGENTS.md present and machine-readable
- [ ] `./setup.sh` takes new developer from zero to running
- [ ] Docker build works
- [ ] CI/CD pipeline green
- [ ] Security audit clean (npm audit, no high/critical)
- [ ] All adapters have dev + prod implementations

### Phase 2 — 3D World (future)

- [ ] 3D world renders in browser
- [ ] City reflects real API structure
- [ ] AI builder generates endpoints from natural language
- [ ] Live telemetry visualized
- [ ] Code changes reflect in world and vice versa
