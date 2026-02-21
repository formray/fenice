import { describe, it, expect } from 'vitest';
import { generateToken, hashToken } from '../../../src/utils/crypto.js';

describe('crypto utils', () => {
  describe('generateToken', () => {
    it('should generate a 64-char hex string (32 bytes)', () => {
      const token = generateToken();
      expect(token).toHaveLength(64);
      expect(token).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should generate unique tokens', () => {
      const tokens = new Set(Array.from({ length: 10 }, () => generateToken()));
      expect(tokens.size).toBe(10);
    });
  });

  describe('hashToken', () => {
    it('should produce consistent SHA-256 hash', () => {
      const token = 'test-token';
      const hash1 = hashToken(token);
      const hash2 = hashToken(token);
      expect(hash1).toBe(hash2);
    });

    it('should produce 64-char hex hash', () => {
      const hash = hashToken('any-input');
      expect(hash).toHaveLength(64);
      expect(hash).toMatch(/^[0-9a-f]{64}$/);
    });

    it('should produce different hashes for different inputs', () => {
      expect(hashToken('a')).not.toBe(hashToken('b'));
    });
  });
});
