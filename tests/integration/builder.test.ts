import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// --- Mock data ---

const mockJobJson = {
  id: 'job-id-123',
  prompt: 'Add a GET /api/v1/products endpoint that lists all products',
  status: 'queued',
  options: { dryRun: false, includeModel: true, includeTests: true },
  userId: 'user-id-123',
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const mockJobDoc = {
  _id: { toString: () => 'job-id-123' },
  prompt: 'Add a GET /api/v1/products endpoint that lists all products',
  status: 'queued',
  options: { dryRun: false, includeModel: true, includeTests: true },
  userId: 'user-id-123',
  get: vi.fn().mockReturnValue('2025-01-01T00:00:00.000Z'),
  toJSON: vi.fn().mockReturnValue(mockJobJson),
};

// --- Standalone mock fns ---

const mockCreate = vi.fn();
const mockFindById = vi.fn();
const mockFind = vi.fn().mockReturnValue({
  sort: vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue([]),
  }),
});
const mockFindByIdAndUpdate = vi.fn();

vi.mock('../../src/models/builder-job.model.js', () => ({
  BuilderJobModel: {
    create: (...args: unknown[]) => mockCreate(...args),
    findById: (...args: unknown[]) => mockFindById(...args),
    find: (...args: unknown[]) => mockFind(...args),
    findByIdAndUpdate: (...args: unknown[]) => mockFindByIdAndUpdate(...args),
  },
}));

// Imports after mock setup
const { builderRouter } = await import('../../src/routes/builder.routes.js');
const { handleError } = await import('../../src/middleware/errorHandler.js');

// --- Test app factory ---

function createTestApp(role = 'admin') {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('requestId', 'test-req-id');
    c.set('userId', 'user-id-123');
    c.set('email', 'admin@example.com');
    c.set('role', role);
    await next();
  });
  app.route('/api/v1', builderRouter);
  app.onError(handleError);
  return app;
}

// --- Tests ---

describe('Builder routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockJobDoc.toJSON.mockReturnValue(mockJobJson);
    // Reset BUILDER_ENABLED for each test
    process.env['BUILDER_ENABLED'] = 'true';
  });

  describe('POST /api/v1/builder/generate', () => {
    it('returns 503 when builder is disabled', async () => {
      process.env['BUILDER_ENABLED'] = 'false';

      const app = createTestApp();
      const res = await app.request('/api/v1/builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Add a products endpoint with CRUD operations' }),
      });

      expect(res.status).toBe(503);
      const body = await res.json();
      expect(body.error.code).toBe('BUILDER_DISABLED');
    });

    it('returns 403 when user is not admin', async () => {
      const app = createTestApp('user');
      const res = await app.request('/api/v1/builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'Add a products endpoint with CRUD operations' }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('returns 400 when prompt is too short', async () => {
      const app = createTestApp();
      const res = await app.request('/api/v1/builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: 'short' }),
      });

      expect(res.status).toBe(400);
    });

    it('returns 202 with jobId when valid prompt', async () => {
      mockCreate.mockResolvedValueOnce(mockJobDoc);

      const app = createTestApp();
      const res = await app.request('/api/v1/builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Add a GET /api/v1/products endpoint that lists all products',
        }),
      });

      expect(res.status).toBe(202);
      const body = await res.json();
      expect(body.jobId).toBe('job-id-123');
      expect(body.status).toBe('queued');
    });

    it('returns 202 with options when provided', async () => {
      mockCreate.mockResolvedValueOnce(mockJobDoc);

      const app = createTestApp();
      const res = await app.request('/api/v1/builder/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt: 'Add a GET /api/v1/products endpoint that lists all products',
          options: { dryRun: true },
        }),
      });

      expect(res.status).toBe(202);
    });
  });

  describe('GET /api/v1/builder/jobs/:id', () => {
    it('returns 200 with job data when found', async () => {
      mockFindById.mockResolvedValueOnce(mockJobDoc);

      const app = createTestApp();
      const res = await app.request('/api/v1/builder/jobs/job-id-123');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.id).toBe('job-id-123');
      expect(body.prompt).toBe(mockJobJson.prompt);
      expect(body.status).toBe('queued');
    });

    it('returns 404 when job is not found', async () => {
      mockFindById.mockResolvedValueOnce(null);

      const app = createTestApp();
      const res = await app.request('/api/v1/builder/jobs/nonexistent');

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });

    it('allows non-admin users to check job status', async () => {
      mockFindById.mockResolvedValueOnce(mockJobDoc);

      const app = createTestApp('user');
      const res = await app.request('/api/v1/builder/jobs/job-id-123');

      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/v1/builder/jobs', () => {
    it('returns 200 with empty list', async () => {
      const app = createTestApp();
      const res = await app.request('/api/v1/builder/jobs');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.data).toEqual([]);
      expect(body.pagination.hasNext).toBe(false);
    });

    it('returns 403 when user is not admin', async () => {
      const app = createTestApp('user');
      const res = await app.request('/api/v1/builder/jobs');

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('supports status filter', async () => {
      const app = createTestApp();
      const res = await app.request('/api/v1/builder/jobs?status=completed');

      expect(res.status).toBe(200);
      expect(mockFind).toHaveBeenCalledWith(expect.objectContaining({ status: 'completed' }));
    });
  });

  describe('POST /api/v1/builder/jobs/:id/approve', () => {
    it('returns 503 when builder is disabled', async () => {
      process.env['BUILDER_ENABLED'] = 'false';
      const app = createTestApp();
      const res = await app.request('/api/v1/builder/jobs/abc123/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
        body: JSON.stringify({
          plan: {
            files: [
              {
                path: 'src/schemas/x.schema.ts',
                type: 'schema',
                action: 'create',
                description: 'X',
              },
            ],
            summary: 'Test',
          },
        }),
      });
      expect(res.status).toBe(503);
    });

    it('returns 403 when role is user', async () => {
      process.env['BUILDER_ENABLED'] = 'true';
      const app = createTestApp('user');
      const res = await app.request('/api/v1/builder/jobs/abc123/approve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer test' },
        body: JSON.stringify({
          plan: {
            files: [
              {
                path: 'src/schemas/x.schema.ts',
                type: 'schema',
                action: 'create',
                description: 'X',
              },
            ],
            summary: 'Test',
          },
        }),
      });
      expect(res.status).toBe(403);
    });
  });

  describe('POST /api/v1/builder/jobs/:id/reject', () => {
    it('returns 503 when builder is disabled', async () => {
      process.env['BUILDER_ENABLED'] = 'false';
      const app = createTestApp();
      const res = await app.request('/api/v1/builder/jobs/abc123/reject', {
        method: 'POST',
        headers: { Authorization: 'Bearer test' },
      });
      expect(res.status).toBe(503);
    });

    it('returns 403 when role is user', async () => {
      process.env['BUILDER_ENABLED'] = 'true';
      const app = createTestApp('user');
      const res = await app.request('/api/v1/builder/jobs/abc123/reject', {
        method: 'POST',
        headers: { Authorization: 'Bearer test' },
      });
      expect(res.status).toBe(403);
    });
  });
});
