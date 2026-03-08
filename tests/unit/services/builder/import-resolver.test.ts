import { vi, describe, it, expect, beforeEach } from 'vitest';

vi.mock('node:fs/promises', () => ({
  readFile: vi.fn(),
}));

const { readFile } = await import('node:fs/promises');
const mockReadFile = vi.mocked(readFile);

const { extractLocalImports, resolveImportChain, inferContextFiles } =
  await import('../../../../src/services/builder/import-resolver.js');

describe('extractLocalImports', () => {
  it('should extract relative imports with .js extension', () => {
    const source = `
import { UserSchema } from './user.schema.js';
import type { ContextBundle } from '../context-reader.js';
export { foo } from './bar.js';
    `;
    const result = extractLocalImports(source, 'src/schemas/product.schema.ts');
    expect(result).toEqual([
      'src/schemas/user.schema.ts',
      'src/context-reader.ts',
      'src/schemas/bar.ts',
    ]);
  });

  it('should ignore non-relative imports (packages)', () => {
    const source = `
import { z } from 'zod';
import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
    `;
    const result = extractLocalImports(source, 'src/services/foo.ts');
    expect(result).toEqual([]);
  });

  it('should handle default imports', () => {
    const source = `import logger from './logger.js';`;
    const result = extractLocalImports(source, 'src/utils/helper.ts');
    expect(result).toEqual(['src/utils/logger.ts']);
  });

  it('should handle import type', () => {
    const source = `import type { User } from '../models/user.model.js';`;
    const result = extractLocalImports(source, 'src/services/user.service.ts');
    expect(result).toEqual(['src/models/user.model.ts']);
  });

  it('should return empty array for files with no local imports', () => {
    const source = `const x = 1;\nexport default x;\n`;
    const result = extractLocalImports(source, 'src/config/constants.ts');
    expect(result).toEqual([]);
  });
});

describe('resolveImportChain', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should resolve direct imports (depth 1)', async () => {
    mockReadFile.mockImplementation(async (filePath: unknown) => {
      const p = filePath as string;
      if (p.endsWith('service.ts')) {
        return `import { UserModel } from '../models/user.model.js';\nimport { UserSchema } from '../schemas/user.schema.js';\n`;
      }
      return '';
    });

    const result = await resolveImportChain('/project', ['src/services/user.service.ts'], 1);
    expect(result).toContain('src/models/user.model.ts');
    expect(result).toContain('src/schemas/user.schema.ts');
  });

  it('should resolve transitive imports (depth 2)', async () => {
    mockReadFile.mockImplementation(async (filePath: unknown) => {
      const p = filePath as string;
      if (p.endsWith('user.service.ts')) {
        return `import { UserModel } from '../models/user.model.js';\n`;
      }
      if (p.endsWith('user.model.ts')) {
        return `import { UserSchema } from '../schemas/user.schema.js';\n`;
      }
      return '';
    });

    const result = await resolveImportChain('/project', ['src/services/user.service.ts'], 2);
    expect(result).toContain('src/models/user.model.ts');
    expect(result).toContain('src/schemas/user.schema.ts');
  });

  it('should not include the target files in results', async () => {
    mockReadFile.mockResolvedValue(`import { foo } from './bar.js';\n`);

    const result = await resolveImportChain('/project', ['src/services/user.service.ts'], 1);
    expect(result).not.toContain('src/services/user.service.ts');
  });

  it('should handle missing files gracefully', async () => {
    mockReadFile.mockRejectedValue(new Error('ENOENT'));

    const result = await resolveImportChain('/project', ['src/nonexistent.ts'], 1);
    expect(result).toEqual([]);
  });

  it('should deduplicate imports across multiple targets', async () => {
    mockReadFile.mockImplementation(async (filePath: unknown) => {
      const p = filePath as string;
      if (p.endsWith('a.ts') || p.endsWith('b.ts')) {
        return `import { shared } from '../utils/shared.js';\n`;
      }
      return '';
    });

    const result = await resolveImportChain(
      '/project',
      ['src/services/a.ts', 'src/services/b.ts'],
      1
    );
    const sharedCount = result.filter((f) => f.includes('shared')).length;
    expect(sharedCount).toBe(1);
  });
});

describe('inferContextFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return empty for new-resource tasks', async () => {
    const result = await inferContextFiles(
      '/project',
      [{ path: 'src/schemas/product.schema.ts', action: 'create', type: 'schema' }],
      'new-resource'
    );
    expect(result).toEqual([]);
  });

  it('should resolve imports for refactor tasks', async () => {
    mockReadFile.mockImplementation(async (filePath: unknown) => {
      const p = filePath as string;
      if (p.endsWith('user.service.ts')) {
        return `import { UserModel } from '../models/user.model.js';\n`;
      }
      return '';
    });

    const result = await inferContextFiles(
      '/project',
      [{ path: 'src/services/user.service.ts', action: 'modify', type: 'service' }],
      'refactor'
    );
    expect(result).toContain('src/models/user.model.ts');
  });

  it('should resolve imports for bugfix tasks', async () => {
    mockReadFile.mockImplementation(async (filePath: unknown) => {
      const p = filePath as string;
      if (p.endsWith('auth.service.ts')) {
        return `import { AppError } from '../utils/errors.js';\n`;
      }
      return '';
    });

    const result = await inferContextFiles(
      '/project',
      [{ path: 'src/services/auth.service.ts', action: 'modify', type: 'service' }],
      'bugfix'
    );
    expect(result).toContain('src/utils/errors.ts');
  });

  it('should infer source files for test-gen tasks', async () => {
    mockReadFile.mockResolvedValue('export const x = 1;\n');

    const result = await inferContextFiles(
      '/project',
      [{ path: 'tests/unit/schemas/product.schema.test.ts', action: 'create', type: 'test' }],
      'test-gen'
    );
    expect(result).toContain('src/schemas/product.schema.ts');
  });

  it('should infer full resource stack for schema-migration tasks', async () => {
    const result = await inferContextFiles(
      '/project',
      [{ path: 'src/schemas/user.schema.ts', action: 'modify', type: 'schema' }],
      'schema-migration'
    );
    expect(result).toContain('src/models/user.model.ts');
    expect(result).toContain('src/services/user.service.ts');
    expect(result).toContain('src/routes/user.routes.ts');
  });

  it('should return empty for doc-gen tasks', async () => {
    const result = await inferContextFiles(
      '/project',
      [{ path: 'CLAUDE.md', action: 'modify', type: 'config' }],
      'doc-gen'
    );
    expect(result).toEqual([]);
  });

  it('should return empty for refactor with no modify actions', async () => {
    const result = await inferContextFiles(
      '/project',
      [{ path: 'src/services/new.service.ts', action: 'create', type: 'service' }],
      'refactor'
    );
    expect(result).toEqual([]);
  });
});
