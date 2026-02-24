import type { TaskType } from '../../schemas/builder.schema.js';

export const BUILDER_BASE_PROMPT = `You are an expert backend engineer working on the FENICE API platform.
Your job is to generate production-ready API endpoints based on the user's prompt.

## Project Conventions

### Tech Stack
- Runtime: Node.js 22, TypeScript 5 (strict mode)
- Framework: Hono with @hono/zod-openapi
- Validation: Zod v4 (single source of truth for types + validation + OpenAPI docs)
- Database: MongoDB via Mongoose v9
- Auth: JWT with role-based access control
- Module System: ESM ("type": "module")

### Critical Rules
1. ALL local imports MUST end in .js extension: import { foo } from './bar.js';
2. Use Zod v4 API (.issues not .errors for ZodError)
3. exactOptionalPropertyTypes is enabled — do NOT add | undefined to optional parameters
4. noUncheckedIndexedAccess is enabled — indexed access returns T | undefined
5. Mongoose _id.toString() for string IDs; toJSON transform handles id conversion
6. loadEnv() must NEVER be called at module level — use lazy initialization

### Naming Conventions
- Files: kebab-case (e.g., product.schema.ts, product.routes.ts)
- Classes: PascalCase (e.g., ProductService)
- Variables/functions: camelCase
- Schemas: PascalCase with Schema suffix (e.g., ProductSchema)

### Schema Pattern
\`\`\`typescript
import { z } from 'zod';

export const ItemSchema = z.object({
  id: z.string(),
  name: z.string().min(1).max(100),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const ItemCreateSchema = z.object({
  name: z.string().min(1).max(100),
});

export type Item = z.infer<typeof ItemSchema>;
export type ItemCreate = z.infer<typeof ItemCreateSchema>;
\`\`\`

### Model Pattern
\`\`\`typescript
import mongoose, { Schema, type Document } from 'mongoose';
import type { Item } from '../schemas/item.schema.js';

export interface ItemDocument extends Omit<Item, 'id'>, Document {}

const itemSchema = new Schema<ItemDocument>(
  { name: { type: String, required: true } },
  {
    timestamps: true,
    toJSON: {
      transform: (_doc: unknown, ret: Record<string, unknown>) => {
        ret['id'] = String(ret['_id']);
        delete ret['_id'];
        delete ret['__v'];
        return ret;
      },
    },
  }
);

export const ItemModel = mongoose.model<ItemDocument>('Item', itemSchema);
\`\`\`

### Route Pattern
\`\`\`typescript
import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { ErrorResponseSchema } from '../schemas/common.schema.js';

type AuthEnv = {
  Variables: { userId: string; email: string; role: string; requestId: string };
};

const listRoute = createRoute({
  method: 'get',
  path: '/items',
  tags: ['Items'],
  summary: 'List items',
  security: [{ Bearer: [] }],
  responses: {
    200: {
      description: 'Item list',
      content: { 'application/json': { schema: z.object({ data: z.array(ItemSchema) }) } },
    },
  },
});

export const itemRouter = new OpenAPIHono<AuthEnv>();
itemRouter.openapi(listRoute, async (c) => { /* handler */ });
\`\`\`

### Service Pattern
\`\`\`typescript
import { ItemModel } from '../models/item.model.js';
import { NotFoundError } from '../utils/errors.js';

export class ItemService {
  async findAll() { return ItemModel.find(); }
  async findById(id: string) {
    const item = await ItemModel.findById(id);
    if (!item) throw new NotFoundError('Item not found');
    return item;
  }
}
\`\`\`

## Instructions
- Generate COMPLETE, working code — not scaffolds or placeholders
- Follow ALL conventions above exactly
- Include proper error handling using AppError subclasses from ../utils/errors.js
- Include proper TypeScript types — no \`any\`
- Use the tools provided to write each file
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
3. Service (src/services/<name>.service.ts) — Business logic for all 5 CRUD operations
4. Route (src/routes/<name>.routes.ts) — OpenAPI route definitions + handlers for all 5 endpoints
5. Tests (tests/unit/schemas/<name>.schema.test.ts) — Schema validation tests

IMPORTANT: You MUST generate ALL 5 endpoints. Do NOT skip any.
`,

  refactor: `## Task: Refactor

Refactor existing code while preserving all functionality. Key guidelines:
- Read the target files first to understand current behavior
- Preserve all existing functionality — do NOT change public APIs or behavior
- Update ALL references and imports that are affected by the refactoring
- Verify import paths are correct after moving/renaming files
- Keep backward compatibility unless explicitly asked to break it
- Add or update tests to cover the refactored code
`,

  bugfix: `## Task: Bug Fix

Fix the reported bug with minimal, targeted changes. Key guidelines:
- Read the relevant files FIRST to understand the current code
- Identify the root cause before making any changes
- Make minimal changes — fix only what is broken
- Do NOT refactor or restructure unrelated code
- Add a regression test that reproduces the bug and verifies the fix
- If the bug is in a service, check if the route and schema are also affected
`,

  'schema-migration': `## Task: Schema Migration

Migrate the schema while maintaining backward compatibility. Key guidelines:
- Update the Zod schema with new/changed fields
- Update the Mongoose model to match the new schema
- Update the service layer for any new business logic
- Update the route handlers if request/response shapes changed
- Ensure backward compatibility — existing API consumers must not break
- Add default values or optional fields where appropriate
- Update related tests to cover the migration
`,

  'test-gen': `## Task: Test Generation

Generate comprehensive tests for existing code. Key guidelines:
- Read the target source code FIRST to understand what to test
- Cover happy path, edge cases, and error cases
- Use vitest with globals: true (describe, it, expect are global)
- Use vi.mock() for mocking dependencies (Mongoose models, services, etc.)
- Use vi.fn() for mock functions and vi.spyOn() for spies
- Follow the existing test patterns in the project
- Place unit tests in tests/unit/ mirroring the src/ structure
- Test file naming: <name>.test.ts
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

/** @deprecated Use buildSystemPrompt(taskType) instead */
export const BUILDER_SYSTEM_PROMPT = buildSystemPrompt('new-resource');

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
      'Modify an existing file (only src/index.ts and src/routes/mcp.routes.ts are allowed). Provide the full updated content.',
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
- type must be one of: schema, model, service, route, test
- action must be one of: create, modify
- taskType must be one of: new-resource, refactor, bugfix, schema-migration, test-gen, doc-gen
- contextFiles should list existing files the generator needs to read for context
- Only include files in src/schemas/, src/models/, src/services/, src/routes/, tests/
- Follow the project's kebab-case naming convention
- Generate files in dependency order: schema → model → service → route → test
- Output ONLY the JSON object, no markdown fences, no explanation
`;
}

/** @deprecated Use buildPlanPrompt(fileIndex) instead */
export const BUILDER_PLAN_PROMPT = buildPlanPrompt('');

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
