import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { timeout } from '../../../src/middleware/timeout.js';
import { handleError } from '../../../src/middleware/errorHandler.js';

describe('Timeout Middleware', () => {
  it('should allow requests that complete within timeout', async () => {
    const app = new Hono();
    app.use('*', timeout(1000));
    app.get('/fast', (c) => c.text('ok'));

    const res = await app.request('/fast');
    expect(res.status).toBe(200);
  });

  it('should return 408 for requests exceeding timeout', async () => {
    const app = new Hono();
    app.onError(handleError);
    app.use('*', timeout(50)); // 50ms timeout
    app.get('/slow', async (c) => {
      await new Promise((resolve) => setTimeout(resolve, 200));
      return c.text('too late');
    });

    const res = await app.request('/slow');
    expect(res.status).toBe(408);
    const body = await res.json();
    expect(body.error.code).toBe('REQUEST_TIMEOUT');
  });
});
