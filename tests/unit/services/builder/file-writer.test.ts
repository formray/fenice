import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockWriteFile = vi.fn();
const mockMkdir = vi.fn();

vi.mock('node:fs/promises', () => ({
  writeFile: (...args: unknown[]) => mockWriteFile(...args),
  mkdir: (...args: unknown[]) => mockMkdir(...args),
}));

const { writeGeneratedFiles } = await import('../../../../src/services/builder/file-writer.js');

describe('writeGeneratedFiles', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWriteFile.mockResolvedValue(undefined);
    mockMkdir.mockResolvedValue(undefined);
  });

  it('should write files to the correct paths', async () => {
    const files = [
      {
        path: 'src/schemas/product.schema.ts',
        content: 'export const ProductSchema = z.object({});',
        action: 'created' as const,
      },
    ];

    const written = await writeGeneratedFiles('/project', files);

    expect(written).toEqual(['src/schemas/product.schema.ts']);
    expect(mockMkdir).toHaveBeenCalledWith('/project/src/schemas', { recursive: true });
    expect(mockWriteFile).toHaveBeenCalledWith(
      '/project/src/schemas/product.schema.ts',
      'export const ProductSchema = z.object({});\n',
      'utf-8'
    );
  });

  it('should write multiple files', async () => {
    const files = [
      { path: 'src/schemas/product.schema.ts', content: 'schema', action: 'created' as const },
      { path: 'src/models/product.model.ts', content: 'model', action: 'created' as const },
      { path: 'tests/unit/product.test.ts', content: 'test', action: 'created' as const },
    ];

    const written = await writeGeneratedFiles('/project', files);

    expect(written).toHaveLength(3);
    expect(mockWriteFile).toHaveBeenCalledTimes(3);
  });

  it('should throw on scope policy violation', async () => {
    const files = [{ path: '.env', content: 'SECRET=hack', action: 'created' as const }];

    await expect(writeGeneratedFiles('/project', files)).rejects.toThrow('Cannot write .env');
  });

  it('should handle modified files for allowed paths', async () => {
    const files = [
      { path: 'src/index.ts', content: 'updated content', action: 'modified' as const },
    ];

    const written = await writeGeneratedFiles('/project', files);

    expect(written).toEqual(['src/index.ts']);
    expect(mockWriteFile).toHaveBeenCalledTimes(1);
  });
});
