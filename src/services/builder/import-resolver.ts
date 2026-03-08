import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('fenice', process.env['LOG_LEVEL'] ?? 'info');

/**
 * Regex to extract local import paths from TypeScript source.
 * Matches: import { X } from './foo.js'
 *          import X from '../bar.js'
 *          import type { X } from './baz.js'
 *          export { X } from './qux.js'
 */
const IMPORT_REGEX =
  /(?:import|export)\s+(?:type\s+)?(?:\{[^}]*\}|[^;{]*)\s+from\s+['"](\.[^'"]+)['"]/g;

/**
 * Extracts local import paths from a TypeScript file's source.
 * Returns resolved relative paths (e.g., 'src/models/user.model.ts').
 */
export function extractLocalImports(source: string, filePath: string): string[] {
  const imports: string[] = [];
  const dir = dirname(filePath);

  for (const match of source.matchAll(IMPORT_REGEX)) {
    const raw = match[1];
    if (!raw) continue;

    // Resolve relative path and normalize to .ts extension
    const resolved = join(dir, raw).replace(/\.js$/, '.ts');
    imports.push(resolved);
  }

  return imports;
}

/**
 * Given a set of target files, resolve their import chains up to `depth` levels.
 * Returns a deduplicated list of file paths that form the dependency tree.
 *
 * Only follows local imports (starting with './' or '../').
 * Stops at the specified depth to prevent runaway context expansion.
 */
export async function resolveImportChain(
  projectRoot: string,
  targetFiles: string[],
  depth = 2
): Promise<string[]> {
  const visited = new Set<string>();
  let frontier = [...targetFiles];

  for (let d = 0; d < depth && frontier.length > 0; d++) {
    const nextFrontier: string[] = [];

    for (const filePath of frontier) {
      if (visited.has(filePath)) continue;
      visited.add(filePath);

      try {
        const fullPath = join(projectRoot, filePath);
        const source = await readFile(fullPath, 'utf-8');
        const imports = extractLocalImports(source, filePath);

        for (const imp of imports) {
          if (!visited.has(imp)) {
            nextFrontier.push(imp);
          }
        }
      } catch {
        // File doesn't exist or unreadable — skip
        logger.debug({ filePath }, 'Import resolution: file not found');
      }
    }

    frontier = nextFrontier;
  }

  // Add final frontier files (leaf nodes) to visited
  for (const f of frontier) {
    visited.add(f);
  }

  // Remove the original target files — caller already has them
  for (const f of targetFiles) {
    visited.delete(f);
  }

  return [...visited].sort();
}

/**
 * Infers which existing files should be read as context for a given task type and prompt.
 *
 * For 'refactor' and 'bugfix': follows import chains from plan files.
 * For 'test-gen': includes the source file being tested + its imports.
 * For 'schema-migration': includes the target schema + model + service + route.
 * For 'new-resource' and 'doc-gen': no extra inference (reference CRUD is sufficient).
 */
export async function inferContextFiles(
  projectRoot: string,
  planFiles: { path: string; action: string; type: string }[],
  taskType: string
): Promise<string[]> {
  const targetFiles = planFiles.filter((f) => f.action === 'modify').map((f) => f.path);

  switch (taskType) {
    case 'refactor':
    case 'bugfix': {
      // Follow imports 2 levels deep from files being modified
      if (targetFiles.length === 0) return [];
      return resolveImportChain(projectRoot, targetFiles, 2);
    }

    case 'test-gen': {
      // For test files, infer the source file being tested
      const sourceFiles: string[] = [];
      for (const f of planFiles) {
        if (f.type === 'test' && f.action === 'create') {
          // tests/unit/schemas/foo.schema.test.ts → src/schemas/foo.schema.ts
          // tests/unit/utils/foo-query-builder.test.ts → src/utils/foo-query-builder.ts
          // tests/unit/services/builder/foo.test.ts → src/services/builder/foo.ts
          const sourcePath = f.path
            .replace(/^tests\/unit\//, 'src/')
            .replace(/^tests\/integration\//, 'src/')
            .replace(/\.test\.ts$/, '.ts');
          sourceFiles.push(sourcePath);
        }
      }

      if (sourceFiles.length === 0) return [];
      // Include source files + their imports
      const imports = await resolveImportChain(projectRoot, sourceFiles, 1);
      return [...new Set([...sourceFiles, ...imports])].sort();
    }

    case 'schema-migration': {
      // Include the full resource stack for each modified schema
      const extra: string[] = [];
      for (const f of targetFiles) {
        if (f.includes('schema')) {
          const base = f.replace('src/schemas/', '').replace('.schema.ts', '');
          extra.push(
            `src/models/${base}.model.ts`,
            `src/services/${base}.service.ts`,
            `src/routes/${base}.routes.ts`
          );
        }
      }
      return [...new Set([...extra])].sort();
    }

    default:
      return [];
  }
}
