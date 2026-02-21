import type { MiddlewareHandler } from 'hono';
import { createMiddleware } from 'hono/factory';
import type { ZodType } from 'zod';
import { ValidationError } from '../utils/errors.js';

interface ValidateSchemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export function validate(schemas: ValidateSchemas): MiddlewareHandler {
  return createMiddleware(async (c, next) => {
    const errors: { field?: string | undefined; message: string }[] = [];

    if (schemas.query) {
      const queryObj = Object.fromEntries(new URL(c.req.url).searchParams);
      const result = schemas.query.safeParse(queryObj);
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({ field: issue.path.join('.'), message: issue.message });
        }
      }
    }

    if (schemas.body) {
      try {
        const body: unknown = await c.req.json();
        const result = schemas.body.safeParse(body);
        if (!result.success) {
          for (const issue of result.error.issues) {
            errors.push({ field: issue.path.join('.'), message: issue.message });
          }
        }
      } catch {
        errors.push({ message: 'Invalid JSON body' });
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(c.req.param());
      if (!result.success) {
        for (const issue of result.error.issues) {
          errors.push({ field: issue.path.join('.'), message: issue.message });
        }
      }
    }

    if (errors.length > 0) {
      throw new ValidationError(errors);
    }

    await next();
  });
}
