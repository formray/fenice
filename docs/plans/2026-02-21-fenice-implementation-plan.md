# FENICE Phase 1 — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Transform `typescript-rest-api-backend` into FENICE — an AI-native, production-ready backend starter built on the 2026 Golden Stack (Hono + Zod + Scalar + OpenTelemetry), fully Formray Engineering Guidelines compliant.

**Architecture:** Complete rewrite of the HTTP layer from Express to Hono with `@hono/zod-openapi`. Zod schemas become the single source of truth for types, validation, OpenAPI, and documentation. Adapter pattern replaces hardcoded vendor services. Pino replaces Winston. Vitest replaces Jest. ESM replaces CommonJS.

**Tech Stack:** Hono, Zod, @hono/zod-openapi, Scalar, Pino, Vitest, fast-check, OpenTelemetry, Mongoose, Passport, Husky, ESLint 9 flat config, Prettier, tsx, Node.js 22

**Repository:** https://github.com/formray/fenice

---

## Task Overview

| # | Task | Estimated Time | Dependencies |
|---|------|---------------|--------------|
| 1 | Project scaffold — clean slate, new package.json, configs | 15 min | None |
| 2 | TypeScript + ESLint + Prettier configuration | 10 min | Task 1 |
| 3 | Zod schemas — the single source of truth | 10 min | Task 2 |
| 4 | Config layer — Zod-validated env at startup | 10 min | Task 3 |
| 5 | Logger — Pino structured logging | 5 min | Task 4 |
| 6 | Hono app skeleton + health endpoints | 10 min | Task 5 |
| 7 | Error handling — middleware + custom errors | 10 min | Task 6 |
| 8 | Mongoose models — bridged from Zod schemas | 10 min | Task 3 |
| 9 | Auth service — bcrypt + JWT | 10 min | Task 8 |
| 10 | Auth routes — signup, login, refresh, me | 15 min | Task 9 |
| 11 | User routes — CRUD with Zod validation | 10 min | Task 9 |
| 12 | Middleware — auth, requestId, requestLogger | 10 min | Task 7 |
| 13 | Adapter pattern — email, storage, messaging | 15 min | Task 5 |
| 14 | OpenAPI + Scalar + LLM docs | 10 min | Task 11 |
| 15 | Vitest setup + unit tests | 15 min | Task 11 |
| 16 | Property-based tests with fast-check | 10 min | Task 15 |
| 17 | Integration tests | 10 min | Task 15 |
| 18 | Husky + lint-staged pre-commit hooks | 5 min | Task 2 |
| 19 | GitHub Actions CI/CD | 10 min | Task 15 |
| 20 | Docker + docker-compose | 10 min | Task 6 |
| 21 | Four-script pattern (setup/dev/stop/reset) | 10 min | Task 20 |
| 22 | OpenTelemetry instrumentation | 10 min | Task 6 |
| 23 | MCP server endpoint | 15 min | Task 14 |
| 24 | Documentation — README, CLAUDE.md, AGENTS.md, CHANGELOG, etc. | 15 min | Task 23 |
| 25 | Infra update — Dockerfile, K8s, Terraform | 10 min | Task 20 |
| 26 | Final validation + security audit | 10 min | Task 25 |

---

## Task 1: Project Scaffold — Clean Slate

**Files:**
- Delete: `jest.config.js`, `typedoc.json`, `src/` (entire old src), `build/`, `target/`, `coverage/`, `logs/`, `public/`
- Create: `package.json` (new)
- Keep: `infra/`, `docs/plans/`, `.git/`, `LICENSE`, `.gitignore`

**Step 1: Remove old source and config files**

Run:
```bash
cd /Users/giuseppealbriziowork/Repos/GitHub/typescript-rest-api-backend
rm -rf src/ build/ target/ coverage/ logs/ public/ jest.config.js typedoc.json node_modules/ package-lock.json
```

**Step 2: Create new package.json**

```json
{
  "name": "fenice",
  "version": "0.1.0",
  "description": "AI-native, production-ready backend starter — Formray Engineering Guidelines compliant",
  "type": "module",
  "main": "dist/index.js",
  "engines": {
    "node": ">=22.0.0"
  },
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "dev:typecheck": "tsc --noEmit --watch",
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
  },
  "keywords": ["backend", "api", "typescript", "hono", "zod", "ai-native", "formray"],
  "author": "Giuseppe Albrizio",
  "license": "AGPL-3.0",
  "repository": {
    "type": "git",
    "url": "https://github.com/formray/fenice.git"
  }
}
```

**Step 3: Install core dependencies**

Run:
```bash
npm install hono @hono/node-server @hono/zod-openapi zod mongoose pino pino-pretty bcryptjs jsonwebtoken helmet cors dotenv
```

**Step 4: Install dev dependencies**

Run:
```bash
npm install -D typescript @types/node @types/bcryptjs @types/jsonwebtoken tsx vitest @vitest/coverage-v8 fast-check eslint @eslint/js typescript-eslint prettier eslint-config-prettier husky lint-staged supertest @types/supertest @scalar/hono-api-reference
```

**Step 5: Create directory structure**

Run:
```bash
mkdir -p src/{adapters/{email,storage,messaging},config,middleware,models,routes,schemas,services,utils,types}
mkdir -p tests/{unit,integration,properties}
mkdir -p scripts
```

**Step 6: Commit**

