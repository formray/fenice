import { createMiddleware } from 'hono/factory';
import { createLogger } from '../utils/logger.js';
import { logBuffer } from '../services/mcp/log-buffer.js';

// Module-level logger — does not require env, uses sensible defaults
const logger = createLogger(process.env.SERVICE_NAME ?? 'fenice', process.env.LOG_LEVEL ?? 'info');

export const requestLogger = createMiddleware(async (c, next) => {
  const start = Date.now();
  const method = c.req.method;
  const path = c.req.path;
  const requestId = (c.get('requestId') as string | undefined) ?? 'unknown';

  logger.info({ method, path, requestId }, 'Incoming request');
  logBuffer.push({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Incoming request',
    fields: { method, path, requestId },
  });

  await next();

  const duration = Date.now() - start;
  const status = c.res.status;

  logger.info({ method, path, status, duration, requestId }, 'Request completed');
  logBuffer.push({
    timestamp: new Date().toISOString(),
    level: 'info',
    message: 'Request completed',
    fields: { method, path, status, duration, requestId },
  });
});
