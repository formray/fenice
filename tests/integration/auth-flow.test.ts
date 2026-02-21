import { describe, it, expect, vi, beforeEach } from 'vitest';

// ---------------------------------------------------------------------------
// Module mocks — must appear before ANY imports that pull these modules
// ---------------------------------------------------------------------------

vi.mock('../../src/config/env.js', () => ({
  loadEnv: () => ({
    JWT_SECRET: 'a]tY9$kP2!mN6^wR4&vQ8#dF0(jL3+xB',
    JWT_REFRESH_SECRET: 'b]uZ0$lQ3!nO7^xS5&wR9#eG1(kM4+yC',
    JWT_ACCESS_EXPIRY: '15m',
    JWT_REFRESH_EXPIRY: '7d',
    CLIENT_URL: 'http://localhost:3000',
    LOCKOUT_THRESHOLD: 5,
    LOCKOUT_DURATION_MS: 900_000,
    PORT: 3000,
    HOST: '0.0.0.0',
    SERVICE_NAME: 'fenice-test',
    LOG_LEVEL: 'info',
    API_VERSION: 'v1',
    RATE_LIMIT_WINDOW_MS: 60_000,
    RATE_LIMIT_MAX_REQUESTS: 100,
    UPLOAD_MAX_SIZE_BYTES: 104_857_600,
    UPLOAD_CHUNK_SIZE_BYTES: 5_242_880,
    UPLOAD_SESSION_TIMEOUT_MS: 3_600_000,
    UPLOAD_MAX_CONCURRENT: 3,
    REQUEST_TIMEOUT_MS: 30_000,
    BODY_SIZE_LIMIT_BYTES: 1_048_576,
    MONGODB_URI: 'mongodb://localhost:27017/test',
    WS_HEARTBEAT_INTERVAL_MS: 30_000,
    WS_HEARTBEAT_TIMEOUT_MS: 10_000,
    WS_MESSAGE_RATE_LIMIT: 60,
  }),
}));

vi.mock('../../src/adapters/index.js', () => ({
  createAdapters: () => ({
    email: { send: vi.fn().mockResolvedValue(undefined) },
    storage: {
      upload: vi.fn(),
      download: vi.fn(),
      delete: vi.fn(),
      getSignedUrl: vi.fn(),
    },
    messaging: {
      send: vi.fn(),
    },
  }),
}));

const mockUserSave = vi.fn().mockResolvedValue(undefined);
const mockComparePassword = vi.fn().mockResolvedValue(true);

function createMockUser(overrides: Record<string, unknown> = {}) {
  const base = {
    _id: { toString: () => 'user-id-123' },
    email: 'test@example.com',
    username: 'testuser',
    fullName: 'Test User',
    role: 'user',
    active: true,
    emailVerified: true,
    password: 'hashed-password',
    failedLoginAttempts: 0,
    lockoutUntil: undefined as Date | undefined,
    refreshToken: undefined as string | undefined,
    emailVerificationToken: undefined as string | undefined,
    emailVerificationExpires: undefined as Date | undefined,
    comparePassword: mockComparePassword,
    save: mockUserSave,
    toJSON: () => ({
      id: 'user-id-123',
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
      role: 'user',
      active: true,
      emailVerified: true,
      createdAt: '2025-01-01T00:00:00.000Z',
      updatedAt: '2025-01-01T00:00:00.000Z',
      ...overrides,
    }),
    ...overrides,
  };
  return base;
}

const mockFindOne = vi.fn();
const mockFindById = vi.fn();
const mockCreate = vi.fn();

vi.mock('../../src/models/user.model.js', () => ({
  UserModel: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
    findById: (...args: unknown[]) => mockFindById(...args),
    create: (...args: unknown[]) => mockCreate(...args),
  },
}));

vi.mock('../../src/utils/crypto.js', () => ({
  generateToken: () => 'mock-verification-token',
  hashToken: (t: string) => `hashed-${t}`,
}));

// ---------------------------------------------------------------------------
// Imports — after mocks
// ---------------------------------------------------------------------------

import { Hono } from 'hono';
import { authRouter } from '../../src/routes/auth.routes.js';
import { handleError } from '../../src/middleware/errorHandler.js';

// ---------------------------------------------------------------------------
// Test app factory
// ---------------------------------------------------------------------------

