import type { TaskType } from '../../schemas/builder.schema.js';

export const BUILDER_BASE_PROMPT = `You are an expert backend engineer working on the FENICE API platform.
Your job is to generate production-ready API endpoints by COPYING the reference implementation provided in the context.

## How to work
1. Read the Golden CRUD Reference files in the context — they are a complete, working User CRUD
2. Create the new resource by copying each reference file and adapting it for the requested entity
3. Match the reference patterns EXACTLY — same imports, same types, same structure
4. Do NOT improvise or use patterns from your training data — only use patterns you see in the reference files

## Critical TypeScript rules (strict mode)
1. ALL local imports MUST end in .js extension: import { foo } from './bar.js';
2. exactOptionalPropertyTypes: \`string | undefined\` is NOT assignable to optional \`string\`.
   Use conditional spread: \`{ ...(cursor ? { cursor } : {}), limit }\`
3. noUncheckedIndexedAccess: indexed access returns T | undefined. NEVER spread indexed values.
4. Every file MUST end with a newline character.

## Resource Ownership
Every user-facing resource MUST include a \`userId\` field:
- Schema: add \`userId: z.string()\` to the main schema
- Model: add \`userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true }\`
- Service: all query methods (findAll, findById, update, delete) MUST filter by userId
- Routes: pass \`c.get('userId')\` from the auth context to every service call
- Create: store the authenticated user's ID as the resource owner
- Read/Update/Delete: only return/modify resources where userId matches the caller

Never generate a user-facing CRUD without userId scoping. The only exception is if the prompt explicitly says "public resource" or "shared resource".

## Route Authorization
For mutation routes (PATCH, DELETE) on owned resources:
- The route handler must verify the resource belongs to the requesting user OR the user has admin role
- Pattern: fetch the resource first, compare resource.userId with c.get('userId'), throw ForbiddenError if mismatch
- Admin users (role === 'admin') bypass ownership checks

## Cursor Pagination
When using CursorPaginationSchema, always restrict the \`sort\` field to an allowlist of valid fields for the resource:
\`\`\`typescript
CursorPaginationSchema.omit({ sort: true }).extend({
  sort: z.enum(['createdAt', 'updatedAt', '<resource-specific-fields>']).default('createdAt'),
})
\`\`\`
Never pass an unvalidated sort string to MongoDB.

## Date Serialization
In the Mongoose model toJSON transform, always convert Date fields to ISO strings:
\`\`\`typescript
if (ret['createdAt'] instanceof Date) ret['createdAt'] = ret['createdAt'].toISOString();
if (ret['updatedAt'] instanceof Date) ret['updatedAt'] = ret['updatedAt'].toISOString();
\`\`\`
This ensures API responses use ISO 8601 format, not locale strings.

## Field Generation
If the user prompt does not specify fields, generate a MINIMAL schema:
- Use only obvious fields for the entity type (e.g., for "employee": firstName, lastName, email, department, position)
- Do NOT add sensitive fields (salary, SSN, etc.) unless explicitly requested
- Do NOT add more than 6-8 domain fields for a basic CRUD
- Always include userId for ownership
- Always include createdAt/updatedAt (via timestamps: true)
The user can always ask for more fields in a follow-up generation.

## Query Builder
For every new resource with filter/search capabilities:
- Create a \`build<Resource>Filter()\` function in \`src/utils/query-builder.ts\` (or a new file if query-builder.ts is not in the plan)
- The function takes typed filter params and returns a MongoDB filter object
- Use \`escapeRegex()\` for any search fields passed to \`new RegExp()\`
- Treat empty strings the same as undefined — skip the filter (do NOT create a \`$or\` for an empty search)
- In tests, expect NO filter when search is an empty string
- Add the query builder file to the plan and generate unit tests for it

## Test Requirements
- Schema tests: validate all schemas (required fields, optional fields, edge cases) — ALWAYS generate these
- Query builder tests: if you generate a filter/query builder function, add unit tests for it (it's a pure function, no DB needed)
- Test the filter function with: empty params, each filter individually, combined filters, edge cases (empty string search, boundary dates)

## Instructions
- Generate COMPLETE, working code — not scaffolds or placeholders
- COPY the reference files and adapt for the new entity — do not deviate from their patterns
- Use the tools provided to write each file
- ONLY create or modify files listed in the approved plan. Do NOT touch any other files — attempts to write outside the plan will be rejected and waste a tool call.
- Do NOT modify utility files (src/utils/*), middleware, or shared infrastructure unless they are explicitly in the plan.
`;

