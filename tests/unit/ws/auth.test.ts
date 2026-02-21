import { describe, it, expect } from 'vitest';
import jwt from 'jsonwebtoken';
import { verifyWsToken } from '../../../src/ws/auth.js';

const SECRET = 'test-secret-that-is-at-least-32-chars-long';

describe('verifyWsToken', () => {
  it('should return payload for valid token', () => {
    const token = jwt.sign({ userId: 'u1', email: 'a@b.com', role: 'user' }, SECRET);
    const result = verifyWsToken(token, SECRET);
    expect(result).not.toBeNull();
    expect(result?.userId).toBe('u1');
    expect(result?.email).toBe('a@b.com');
    expect(result?.role).toBe('user');
  });

  it('should return null for invalid token', () => {
    const result = verifyWsToken('invalid-token', SECRET);
    expect(result).toBeNull();
  });

  it('should return null for expired token', () => {
    const token = jwt.sign({ userId: 'u1', email: 'a@b.com', role: 'user' }, SECRET, {
      expiresIn: '0s',
    });
    // Wait a tick for expiration
    const result = verifyWsToken(token, SECRET);
    expect(result).toBeNull();
  });

  it('should return null for token with wrong secret', () => {
    const token = jwt.sign(
      { userId: 'u1', email: 'a@b.com', role: 'user' },
      'wrong-secret-that-is-at-least-32chars'
    );
    const result = verifyWsToken(token, SECRET);
    expect(result).toBeNull();
  });

  it('should return null for token missing userId', () => {
    const token = jwt.sign({ email: 'a@b.com', role: 'user' }, SECRET);
    const result = verifyWsToken(token, SECRET);
    expect(result).toBeNull();
  });

  it('should return null for token missing email', () => {
    const token = jwt.sign({ userId: 'u1', role: 'user' }, SECRET);
    const result = verifyWsToken(token, SECRET);
    expect(result).toBeNull();
  });

  it('should return null for token missing role', () => {
    const token = jwt.sign({ userId: 'u1', email: 'a@b.com' }, SECRET);
    const result = verifyWsToken(token, SECRET);
    expect(result).toBeNull();
  });
});
