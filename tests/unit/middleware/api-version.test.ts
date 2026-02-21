import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { apiVersion } from '../../../src/middleware/api-version.js';

describe('apiVersion middleware', () => {
  it('should extract v1 from /api/v1/users', async () => {
    const app = new Hono();
    app.use('*', apiVersion);
    app.get('/api/v1/users', (c) => c.json({ version: c.get('apiVersion') }));

    const res = await app.request('/api/v1/users');
    const body = (await res.json()) as { version: string };
    expect(body.version).toBe('v1');
  });

  it('should default to v1 for paths without version', async () => {
    const app = new Hono();
    app.use('*', apiVersion);
    app.get('/health', (c) => c.json({ version: c.get('apiVersion') }));

    const res = await app.request('/health');
    const body = (await res.json()) as { version: string };
    expect(body.version).toBe('v1');
  });

  it('should extract v2 from /api/v2/users', async () => {
    const app = new Hono();
    app.use('*', apiVersion);
    app.get('/api/v2/users', (c) => c.json({ version: c.get('apiVersion') }));

    const res = await app.request('/api/v2/users');
    const body = (await res.json()) as { version: string };
    expect(body.version).toBe('v2');
  });
});
