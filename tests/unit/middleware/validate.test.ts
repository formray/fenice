import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { z } from 'zod';
import { validate } from '../../../src/middleware/validate.js';
import { handleError } from '../../../src/middleware/errorHandler.js';

function createTestApp() {
  const app = new Hono();
  app.onError(handleError);
  return app;
}

describe('validate middleware', () => {
  it('should pass with valid query params', async () => {
    const app = createTestApp();
    app.get('/test', validate({ query: z.object({ name: z.string() }) }), (c) => {
      return c.json({ ok: true });
    });

    const res = await app.request('/test?name=foo');
    expect(res.status).toBe(200);
  });

  it('should return 400 with invalid query params', async () => {
    const app = createTestApp();
    app.get(
      '/test',
      validate({ query: z.object({ count: z.coerce.number().positive() }) }),
      (c) => {
        return c.json({ ok: true });
      }
    );

    const res = await app.request('/test?count=-1');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('VALIDATION_ERROR');
  });

  it('should pass with valid JSON body', async () => {
    const app = createTestApp();
    app.post('/test', validate({ body: z.object({ email: z.email() }) }), (c) => {
      return c.json({ ok: true });
    });

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.com' }),
    });
    expect(res.status).toBe(200);
  });

  it('should return 400 with invalid JSON body', async () => {
    const app = createTestApp();
    app.post('/test', validate({ body: z.object({ email: z.email() }) }), (c) => {
      return c.json({ ok: true });
    });

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    expect(res.status).toBe(400);
  });

  it('should validate params', async () => {
    const app = createTestApp();
    app.get('/test/:id', validate({ params: z.object({ id: z.string().min(5) }) }), (c) => {
      return c.json({ ok: true });
    });

    const res = await app.request('/test/ab');
    expect(res.status).toBe(400);
  });

  it('should return 400 for invalid JSON', async () => {
    const app = createTestApp();
    app.post('/test', validate({ body: z.object({ name: z.string() }) }), (c) => {
      return c.json({ ok: true });
    });

    const res = await app.request('/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: 'not-json',
    });
    expect(res.status).toBe(400);
  });
});
