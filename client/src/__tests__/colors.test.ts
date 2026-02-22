import { describe, it, expect } from 'vitest';
import { METHOD_COLORS, METHOD_LABELS } from '../utils/colors';
import type { HttpMethod } from '../types/world';

const ALL_METHODS: HttpMethod[] = [
  'get',
  'post',
  'put',
  'patch',
  'delete',
  'options',
  'head',
  'trace',
];

describe('METHOD_COLORS', () => {
  it('has a color for every HTTP method', () => {
    for (const method of ALL_METHODS) {
      expect(METHOD_COLORS[method]).toBeDefined();
      expect(typeof METHOD_COLORS[method]).toBe('string');
    }
  });

  it('returns valid hex color strings', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    for (const method of ALL_METHODS) {
      expect(METHOD_COLORS[method]).toMatch(hexPattern);
    }
  });

  it('maps expected colors for primary methods', () => {
    expect(METHOD_COLORS.get).toBe('#4A90D9');
    expect(METHOD_COLORS.post).toBe('#50C878');
    expect(METHOD_COLORS.put).toBe('#FFA500');
    expect(METHOD_COLORS.patch).toBe('#FFD700');
    expect(METHOD_COLORS.delete).toBe('#E74C3C');
  });
});

describe('METHOD_LABELS', () => {
  it('has a label for every HTTP method', () => {
    for (const method of ALL_METHODS) {
      expect(METHOD_LABELS[method]).toBeDefined();
      expect(typeof METHOD_LABELS[method]).toBe('string');
    }
  });

  it('labels are uppercase versions of methods', () => {
    for (const method of ALL_METHODS) {
      expect(METHOD_LABELS[method]).toBe(method.toUpperCase());
    }
  });
});