```bash
git add -A
git commit -m "chore!: scaffold FENICE project structure

BREAKING CHANGE: Complete project restructure from Express to Hono.
Removes all legacy source code, Jest config, and TypeDoc config.
Sets up new package.json with ESM, Hono, Zod, Vitest stack.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: TypeScript + ESLint + Prettier Configuration

**Files:**
- Create: `tsconfig.json` (overwrite)
- Create: `eslint.config.js`
- Create: `.prettierrc`
- Create: `.prettierignore`

**Step 1: Write tsconfig.json**

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
    "sourceMap": true,
    "esModuleInterop": true,
    "resolveJsonModule": true
  },
  "include": ["src"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 2: Write eslint.config.js**

```javascript
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  eslint.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        project: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      '@typescript-eslint/no-unused-vars': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/explicit-function-return-type': 'error',
      '@typescript-eslint/no-floating-promises': 'warn',
    },
  },
  {
    ignores: ['dist/', 'node_modules/', 'coverage/', '*.config.*'],
  }
);
```

**Step 3: Write .prettierrc**

```json
{
  "semi": true,
  "singleQuote": true,
  "tabWidth": 2,
  "trailingComma": "es5",
  "printWidth": 100,
  "arrowParens": "always"
}
```

**Step 4: Write .prettierignore**

```
dist/
node_modules/
coverage/
*.md
```

**Step 5: Commit**

```bash
git add tsconfig.json eslint.config.js .prettierrc .prettierignore
git commit -m "chore: add TypeScript, ESLint 9 flat config, and Prettier

Formray standard: strict TypeScript, strictTypeChecked ESLint,
Prettier with semi, singleQuote, 100 width.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Zod Schemas — The Single Source of Truth

**Files:**
- Create: `src/schemas/common.schema.ts`
- Create: `src/schemas/user.schema.ts`
- Create: `src/schemas/auth.schema.ts`

**Step 1: Write the failing test**

Create `tests/unit/schemas/user.schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { UserSchema, UserCreateSchema } from '../../../src/schemas/user.schema.js';

describe('UserSchema', () => {
  it('should validate a correct user object', () => {
    const user = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
      role: 'user',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(() => UserSchema.parse(user)).not.toThrow();
  });

  it('should reject invalid email', () => {
    const user = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'not-an-email',
      username: 'testuser',
      fullName: 'Test User',
      role: 'user',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(() => UserSchema.parse(user)).toThrow();
  });
});

describe('UserCreateSchema', () => {
  it('should validate signup input', () => {
    const input = {
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
      password: 'securePassword123!',
    };
    expect(() => UserCreateSchema.parse(input)).not.toThrow();
  });

  it('should reject short password', () => {
    const input = {
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
      password: 'short',
    };
    expect(() => UserCreateSchema.parse(input)).toThrow();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/schemas/user.schema.test.ts`
Expected: FAIL — modules don't exist yet

**Step 3: Write common.schema.ts**

```typescript
import { z } from 'zod';

export const ErrorResponseSchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.array(z.object({
      field: z.string().optional(),
      message: z.string(),
    })).optional(),
    requestId: z.string(),
  }),
});

export const PaginationSchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export const SuccessResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
});

export type ErrorResponse = z.infer<typeof ErrorResponseSchema>;
export type Pagination = z.infer<typeof PaginationSchema>;
export type SuccessResponse = z.infer<typeof SuccessResponseSchema>;
```

**Step 4: Write user.schema.ts**

```typescript
import { z } from 'zod';

export const RoleEnum = z.enum(['superAdmin', 'admin', 'employee', 'client', 'vendor', 'user']);

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  username: z.string().min(2).max(50),
  fullName: z.string().min(1).max(100),
  role: RoleEnum.default('user'),
  active: z.boolean().default(true),
  pictureUrl: z.string().url().optional(),
  lastLoginDate: z.string().datetime().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const UserCreateSchema = z.object({
  email: z.string().email(),
  username: z.string().min(2).max(50),
  fullName: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
});

export const UserUpdateSchema = z.object({
  fullName: z.string().min(1).max(100).optional(),
  pictureUrl: z.string().url().optional(),
}).strict();

export type User = z.infer<typeof UserSchema>;
export type UserCreate = z.infer<typeof UserCreateSchema>;
export type UserUpdate = z.infer<typeof UserUpdateSchema>;
```

**Step 5: Write auth.schema.ts**

```typescript
import { z } from 'zod';
import { UserSchema } from './user.schema.js';

export const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export const SignupSchema = z.object({
  email: z.string().email(),
  username: z.string().min(2).max(50),
  fullName: z.string().min(1).max(100),
  password: z.string().min(8).max(128),
});

export const RefreshTokenSchema = z.object({
  refreshToken: z.string().min(1),
});

export const AuthTokensSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
  expiresIn: z.number(),
});

export const AuthResponseSchema = z.object({
  user: UserSchema,
  tokens: AuthTokensSchema,
});

export type Login = z.infer<typeof LoginSchema>;
export type Signup = z.infer<typeof SignupSchema>;
export type RefreshToken = z.infer<typeof RefreshTokenSchema>;
export type AuthTokens = z.infer<typeof AuthTokensSchema>;
export type AuthResponse = z.infer<typeof AuthResponseSchema>;
```

**Step 6: Run test to verify it passes**

Run: `npx vitest run tests/unit/schemas/user.schema.test.ts`
Expected: PASS

**Step 7: Commit**

