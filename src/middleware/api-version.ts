import { createMiddleware } from 'hono/factory';

export const apiVersion = createMiddleware(async (c, next) => {
  const match = /\/api\/(v\d+)\//.exec(c.req.path);
  c.set('apiVersion', match?.[1] ?? 'v1');
  await next();
});
