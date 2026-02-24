import { describe, it, expect, vi } from 'vitest';
import {
  computeDiffs,
  computePlanCoverage,
  findImpactedFiles,
} from '../../../../src/services/builder/dry-run.js';
import type {
  BuilderGeneratedFile,
  BuilderPlanFile,
} from '../../../../src/schemas/builder.schema.js';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
  readdir: vi.fn(),
}));

describe('computeDiffs', () => {
  it('should produce diff for modified files', async () => {
    const { readFile } = await import('node:fs/promises');
    vi.mocked(readFile).mockResolvedValue('const x = 1;\n');

    const files: BuilderGeneratedFile[] = [
      { path: 'src/foo.ts', content: 'const x = 2;\n', action: 'modified' },
    ];
    const diffs = await computeDiffs('/root', files);
    expect(diffs).toHaveLength(1);
    const first = diffs[0];
    expect(first).toBeDefined();
    expect(first?.path).toBe('src/foo.ts');
    expect(first?.diff).toContain('-const x = 1;');
    expect(first?.diff).toContain('+const x = 2;');
  });

  it('should show full content for created files', async () => {
    const files: BuilderGeneratedFile[] = [
      { path: 'src/new.ts', content: 'export const Y = 1;\n', action: 'created' },
    ];
    const diffs = await computeDiffs('/root', files);
    expect(diffs).toHaveLength(1);
    const first = diffs[0];
    expect(first).toBeDefined();
    expect(first?.diff).toContain('+export const Y = 1;');
  });
});

describe('computePlanCoverage', () => {
  it('should detect missing files', () => {
    const planned: BuilderPlanFile[] = [
      { path: 'src/a.ts', type: 'schema', action: 'create', description: 'A' },
      { path: 'src/b.ts', type: 'model', action: 'create', description: 'B' },
      { path: 'src/c.ts', type: 'service', action: 'create', description: 'C' },
    ];
    const generated: BuilderGeneratedFile[] = [
      { path: 'src/a.ts', content: '', action: 'created' },
    ];

    const coverage = computePlanCoverage(planned, generated);
    expect(coverage.planned).toEqual(['src/a.ts', 'src/b.ts', 'src/c.ts']);
    expect(coverage.generated).toEqual(['src/a.ts']);
    expect(coverage.missing).toEqual(['src/b.ts', 'src/c.ts']);
  });

  it('should report full coverage when all files generated', () => {
    const planned: BuilderPlanFile[] = [
      { path: 'src/a.ts', type: 'schema', action: 'create', description: 'A' },
    ];
    const generated: BuilderGeneratedFile[] = [
      { path: 'src/a.ts', content: '', action: 'created' },
    ];
    const coverage = computePlanCoverage(planned, generated);
    expect(coverage.missing).toEqual([]);
  });
});

describe('findImpactedFiles', () => {
  it('should find files that import from modified paths', async () => {
    const { readFile, readdir } = await import('node:fs/promises');
    vi.mocked(readdir).mockImplementation(async (dirPath: unknown) => {
      const p = String(dirPath);
      if (p.endsWith('/src'))
        return [
          { name: 'index.ts', isDirectory: () => false, isFile: () => true },
        ] as unknown as Awaited<ReturnType<typeof readdir>>;
      return [] as unknown as Awaited<ReturnType<typeof readdir>>;
    });
    vi.mocked(readFile).mockResolvedValue("import { Foo } from './schemas/foo.schema.js';\n");

    const impacted = await findImpactedFiles('/root', [
      { path: 'src/schemas/foo.schema.ts', content: '', action: 'modified' },
    ]);
    expect(impacted).toContain('src/index.ts');
  });

  it('should return empty array when no files are modified', async () => {
    const impacted = await findImpactedFiles('/root', [
      { path: 'src/new.ts', content: '', action: 'created' },
    ]);
    expect(impacted).toEqual([]);
  });
});
