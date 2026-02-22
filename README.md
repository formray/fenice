# FENICE

**AI-native, production-ready backend platform.**

[![Node.js 22](https://img.shields.io/badge/Node.js-22_LTS-339933?logo=nodedotjs&logoColor=white)](https://nodejs.org/)
[![Hono](https://img.shields.io/badge/Hono-4.x-E36002?logo=hono&logoColor=white)](https://hono.dev/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.x-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Zod](https://img.shields.io/badge/Zod-v4-3E67B1?logo=zod&logoColor=white)](https://zod.dev/)
[![MongoDB](https://img.shields.io/badge/MongoDB-7-47A248?logo=mongodb&logoColor=white)](https://www.mongodb.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

FENICE (Italian for "phoenix") is a backend starter platform built on the **2026 Golden Stack**. It provides a complete foundation for production REST APIs with authentication, user management, AI agent discovery, and observability built in from the start.

---

## Features

- **Hono + Zod OpenAPI** -- Type-safe routes with automatic OpenAPI 3.1 spec generation
- **Zod v4 as Single Source of Truth** -- One schema drives validation, TypeScript types, and API documentation
- **Mongoose v9 + MongoDB** -- Production-ready data layer with bcrypt password hashing
- **JWT Authentication** -- Access + refresh token flow with configurable expiry
- **MCP Server Endpoint** -- Model Context Protocol discovery for AI agent integration
- **Scalar Interactive Docs** -- Beautiful API documentation UI at `/docs`
- **LLM-Readable Docs** -- Markdown API reference optimized for AI consumption at `/docs/llm`
- **FENICE 3D World (M1)** -- React + R3F static city generated from live OpenAPI
- **OpenTelemetry** -- Auto-instrumented distributed tracing
- **Pino Structured Logging** -- JSON logging with request correlation
- **Adapter Pattern** -- Vendor-independent abstractions for email (Resend), storage (GCS), messaging (FCM)
- **Vitest + fast-check** -- Modern testing with property-based testing support
- **Docker Multi-Stage Build** -- Optimized production images with health checks
- **GitHub Actions CI** -- Lint, typecheck, test, and build on every push
- **Four-Script Pattern** -- `setup.sh`, `dev.sh`, `stop.sh`, `reset.sh` for consistent workflows
- **Husky + lint-staged** -- Pre-commit quality enforcement

## Quick Start

```bash
# Clone and enter
git clone https://github.com/formray/fenice.git
cd fenice

# Setup (installs deps, creates .env)
./setup.sh

# Start development (MongoDB via Docker + dev server)
./dev.sh

# Visit the API docs
open http://localhost:3000/docs
```

See [QUICKSTART.md](QUICKSTART.md) for a detailed walkthrough.

## API Endpoints

| Method | Path                        | Auth | Description                       |
| ------ | --------------------------- | ---- | --------------------------------- |
| GET    | `/api/v1/health`            | No   | Liveness check                    |
| GET    | `/api/v1/health/detailed`   | No   | Readiness check with dependencies |
| POST   | `/api/v1/auth/signup`       | No   | Register a new user               |
| POST   | `/api/v1/auth/login`        | No   | Authenticate user                 |
| POST   | `/api/v1/auth/refresh`      | No   | Refresh access token              |
| GET    | `/api/v1/users/me`          | Yes  | Get current user profile          |
| GET    | `/api/v1/users/:id`         | Yes  | Get user by ID                    |
| PATCH  | `/api/v1/users/:id`         | Yes  | Update user profile               |
| DELETE | `/api/v1/users/:id`         | Yes  | Delete user (admin only)          |
| GET    | `/api/v1/mcp`               | No   | MCP discovery manifest            |
| GET    | `/api/v1/world-ws`          | Yes  | WebSocket world stream (3D client)|
| GET    | `/openapi`                  | No   | OpenAPI 3.1 JSON specification    |
| GET    | `/docs`                     | No   | Scalar interactive API docs       |
| GET    | `/docs/llm`                 | No   | LLM-readable Markdown docs        |

## Architecture

```
Client Request
  -> Middleware (requestId, requestLogger)
  -> Auth Middleware (JWT, on protected routes)
  -> OpenAPI Route (Zod validation)
  -> Service (business logic)
  -> Mongoose Model (MongoDB)
  -> JSON Response
```

**Key design decisions:**

- **Hono over Express** -- Modern, edge-ready framework with first-class OpenAPI support
- **Zod as SSoT** -- One schema for validation, types, and documentation eliminates drift
- **Adapter pattern** -- Swap email/storage/messaging providers without touching business logic
- **MCP endpoint** -- AI agents discover and use the API without human documentation
- **OpenTelemetry** -- Vendor-neutral observability from day one

See [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for detailed architecture decisions.

## Project Structure

```
src/
  index.ts              # Hono app (routes, middleware, OpenAPI, Scalar)
  server.ts             # Entry point (MongoDB connect, @hono/node-server)
  instrumentation.ts    # OpenTelemetry auto-instrumentation
  config/env.ts         # Zod-validated environment variables
  schemas/              # Zod schemas (SSoT for types + validation + OpenAPI)
  models/               # Mongoose models
  services/             # Business logic layer
  routes/               # OpenAPI route definitions
  middleware/            # Auth, error handling, logging, request ID
  adapters/             # Email, storage, messaging abstractions
  utils/                # Errors, logger, LLM docs generator
client/
  src/                  # React + R3F 3D world client (M1)
docs/3d-world/          # 3D world plans, ADRs, boards, and execution docs
tests/
  unit/                 # Unit tests (schemas, config, errors, adapters)
  integration/          # Integration tests (health, auth, docs, MCP)
  properties/           # fast-check property-based tests
```

## Scripts

```bash
# Development
npm run dev              # tsx watch with OTel instrumentation
npm run dev:typecheck    # tsc --noEmit --watch

# Quality
npm run lint             # ESLint
npm run typecheck        # TypeScript type checking
npm run validate         # lint + typecheck + test

# Testing
npm run test             # Vitest single run
npm run test:watch       # Vitest watch mode
npm run test:coverage    # Vitest with coverage

# Build
npm run build            # TypeScript compilation
npm run start            # Production server

# Shell scripts
./setup.sh               # First-time setup
./dev.sh                 # Start MongoDB + backend + 3D client
./stop.sh                # Stop Docker services
./reset.sh               # Full clean and reinstall

# Client (from client/)
npm run dev              # Vite dev server (3D client)
npm run lint             # Client ESLint
npm run typecheck        # Client TypeScript checks
npm run test             # Client Vitest
npm run build            # Client production build
```

## Documentation

| File                                           | Purpose                          |
| ---------------------------------------------- | -------------------------------- |
| [CLAUDE.md](CLAUDE.md)                         | AI agent context file            |
| [AGENTS.md](AGENTS.md)                         | Machine-readable agent guide     |
| [QUICKSTART.md](QUICKSTART.md)                 | Zero-to-running guide            |
| [CONTRIBUTING.md](CONTRIBUTING.md)             | Contribution guidelines          |
| [CHANGELOG.md](CHANGELOG.md)                   | Version history                  |
| [ROADMAP.md](ROADMAP.md)                       | Future plans                     |
| [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)   | Architecture decisions           |
| [docs/3d-world/00_START_HERE.md](docs/3d-world/00_START_HERE.md) | 3D world execution entrypoint |

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines. In brief:

1. Fork the repo
2. Create a feature branch
3. Write tests (TDD preferred)
4. Ensure `npm run validate` passes
5. Submit a PR with Conventional Commits

## License

[MIT](LICENSE) -- Copyright (c) 2023 Giuseppe Albrizio

---

Built with care by [Formray](https://github.com/formray).