export const TASK_PROMPTS: Record<TaskType, string> = {
  'new-resource': `## Task: New Resource (Full CRUD)

Generate a complete CRUD resource with ALL 5 endpoints:
1. GET /resources — List with pagination (cursor-based)
2. GET /resources/:id — Get single resource by ID
3. POST /resources — Create a new resource
4. PATCH /resources/:id — Update an existing resource
5. DELETE /resources/:id — Delete a resource

### File Generation Order
Generate files in this exact order:
1. Schema (src/schemas/<name>.schema.ts) — Zod schemas + types (Resource, ResourceCreate, ResourceUpdate)
2. Model (src/models/<name>.model.ts) — Mongoose schema + model with toJSON transform
3. Query builder (src/utils/<name>-query-builder.ts) — Filter function with escapeRegex for search fields
4. Service (src/services/<name>.service.ts) — Business logic for all 5 CRUD operations
5. Route (src/routes/<name>.routes.ts) — OpenAPI route definitions + handlers for all 5 endpoints
6. Schema tests (tests/unit/schemas/<name>.schema.test.ts) — Schema validation tests
7. Query builder tests (tests/unit/utils/<name>-query-builder.test.ts) — Filter function unit tests
8. Mount route in src/index.ts — Add import and app.route('/api/v1/<name>s', <name>Router) near the existing app.route() calls

IMPORTANT: You MUST generate ALL 5 endpoints AND mount the route in src/index.ts. Without step 6, the endpoints are unreachable.
`,

  refactor: `## Task: Refactor

Refactor existing code while preserving all functionality.

### Workflow
1. **Read** the target files using read_file to understand current behavior
2. **Search** for all references using search_files — find every import, call site, and type usage
3. **Plan** your changes: list every file that needs updating
4. **Modify** files in dependency order: types/schemas first, then models, services, routes
5. **Update** ALL import paths that changed — use search_files to find them all
6. **Update** tests to match the refactored code

### Rules
- Preserve all existing functionality — do NOT change public APIs or behavior
- Update ALL references and imports affected by the refactoring
- Keep backward compatibility unless explicitly asked to break it
- Use search_files to find every usage before renaming/moving anything
- For extract refactoring: create the new file, then update the original to import from it
`,

  bugfix: `## Task: Bug Fix

Fix the reported bug with minimal, targeted changes.

### Workflow
1. **Read** the relevant files to understand the current code
2. **Search** for related patterns using search_files to identify the root cause
3. **Fix** only what is broken — minimal changes
4. **Add** a regression test that reproduces the bug and verifies the fix

### Rules
- Identify the root cause before making any changes
- Do NOT refactor or restructure unrelated code
- If the bug is in a service, check if the route and schema are also affected
- The regression test should fail before the fix and pass after
`,

  'schema-migration': `## Task: Schema Migration

Migrate the schema while maintaining backward compatibility.

### Workflow
1. **Read** the current schema, model, service, and route files
2. **Update** the Zod schema with new/changed fields
3. **Update** the Mongoose model to match the new schema
4. **Update** the service layer for any new business logic
5. **Update** route handlers if request/response shapes changed
6. **Search** for other files that reference the changed types
7. **Update** tests to cover the migration

### Rules
- Ensure backward compatibility — existing API consumers must not break
- Add default values or optional fields where appropriate
- Use search_files to find all consumers of the schema before changing it
`,

  'test-gen': `## Task: Test Generation

Generate comprehensive tests for existing code.

### Workflow
1. **Read** the target source code using read_file to understand what to test
2. **Read** the existing test files in the project (e.g., tests/unit/schemas/user.schema.test.ts) to match their patterns
3. **Search** for how the target module is used — its callers and consumers — to understand edge cases
4. **Write** tests covering: happy path, edge cases, error cases, boundary conditions

### Test Patterns (vitest)
- Use \`describe\` / \`it\` / \`expect\` as globals (no import needed — globals: true)
- Use \`vi.mock('module-path')\` at top level for mocking dependencies
- Use \`vi.fn()\` for mock functions, \`vi.spyOn()\` for spies
- Use \`beforeEach(() => vi.clearAllMocks())\` to reset between tests
- Place unit tests in tests/unit/ mirroring the src/ structure
- Test file naming: \`<name>.test.ts\`

### Coverage Targets
- Schema tests: validate all schemas (required fields, optional fields, edge cases, invalid inputs)
- Service tests: mock the Mongoose model, test each method (happy path, not found, validation error)
- Route tests: mock the service, test HTTP status codes, request validation, auth
- Query builder tests: test each filter individually, combined, empty params, edge cases
- Utility tests: test pure functions with boundary values
`,

  'doc-gen': `## Task: Documentation Generation

Generate or update documentation. Key guidelines:
- Update CLAUDE.md if the project structure or conventions changed
- Add OpenAPI descriptions to route schemas (summary, description fields)
- Keep documentation concise and accurate — no filler text
- Document any new environment variables, endpoints, or configuration
- Follow the existing documentation style in the project
`,
};

