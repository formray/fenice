import { describe, it, expect, vi, beforeAll } from 'vitest';
import { Hono } from 'hono';
import jwt from 'jsonwebtoken';
import { authMiddleware } from '../../../src/middleware/auth.js';
import { handleError } from '../../../src/middleware/errorHandler.js';

// Mock loadEnv before imports resolve the lazy-init
vi.mock('../../../src/config/env.js', () => ({
  loadEnv: () => ({ JWT_SECRET: 'test-secret-key-for-testing' }),
}));

const TEST_SECRET = 'test-secret-key-for-testing';

function createTestApp() {
  const app = new Hono();
  app.use('/protected/*', authMiddleware);
  app.get('/protected/resource', (c) => {
    return c.json({
      userId: c.get('userId'),
      email: c.get('email'),
      role: c.get('role'),
    });
  });
  app.onError(handleError);
  return app;
}

describe('Auth Middleware', () => {
  let app: ReturnType<typeof createTestApp>;

  beforeAll(() => {
    app = createTestApp();
  });

  it('should return 401 when no Authorization header is provided', async () => {
    const res = await app.request('/protected/resource');
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_AUTHORIZED');
    expect(body.error.message).toBe('Missing authorization header');
  });

  it('should return 401 for malformed header without Bearer prefix', async () => {
    const res = await app.request('/protected/resource', {
      headers: { Authorization: 'Basic some-token' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_AUTHORIZED');
    expect(body.error.message).toBe('Invalid authorization format');
  });

  it('should return 401 for malformed header with only token (no scheme)', async () => {
    const res = await app.request('/protected/resource', {
      headers: { Authorization: 'some-token-without-scheme' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_AUTHORIZED');
    expect(body.error.message).toBe('Invalid authorization format');
  });

  it('should return 401 when Bearer is present but token is an invalid string', async () => {
    const res = await app.request('/protected/resource', {
      headers: { Authorization: 'Bearer not-a-valid-jwt' },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_AUTHORIZED');
    expect(body.error.message).toBe('Invalid or expired token');
  });

  it('should return 401 for an expired JWT', async () => {
    const expiredToken = jwt.sign(
      { userId: 'u1', email: 'test@test.com', role: 'user' },
      TEST_SECRET,
      { expiresIn: '0s' }
    );
    // Small delay to ensure the token is past its expiry
    await new Promise((resolve) => setTimeout(resolve, 20));

    const res = await app.request('/protected/resource', {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_AUTHORIZED');
    expect(body.error.message).toBe('Invalid or expired token');
  });

  it('should return 401 for a JWT signed with the wrong secret', async () => {
    const wrongSecretToken = jwt.sign(
      { userId: 'u1', email: 'test@test.com', role: 'user' },
      'wrong-secret',
      { expiresIn: '1h' }
    );

    const res = await app.request('/protected/resource', {
      headers: { Authorization: `Bearer ${wrongSecretToken}` },
    });
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('NOT_AUTHORIZED');
    expect(body.error.message).toBe('Invalid or expired token');
  });

  it('should return 200 and set context values for a valid JWT', async () => {
    const validToken = jwt.sign(
      { userId: 'user-123', email: 'alice@example.com', role: 'admin' },
      TEST_SECRET,
      { expiresIn: '1h' }
    );

    const res = await app.request('/protected/resource', {
      headers: { Authorization: `Bearer ${validToken}` },
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.userId).toBe('user-123');
    expect(body.email).toBe('alice@example.com');
    expect(body.role).toBe('admin');
  });
});
