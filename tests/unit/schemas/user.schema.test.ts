import { describe, it, expect } from 'vitest';
import { UserSchema, UserCreateSchema } from '../../../src/schemas/user.schema.js';

describe('UserSchema', () => {
  it('should validate a correct user object', () => {
    const user = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
      role: 'user',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(() => UserSchema.parse(user)).not.toThrow();
  });

  it('should reject invalid email', () => {
    const user = {
      id: '550e8400-e29b-41d4-a716-446655440000',
      email: 'not-an-email',
      username: 'testuser',
      fullName: 'Test User',
      role: 'user',
      active: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(() => UserSchema.parse(user)).toThrow();
  });
});

describe('UserCreateSchema', () => {
  it('should validate signup input', () => {
    const input = {
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
      password: 'securePassword123!',
    };
    expect(() => UserCreateSchema.parse(input)).not.toThrow();
  });

  it('should reject short password', () => {
    const input = {
      email: 'test@example.com',
      username: 'testuser',
      fullName: 'Test User',
      password: 'short',
    };
    expect(() => UserCreateSchema.parse(input)).toThrow();
  });
});
