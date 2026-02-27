import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import type { BuilderGeneratedFile } from '../../schemas/builder.schema.js';
import { validateFilePath } from './scope-policy.js';
import { AppError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('fenice', process.env['LOG_LEVEL'] ?? 'info');

export async function writeGeneratedFiles(
  projectRoot: string,
  files: BuilderGeneratedFile[]
): Promise<string[]> {
  const writtenPaths: string[] = [];

  for (const file of files) {
    const pathError = validateFilePath(file.path, file.action);
    if (pathError) {
      throw new AppError(400, 'SCOPE_VIOLATION', `Cannot write ${file.path}: ${pathError}`);
    }

    const fullPath = join(projectRoot, file.path);
    const dir = dirname(fullPath);
    const content = file.content.endsWith('\n') ? file.content : file.content + '\n';

    await mkdir(dir, { recursive: true });
    await writeFile(fullPath, content, 'utf-8');

    writtenPaths.push(file.path);
    logger.info({ path: file.path, action: file.action }, 'File written');
  }

  return writtenPaths;
}
