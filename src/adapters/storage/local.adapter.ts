import { mkdir, readFile, unlink, writeFile } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import type { StorageAdapter } from './types.js';

const UPLOADS_DIR = resolve('./uploads');

export class LocalStorageAdapter implements StorageAdapter {
  private readonly baseDir: string;

  constructor(baseDir: string = UPLOADS_DIR) {
    this.baseDir = baseDir;
  }

  async upload(key: string, data: Buffer, _contentType: string): Promise<string> {
    const filePath = join(this.baseDir, key);
    await mkdir(dirname(filePath), { recursive: true });
    await writeFile(filePath, data);
    return `file://${filePath}`;
  }

  async download(key: string): Promise<Buffer> {
    const filePath = join(this.baseDir, key);
    return readFile(filePath);
  }

  async delete(key: string): Promise<void> {
    const filePath = join(this.baseDir, key);
    await unlink(filePath);
  }

  getSignedUrl(key: string, _expiresInSeconds?: number): Promise<string> {
    // Local filesystem has no concept of signed URLs — return file path
    const filePath = join(this.baseDir, key);
    return Promise.resolve(`file://${filePath}`);
  }
}