```bash
git add src/schemas/ tests/unit/schemas/
git commit -m "feat: add Zod schemas as single source of truth

UserSchema, AuthSchema, CommonSchema with full validation.
Types derived via z.infer — zero manual TypeScript interfaces.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Config Layer — Zod-Validated Env at Startup

**Files:**
- Create: `src/config/env.ts`
- Create: `.env.example`

**Step 1: Write the failing test**

Create `tests/unit/config/env.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Environment Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should parse valid environment variables', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/fenice-test';
    process.env.JWT_SECRET = 'a-very-secure-secret-that-is-at-least-32-chars';
    process.env.JWT_REFRESH_SECRET = 'another-very-secure-secret-at-least-32-chars';

    const { EnvSchema } = await import('../../../src/config/env.js');
    const result = EnvSchema.safeParse(process.env);
    expect(result.success).toBe(true);
  });

  it('should fail with missing required vars', async () => {
    process.env = {};
    const { EnvSchema } = await import('../../../src/config/env.js');
    const result = EnvSchema.safeParse(process.env);
    expect(result.success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/config/env.test.ts`
Expected: FAIL

**Step 3: Write env.ts**

```typescript
import { z } from 'zod';

export const EnvSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().default(3000),

  // Database
  MONGODB_URI: z.string().url(),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_ACCESS_EXPIRY: z.string().default('15m'),
  JWT_REFRESH_EXPIRY: z.string().default('7d'),

  // Logging
  LOG_LEVEL: z.enum(['error', 'warn', 'info', 'debug']).default('info'),
  SERVICE_NAME: z.string().default('fenice'),

  // Optional — Adapters (only required in production)
  RESEND_API_KEY: z.string().optional(),
  GCS_BUCKET_NAME: z.string().optional(),
  GCS_PROJECT_ID: z.string().optional(),
  GOOGLE_APPLICATION_CREDENTIALS: z.string().optional(),
  FCM_PROJECT_ID: z.string().optional(),

  // CORS
  CLIENT_URL: z.string().url().optional(),
});

export type Env = z.infer<typeof EnvSchema>;

export function loadEnv(): Env {
  const result = EnvSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    console.error('❌ Invalid environment variables:', JSON.stringify(formatted, null, 2));
    process.exit(1);
  }
  return result.data;
}
```

**Step 4: Write .env.example**

```bash
# ============================================
# FENICE — Environment Variables
# ============================================
# Copy this file to .env and fill in your values
# cp .env.example .env

# Server
NODE_ENV=development
HOST=0.0.0.0
PORT=3000

# Database
MONGODB_URI=mongodb://localhost:27017/fenice

# JWT (generate secrets with: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
JWT_SECRET=change-me-to-a-random-32-char-string
JWT_REFRESH_SECRET=change-me-to-another-random-32-char-string
JWT_ACCESS_EXPIRY=15m
JWT_REFRESH_EXPIRY=7d

# Logging
LOG_LEVEL=debug
SERVICE_NAME=fenice

# CORS
CLIENT_URL=http://localhost:3001

# ============================================
# Optional — Service Adapters (production only)
# ============================================

# Email (Resend)
# RESEND_API_KEY=re_xxxxx

# Google Cloud Storage
# GCS_BUCKET_NAME=fenice-bucket
# GCS_PROJECT_ID=my-project
# GOOGLE_APPLICATION_CREDENTIALS=/path/to/credentials.json

# Firebase Cloud Messaging
# FCM_PROJECT_ID=my-project
```

**Step 5: Run test to verify it passes**

Run: `npx vitest run tests/unit/config/env.test.ts`
Expected: PASS

**Step 6: Commit**

```bash
git add src/config/env.ts .env.example tests/unit/config/
git commit -m "feat: add Zod-validated environment config

Fail-fast at startup if required env vars are missing or invalid.
Adapter env vars optional (only needed in production).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Logger — Pino Structured Logging

**Files:**
- Create: `src/utils/logger.ts`

**Step 1: Write logger.ts**

```typescript
import pino from 'pino';

export function createLogger(serviceName: string, logLevel: string): pino.Logger {
  return pino({
    level: logLevel,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: serviceName,
    },
    transport:
      process.env.NODE_ENV === 'development'
        ? { target: 'pino-pretty', options: { colorize: true } }
        : undefined,
  });
}
```

**Step 2: Commit**

```bash
git add src/utils/logger.ts
git commit -m "feat: add Pino structured logger

JSON output in production, pretty-printed in development.
Formray standard: service name, ISO timestamps, level labels.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Hono App Skeleton + Health Endpoints

**Files:**
- Create: `src/index.ts`
- Create: `src/routes/health.routes.ts`

**Step 1: Write the failing test**

Create `tests/integration/health.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { app } from '../../src/index.js';

describe('Health Endpoints', () => {
  it('GET /api/v1/health should return 200', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  it('GET /api/v1/health/detailed should return 200 with dependencies', async () => {
    const res = await app.request('/api/v1/health/detailed');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('dependencies');
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npx vitest run tests/integration/health.test.ts`
Expected: FAIL

**Step 3: Write health.routes.ts**

```typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import mongoose from 'mongoose';

const healthRouter = new OpenAPIHono();

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Liveness check',
  responses: {
    200: {
      description: 'Service is alive',
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            timestamp: z.string(),
            uptime: z.number(),
          }),
        },
      },
    },
  },
});

const healthDetailedRoute = createRoute({
  method: 'get',
  path: '/health/detailed',
  tags: ['Health'],
  summary: 'Readiness check with dependency status',
  responses: {
    200: {
      description: 'Service readiness with dependency health',
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            timestamp: z.string(),
            uptime: z.number(),
            dependencies: z.object({
              mongodb: z.object({
                status: z.string(),
                responseTime: z.number().optional(),
              }),
            }),
          }),
        },
      },
    },
  },
});

