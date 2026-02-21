# FENICE Roadmap

## v0.1.0 — Foundation Layer ✅

The foundation is in place. FENICE provides a fully functional, production-ready backend with:

- Hono + Zod OpenAPI routes (auth, users, health, MCP)
- JWT authentication with access/refresh tokens
- Mongoose v9 User model with bcrypt
- Adapter pattern (email, storage, messaging)
- OpenTelemetry auto-instrumentation
- MCP endpoint for AI agent discovery
- Scalar interactive docs + LLM-readable docs
- Vitest + fast-check testing (35 tests)
- Docker multi-stage build + docker-compose
- GitHub Actions CI pipeline
- Four-script development workflow
- Comprehensive documentation

## v0.2.0 — Advanced Backend Features

Planned enhancements to expand platform capabilities:

- **WebSocket Support** — Real-time communication via Hono WebSocket adapter
- **Rate Limiting** — Request throttling with configurable windows per endpoint
- **RBAC Middleware** — Role-based access control beyond the current admin-only delete check
- **File Upload** — Multipart upload handling with storage adapter integration
- **Pagination** — Cursor-based pagination for list endpoints (PaginationSchema already defined)
- **Search & Filtering** — Query parameter support for user listing
- **Email Verification** — Account verification flow using the email adapter
- **Password Reset** — Reset flow using the existing resetPasswordToken fields
- **Request Validation Middleware** — Generic middleware for body/query/params validation
- **API Versioning Strategy** — Header or path-based versioning beyond `/api/v1`

## v0.3.0 — Scale & Optimize

Infrastructure and performance improvements for production scale:

- **Redis Caching** — Response caching and session store with Redis adapter
- **Queue Workers** — Background job processing (email sending, data processing)
- **K8s Autoscaling** — Horizontal Pod Autoscaler configuration
- **Database Indexing** — Performance-tuned MongoDB indexes beyond the current email/username index
- **Connection Pooling** — Optimized MongoDB connection management
- **Health Check Enhancements** — Deep dependency checks (Redis, queues, external services)
- **Metrics Endpoint** — Prometheus-compatible metrics export
- **Audit Logging** — Structured audit trail for security-sensitive operations
- **Multi-tenancy** — Tenant isolation at the data layer
- **GraphQL Gateway** — Optional GraphQL layer alongside REST

## v1.0.0 — 3D World

The AI-native 3D city experience (React Three Fiber, AI builder, city metaphor). See [design doc](docs/plans/2026-02-21-fenice-design.md) for details.

## Contributing

Want to help build the next version? See [CONTRIBUTING.md](CONTRIBUTING.md) for guidelines.
Proposals for new features should be discussed via GitHub Issues before implementation.
