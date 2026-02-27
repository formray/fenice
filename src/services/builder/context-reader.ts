import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('fenice', process.env['LOG_LEVEL'] ?? 'info');

export interface ContextBundle {
  openApiSpec: string;
  projectConventions: string;
  exampleSchema: string;
  exampleModel: string;
  exampleService: string;
  exampleRoute: string;
}

const MAX_FILE_SIZE = 15_000;

async function safeReadFile(filePath: string, maxSize = MAX_FILE_SIZE): Promise<string> {
  try {
    const content = await readFile(filePath, 'utf-8');
    if (content.length > maxSize) {
      return content.slice(0, maxSize) + '\n\n... [truncated]';
    }
    return content;
  } catch {
    logger.warn({ filePath }, 'Context file not found, skipping');
    return '';
  }
}

export async function buildContextBundle(projectRoot: string): Promise<ContextBundle> {
  const [
    openApiSpec,
    projectConventions,
    exampleSchema,
    exampleModel,
    exampleService,
    exampleRoute,
  ] = await Promise.all([
    readOpenApiSpec(projectRoot),
    safeReadFile(join(projectRoot, 'CLAUDE.md')),
    safeReadFile(join(projectRoot, 'src/schemas/user.schema.ts')),
    safeReadFile(join(projectRoot, 'src/models/user.model.ts')),
    safeReadFile(join(projectRoot, 'src/services/user.service.ts')),
    safeReadFile(join(projectRoot, 'src/routes/user.routes.ts')),
  ]);

  return {
    openApiSpec,
    projectConventions,
    exampleSchema,
    exampleModel,
    exampleService,
    exampleRoute,
  };
}

async function readOpenApiSpec(projectRoot: string): Promise<string> {
  // Try reading from a cached spec file first, fall back to describing the structure
  try {
    const specPath = join(projectRoot, 'openapi.json');
    const content = await readFile(specPath, 'utf-8');
    if (content.length > MAX_FILE_SIZE) {
      return content.slice(0, MAX_FILE_SIZE) + '\n\n... [truncated]';
    }
    return content;
  } catch {
    // No cached spec — build a summary from file structure
    return buildSpecSummary(projectRoot);
  }
}

async function buildSpecSummary(projectRoot: string): Promise<string> {
  const files = [
    'src/schemas/common.schema.ts',
    'src/schemas/user.schema.ts',
    'src/schemas/auth.schema.ts',
  ];

  const parts: string[] = ['# Existing API Schema Summary\n'];

  for (const file of files) {
    const content = await safeReadFile(join(projectRoot, file), 5_000);
    if (content) {
      parts.push(`## ${file}\n\`\`\`typescript\n${content}\n\`\`\`\n`);
    }
  }

  return parts.join('\n');
}

export function formatContextForPrompt(bundle: ContextBundle): string {
  const parts: string[] = [];

  if (bundle.openApiSpec) {
    parts.push('## Current OpenAPI Spec / Schema Summary\n```\n' + bundle.openApiSpec + '\n```\n');
  }

  if (bundle.exampleSchema) {
    parts.push(
      '## Example Schema (user.schema.ts)\n```typescript\n' + bundle.exampleSchema + '\n```\n'
    );
  }

  if (bundle.exampleModel) {
    parts.push(
      '## Example Model (user.model.ts)\n```typescript\n' + bundle.exampleModel + '\n```\n'
    );
  }

  if (bundle.exampleService) {
    parts.push(
      '## Example Service (user.service.ts)\n```typescript\n' + bundle.exampleService + '\n```\n'
    );
  }

  if (bundle.exampleRoute) {
    parts.push(
      '## Example Route (user.routes.ts)\n```typescript\n' + bundle.exampleRoute + '\n```\n'
    );
  }

  return parts.join('\n');
}

const CONVENTIONS_SECTIONS = [
  '## Tech Stack',
  '## Key Commands',
  '## Code Style & Conventions',
  '## Common Gotchas',
];

export function trimConventions(
  fullConventions: string,
  sections: string[] = CONVENTIONS_SECTIONS
): string {
  if (!fullConventions) return '';
  const lines = fullConventions.split('\n');
  const result: string[] = [];
  let capturing = false;

  for (const line of lines) {
    if (sections.some((s) => line.startsWith(s))) {
      capturing = true;
    } else if (line.startsWith('## ') && capturing) {
      capturing = false;
    }
    if (capturing) result.push(line);
  }

  return result.join('\n');
}

