import { describe, it, expect } from 'vitest';
import { app } from '../../src/index.js';

describe('Auth Routes (validation only)', () => {
  it('POST /api/v1/auth/signup should reject invalid body', async () => {
    const res = await app.request('/api/v1/auth/signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'not-an-email' }),
    });
    expect(res.status).toBe(400);
  });

  it('POST /api/v1/auth/login should reject empty body', async () => {
    const res = await app.request('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(400);
  });
});
