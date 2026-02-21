# Contributing to FENICE

Thank you for your interest in contributing to FENICE. This guide covers the standards and workflow expected for all contributions.

## Getting Started

1. **Fork** the repository to your own GitHub account
2. **Clone** your fork locally
3. Run `./setup.sh` to install dependencies and create your `.env`
4. Run `./dev.sh` to start the development environment
5. Create a **feature branch** from `development`:
   ```bash
   git checkout -b feat/your-feature-name
   ```

## Development Workflow

### Before You Code

- Check existing issues and PRs to avoid duplicate work
- For significant changes, open an issue first to discuss the approach
- Follow TDD (Test-Driven Development) when possible

### While You Code

- Write tests alongside or before your implementation
- Follow the existing code style (ESM, `.js` extensions on imports, strict TypeScript)
- Use the adapter pattern for any new external service integrations
- Define Zod schemas as the single source of truth for new data structures

### Before You Submit

Run the full validation suite:
```bash
npm run validate
```

This runs:
1. `npm run lint` -- ESLint must pass with no errors
2. `npm run typecheck` -- TypeScript strict mode must pass
3. `npm run test` -- All tests must pass

All three must succeed before submitting a PR.

## Commit Messages

FENICE uses [Conventional Commits](https://www.conventionalcommits.org/). Every commit message must follow this format:

```
<type>: <description>

[optional body]

[optional footer]
```

### Types

| Type       | When to Use                                    |
| ---------- | ---------------------------------------------- |
| `feat`     | New feature                                    |
| `fix`      | Bug fix                                        |
| `docs`     | Documentation only changes                     |
| `test`     | Adding or updating tests                       |
| `refactor` | Code change that neither fixes a bug nor adds a feature |
| `chore`    | Build process, tooling, dependency updates     |
| `style`    | Formatting, whitespace (no code logic changes) |
| `perf`     | Performance improvement                        |
| `ci`       | CI/CD configuration changes                    |

### Examples

```
feat: add rate limiting middleware

Implemented sliding window rate limiter with configurable
thresholds per endpoint group.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>
```

```
fix: handle expired refresh token gracefully

Previously threw an unhandled error. Now returns 401 with
a clear error message.
```

## Code Style

### TypeScript
- Strict mode is enabled (`strict: true`, `exactOptionalPropertyTypes: true`)
- Use explicit types over `any` -- prefer `unknown` when type is truly unknown
- Optional properties must include `undefined` in the union: `foo?: string | undefined`

### ESM
- All local imports must end in `.js`: `import { foo } from './bar.js';`
- No CommonJS `require()` calls

### File Naming
- Use `kebab-case` for all files: `auth.routes.ts`, `console.adapter.ts`
- Suffix convention: `.routes.ts`, `.service.ts`, `.model.ts`, `.schema.ts`, `.adapter.ts`, `.test.ts`

### Testing
- Place unit tests in `tests/unit/` mirroring the `src/` structure
- Place integration tests in `tests/integration/`
- Place property-based tests in `tests/properties/`
- Use descriptive test names that explain the expected behavior
- Coverage thresholds: 80% for lines, branches, functions, and statements

## Pre-Commit Hooks

Husky and lint-staged are configured to run automatically on every commit:
- **ESLint** with `--fix` on staged `.ts` and `.tsx` files
- **Prettier** on staged `.ts`, `.tsx`, `.json`, `.yml`, and `.yaml` files

If the hooks fail, fix the issues before committing. Do not bypass hooks with `--no-verify`.

## Pull Request Process

1. Target the `development` branch (not `main`)
2. Write a clear PR title using Conventional Commit format
3. Include a description of what changed and why
4. Ensure CI passes (lint, typecheck, test, build)
5. Request review from a maintainer
6. Address review feedback promptly

## Project Structure Reference

```
src/
  schemas/     # Zod schemas (add new schemas here)
  models/      # Mongoose models
  services/    # Business logic
  routes/      # OpenAPI route definitions
  middleware/  # Hono middleware
  adapters/    # External service abstractions
  utils/       # Shared utilities
  config/      # Environment and configuration
```

## Questions?

Open a GitHub Issue or check the existing documentation:
- [CLAUDE.md](CLAUDE.md) -- Full project context
- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) -- Architecture decisions
- [AGENTS.md](AGENTS.md) -- API reference for AI agents
