# M5: Builder v2 — Design Document

> **Date:** 2026-02-24
> **Status:** Approved
> **Author:** Giuseppe Albrizio + Claude Opus 4.6
> **Dependencies:** M3.1 (completed)
> **Codebase:** server only

---

## 1. Goal

Expand the AI Builder from a single-purpose "new endpoint" generator into a versatile development agent that handles refactoring, bug fixes, test generation, schema migrations, and documentation — with intelligent context selection, robust recovery, and verifiable dry-run output.

## 2. Current State

The builder is a two-phase (plan -> generate) pipeline across 12 source files (~900 lines). It uses a Claude API tool-use loop with 3 tools (`write_file`, `modify_file`, `read_file`), scope policy enforcement, git branch/commit/push, and GitHub PR creation.

### Key Limitations

- **Single task type:** Only generates new endpoints. Asking for a full CRUD often produces a single endpoint.
- **Static context:** Always reads the same 5 `user.*` files as examples, regardless of prompt content.
- **Fragile recovery:** One repair attempt; if it fails, the entire job is `failed` and work is lost.
- **Opaque dry-run:** Stores raw file content in MongoDB but provides no diff, no completeness check, no impact analysis.
- **No token tracking:** Token usage is computed but never persisted to the job document.
- **DRY violation:** `generateCode` and `repairCode` share ~200 lines of nearly identical tool-loop logic.
- **Security gap:** `read_file` tool has no path validation — LLM can read `.env` and other sensitive files.

---

## 3. Design

### 3.1 Task Type System

Six task types, each with a dedicated prompt template:

| Type | Purpose | Key Context Needs |
|------|---------|-------------------|
| `new-resource` | Full CRUD (schema + model + service + routes + tests) | Existing schemas as pattern, route index |
| `refactor` | Rename, extract, move | Target files, referencing files |
| `bugfix` | Fix from error description or stack trace | Target files, test files, error context |
| `schema-migration` | Add/modify fields, backward compat | Target schema + model, existing tests |
| `test-gen` | Generate test suite for existing code | Target service/route, existing test patterns |
| `doc-gen` | Update CLAUDE.md, OpenAPI descriptions | CLAUDE.md, route files, schema files |

**Hybrid detection:**

1. User submits prompt with optional `taskType` field in `BuilderOptions`
2. If `taskType` is not provided, the planning phase classifies it from the prompt
3. The detected/provided `taskType` is persisted on the `BuilderJob` document
4. Task type determines: which system prompt to use, which context files to prioritize, which validation rules apply

**Prompt template architecture:**

- `prompt-templates.ts` refactored from one monolithic `BUILDER_SYSTEM_PROMPT` into:
  - `BUILDER_BASE_PROMPT` — shared conventions, TypeScript rules, code patterns
  - `BUILDER_TASK_PROMPTS: Record<TaskType, string>` — task-specific instructions
  - `buildSystemPrompt(taskType)` — composes base + task-specific

### 3.2 Smart Context (File Index)

Replace hardcoded `user.*` context with a dynamic file index that lets the LLM choose what it needs.

**File Indexer (`file-indexer.ts`):**

- Scans `src/` and `tests/` directories
- For each `.ts` file: extracts path, top-level export names (via regex, not AST), line count
- Produces a compact text index (~500-800 tokens for a medium project)
- Cached in memory with filesystem watcher invalidation (or rebuilt per job — cheap enough)

**Index format:**

```
src/schemas/user.schema.ts     | UserSchema, UserCreateSchema, UserUpdateSchema | 45 lines
src/models/user.model.ts       | UserModel, IUser                               | 62 lines
src/services/auth.service.ts   | AuthService                                    | 89 lines
...
```

**Integration with planning phase:**

The plan output schema gains a new field:

```typescript
BuilderPlan {
  summary: string
  taskType: TaskType              // NEW — classified or echoed from input
  files: BuilderPlanFile[]        // files to create/modify (existing)
  contextFiles: string[]          // NEW — existing files to read as reference
}
```

**Generation phase context assembly:**

1. Read `contextFiles` from the approved plan
2. Apply token budget (`CONTEXT_MAX_TOKENS`, default 8000, env-configurable)
3. If over budget, prioritize: files directly related to `filesToCreate` > pattern examples > general context
4. Fall back to default `user.*` files if `contextFiles` is empty

### 3.3 Recovery and Graceful Fallback

Three-level recovery model. Work is never lost.

**Level 1 — Targeted repair (up to 2 attempts):**

- Attempt 1: Pass ALL errors (typecheck + lint + test) to LLM with project conventions context (today repair has no conventions). Use the refactored shared tool loop (DRY fix).
- Attempt 2: Pass only residual errors from attempt 1.

**Level 2 — Draft PR (graceful fallback):**

If validation still fails after 2 repair attempts:

