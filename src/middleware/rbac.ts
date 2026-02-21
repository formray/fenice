import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import { ForbiddenError } from '../utils/errors.js';

export type Role = 'superAdmin' | 'admin' | 'employee' | 'client' | 'vendor' | 'user';

export const ROLE_HIERARCHY: Record<Role, number> = {
  superAdmin: 60,
  admin: 50,
  employee: 40,
  client: 30,
  vendor: 20,
  user: 10,
};

export function requireRole(minRole: Role): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    const userRole = (c.get('role') as string) || 'user';
    const userLevel = userRole in ROLE_HIERARCHY ? ROLE_HIERARCHY[userRole as Role] : 0;
    const requiredLevel = ROLE_HIERARCHY[minRole];

    if (userLevel < requiredLevel) {
      throw new ForbiddenError('Insufficient permissions');
    }

    await next();
  });
}

export function requireRoles(roles: Role[]): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    const userRole = (c.get('role') as string) || 'user';

    if (!roles.includes(userRole as Role)) {
      throw new ForbiddenError('Insufficient permissions');
    }

    await next();
  });
}
