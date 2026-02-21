import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import mongoose from 'mongoose';

const healthRouter = new OpenAPIHono();

const healthRoute = createRoute({
  method: 'get',
  path: '/health',
  tags: ['Health'],
  summary: 'Liveness check',
  responses: {
    200: {
      description: 'Service is alive',
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            timestamp: z.string(),
            uptime: z.number(),
          }),
        },
      },
    },
  },
});

const healthDetailedRoute = createRoute({
  method: 'get',
  path: '/health/detailed',
  tags: ['Health'],
  summary: 'Readiness check with dependency status',
  responses: {
    200: {
      description: 'Service readiness with dependency health',
      content: {
        'application/json': {
          schema: z.object({
            status: z.string(),
            timestamp: z.string(),
            uptime: z.number(),
            dependencies: z.object({
              mongodb: z.object({
                status: z.string(),
                responseTime: z.number().optional(),
              }),
            }),
          }),
        },
      },
    },
  },
});

healthRouter.openapi(healthRoute, (c) => {
  return c.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }, 200);
});

healthRouter.openapi(healthDetailedRoute, async (c) => {
  const mongoStart = Date.now();
  const mongoStatus = mongoose.connection.readyState === 1 ? 'ok' : 'degraded';
  const mongoResponseTime = Date.now() - mongoStart;

  const overallStatus = mongoStatus === 'ok' ? 'ok' : 'degraded';

  return c.json({
    status: overallStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    dependencies: {
      mongodb: {
        status: mongoStatus,
        responseTime: mongoResponseTime,
      },
    },
  }, 200);
});

export { healthRouter };
