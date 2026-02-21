# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
