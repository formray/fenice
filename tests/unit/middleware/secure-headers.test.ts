import { describe, it, expect } from 'vitest';
import { app } from '../../../src/index.js';

describe('Secure Headers Middleware', () => {
  it('should set X-Content-Type-Options header', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.headers.get('x-content-type-options')).toBe('nosniff');
  });

  it('should set X-Frame-Options header', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.headers.get('x-frame-options')).toBe('SAMEORIGIN');
  });

  it('should set X-XSS-Protection header', async () => {
    const res = await app.request('/api/v1/health');
    expect(res.headers.get('x-xss-protection')).toBe('0');
  });
});