healthRouter.openapi(healthRoute, (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }, 200);
});

healthRouter.openapi(healthDetailedRoute, async (c) => {
  const mongoStart = Date.now();
  const mongoStatus = mongoose.connection.readyState === 1 ? 'ok' : 'degraded';
  const mongoResponseTime = Date.now() - mongoStart;

  const overallStatus = mongoStatus === 'ok' ? 'ok' : 'degraded';

  return c.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dependencies: {
      mongodb: {
        status: mongoStatus,
        responseTime: mongoResponseTime,
      },
    },
  }, 200);
});

export { healthRouter };
```

**Step 4: Write src/index.ts**

```typescript
import { OpenAPIHono } from '@hono/zod-openapi';
import { healthRouter } from './routes/health.routes.js';

export const app = new OpenAPIHono();

// Mount API routes
app.route('/api/v1', healthRouter);

// Default export for server
export default app;
```

**Step 5: Create src/server.ts (entry point)**

```typescript
import { serve } from '@hono/node-server';
import dotenv from 'dotenv';
import mongoose from 'mongoose';
import { app } from './index.js';
import { loadEnv } from './config/env.js';
import { createLogger } from './utils/logger.js';

dotenv.config();

const env = loadEnv();
const logger = createLogger(env.SERVICE_NAME, env.LOG_LEVEL);

async function start(): Promise<void> {
  try {
    await mongoose.connect(env.MONGODB_URI);
    logger.info('Connected to MongoDB');

    serve({
      fetch: app.fetch,
      port: env.PORT,
      hostname: env.HOST,
    }, (info) => {
      logger.info(`🔥 FENICE is running on http://${env.HOST}:${info.port}`);
    });
  } catch (error) {
    logger.error({ error }, 'Failed to start server');
    process.exit(1);
  }
}

start();
```

**Step 6: Update package.json scripts**

Update `"dev"` to: `"tsx watch src/server.ts"` and `"start"` to: `"node dist/server.js"`

**Step 7: Run test to verify it passes**

Run: `npx vitest run tests/integration/health.test.ts`
Expected: PASS

**Step 8: Commit**

```bash
git add src/index.ts src/server.ts src/routes/health.routes.ts tests/integration/health.test.ts package.json
git commit -m "feat: add Hono app skeleton with health endpoints

GET /api/v1/health (liveness) and GET /api/v1/health/detailed (readiness).
Both auto-documented via @hono/zod-openapi.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Error Handling

**Files:**
- Create: `src/utils/errors.ts`
- Create: `src/middleware/errorHandler.ts`

**Step 1: Write errors.ts**

```typescript
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: string,
    message: string,
    public readonly details?: Array<{ field?: string; message: string }>
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Resource not found') {
    super(404, 'NOT_FOUND', message);
  }
}

export class NotAuthorizedError extends AppError {
  constructor(message = 'Not authorized') {
    super(401, 'NOT_AUTHORIZED', message);
  }
}

export class ForbiddenError extends AppError {
  constructor(message = 'Forbidden') {
    super(403, 'FORBIDDEN', message);
  }
}

export class ValidationError extends AppError {
  constructor(details: Array<{ field?: string; message: string }>) {
    super(400, 'VALIDATION_ERROR', 'Validation failed', details);
  }
}
```

**Step 2: Write errorHandler.ts**

```typescript
import type { Context } from 'hono';
import type { ErrorResponse } from '../schemas/common.schema.js';
import { AppError } from '../utils/errors.js';
import { ZodError } from 'zod';

export function errorResponse(
  code: string,
  message: string,
  requestId: string,
  details?: Array<{ field?: string; message: string }>
): ErrorResponse {
  return {
    error: {
      code,
      message,
      requestId,
      ...(details && { details }),
    },
  };
}

export function handleError(err: Error, c: Context): Response {
  const requestId = c.get('requestId') as string || 'unknown';

  if (err instanceof AppError) {
    return c.json(
      errorResponse(err.code, err.message, requestId, err.details),
      err.statusCode as 400 | 401 | 403 | 404 | 500
    );
  }

  if (err instanceof ZodError) {
    const details = err.errors.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return c.json(errorResponse('VALIDATION_ERROR', 'Validation failed', requestId, details), 400);
  }

  // Unknown error
  console.error('Unhandled error:', err);
  return c.json(
    errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', requestId),
    500
  );
}
```

**Step 3: Commit**

```bash
git add src/utils/errors.ts src/middleware/errorHandler.ts
git commit -m "feat: add error handling layer

AppError hierarchy (NotFound, NotAuthorized, Forbidden, Validation).
Global error handler with Zod error formatting and requestId tracking.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Mongoose Models — Bridged from Zod Schemas

**Files:**
- Create: `src/models/user.model.ts`

**Step 1: Write user.model.ts**

```typescript
import mongoose, { Schema, type Document } from 'mongoose';
import bcrypt from 'bcryptjs';
import type { User } from '../schemas/user.schema.js';
import { RoleEnum } from '../schemas/user.schema.js';

