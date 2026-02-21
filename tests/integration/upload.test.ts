import { describe, it, expect, vi, beforeAll, afterAll } from 'vitest';
import { tmpdir } from 'node:os';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';

/* ------------------------------------------------------------------ *
 *  Module-level temp dir reference – set in beforeAll, consumed by   *
 *  the createAdapters mock (hoisted by vitest).                      *
 * ------------------------------------------------------------------ */
let testDir: string;

/* ------------------------------------------------------------------ *
 *  Mock loadEnv() so we don't need real env vars                     *
 * ------------------------------------------------------------------ */
vi.mock('../../src/config/env.js', () => ({
  loadEnv: () => ({
    JWT_SECRET: 'test-jwt-secret-value-must-be-32chars!',
    JWT_REFRESH_SECRET: 'test-refresh-secret-value-32chars!',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    UPLOAD_MAX_SIZE_BYTES: 10_485_760, // 10 MB
    UPLOAD_CHUNK_SIZE_BYTES: 1_048_576, // 1 MB
    UPLOAD_SESSION_TIMEOUT_MS: 3_600_000,
    UPLOAD_MAX_CONCURRENT: 5,
    REQUEST_TIMEOUT_MS: 30_000,
    BODY_SIZE_LIMIT_BYTES: 1_048_576,
    PORT: 3000,
    HOST: '0.0.0.0',
    SERVICE_NAME: 'fenice-test',
    LOG_LEVEL: 'silent',
    API_VERSION: 'v1',
    RATE_LIMIT_WINDOW_MS: 60_000,
    RATE_LIMIT_MAX: 100,
    RATE_LIMIT_AUTH_WINDOW_MS: 300_000,
    RATE_LIMIT_AUTH_MAX: 10,
    MONGODB_URI: 'mongodb://localhost:27017/test',
  }),
}));

/* ------------------------------------------------------------------ *
 *  Mock createAdapters() to use LocalStorageAdapter with temp dir    *
 * ------------------------------------------------------------------ */
vi.mock('../../src/adapters/index.js', async () => {
  const { LocalStorageAdapter } = await vi.importActual<
    typeof import('../../src/adapters/storage/local.adapter.js')
  >('../../src/adapters/storage/local.adapter.js');

  return {
    createAdapters: () => ({
      email: { send: vi.fn() },
      storage: new LocalStorageAdapter(testDir),
      messaging: { send: vi.fn() },
    }),
  };
});

/* ------------------------------------------------------------------ *
 *  Imports – must come AFTER vi.mock calls (vitest hoists mocks)     *
 * ------------------------------------------------------------------ */
import { Hono } from 'hono';
import { uploadRouter } from '../../src/routes/upload.routes.js';
import { handleError } from '../../src/middleware/errorHandler.js';

/* ------------------------------------------------------------------ *
 *  Test app: upload routes without real auth                         *
 * ------------------------------------------------------------------ */
function createTestApp(): Hono {
  const app = new Hono();

  // Fake auth middleware – sets the variables the route handlers expect
  app.use('*', async (c, next) => {
    c.set('requestId', 'test-req-id');
    c.set('userId', 'test-user-id');
    c.set('email', 'test@example.com');
    c.set('role', 'user');
    await next();
  });

  app.route('/api/v1', uploadRouter);
  app.onError(handleError);
  return app;
}

/* ------------------------------------------------------------------ *
 *  Setup & teardown                                                  *
 * ------------------------------------------------------------------ */
let app: Hono;

beforeAll(async () => {
  testDir = await mkdtemp(join(tmpdir(), 'fenice-upload-test-'));
  app = createTestApp();
});

afterAll(async () => {
  await rm(testDir, { recursive: true, force: true });
});

/* ------------------------------------------------------------------ *
 *  Helpers                                                           *
 * ------------------------------------------------------------------ */
