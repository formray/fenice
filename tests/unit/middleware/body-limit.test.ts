import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { bodyLimit } from 'hono/body-limit';

describe('Body Limit Middleware', () => {
  it('should accept requests within body size limit', async () => {
    const app = new Hono();
    app.use('*', bodyLimit({ maxSize: 1024 })); // 1KB
    app.post('/test', async (c) => {
      const body = await c.req.text();
      return c.text(`received: ${body.length}`);
    });

    const res = await app.request('/test', {
      method: 'POST',
      body: 'a'.repeat(512), // 512 bytes, within limit
    });
    expect(res.status).toBe(200);
  });

  it('should reject requests exceeding body size limit', async () => {
    const app = new Hono();
    app.use(
      '*',
      bodyLimit({
        maxSize: 100, // 100 bytes
        onError: (c) =>
          c.json({ error: { code: 'BODY_TOO_LARGE', message: 'Body too large' } }, 413),
      })
    );
    app.post('/test', async (c) => {
      const body = await c.req.text();
      return c.text(`received: ${body.length}`);
    });

    const res = await app.request('/test', {
      method: 'POST',
      body: 'a'.repeat(200), // 200 bytes, over limit
    });
    expect(res.status).toBe(413);
  });
});