export interface UserDocument extends Omit<User, 'id'>, Document {
  password: string;
  refreshToken?: string;
  resetPasswordToken?: string;
  resetPasswordExpires?: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

const userSchema = new Schema<UserDocument>(
  {
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
    },
    username: {
      type: String,
      required: true,
      unique: true,
      trim: true,
      minlength: 2,
      maxlength: 50,
    },
    fullName: {
      type: String,
      required: true,
      trim: true,
      minlength: 1,
      maxlength: 100,
    },
    password: {
      type: String,
      required: true,
      minlength: 8,
    },
    role: {
      type: String,
      enum: RoleEnum.options,
      default: 'user',
    },
    active: {
      type: Boolean,
      default: true,
    },
    pictureUrl: String,
    lastLoginDate: Date,
    refreshToken: String,
    resetPasswordToken: String,
    resetPasswordExpires: Date,
  },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        delete ret.password;
        delete ret.refreshToken;
        delete ret.resetPasswordToken;
        delete ret.resetPasswordExpires;
        return ret;
      },
    },
  }
);

userSchema.index({ email: 1, username: 1 });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function (
  candidatePassword: string
): Promise<boolean> {
  return bcrypt.compare(candidatePassword, this.password);
};

export const UserModel = mongoose.model<UserDocument>('User', userSchema);
```

**Step 2: Commit**

```bash
git add src/models/user.model.ts
git commit -m "feat: add Mongoose User model bridged from Zod schema

bcrypt 12 rounds, role enum from Zod, timestamps, clean toJSON.
Password excluded from serialization by default.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Auth Service

**Files:**
- Create: `src/services/auth.service.ts`

**Step 1: Write auth.service.ts**

```typescript
import jwt from 'jsonwebtoken';
import { UserModel, type UserDocument } from '../models/user.model.js';
import type { Signup, Login, AuthTokens } from '../schemas/auth.schema.js';
import { NotAuthorizedError, AppError } from '../utils/errors.js';

export class AuthService {
  constructor(
    private readonly jwtSecret: string,
    private readonly jwtRefreshSecret: string,
    private readonly accessExpiry: string,
    private readonly refreshExpiry: string
  ) {}

  async signup(data: Signup): Promise<{ user: UserDocument; tokens: AuthTokens }> {
    const existingUser = await UserModel.findOne({
      $or: [{ email: data.email }, { username: data.username }],
    });

    if (existingUser) {
      throw new AppError(409, 'CONFLICT', 'User with this email or username already exists');
    }

    const user = await UserModel.create(data);
    const tokens = this.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return { user, tokens };
  }

  async login(data: Login): Promise<{ user: UserDocument; tokens: AuthTokens }> {
    const user = await UserModel.findOne({ email: data.email });
    if (!user || !user.active) {
      throw new NotAuthorizedError('Invalid credentials');
    }

    const isMatch = await user.comparePassword(data.password);
    if (!isMatch) {
      throw new NotAuthorizedError('Invalid credentials');
    }

    user.lastLoginDate = new Date();
    const tokens = this.generateTokens(user);
    user.refreshToken = tokens.refreshToken;
    await user.save();

    return { user, tokens };
  }

  async refresh(refreshToken: string): Promise<AuthTokens> {
    try {
      const payload = jwt.verify(refreshToken, this.jwtRefreshSecret) as { userId: string };
      const user = await UserModel.findById(payload.userId);

      if (!user || user.refreshToken !== refreshToken) {
        throw new NotAuthorizedError('Invalid refresh token');
      }

      const tokens = this.generateTokens(user);
      user.refreshToken = tokens.refreshToken;
      await user.save();

      return tokens;
    } catch {
      throw new NotAuthorizedError('Invalid refresh token');
    }
  }

  private generateTokens(user: UserDocument): AuthTokens {
    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      this.jwtSecret,
      { expiresIn: this.accessExpiry }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      this.jwtRefreshSecret,
      { expiresIn: this.refreshExpiry }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 900, // 15 minutes in seconds
    };
  }
}
```

**Step 2: Commit**

```bash
git add src/services/auth.service.ts
git commit -m "feat: add auth service with JWT access/refresh tokens

Signup, login, refresh flow. Access tokens 15m, refresh tokens 7d.
bcrypt password comparison via Mongoose model method.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Auth Routes

**Files:**
- Create: `src/routes/auth.routes.ts`

**Step 1: Write auth.routes.ts with Zod-OpenAPI**

```typescript
import { OpenAPIHono, createRoute } from '@hono/zod-openapi';
import { z } from 'zod';
import { LoginSchema, SignupSchema, RefreshTokenSchema, AuthResponseSchema } from '../schemas/auth.schema.js';
import { ErrorResponseSchema } from '../schemas/common.schema.js';
import { AuthService } from '../services/auth.service.js';
import { loadEnv } from '../config/env.js';

const authRouter = new OpenAPIHono();
const env = loadEnv();

const authService = new AuthService(
  env.JWT_SECRET,
  env.JWT_REFRESH_SECRET,
  env.JWT_ACCESS_EXPIRY,
  env.JWT_REFRESH_EXPIRY
);

