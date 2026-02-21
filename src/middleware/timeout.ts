import type { MiddlewareHandler } from 'hono';
import { AppError } from '../utils/errors.js';

export function timeout(ms: number): MiddlewareHandler {
  return async (c, next) => {
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, ms);

    try {
      c.req.raw.signal.addEventListener('abort', () => {
        controller.abort();
        clearTimeout(timer);
      });

      await Promise.race([
        next().then(() => 'done' as const),
        new Promise<never>((_, reject) => {
          controller.signal.addEventListener('abort', () => {
            reject(new AppError(408, 'REQUEST_TIMEOUT', 'Request timed out'));
          });
        }),
      ]);
    } finally {
      clearTimeout(timer);
    }
  };
}