export function formatContextForGeneration(bundle: ContextBundle): string {
  const parts: string[] = [];

  // Trimmed conventions instead of full CLAUDE.md
  const trimmed = trimConventions(bundle.projectConventions);
  if (trimmed) {
    parts.push('## Project Conventions (excerpt)\n```\n' + trimmed + '\n```\n');
  }

  // All 4 example files — Claude needs these to match project patterns
  if (bundle.exampleSchema) {
    parts.push(
      '## Example Schema (user.schema.ts)\n```typescript\n' + bundle.exampleSchema + '\n```\n'
    );
  }

  if (bundle.exampleModel) {
    parts.push(
      '## Example Model (user.model.ts)\n```typescript\n' + bundle.exampleModel + '\n```\n'
    );
  }

  if (bundle.exampleService) {
    parts.push(
      '## Example Service (user.service.ts)\n```typescript\n' + bundle.exampleService + '\n```\n'
    );
  }

  if (bundle.exampleRoute) {
    parts.push(
      '## Example Route (user.routes.ts)\n```typescript\n' + bundle.exampleRoute + '\n```\n'
    );
  }

  return parts.join('\n');
}

// --- Dynamic Context (M5) ---

export interface ContextFileContent {
  path: string;
  content: string;
}

export interface DynamicContextBundle {
  conventions: string;
  contextFiles: ContextFileContent[];
}

const DEFAULT_CONTEXT_FILES = [
  'src/schemas/user.schema.ts',
  'src/models/user.model.ts',
  'src/services/user.service.ts',
  'src/routes/user.routes.ts',
  'src/index.ts',
];

const DEFAULT_MAX_CONTEXT_CHARS = 50_000; // ~12500 tokens at ~4 chars/token

/**
 * Reads requested contextFiles from disk; falls back to DEFAULT_CONTEXT_FILES if empty.
 * ALWAYS includes the reference CRUD files (user.*) so Claude can match project patterns.
 * Respects a token budget (maxChars). Truncates files that exceed remaining budget.
 */
export async function buildDynamicContext(
  projectRoot: string,
  contextFiles: string[],
  maxChars?: number
): Promise<DynamicContextBundle> {
  const budget = maxChars ?? DEFAULT_MAX_CONTEXT_CHARS;

  // Always read CLAUDE.md for conventions
  const rawConventions = await safeReadFile(join(projectRoot, 'CLAUDE.md'));
  const conventions = trimConventions(rawConventions);

  // Always include reference CRUD files first — Claude needs these to match project patterns.
  // Then append plan-specific contextFiles, deduplicating.
  const seen = new Set<string>();
  const filesToRead: string[] = [];

  for (const f of DEFAULT_CONTEXT_FILES) {
    if (!seen.has(f)) {
      seen.add(f);
      filesToRead.push(f);
    }
  }
  for (const f of contextFiles) {
    if (!seen.has(f)) {
      seen.add(f);
      filesToRead.push(f);
    }
  }

  const result: ContextFileContent[] = [];
  let usedChars = 0;

  for (const filePath of filesToRead) {
    if (usedChars >= budget) {
      break;
    }

    // Validate path stays within project root (contextFiles comes from LLM output)
    const resolved = join(projectRoot, filePath);
    if (!resolved.startsWith(projectRoot) || filePath.includes('..')) {
      logger.warn({ filePath }, 'Context file path escapes project root, skipping');
      result.push({ path: filePath, content: '' });
      continue;
    }

    const content = await safeReadFile(resolved);
    if (!content) {
      // Include empty entry so caller knows the file was attempted but missing
      result.push({ path: filePath, content: '' });
      continue;
    }

    const remaining = budget - usedChars;
    if (content.length > remaining) {
      result.push({
        path: filePath,
        content: content.slice(0, remaining) + '\n\n... [truncated]',
      });
      usedChars = budget;
    } else {
      result.push({ path: filePath, content });
      usedChars += content.length;
    }
  }

  return { conventions, contextFiles: result };
}

const REFERENCE_FILE_SET = new Set(DEFAULT_CONTEXT_FILES);

/**
 * Formats a DynamicContextBundle into text for the LLM system message.
 * Reference CRUD files are labeled as "REFERENCE" so Claude matches their patterns exactly.
 */
export function formatDynamicContext(bundle: DynamicContextBundle): string {
  const parts: string[] = [];

  if (bundle.conventions) {
    parts.push('## Project Conventions (excerpt)\n```\n' + bundle.conventions + '\n```\n');
  }

  const refFiles = bundle.contextFiles.filter((f) => REFERENCE_FILE_SET.has(f.path));
  const otherFiles = bundle.contextFiles.filter((f) => !REFERENCE_FILE_SET.has(f.path));

  if (refFiles.some((f) => f.content)) {
    parts.push(
      '## REFERENCE FILES — Follow these patterns EXACTLY for naming, imports, types, and structure\n'
    );
    for (const file of refFiles) {
      if (file.content) {
        parts.push(`### ${file.path}\n\`\`\`typescript\n${file.content}\n\`\`\`\n`);
      }
    }
  }

  for (const file of otherFiles) {
    if (file.content) {
      parts.push(`## ${file.path}\n\`\`\`typescript\n${file.content}\n\`\`\`\n`);
    }
  }

  return parts.join('\n');
}
