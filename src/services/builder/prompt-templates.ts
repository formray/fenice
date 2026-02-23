export const BUILDER_SYSTEM_PROMPT = `You are an expert backend engineer working on the FENICE API platform.
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

### File Generation Order
Generate files in this exact order:
1. Schema (src/schemas/<name>.schema.ts) — Zod schemas + types
2. Model (src/models/<name>.model.ts) — Mongoose schema + model
3. Service (src/services/<name>.service.ts) — Business logic
4. Route (src/routes/<name>.routes.ts) — OpenAPI route definitions + handlers
5. Tests (tests/unit/schemas/<name>.schema.test.ts) — Schema validation tests

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

export const BUILDER_PLAN_PROMPT = `You are an expert backend architect analyzing a code generation request for the FENICE API platform.

Your job is to produce a structured JSON plan of files that need to be created or modified — NOT the code itself.

## Project Structure

Files follow these conventions:
- Schema: src/schemas/<name>.schema.ts (Zod schemas + types)
- Model: src/models/<name>.model.ts (Mongoose schema + model)
- Service: src/services/<name>.service.ts (Business logic)
- Route: src/routes/<name>.routes.ts (OpenAPI route handlers)
- Test: tests/unit/schemas/<name>.schema.test.ts (Schema tests)

## Instructions

1. Analyze the user's request and the project context provided
2. Determine which files need to be created or modified
3. Output ONLY a JSON object with this exact structure:

{
  "summary": "1-2 sentence description of what will be generated",
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
- Only include files in src/schemas/, src/models/, src/services/, src/routes/, tests/
- Follow the project's kebab-case naming convention
- Generate files in dependency order: schema → model → service → route → test
- Output ONLY the JSON object, no markdown fences, no explanation
`;

export function buildPlanConstraint(plan: { files: { path: string; action: string; description: string }[] }): string {
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
