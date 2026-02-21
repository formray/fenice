import { describe, it, expect } from 'vitest';
import { buildUserFilter } from '../../../src/utils/query-builder.js';

describe('query-builder', () => {
  describe('buildUserFilter', () => {
    it('should return empty filter for empty params', () => {
      const filter = buildUserFilter({});
      expect(filter).toEqual({});
    });

    it('should build search regex filter', () => {
      const filter = buildUserFilter({ search: 'giuseppe' });
      expect(filter).toHaveProperty('$or');
      const orArr = filter['$or'] as unknown[];
      expect(orArr).toHaveLength(3); // email, username, fullName
    });

    it('should build exact role filter', () => {
      const filter = buildUserFilter({ role: 'admin' });
      expect(filter).toEqual({ role: 'admin' });
    });

    it('should build active boolean filter', () => {
      const filter = buildUserFilter({ active: true });
      expect(filter).toEqual({ active: true });
    });

    it('should build date range filter', () => {
      const filter = buildUserFilter({
        createdAfter: '2026-01-01T00:00:00.000Z',
        createdBefore: '2026-12-31T00:00:00.000Z',
      });
      expect(filter).toHaveProperty('createdAt');
    });

    it('should combine multiple filters', () => {
      const filter = buildUserFilter({ role: 'admin', active: true, search: 'test' });
      expect(filter).toHaveProperty('role');
      expect(filter).toHaveProperty('active');
      expect(filter).toHaveProperty('$or');
    });

    it('should build createdAfter only filter', () => {
      const filter = buildUserFilter({
        createdAfter: '2026-01-01T00:00:00.000Z',
      });
      const createdAt = filter['createdAt'] as Record<string, unknown>;
      expect(createdAt).toHaveProperty('$gte');
      expect(createdAt).not.toHaveProperty('$lte');
    });
  });
});
