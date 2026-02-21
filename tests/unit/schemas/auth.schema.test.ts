import { describe, it, expect } from 'vitest';
import {
  VerifyEmailSchema,
  RequestPasswordResetSchema,
  ResetPasswordSchema,
} from '../../../src/schemas/auth.schema.js';

describe('auth schemas', () => {
  describe('VerifyEmailSchema', () => {
    it('should accept valid token', () => {
      const result = VerifyEmailSchema.safeParse({ token: 'abc123' });
      expect(result.success).toBe(true);
    });

    it('should reject empty token', () => {
      const result = VerifyEmailSchema.safeParse({ token: '' });
      expect(result.success).toBe(false);
    });
  });

  describe('RequestPasswordResetSchema', () => {
    it('should accept valid email', () => {
      const result = RequestPasswordResetSchema.safeParse({ email: 'test@example.com' });
      expect(result.success).toBe(true);
    });

    it('should reject invalid email', () => {
      const result = RequestPasswordResetSchema.safeParse({ email: 'not-an-email' });
      expect(result.success).toBe(false);
    });
  });

  describe('ResetPasswordSchema', () => {
    it('should accept valid reset data', () => {
      const result = ResetPasswordSchema.safeParse({
        token: 'abc123',
        newPassword: 'securePassword1!',
      });
      expect(result.success).toBe(true);
    });

    it('should reject short password', () => {
      const result = ResetPasswordSchema.safeParse({
        token: 'abc123',
        newPassword: 'short',
      });
      expect(result.success).toBe(false);
    });

    it('should reject missing token', () => {
      const result = ResetPasswordSchema.safeParse({
        newPassword: 'securePassword1!',
      });
      expect(result.success).toBe(false);
    });
  });
});
