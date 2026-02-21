import { describe, it, expect } from 'vitest';
import { app } from '../../../src/index.js';

describe('POST /api/v1/auth/logout', () => {
  it('should return 401 without auth token', async () => {
    const res = await app.request('/api/v1/auth/logout', {
      method: 'POST',
    });
    expect(res.status).toBe(401);
  });
});
