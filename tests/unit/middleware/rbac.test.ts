import { describe, it, expect } from 'vitest';
import { Hono } from 'hono';
import { requireRole, requireRoles, ROLE_HIERARCHY } from '../../../src/middleware/rbac.js';
import { handleError } from '../../../src/middleware/errorHandler.js';

function createApp(middleware: ReturnType<typeof requireRole>): InstanceType<typeof Hono> {
  const app = new Hono();
  app.onError(handleError);
  // Simulate auth middleware setting role
  app.use('*', async (c, next) => {
    c.set('role', c.req.header('x-test-role') ?? 'user');
    await next();
  });
  app.get('/test', middleware, (c) => c.json({ ok: true }));
  return app;
}

describe('RBAC middleware', () => {
  describe('ROLE_HIERARCHY', () => {
    it('should have all 6 roles with ascending values', () => {
      expect(ROLE_HIERARCHY['user']).toBeLessThan(ROLE_HIERARCHY['vendor']);
      expect(ROLE_HIERARCHY['vendor']).toBeLessThan(ROLE_HIERARCHY['client']);
      expect(ROLE_HIERARCHY['client']).toBeLessThan(ROLE_HIERARCHY['employee']);
      expect(ROLE_HIERARCHY['employee']).toBeLessThan(ROLE_HIERARCHY['admin']);
      expect(ROLE_HIERARCHY['admin']).toBeLessThan(ROLE_HIERARCHY['superAdmin']);
    });
  });

  describe('requireRole', () => {
    it('should allow superAdmin to access admin-only route', async () => {
      const app = createApp(requireRole('admin'));
      const res = await app.request('/test', { headers: { 'x-test-role': 'superAdmin' } });
      expect(res.status).toBe(200);
    });

    it('should allow admin to access admin-only route', async () => {
      const app = createApp(requireRole('admin'));
      const res = await app.request('/test', { headers: { 'x-test-role': 'admin' } });
      expect(res.status).toBe(200);
    });

    it('should deny user access to admin-only route', async () => {
      const app = createApp(requireRole('admin'));
      const res = await app.request('/test', { headers: { 'x-test-role': 'user' } });
      expect(res.status).toBe(403);
    });

    it('should deny employee access to admin-only route', async () => {
      const app = createApp(requireRole('admin'));
      const res = await app.request('/test', { headers: { 'x-test-role': 'employee' } });
      expect(res.status).toBe(403);
    });

    it('should allow any authenticated user for user-level route', async () => {
      const app = createApp(requireRole('user'));
      const res = await app.request('/test', { headers: { 'x-test-role': 'user' } });
      expect(res.status).toBe(200);
    });
  });

  describe('requireRoles', () => {
    it('should allow listed roles (OR logic)', async () => {
      const app = createApp(requireRoles(['admin', 'employee']));
      const res = await app.request('/test', { headers: { 'x-test-role': 'admin' } });
      expect(res.status).toBe(200);
    });

    it('should deny unlisted roles', async () => {
      const app = createApp(requireRoles(['admin']));
      const res = await app.request('/test', { headers: { 'x-test-role': 'user' } });
      expect(res.status).toBe(403);
    });
  });
});
