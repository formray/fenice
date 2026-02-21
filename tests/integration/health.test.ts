import { describe, it, expect } from 'vitest';
import { app } from '../../src/index.js';

describe('Health Endpoints', () => {
  it('GET /api/v1/health should return 200', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status', 'ok');
  });

  it('GET /api/v1/health/detailed should return 200 with dependencies', async () => {
    const res = await app.request('/api/v1/health/detailed');
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty('status');
    expect(body).toHaveProperty('dependencies');
  });
});
