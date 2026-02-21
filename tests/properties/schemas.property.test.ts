import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { z } from 'zod';
import { UserCreateSchema, UserUpdateSchema } from '../../src/schemas/user.schema.js';
import { LoginSchema } from '../../src/schemas/auth.schema.js';
import { PaginationSchema } from '../../src/schemas/common.schema.js';

// Zod v4 email validation is stricter than fast-check's emailAddress() arbitrary.
// Build a custom email generator that only produces Zod-valid emails.
const zodEmail = fc.emailAddress().filter((e) => z.string().email().safeParse(e).success);

describe('Schema Property Tests', () => {
  it('UserCreateSchema should accept all valid inputs', () => {
    fc.assert(
      fc.property(
        fc.record({
          email: zodEmail,
          username: fc.string({ minLength: 2, maxLength: 50 }).filter((s) => s.trim().length >= 2),
          fullName: fc.string({ minLength: 1, maxLength: 100 }).filter((s) => s.trim().length >= 1),
          password: fc.string({ minLength: 8, maxLength: 128 }),
        }),
        (input) => {
          const result = UserCreateSchema.safeParse(input);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('UserCreateSchema should reject all short passwords', () => {
    fc.assert(
      fc.property(
        fc.record({
          email: zodEmail,
          username: fc.string({ minLength: 2, maxLength: 50 }),
          fullName: fc.string({ minLength: 1, maxLength: 100 }),
          password: fc.string({ minLength: 0, maxLength: 7 }),
        }),
        (input) => {
          const result = UserCreateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('LoginSchema should accept valid email + non-empty password', () => {
    fc.assert(
      fc.property(
        fc.record({
          email: zodEmail,
          password: fc.string({ minLength: 1, maxLength: 128 }),
        }),
        (input) => {
          const result = LoginSchema.safeParse(input);
          expect(result.success).toBe(true);
        }
      ),
      { numRuns: 100 }
    );
  });

  it('PaginationSchema should coerce valid numbers', () => {
    fc.assert(
      fc.property(
        fc.record({
          page: fc.integer({ min: 1, max: 1000 }),
          limit: fc.integer({ min: 1, max: 100 }),
        }),
        (input) => {
          const result = PaginationSchema.safeParse(input);
          expect(result.success).toBe(true);
          if (result.success) {
            expect(result.data.page).toBe(input.page);
            expect(result.data.limit).toBe(input.limit);
          }
        }
      ),
      { numRuns: 100 }
    );
  });

  it('UserUpdateSchema should reject unknown fields', () => {
    fc.assert(
      fc.property(
        fc.record({
          fullName: fc.string({ minLength: 1, maxLength: 100 }),
          unknownField: fc.string(),
        }),
        (input) => {
          const result = UserUpdateSchema.safeParse(input);
          expect(result.success).toBe(false);
        }
      ),
      { numRuns: 50 }
    );
  });
});