const signupRoute = createRoute({
  method: 'post',
  path: '/auth/signup',
  tags: ['Authentication'],
  summary: 'Register a new user',
  request: {
    body: {
      content: { 'application/json': { schema: SignupSchema } },
    },
  },
  responses: {
    201: {
      description: 'User created successfully',
      content: { 'application/json': { schema: AuthResponseSchema } },
    },
    409: {
      description: 'User already exists',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

const loginRoute = createRoute({
  method: 'post',
  path: '/auth/login',
  tags: ['Authentication'],
  summary: 'Login with email and password',
  request: {
    body: {
      content: { 'application/json': { schema: LoginSchema } },
    },
  },
  responses: {
    200: {
      description: 'Login successful',
      content: { 'application/json': { schema: AuthResponseSchema } },
    },
    401: {
      description: 'Invalid credentials',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

const refreshRoute = createRoute({
  method: 'post',
  path: '/auth/refresh',
  tags: ['Authentication'],
  summary: 'Refresh access token',
  request: {
    body: {
      content: { 'application/json': { schema: RefreshTokenSchema } },
    },
  },
  responses: {
    200: {
      description: 'Token refreshed',
      content: {
        'application/json': {
          schema: z.object({
            accessToken: z.string(),
            refreshToken: z.string(),
            expiresIn: z.number(),
          }),
        },
      },
    },
    401: {
      description: 'Invalid refresh token',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

authRouter.openapi(signupRoute, async (c) => {
  const body = c.req.valid('json');
  const { user, tokens } = await authService.signup(body);
  return c.json({ user: user.toJSON(), tokens }, 201);
});

authRouter.openapi(loginRoute, async (c) => {
  const body = c.req.valid('json');
  const { user, tokens } = await authService.login(body);
  return c.json({ user: user.toJSON(), tokens }, 200);
});

authRouter.openapi(refreshRoute, async (c) => {
  const { refreshToken } = c.req.valid('json');
  const tokens = await authService.refresh(refreshToken);
  return c.json(tokens, 200);
});

export { authRouter };
```

**Step 2: Register routes in src/index.ts**

Add `import { authRouter } from './routes/auth.routes.js';` and `app.route('/api/v1', authRouter);`

**Step 3: Commit**

```bash
git add src/routes/auth.routes.ts src/index.ts
git commit -m "feat: add auth routes — signup, login, refresh

All routes auto-documented via @hono/zod-openapi.
Zod validates input, types inferred, OpenAPI spec generated.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 11: User Routes — CRUD

**Files:**
- Create: `src/routes/user.routes.ts`
- Create: `src/services/user.service.ts`

**Step 1: Write user.service.ts**

```typescript
import { UserModel, type UserDocument } from '../models/user.model.js';
import type { UserUpdate } from '../schemas/user.schema.js';
import { NotFoundError } from '../utils/errors.js';

export class UserService {
  async findById(id: string): Promise<UserDocument> {
    const user = await UserModel.findById(id);
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async update(id: string, data: UserUpdate): Promise<UserDocument> {
    const user = await UserModel.findByIdAndUpdate(id, data, { new: true, runValidators: true });
    if (!user) throw new NotFoundError('User not found');
    return user;
  }

  async delete(id: string): Promise<void> {
    const user = await UserModel.findByIdAndDelete(id);
    if (!user) throw new NotFoundError('User not found');
  }
}
```

**Step 2: Write user.routes.ts with Zod-OpenAPI route definitions**

Create the routes for GET `/users/me`, GET `/users/{id}`, PATCH `/users/{id}`, DELETE `/users/{id}`, all with proper Zod schemas for request/response and OpenAPI tags.

**Step 3: Register routes in src/index.ts**

**Step 4: Commit**

```bash
git add src/routes/user.routes.ts src/services/user.service.ts src/index.ts
git commit -m "feat: add user CRUD routes with Zod-OpenAPI

GET /users/me, GET /users/:id, PATCH /users/:id, DELETE /users/:id.
All auto-documented. UserService handles business logic.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Middleware — Auth, RequestId, RequestLogger

**Files:**
- Create: `src/middleware/auth.ts`
- Create: `src/middleware/requestId.ts`
- Create: `src/middleware/requestLogger.ts`

**Step 1: Write all three middleware files**

- `auth.ts`: JWT verification from `Authorization: Bearer` header, sets `userId`, `email`, `role` in context
- `requestId.ts`: Generates or passes through `x-request-id` header, sets in context
- `requestLogger.ts`: Pino-based request/response logging with duration, method, path, status

**Step 2: Apply middleware in src/index.ts**

**Step 3: Commit**

```bash
git add src/middleware/ src/index.ts
git commit -m "feat: add auth, requestId, and requestLogger middleware

JWT verification, x-request-id tracking, Pino request logging.
All middleware composable via Hono's middleware pattern.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 13: Adapter Pattern — Email, Storage, Messaging

**Files:**
- Create: `src/adapters/email/types.ts`
- Create: `src/adapters/email/console.adapter.ts`
- Create: `src/adapters/email/resend.adapter.ts`
- Create: `src/adapters/storage/types.ts`
- Create: `src/adapters/storage/local.adapter.ts`
- Create: `src/adapters/storage/gcs.adapter.ts`
- Create: `src/adapters/messaging/types.ts`
- Create: `src/adapters/messaging/console.adapter.ts`
- Create: `src/adapters/messaging/fcm.adapter.ts`
- Create: `src/adapters/index.ts` (factory)

**Step 1: Write adapter interfaces and implementations**

Each adapter follows the same pattern: interface → console adapter (dev) → production adapter.

**Step 2: Write factory that selects adapter based on NODE_ENV**

**Step 3: Write tests for console adapters**

**Step 4: Commit**

```bash
git add src/adapters/ tests/unit/adapters/
git commit -m "feat: add adapter pattern for external services

Email (console/Resend), Storage (local/GCS), Messaging (console/FCM).
Factory selects adapter based on environment. Zero vendor lock-in.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 14: OpenAPI + Scalar + LLM Docs

**Files:**
- Modify: `src/index.ts`

**Step 1: Add OpenAPI spec endpoint**

```typescript
app.doc('/openapi', {
  openapi: '3.1.0',
  info: {
    title: 'FENICE API',
    version: '0.1.0',
    description: 'AI-native, production-ready backend API',
  },
  servers: [{ url: 'http://localhost:3000' }],
});
```

**Step 2: Add Scalar documentation UI**

```typescript
import { apiReference } from '@scalar/hono-api-reference';

app.get('/docs', apiReference({
  theme: 'kepler',
  spec: { url: '/openapi' },
}));
```

**Step 3: Add LLM-readable markdown docs endpoint**

```typescript
app.get('/docs/llm', async (c) => {
  const spec = app.getOpenAPI31Document({
    openapi: '3.1.0',
    info: { title: 'FENICE API', version: '0.1.0' },
  });
  // Convert OpenAPI spec to markdown for LLM consumption
  const markdown = generateMarkdownFromSpec(spec);
  return c.text(markdown);
});
```

**Step 4: Commit**

```bash
git add src/index.ts
git commit -m "feat: add Scalar API docs + LLM-readable endpoint

GET /docs — Scalar interactive UI (for humans)
GET /docs/llm — Markdown API reference (for AI agents)
GET /openapi — OpenAPI 3.1 JSON spec (for tools)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 15: Vitest Setup + Unit Tests

**Files:**
- Create: `vitest.config.ts`
- Create unit tests for services and utils

**Step 1: Write vitest.config.ts**

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'lcov'],
      include: ['src/**/*.ts'],
      exclude: ['src/server.ts', 'src/instrumentation.ts'],
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

**Step 2: Write unit tests for auth.service, user.service, errors, logger**

**Step 3: Run full test suite**

Run: `npx vitest run --coverage`
Expected: All tests pass, coverage > 80%

**Step 4: Commit**

```bash
git add vitest.config.ts tests/
git commit -m "test: add Vitest config and unit test suite

Coverage thresholds at 80% (Formray standard).
Tests for auth service, user service, schemas, errors.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 16: Property-Based Tests with fast-check

**Files:**
- Create: `tests/properties/schemas.property.test.ts`

**Step 1: Write property tests for Zod schemas**

Use fast-check to generate thousands of random inputs and verify schemas accept all valid shapes and reject all invalid ones.

**Step 2: Commit**

```bash
git add tests/properties/
git commit -m "test: add property-based tests with fast-check

Verify Zod schemas handle all edge cases automatically.
Generates thousands of random inputs per test run.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 17: Integration Tests

**Files:**
- Create: `tests/integration/auth.test.ts`
- Create: `tests/integration/user.test.ts`

**Step 1: Write integration tests using Hono's built-in test client**

Test the full request→response cycle for auth and user endpoints.

**Step 2: Commit**

```bash
git add tests/integration/
git commit -m "test: add API integration tests

Full request→response cycle tests for auth and user endpoints.
Uses Hono's built-in request testing (no supertest needed).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 18: Husky + lint-staged

**Files:**
- Create: `.husky/pre-commit`
- Modify: `package.json` (lint-staged config)

**Step 1: Initialize Husky**

Run: `npx husky init`

**Step 2: Configure lint-staged in package.json**

```json
{
  "lint-staged": {
    "*.{ts,tsx}": ["eslint --fix", "prettier --write"],
    "*.{json,md,yml,yaml}": ["prettier --write"]
  }
}
```

**Step 3: Write pre-commit hook**

```bash
npx lint-staged
```

**Step 4: Commit**

```bash
git add .husky/ package.json
git commit -m "chore: add Husky pre-commit hooks with lint-staged

Auto-fix ESLint + Prettier on staged files before every commit.
Formray quality gate enforced.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 19: GitHub Actions CI/CD

**Files:**
- Create: `.github/workflows/ci.yml`

**Step 1: Write CI workflow**

Pipeline: Lint → Typecheck → Test (with coverage) → Build
Triggered on push to main and pull requests.
Node.js 22, MongoDB service container.

**Step 2: Commit**

```bash
git add .github/
git commit -m "ci: add GitHub Actions CI pipeline

Lint → Typecheck → Test → Build on every PR and push to main.
MongoDB service container for integration tests.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 20: Docker + docker-compose

**Files:**
- Overwrite: `Dockerfile`
- Create: `docker-compose.yml`

**Step 1: Write multi-stage Dockerfile for Node 22 alpine**

**Step 2: Write docker-compose.yml with MongoDB + app**

```yaml
services:
  mongodb:
    image: mongo:7
    ports:
      - "27017:27017"
    volumes:
      - mongodb_data:/data/db

  app:
    build: .
    ports:
      - "3000:3000"
    environment:
      - MONGODB_URI=mongodb://mongodb:27017/fenice
    depends_on:
      - mongodb

volumes:
  mongodb_data:
```

**Step 3: Commit**

```bash
git add Dockerfile docker-compose.yml
git commit -m "chore: add Docker multi-stage build + docker-compose

Node 22 alpine, multi-stage for minimal production image.
docker-compose with MongoDB 7 for local development.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 21: Four-Script Pattern

**Files:**
- Create: `setup.sh`, `dev.sh`, `stop.sh`, `reset.sh`
- Create: `scripts/lib.sh`

**Step 1: Write shared lib.sh with color utilities and helper functions**

**Step 2: Write setup.sh — install deps, copy .env, verify prerequisites**

**Step 3: Write dev.sh — start MongoDB via docker-compose, run tsx watch**

**Step 4: Write stop.sh — stop docker-compose**

**Step 5: Write reset.sh — clean slate (node_modules, dist, Docker volumes)**

**Step 6: Make scripts executable**

Run: `chmod +x setup.sh dev.sh stop.sh reset.sh scripts/lib.sh`

**Step 7: Commit**

```bash
git add setup.sh dev.sh stop.sh reset.sh scripts/lib.sh
git commit -m "chore: add four-script pattern (setup/dev/stop/reset)

Formray standard: one-command setup, one-command dev, clean reset.
Shared lib.sh with color utilities and prerequisite checks.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 22: OpenTelemetry Instrumentation

**Files:**
- Create: `src/instrumentation.ts`

**Step 1: Install OpenTelemetry packages**

Run: `npm install @opentelemetry/sdk-node @opentelemetry/auto-instrumentations-node @opentelemetry/exporter-trace-otlp-http`

**Step 2: Write instrumentation.ts**

**Step 3: Update dev script to load instrumentation before app**

**Step 4: Commit**

```bash
git add src/instrumentation.ts package.json
git commit -m "feat: add OpenTelemetry auto-instrumentation

Zero-code observability for HTTP, MongoDB, and external calls.
Traces, metrics, and logs generated automatically.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 23: MCP Server Endpoint

**Files:**
- Create: `src/routes/mcp.routes.ts`

**Step 1: Install MCP SDK**

Run: `npm install @modelcontextprotocol/sdk`

**Step 2: Create MCP endpoint that exposes API capabilities**

The MCP server reads the OpenAPI spec and exposes each endpoint as a tool that AI agents can discover and invoke.

**Step 3: Register in src/index.ts**

**Step 4: Commit**

```bash
git add src/routes/mcp.routes.ts src/index.ts package.json
git commit -m "feat: add MCP server endpoint for AI agent discovery

AI agents can discover and invoke API capabilities via MCP protocol.
Auto-generated from OpenAPI spec — always in sync with code.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 24: Documentation

**Files:**
- Create: `CLAUDE.md`
- Create: `AGENTS.md`
- Overwrite: `README.md`
- Create: `CHANGELOG.md`
- Overwrite: `CONTRIBUTING.md`
- Create: `QUICKSTART.md`
- Create: `ROADMAP.md`
- Create: `docs/ARCHITECTURE.md`

**Step 1: Write each documentation file following Formray standards**

- `CLAUDE.md` — comprehensive AI agent context
- `AGENTS.md` — machine-readable instructions for AI coding agents
- `README.md` — human-facing, with feature list and quick start
- `CHANGELOG.md` — Keep a Changelog format
- `QUICKSTART.md` — zero to running in 2 minutes
- `ROADMAP.md` — Phase 1 checklist + Phase 2 preview
- `docs/ARCHITECTURE.md` — architecture decisions and patterns

**Step 2: Commit**

```bash
git add CLAUDE.md AGENTS.md README.md CHANGELOG.md CONTRIBUTING.md QUICKSTART.md ROADMAP.md docs/ARCHITECTURE.md
git commit -m "docs: add comprehensive documentation suite

CLAUDE.md (AI context), AGENTS.md (machine-readable), README.md,
CHANGELOG.md, QUICKSTART.md, ROADMAP.md, ARCHITECTURE.md.
Formray documentation standards compliant.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 25: Infra Update

**Files:**
- Update: `Dockerfile` (already done in Task 20)
- Update: `infra/k8s/` and `infra/k8s-dev/` deployment manifests
- Update: `infra/terraform/` provider versions

**Step 1: Update K8s manifests for FENICE**

- Change image references
- Update environment variables to match new .env schema
- Remove MySQL-related config
- Remove vendor-specific secrets (SparkPost, MessageBird)
- Add health check paths to match new `/api/v1/health`

**Step 2: Update Terraform provider to latest**

**Step 3: Commit**

```bash
git add infra/
git commit -m "chore: update infra for FENICE

K8s manifests updated for new env schema and health endpoints.
Removed MySQL and vendor-specific secrets.
Terraform provider updated.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 26: Final Validation + Security Audit

**Step 1: Run full validation**

```bash
npm run validate
```
Expected: lint passes, typecheck passes, all tests pass

**Step 2: Run security audit**

```bash
npm audit
```
Expected: No high or critical vulnerabilities

**Step 3: Test Docker build**

```bash
docker compose build
```
Expected: Build succeeds

**Step 4: Test full startup**

```bash
./setup.sh && ./dev.sh
```
Expected: Server starts, health endpoints respond

**Step 5: Verify Scalar docs**

Open `http://localhost:3000/docs` — interactive API documentation
Open `http://localhost:3000/docs/llm` — LLM-readable markdown
Open `http://localhost:3000/openapi` — OpenAPI JSON spec

**Step 6: Final commit — update .gitignore**

```bash
git add .gitignore
git commit -m "chore: update .gitignore for FENICE

Add dist/, coverage/, *.env patterns.
Remove legacy entries (build/, docs/).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

**Step 7: Tag release**

```bash
git tag -a v0.1.0 -m "FENICE v0.1.0 — Phase 1 Foundation Layer complete"
```

---

## Execution Notes

- **Each task is independently committable** — if something breaks, you can bisect
- **TDD approach** — tests first where applicable (Tasks 3, 4, 6, 15-17)
- **Frequent commits** — one commit per logical unit of work
- **Convention:** All commits use Conventional Commits format with Co-Authored-By
- **Dependencies:** Follow the task order — each task builds on the previous
- **Total estimated time:** 4-5 hours for a skilled developer/AI agent
