import { describe, it, expect, afterAll } from 'vitest';
import { LocalStorageAdapter } from '../../../src/adapters/storage/local.adapter.js';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

describe('LocalStorageAdapter', () => {
  let tempDir: string;
  let adapter: LocalStorageAdapter;

  // Use a real temp directory for each test run
  const setup = async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'fenice-storage-test-'));
    adapter = new LocalStorageAdapter(tempDir);
  };

  afterAll(async () => {
    if (tempDir) {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it('should upload, download, and delete a file', async () => {
    await setup();
    const key = 'test-file.txt';
    const data = Buffer.from('hello world');

    // Upload
    const url = await adapter.upload(key, data, 'text/plain');
    expect(url).toContain(key);
    expect(url).toMatch(/^file:\/\//);

    // Download
    const downloaded = await adapter.download(key);
    expect(downloaded.toString()).toBe('hello world');

    // Delete
    await adapter.delete(key);
    await expect(adapter.download(key)).rejects.toThrow();
  });

  it('should create nested directories on upload', async () => {
    await setup();
    const key = 'nested/dir/file.txt';
    const data = Buffer.from('nested content');

    const url = await adapter.upload(key, data, 'text/plain');
    expect(url).toContain('nested/dir/file.txt');

    const downloaded = await adapter.download(key);
    expect(downloaded.toString()).toBe('nested content');
  });

  it('should return file:// URL for getSignedUrl', async () => {
    await setup();
    const key = 'some-file.pdf';
    const url = await adapter.getSignedUrl(key, 3600);
    expect(url).toMatch(/^file:\/\//);
    expect(url).toContain(key);
  });

  it('should handle binary data', async () => {
    await setup();
    const key = 'binary.bin';
    const data = Buffer.from([0x00, 0xff, 0x42, 0x13, 0x37]);

    await adapter.upload(key, data, 'application/octet-stream');
    const downloaded = await adapter.download(key);

    expect(Buffer.compare(downloaded, data)).toBe(0);
  });
});