async function initUpload(
  overrides: Record<string, unknown> = {}
): Promise<{ status: number; body: Record<string, unknown> }> {
  const payload = {
    filename: 'test-file.txt',
    contentType: 'application/pdf',
    totalSize: 2048,
    ...overrides,
  };

  const res = await app.request('/api/v1/upload/init', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  const body = (await res.json()) as Record<string, unknown>;
  return { status: res.status, body };
}

/* ================================================================== *
 *  Tests                                                             *
 * ================================================================== */
describe('Upload Routes – integration', () => {
  // ------------------------------------------------------------------
  // 1. POST /api/v1/upload/init – happy path
  // ------------------------------------------------------------------
  it('POST /upload/init should return 201 with session info', async () => {
    const { status, body } = await initUpload();

    expect(status).toBe(201);
    expect(body).toHaveProperty('uploadId');
    expect(typeof body['uploadId']).toBe('string');
    expect(body).toHaveProperty('chunkSize');
    expect(typeof body['chunkSize']).toBe('number');
    expect(body).toHaveProperty('totalChunks');
    expect(typeof body['totalChunks']).toBe('number');
    expect(body).toHaveProperty('expiresAt');
    expect(typeof body['expiresAt']).toBe('string');
  });

  // ------------------------------------------------------------------
  // 2. POST /api/v1/upload/init – file exceeds max size
  // ------------------------------------------------------------------
  it('POST /upload/init should return 400 when totalSize exceeds schema max', async () => {
    // The Zod schema caps totalSize at 104_857_600 (MAX_FILE_SIZE).
    // Sending a value above that triggers a validation error (400).
    const { status, body } = await initUpload({ totalSize: 200_000_000 });

    expect(status).toBe(400);
    expect(body).toHaveProperty('error');
  });

  // ------------------------------------------------------------------
  // 3. PUT /api/v1/upload/:id/chunk/0 – upload a single chunk
  // ------------------------------------------------------------------
  it('PUT /upload/:id/chunk/0 should return 200 with progress', async () => {
    // Init a 2048-byte upload → chunkSize is 1_048_576, so totalChunks = 1
    const { body: initBody } = await initUpload({ totalSize: 2048 });
    const uploadId = initBody['uploadId'] as string;

    const chunkData = Buffer.alloc(2048, 0x61); // 2048 bytes of 'a'

    const res = await app.request(`/api/v1/upload/${uploadId}/chunk/0`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: chunkData,
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('uploaded', 1);
    expect(body).toHaveProperty('totalChunks', 1);
    expect(body).toHaveProperty('progress', '100%');
  });

  // ------------------------------------------------------------------
  // 4. POST /api/v1/upload/:id/complete – assemble the file
  // ------------------------------------------------------------------
  it('POST /upload/:id/complete should return 200 with file metadata', async () => {
    // Init + upload single chunk + complete
    const { body: initBody } = await initUpload({ totalSize: 512 });
    const uploadId = initBody['uploadId'] as string;

    const chunkData = Buffer.alloc(512, 0x62);
    await app.request(`/api/v1/upload/${uploadId}/chunk/0`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/octet-stream' },
      body: chunkData,
    });

    const res = await app.request(`/api/v1/upload/${uploadId}/complete`, {
      method: 'POST',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('fileId');
    expect(typeof body['fileId']).toBe('string');
    expect(body).toHaveProperty('fileUrl');
    expect(typeof body['fileUrl']).toBe('string');
    expect(body).toHaveProperty('filename', 'test-file.txt');
    expect(body).toHaveProperty('contentType', 'application/pdf');
    expect(body).toHaveProperty('size', 512);
    expect(body).toHaveProperty('createdAt');
  });

  // ------------------------------------------------------------------
  // 5. DELETE /api/v1/upload/:id – cancel an upload
  // ------------------------------------------------------------------
  it('DELETE /upload/:id should return 200 with success message', async () => {
    const { body: initBody } = await initUpload({ totalSize: 1024 });
    const uploadId = initBody['uploadId'] as string;

    const res = await app.request(`/api/v1/upload/${uploadId}`, {
      method: 'DELETE',
    });

    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body).toHaveProperty('success', true);
    expect(body).toHaveProperty('message', 'Upload cancelled');
  });
});
