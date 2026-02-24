import { readFile, readdir } from 'node:fs/promises';
import type { Dirent } from 'node:fs';
import { join, relative, basename } from 'node:path';
import { createTwoFilesPatch } from 'diff';
import type { BuilderGeneratedFile, BuilderPlanFile } from '../../schemas/builder.schema.js';

export interface DiffEntry {
  path: string;
  diff: string;
}

export interface PlanCoverage {
  planned: string[];
  generated: string[];
  missing: string[];
}

export async function computeDiffs(
  projectRoot: string,
  files: BuilderGeneratedFile[]
): Promise<DiffEntry[]> {
  const diffs: DiffEntry[] = [];

  for (const file of files) {
    let original = '';
    if (file.action === 'modified') {
      try {
        original = await readFile(join(projectRoot, file.path), 'utf-8');
      } catch {
        // File doesn't exist yet — treat as new
      }
    }

    const diff = createTwoFilesPatch(
      file.path,
      file.path,
      original,
      file.content,
      'original',
      'generated'
    );
    diffs.push({ path: file.path, diff });
  }

  return diffs;
}

export function computePlanCoverage(
  planned: BuilderPlanFile[],
  generated: BuilderGeneratedFile[]
): PlanCoverage {
  const plannedPaths = planned.map((f) => f.path);
  const generatedPaths = generated.map((f) => f.path);
  const generatedSet = new Set(generatedPaths);
  const missing = plannedPaths.filter((p) => !generatedSet.has(p));

  return { planned: plannedPaths, generated: generatedPaths, missing };
}

export async function findImpactedFiles(
  projectRoot: string,
  files: BuilderGeneratedFile[]
): Promise<string[]> {
  const modifiedPaths = files.filter((f) => f.action === 'modified').map((f) => f.path);

  if (modifiedPaths.length === 0) return [];

  // Build import patterns to search for
  const importPatterns = modifiedPaths.map((p) => {
    const withoutExt = p.replace(/\.ts$/, '.js');
    const fileName = basename(withoutExt, '.js');
    return fileName;
  });

  const impacted = new Set<string>();

  async function scanDir(dirPath: string): Promise<void> {
    let items: Dirent[];
    try {
      items = await readdir(dirPath, { withFileTypes: true, encoding: 'utf-8' });
    } catch {
      return;
    }

    for (const item of items) {
      const name = item.name;
      const fullPath = join(dirPath, name);
      if (item.isDirectory()) {
        if (['node_modules', 'dist', '.git'].includes(name)) continue;
        await scanDir(fullPath);
      } else if (item.isFile() && name.endsWith('.ts')) {
        const relativePath = relative(projectRoot, fullPath).replace(/\\/g, '/');
        // Skip files that are themselves being modified
        if (modifiedPaths.includes(relativePath)) continue;

        try {
          const content = await readFile(fullPath, 'utf-8');
          for (const pattern of importPatterns) {
            if (content.includes(pattern)) {
              impacted.add(relativePath);
              break;
            }
          }
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  await scanDir(join(projectRoot, 'src'));
  return [...impacted].sort();
}