function createTestApp() {
  const testApp = new Hono();

  // Provide requestId context variable (normally set by requestId middleware)
  testApp.use('*', async (c, next) => {
    c.set('requestId', 'test-req-id');
    await next();
  });

  testApp.route('/api/v1', authRouter);
  testApp.onError(handleError);

  return testApp;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Auth Flow Integration Tests', () => {
  let app: Hono;

  beforeEach(() => {
    vi.clearAllMocks();
    // Create a fresh app per test to reset the lazy-init singleton in auth routes
    app = createTestApp();
  });

  // -----------------------------------------------------------------------
  // POST /api/v1/auth/signup
  // -----------------------------------------------------------------------

  describe('POST /api/v1/auth/signup', () => {
    const signupBody = {
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
      password: 'Str0ngP@ssword!',
    };

    it('should return 201 with user and tokens for valid signup', async () => {
      const newUser = createMockUser();
      mockFindOne.mockResolvedValueOnce(null); // no existing user
      mockCreate.mockResolvedValueOnce(newUser);

      const res = await app.request('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupBody),
      });

      expect(res.status).toBe(201);

      const body = await res.json();
      expect(body).toHaveProperty('user');
      expect(body).toHaveProperty('tokens');
      expect(body.user).toHaveProperty('id', 'user-id-123');
      expect(body.user).toHaveProperty('email', 'test@example.com');
      expect(body.user).toHaveProperty('username', 'testuser');
      expect(body.tokens).toHaveProperty('accessToken');
      expect(body.tokens).toHaveProperty('refreshToken');
      expect(body.tokens).toHaveProperty('expiresIn');
      expect(mockCreate).toHaveBeenCalledOnce();
      expect(mockUserSave).toHaveBeenCalled();
    });

    it('should return 409 when user already exists', async () => {
      const existingUser = createMockUser();
      mockFindOne.mockResolvedValueOnce(existingUser);

      const res = await app.request('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(signupBody),
      });

      expect(res.status).toBe(409);

      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code', 'CONFLICT');
      expect(mockCreate).not.toHaveBeenCalled();
    });

    it('should return 400 for invalid body (missing required fields)', async () => {
      const res = await app.request('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'not-valid' }),
      });

      expect(res.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
      expect(mockFindOne).not.toHaveBeenCalled();
    });

    it('should return 400 when password is too short', async () => {
      const res = await app.request('/api/v1/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'test@example.com',
          username: 'testuser',
          fullName: 'Test User',
          password: 'short',
        }),
      });

      expect(res.status).toBe(400);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/v1/auth/login
  // -----------------------------------------------------------------------

  describe('POST /api/v1/auth/login', () => {
    const loginBody = {
      email: 'test@example.com',
      password: 'Str0ngP@ssword!',
    };

    it('should return 200 with user and tokens for valid login', async () => {
      const user = createMockUser({ emailVerified: true });
      mockFindOne.mockResolvedValueOnce(user);
      mockComparePassword.mockResolvedValueOnce(true);

      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginBody),
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('user');
      expect(body).toHaveProperty('tokens');
      expect(body.user).toHaveProperty('email', 'test@example.com');
      expect(body.tokens).toHaveProperty('accessToken');
      expect(body.tokens).toHaveProperty('refreshToken');
      expect(body.tokens).toHaveProperty('expiresIn');
      expect(mockComparePassword).toHaveBeenCalledWith('Str0ngP@ssword!');
    });

    it('should return 401 for invalid credentials', async () => {
      const user = createMockUser();
      mockFindOne.mockResolvedValueOnce(user);
      mockComparePassword.mockResolvedValueOnce(false);

      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginBody),
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code', 'NOT_AUTHORIZED');
    });

    it('should return 403 for unverified email', async () => {
      const user = createMockUser({ emailVerified: false });
      mockFindOne.mockResolvedValueOnce(user);
      mockComparePassword.mockResolvedValueOnce(true);

      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginBody),
      });

      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code', 'EMAIL_NOT_VERIFIED');
    });

    it('should return 401 when user does not exist', async () => {
      mockFindOne.mockResolvedValueOnce(null);

      const res = await app.request('/api/v1/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(loginBody),
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code', 'NOT_AUTHORIZED');
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/v1/auth/refresh
  // -----------------------------------------------------------------------

  describe('POST /api/v1/auth/refresh', () => {
    it('should return 401 for invalid refresh token', async () => {
      const res = await app.request('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: 'invalid-token' }),
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code', 'NOT_AUTHORIZED');
    });

    it('should return 400 for missing refresh token', async () => {
      const res = await app.request('/api/v1/auth/refresh', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });
  });

  // -----------------------------------------------------------------------
  // GET /api/v1/auth/verify-email
  // -----------------------------------------------------------------------

  describe('GET /api/v1/auth/verify-email', () => {
    it('should return 401 for invalid verification token', async () => {
      mockFindOne.mockReturnValueOnce({
        select: vi.fn().mockResolvedValueOnce(null),
      });

      const res = await app.request('/api/v1/auth/verify-email?token=bad-token');

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body).toHaveProperty('error');
      expect(body.error).toHaveProperty('code', 'NOT_AUTHORIZED');
    });
  });

  // -----------------------------------------------------------------------
  // POST /api/v1/auth/request-password-reset
  // -----------------------------------------------------------------------

  describe('POST /api/v1/auth/request-password-reset', () => {
    it('should return 200 even if email does not exist (no leak)', async () => {
      mockFindOne.mockResolvedValueOnce(null);

      const res = await app.request('/api/v1/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'nonexistent@example.com' }),
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body).toHaveProperty('success', true);
    });
  });
});
