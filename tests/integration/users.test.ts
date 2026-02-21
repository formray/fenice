import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Hono } from 'hono';

// --- Mock data ---

const mockUserJson = {
  id: 'user-id-123',
  email: 'test@example.com',
  username: 'testuser',
  fullName: 'Test User',
  role: 'user',
  active: true,
  emailVerified: true,
  createdAt: '2025-01-01T00:00:00.000Z',
  updatedAt: '2025-01-01T00:00:00.000Z',
};

const mockUserDoc = {
  _id: { toString: () => 'user-id-123' },
  email: 'test@example.com',
  username: 'testuser',
  fullName: 'Test User',
  role: 'user',
  active: true,
  emailVerified: true,
  get: vi.fn().mockReturnValue('2025-01-01T00:00:00.000Z'),
  toJSON: vi.fn().mockReturnValue(mockUserJson),
};

// --- Standalone mock fns (avoids unbound-method lint errors) ---

const mockFindById = vi.fn();
const mockFindByIdAndUpdate = vi.fn();
const mockFindByIdAndDelete = vi.fn();
const mockFind = vi.fn().mockReturnValue({
  sort: vi.fn().mockReturnValue({
    limit: vi.fn().mockResolvedValue([]),
  }),
});

vi.mock('../../src/models/user.model.js', () => ({
  UserModel: {
    findById: (...args: unknown[]) => mockFindById(...args),
    findByIdAndUpdate: (...args: unknown[]) => mockFindByIdAndUpdate(...args),
    findByIdAndDelete: (...args: unknown[]) => mockFindByIdAndDelete(...args),
    find: (...args: unknown[]) => mockFind(...args),
  },
}));

// Imports after mock setup
const { userRouter } = await import('../../src/routes/user.routes.js');
const { handleError } = await import('../../src/middleware/errorHandler.js');

// --- Test app factory ---

function createTestApp(role = 'user') {
  const app = new Hono();
  app.use('*', async (c, next) => {
    c.set('requestId', 'test-req-id');
    c.set('userId', 'user-id-123');
    c.set('email', 'test@example.com');
    c.set('role', role);
    await next();
  });
  app.route('/api/v1', userRouter);
  app.onError(handleError);
  return app;
}

// --- Tests ---

describe('User CRUD routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUserDoc.toJSON.mockReturnValue(mockUserJson);
  });

  describe('GET /api/v1/users/me', () => {
    it('returns 200 with current user data', async () => {
      mockFindById.mockResolvedValueOnce(mockUserDoc);

      const app = createTestApp();
      const res = await app.request('/api/v1/users/me');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual(mockUserJson);
      expect(mockFindById).toHaveBeenCalledWith('user-id-123');
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('returns 200 with user data when found', async () => {
      mockFindById.mockResolvedValueOnce(mockUserDoc);

      const app = createTestApp();
      const res = await app.request('/api/v1/users/user-id-456');

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual(mockUserJson);
      expect(mockFindById).toHaveBeenCalledWith('user-id-456');
    });

    it('returns 404 when user is not found', async () => {
      mockFindById.mockResolvedValueOnce(null);

      const app = createTestApp();
      const res = await app.request('/api/v1/users/nonexistent-id');

      expect(res.status).toBe(404);
      const body = await res.json();
      expect(body.error.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/users/:id', () => {
    it('returns 200 with updated user data', async () => {
      const updatedJson = { ...mockUserJson, fullName: 'Updated Name' };
      const updatedDoc = {
        ...mockUserDoc,
        fullName: 'Updated Name',
        toJSON: vi.fn().mockReturnValue(updatedJson),
      };
      mockFindByIdAndUpdate.mockResolvedValueOnce(updatedDoc);

      const app = createTestApp();
      const res = await app.request('/api/v1/users/user-id-123', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ fullName: 'Updated Name' }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.fullName).toBe('Updated Name');
      expect(mockFindByIdAndUpdate).toHaveBeenCalledWith(
        'user-id-123',
        { fullName: 'Updated Name' },
        { new: true, runValidators: true }
      );
    });
  });

  describe('DELETE /api/v1/users/:id', () => {
    it('returns 403 when user role is not admin', async () => {
      const app = createTestApp('user');
      const res = await app.request('/api/v1/users/user-id-123', {
        method: 'DELETE',
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error.code).toBe('FORBIDDEN');
    });

    it('returns 200 when admin deletes a user', async () => {
      mockFindByIdAndDelete.mockResolvedValueOnce(mockUserDoc);

      const app = createTestApp('admin');
      const res = await app.request('/api/v1/users/user-id-123', {
        method: 'DELETE',
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.message).toBe('User deleted');
      expect(mockFindByIdAndDelete).toHaveBeenCalledWith('user-id-123');
    });
  });
});
