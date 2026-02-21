import type { Context } from 'hono';
import type { ErrorResponse } from '../schemas/common.schema.js';
import { AppError, RateLimitError } from '../utils/errors.js';
import { ZodError } from 'zod';

export function errorResponse(
  code: string,
  message: string,
  requestId: string,
  details?: { field?: string; message: string }[]
): ErrorResponse {
  return {
    error: {
      code,
      message,
      requestId,
      ...(details && { details }),
    },
  };
}

export function handleError(err: Error, c: Context): Response {
  const requestId = (c.get('requestId') as string) || 'unknown';

  if (err instanceof AppError) {
    if (err instanceof RateLimitError) {
      c.header('Retry-After', String(err.retryAfter));
    }
    return c.json(
      errorResponse(err.code, err.message, requestId, err.details),
      err.statusCode as 400 | 401 | 403 | 404 | 429 | 500
    );
  }

  if (err instanceof ZodError) {
    const details = err.issues.map((e) => ({
      field: e.path.join('.'),
      message: e.message,
    }));
    return c.json(errorResponse('VALIDATION_ERROR', 'Validation failed', requestId, details), 400);
  }

  // Unknown error
  console.error('Unhandled error:', err);
  return c.json(errorResponse('INTERNAL_ERROR', 'An unexpected error occurred', requestId), 500);
}
