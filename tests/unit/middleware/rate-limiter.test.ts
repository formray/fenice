import { describe, it, expect, beforeEach } from 'vitest';
import { Hono } from 'hono';
import { rateLimiter, MemoryRateLimitStore } from '../../../src/middleware/rate-limiter.js';
import { handleError } from '../../../src/middleware/errorHandler.js';

describe('rate limiter', () => {
  describe('MemoryRateLimitStore', () => {
    let store: MemoryRateLimitStore;

    beforeEach(() => {
      store = new MemoryRateLimitStore(60_000); // 60s window
    });

    it('should increment count from 0 to 1', async () => {
      const result = await store.increment('key1');
      expect(result.count).toBe(1);
    });

    it('should increment count on subsequent calls', async () => {
      await store.increment('key1');
      const result = await store.increment('key1');
      expect(result.count).toBe(2);
    });

    it('should track separate keys independently', async () => {
      await store.increment('key1');
      await store.increment('key1');
      const result = await store.increment('key2');
      expect(result.count).toBe(1);
    });

    it('should reset count', async () => {
      await store.increment('key1');
      await store.increment('key1');
      await store.reset('key1');
      const result = await store.increment('key1');
      expect(result.count).toBe(1);
    });
  });

  describe('rateLimiter middleware', () => {
    it('should allow requests under the limit', async () => {
      const app = new Hono();
      app.onError(handleError);
      app.use('*', rateLimiter({ windowMs: 60_000, max: 5 }));
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test');
      expect(res.status).toBe(200);
      expect(res.headers.get('X-RateLimit-Limit')).toBe('5');
    });

    it('should return 429 when limit exceeded', async () => {
      const app = new Hono();
      app.onError(handleError);
      app.use('*', rateLimiter({ windowMs: 60_000, max: 2 }));
      app.get('/test', (c) => c.json({ ok: true }));

      await app.request('/test');
      await app.request('/test');
      const res = await app.request('/test');
      expect(res.status).toBe(429);
    });

    it('should set rate limit headers', async () => {
      const app = new Hono();
      app.onError(handleError);
      app.use('*', rateLimiter({ windowMs: 60_000, max: 10 }));
      app.get('/test', (c) => c.json({ ok: true }));

      const res = await app.request('/test');
      expect(res.headers.get('X-RateLimit-Limit')).toBe('10');
      expect(res.headers.get('X-RateLimit-Remaining')).toBe('9');
      expect(res.headers.get('X-RateLimit-Reset')).toBeDefined();
    });
  });
});
