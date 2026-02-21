import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import { handleError } from '../../../src/middleware/errorHandler.js';
import {
  AppError,
  NotFoundError,
  NotAuthorizedError,
  ForbiddenError,
  ValidationError,
  RateLimitError,
  UploadError,
} from '../../../src/utils/errors.js';

function createTestApp() {
  const app = new Hono();

  // Set requestId like the real app does
  app.use('*', async (c, next) => {
    c.set('requestId', 'test-request-id');
    await next();
  });

  app.get('/app-error', () => {
    throw new AppError(400, 'CUSTOM_ERROR', 'Custom message');
  });
  app.get('/not-found', () => {
    throw new NotFoundError();
  });
  app.get('/not-authorized', () => {
    throw new NotAuthorizedError();
  });
  app.get('/forbidden', () => {
    throw new ForbiddenError();
  });
  app.get('/validation', () => {
    throw new ValidationError([{ field: 'email', message: 'Invalid email' }]);
  });
  app.get('/rate-limit', () => {
    throw new RateLimitError(60);
  });
  app.get('/upload', () => {
    throw new UploadError('File too large');
  });
  app.get('/zod-error', () => {
    z.object({ email: z.email() }).parse({ email: 'invalid' });
  });
  app.get('/unknown', () => {
    throw new Error('Something went wrong');
  });

  app.onError(handleError);
  return app;
}

describe('handleError', () => {
  it('should handle AppError with correct status and body', async () => {
    const app = createTestApp();
    const res = await app.request('/app-error');

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('CUSTOM_ERROR');
    expect(body.error.message).toBe('Custom message');
    expect(body.error.requestId).toBe('test-request-id');
  });

  it('should handle NotFoundError with 404 status', async () => {
    const app = createTestApp();
    const res = await app.request('/not-found');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_FOUND');
    expect(body.error.message).toBe('Resource not found');
    expect(body.error.requestId).toBe('test-request-id');
  });

  it('should handle NotAuthorizedError with 401 status', async () => {
    const app = createTestApp();
    const res = await app.request('/not-authorized');

    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_AUTHORIZED');
    expect(body.error.message).toBe('Not authorized');
    expect(body.error.requestId).toBe('test-request-id');
  });

  it('should handle ForbiddenError with 403 status', async () => {
    const app = createTestApp();
    const res = await app.request('/forbidden');

    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
    expect(body.error.message).toBe('Forbidden');
    expect(body.error.requestId).toBe('test-request-id');
  });

  it('should handle ValidationError with 400 status and field details', async () => {
    const app = createTestApp();
    const res = await app.request('/validation');

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Validation failed');
    expect(body.error.details).toEqual([{ field: 'email', message: 'Invalid email' }]);
    expect(body.error.requestId).toBe('test-request-id');
  });

  it('should handle RateLimitError with 429 status and Retry-After header', async () => {
    const app = createTestApp();
    const res = await app.request('/rate-limit');

    expect(res.status).toBe(429);
    expect(res.headers.get('Retry-After')).toBe('60');
    const body = await res.json();
    expect(body.error.code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.error.message).toBe('Too many requests');
    expect(body.error.requestId).toBe('test-request-id');
  });

  it('should handle UploadError with 400 status', async () => {
    const app = createTestApp();
    const res = await app.request('/upload');

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('UPLOAD_ERROR');
    expect(body.error.message).toBe('File too large');
    expect(body.error.requestId).toBe('test-request-id');
  });

  it('should handle ZodError with 400 status and field details', async () => {
    const app = createTestApp();
    const res = await app.request('/zod-error');

    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
    expect(body.error.message).toBe('Validation failed');
    expect(body.error.details).toBeInstanceOf(Array);
    expect(body.error.details.length).toBeGreaterThan(0);
    expect(body.error.details[0].field).toBe('email');
    expect(body.error.details[0].message).toEqual(expect.any(String));
    expect(body.error.requestId).toBe('test-request-id');
  });

  it('should handle unknown errors with 500 and generic message', async () => {
    const app = createTestApp();
    const res = await app.request('/unknown');

    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.code).toBe('INTERNAL_ERROR');
    expect(body.error.message).toBe('An unexpected error occurred');
    expect(body.error.message).not.toBe('Something went wrong');
    expect(body.error.requestId).toBe('test-request-id');
  });

  it('should fall back to "unknown" requestId when not set', async () => {
    const app = new Hono();
    // No requestId middleware
    app.get('/no-request-id', () => {
      throw new NotFoundError();
    });
    app.onError(handleError);

    const res = await app.request('/no-request-id');

    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body.error.requestId).toBe('unknown');
  });
});