- New pipeline state: `completed_draft`
- Branch naming: `draft/{jobId}-{slug}` (distinct from `builder/`)
- PR created with:
  - Body includes: which validations pass, which fail, residual errors formatted, LLM suggestions
  - GitHub label: `needs-manual-fix` (if label creation fails, skip gracefully)
- Job persists `validationErrors: string[]` for the residual errors
- World notifier emits `builder.progress` with `status: 'completed_draft'`

**Level 3 — Real failure:**

Only for non-code errors: Claude API down, GitHub API failure, scope policy violation, timeout. These remain `failed` as today.

**Model changes:**

- `BuilderJobStatus` adds: `completed_draft`
- `BuilderJobResult` adds: `validationErrors?: string[]`, `tokenUsage?: { input: number, output: number }`

### 3.4 Enhanced Dry-Run

When `dryRun: true`, the job result includes three additional outputs beyond the raw file content.

**1. Unified diffs:**

For `action: 'modified'` files, read the original from disk and compute a unified diff. For `action: 'created'` files, the diff is the entire content (new file). Stored as:

```typescript
diffs?: Array<{ path: string; diff: string }>
```

Use the `diff` npm package (lightweight, zero-dep) for LCS-based unified diff generation.

**2. Plan coverage check:**

After generation, compare produced files against the approved plan:

```typescript
planCoverage?: {
  planned: string[]    // paths from plan.files
  generated: string[]  // paths actually generated
  missing: string[]    // planned but not generated
}
```

This directly catches the "asked for CRUD, got one endpoint" problem.

**3. Impact analysis (lightweight):**

Grep existing source files for import statements referencing modified files:

```typescript
impactedFiles?: string[]  // files that import from modified paths
```

Not a full static analysis — a regex search on `import ... from` patterns. Sufficient for a "heads up, these files might break" signal.

---

## 4. Security Improvements (Bundled)

While touching the relevant modules, fix two known gaps:

1. **`read_file` path validation:** Add `ALLOWED_READ_PREFIXES` to scope policy. Block reads of `.env`, `node_modules/`, `.git/`, and credential files. Apply in the tool loop alongside existing write validation.

2. **Plan file enforcement:** In the tool loop, if an approved plan exists, reject `write_file`/`modify_file` calls for paths not in `plan.files`. Today this is a soft prompt constraint; make it a hard check.

---

## 5. Refactoring (Bundled)

**DRY the tool loop:** Extract the shared ~200-line tool-use loop from `generateCode` and `repairCode` into a private `runToolLoop()` function. Both callers configure it with different system prompts, tools, and callbacks.

---

## 6. Schema / API Changes Summary

### New/Modified Schemas

```typescript
// builder.schema.ts additions
TaskType = 'new-resource' | 'refactor' | 'bugfix' | 'schema-migration' | 'test-gen' | 'doc-gen'

BuilderOptions {
  ...existing...
  taskType?: TaskType     // NEW — optional override
}

BuilderPlan {
  ...existing...
  taskType: TaskType      // NEW — classified or echoed
  contextFiles: string[]  // NEW — files to read as reference
}

BuilderJobStatus adds: 'completed_draft'

BuilderJobResult {
  ...existing...
  validationErrors?: string[]
  tokenUsage?: { input: number, output: number }
  diffs?: Array<{ path: string, diff: string }>
  planCoverage?: { planned: string[], generated: string[], missing: string[] }
  impactedFiles?: string[]
}
```

### No New HTTP Endpoints

All changes are internal to the existing pipeline. The 5 existing builder routes remain unchanged. The new fields appear in the `GET /builder/jobs/:id` response automatically via the updated schema.

---

## 7. Done Definition

- [ ] Builder handles all 6 task types with dedicated prompt templates
- [ ] Task type is auto-detected from prompt when not specified
- [ ] File indexer scans the project and produces a compact index
- [ ] Planning phase outputs `contextFiles` and `taskType`
- [ ] Generation phase reads only plan-specified context files
- [ ] Recovery attempts repair twice before falling back to draft PR
- [ ] `completed_draft` jobs produce a PR with `needs-manual-fix` label and error details
- [ ] Token usage persisted on every job
- [ ] Dry-run produces diffs, plan coverage, and impact analysis
- [ ] `read_file` tool respects path validation (no `.env` reads)
- [ ] Plan file enforcement is hard-checked in the tool loop
- [ ] Tool loop DRY'd into shared `runToolLoop()`
- [ ] All existing tests pass
- [ ] New unit tests for: file indexer, task type detection, diff generation, plan coverage, impact analysis
- [ ] New integration tests for: draft PR flow, multi-retry recovery, context file selection

---

## 8. Non-Goals

- No new HTTP endpoints (existing 5 routes are sufficient)
- No frontend changes (server-only milestone)
- No multi-agent (single builder, single task at a time)
- No streaming token output (batch response only)
- No AST-based analysis (regex-based file indexer and impact analysis are sufficient)
