import { createMiddleware } from 'hono/factory';
import crypto from 'node:crypto';

export const requestId = createMiddleware(async (c, next) => {
  const id = c.req.header('x-request-id') ?? crypto.randomUUID();
  c.set('requestId', id);
  c.header('x-request-id', id);
  await next();
});