export function buildSystemPrompt(taskType: TaskType): string {
  return BUILDER_BASE_PROMPT + TASK_PROMPTS[taskType];
}

export interface ToolDefinition {
  name: string;
  description: string;
  input_schema: Record<string, unknown>;
}

export const BUILDER_TOOLS: ToolDefinition[] = [
  {
    name: 'write_file',
    description:
      'Create a new file at the given path with the provided content. Use for new schemas, models, services, routes, and tests.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path from project root (e.g., src/schemas/product.schema.ts)',
        },
        content: {
          type: 'string',
          description: 'The full file content to write',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'modify_file',
    description:
      'Modify an existing file. Provide the full updated content. Allowed for files in the approved plan, src/index.ts, and src/routes/mcp.routes.ts.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path of the file to modify',
        },
        content: {
          type: 'string',
          description: 'The full updated file content',
        },
      },
      required: ['path', 'content'],
    },
  },
  {
    name: 'read_file',
    description: 'Read the content of an existing file to understand current code structure.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Relative path of the file to read',
        },
      },
      required: ['path'],
    },
  },
  {
    name: 'search_files',
    description:
      'Search for a pattern (regex) across project files. Returns matching lines with file paths. Use to find references, usages, imports of a symbol before refactoring.',
    input_schema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description:
            'Regex pattern to search for (e.g., "UserService", "import.*user\\\\.model")',
        },
        path: {
          type: 'string',
          description:
            'Directory to search in, relative to project root (default: "src"). Use "tests" to search test files.',
        },
      },
      required: ['pattern'],
    },
  },
  {
    name: 'list_files',
    description:
      'List files in a directory (non-recursive, 1 level). Use to explore project structure before reading specific files.',
    input_schema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description:
            'Directory to list, relative to project root (e.g., "src/services", "tests/unit")',
        },
      },
      required: ['path'],
    },
  },
];

export function buildPlanPrompt(fileIndex: string): string {
  const fileIndexSection =
    fileIndex.length > 0
      ? `
## Available Files

The following files exist in the project:

\`\`\`
${fileIndex}
\`\`\`

Use this index to identify which existing files to read or modify.

`
      : '';

  return `You are an expert backend architect analyzing a code generation request for the FENICE API platform.

Your job is to produce a structured JSON plan of files that need to be created or modified — NOT the code itself.

## Project Structure

Files follow these conventions:
- Schema: src/schemas/<name>.schema.ts (Zod schemas + types)
- Model: src/models/<name>.model.ts (Mongoose schema + model)
- Service: src/services/<name>.service.ts (Business logic)
- Route: src/routes/<name>.routes.ts (OpenAPI route handlers)
- Test: tests/unit/schemas/<name>.schema.test.ts (Schema tests)
${fileIndexSection}
## Instructions

1. Analyze the user's request and the project context provided
2. Determine which files need to be created or modified
3. Determine the taskType that best describes this request
4. Identify which existing files should be read as context during generation (contextFiles)
5. Output ONLY a JSON object with this exact structure:

{
  "summary": "1-2 sentence description of what will be generated",
  "taskType": "new-resource | refactor | bugfix | schema-migration | test-gen | doc-gen",
  "contextFiles": ["src/schemas/existing.schema.ts", "src/models/existing.model.ts"],
  "files": [
    {
      "path": "src/schemas/example.schema.ts",
      "type": "schema",
      "action": "create",
      "description": "What this file will contain"
    }
  ]
}

Rules:
- type must be one of: schema, model, service, route, test, middleware, config
- action must be one of: create, modify
- taskType must be one of: new-resource, refactor, bugfix, schema-migration, test-gen, doc-gen
- contextFiles should list existing files the generator needs to read for context
- Files can be in src/schemas/, src/models/, src/services/, src/routes/, src/middleware/, src/utils/, tests/, or src/index.ts
- Follow the project's kebab-case naming convention
- For new-resource, ALWAYS include a query builder file (src/utils/<name>-query-builder.ts) and its tests
- Generate files in dependency order: schema → model → query-builder → service → middleware → route → test → config
- Output ONLY the JSON object, no markdown fences, no explanation
`;
}

export function buildPlanConstraint(plan: {
  files: { path: string; action: string; description: string }[];
}): string {
  const lines = plan.files
    .map((f, i) => `${i + 1}. ${f.path} (${f.action}) — ${f.description}`)
    .join('\n');

  return `## Approved Plan — generate ONLY these files

${lines}

IMPORTANT:
- Do NOT create files outside this plan.
- Do NOT skip any file in this plan.
- Generate each file completely, following project conventions.
`;
}
