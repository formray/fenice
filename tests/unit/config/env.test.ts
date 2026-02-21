import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

describe('Environment Config', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    vi.resetModules();
    process.env = { ...originalEnv };
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should parse valid environment variables', async () => {
    process.env.NODE_ENV = 'test';
    process.env.PORT = '3000';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/fenice-test';
    process.env.JWT_SECRET = 'a-very-secure-secret-that-is-at-least-32-chars';
    process.env.JWT_REFRESH_SECRET = 'another-very-secure-secret-at-least-32-chars';

    const { EnvSchema } = await import('../../../src/config/env.js');
    const result = EnvSchema.safeParse(process.env);
    expect(result.success).toBe(true);
  });

  it('should fail with missing required vars', async () => {
    process.env = {};
    const { EnvSchema } = await import('../../../src/config/env.js');
    const result = EnvSchema.safeParse(process.env);
    expect(result.success).toBe(false);
  });
});
