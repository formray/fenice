import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { cors } from 'hono/cors';

describe('CORS Middleware', () => {
  it('should return CORS headers for preflight request', async () => {
    const app = new Hono();
    app.use('*', cors({ origin: 'http://localhost:5173' }));
    app.get('/test', (c) => c.text('ok'));

    const res = await app.request('/test', {
      method: 'OPTIONS',
      headers: {
        Origin: 'http://localhost:5173',
        'Access-Control-Request-Method': 'GET',
      },
    });

    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('should set Access-Control-Allow-Origin on normal requests', async () => {
    const app = new Hono();
    app.use('*', cors({ origin: 'http://localhost:5173' }));
    app.get('/test', (c) => c.text('ok'));

    const res = await app.request('/test', {
      headers: { Origin: 'http://localhost:5173' },
    });

    expect(res.headers.get('access-control-allow-origin')).toBe('http://localhost:5173');
  });

  it('should allow all origins when CLIENT_URL is not set (development)', async () => {
    const app = new Hono();
    app.use('*', cors({ origin: '*' }));
    app.get('/test', (c) => c.text('ok'));

    const res = await app.request('/test', {
      headers: { Origin: 'http://any-origin.com' },
    });

    expect(res.headers.get('access-control-allow-origin')).toBe('*');
  });
});
