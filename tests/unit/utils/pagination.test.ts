import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor } from '../../../src/utils/pagination.js';

describe('pagination utils', () => {
  describe('encodeCursor / decodeCursor', () => {
    it('should encode and decode cursor round-trip', () => {
      const cursor = { id: '507f1f77bcf86cd799439011', sortValue: '2026-01-01T00:00:00.000Z' };
      const encoded = encodeCursor(cursor);
      const decoded = decodeCursor(encoded);
      expect(decoded).toEqual(cursor);
    });

    it('should return null for invalid cursor', () => {
      const decoded = decodeCursor('not-valid-base64-json');
      expect(decoded).toBeNull();
    });

    it('should return null for undefined cursor', () => {
      const decoded = decodeCursor(undefined);
      expect(decoded).toBeNull();
    });

    it('should return null for null cursor', () => {
      const decoded = decodeCursor(null);
      expect(decoded).toBeNull();
    });

    it('should produce base64 string', () => {
      const encoded = encodeCursor({ id: 'abc', sortValue: 'xyz' });
      expect(typeof encoded).toBe('string');
      // Should be valid base64
      expect(() => Buffer.from(encoded, 'base64')).not.toThrow();
    });

    it('should return null for invalid JSON structure', () => {
      const encoded = Buffer.from(JSON.stringify({ wrong: 'shape' })).toString('base64');
      const decoded = decodeCursor(encoded);
      expect(decoded).toBeNull();
    });
  });
});
