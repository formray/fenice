import { describe, it, expect } from 'vitest';
import {
  METHOD_COLORS,
  METHOD_LABELS,
  LINK_STATE_COLORS,
  ZONE_STYLES,
  ACCENT_RING_HEIGHT,
  ACCENT_EMISSIVE_INTENSITY,
} from '../utils/colors';
import type { HttpMethod } from '../types/world';
import type { LinkState, Zone } from '../types/semantic';

const ALL_LINK_STATES: LinkState[] = ['ok', 'degraded', 'blocked', 'unknown'];
const ALL_ZONES: Zone[] = ['public-perimeter', 'protected-core', 'auth-hub'];

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

describe('LINK_STATE_COLORS', () => {
  it('has entry for every link state', () => {
    for (const state of ALL_LINK_STATES) {
      expect(LINK_STATE_COLORS[state]).toBeDefined();
    }
  });

  it('each entry has hex, emissiveIntensity, opacity', () => {
    for (const state of ALL_LINK_STATES) {
      const entry = LINK_STATE_COLORS[state];
      expect(entry.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(typeof entry.emissiveIntensity).toBe('number');
      expect(typeof entry.opacity).toBe('number');
    }
  });

  it('blocked emissive is lower than degraded', () => {
    expect(LINK_STATE_COLORS.blocked.emissiveIntensity).toBeLessThan(
      LINK_STATE_COLORS.degraded.emissiveIntensity
    );
  });

  it('unknown opacity is lowest', () => {
    expect(LINK_STATE_COLORS.unknown.opacity).toBeLessThanOrEqual(
      LINK_STATE_COLORS.blocked.opacity
    );
    expect(LINK_STATE_COLORS.unknown.opacity).toBeLessThanOrEqual(
      LINK_STATE_COLORS.degraded.opacity
    );
    expect(LINK_STATE_COLORS.unknown.opacity).toBeLessThanOrEqual(LINK_STATE_COLORS.ok.opacity);
  });

  it('each entry has edgeStyle', () => {
    expect(LINK_STATE_COLORS.ok.edgeStyle).toBe('solid');
    expect(LINK_STATE_COLORS.degraded.edgeStyle).toBe('solid');
    expect(LINK_STATE_COLORS.blocked.edgeStyle).toBe('dashed');
    expect(LINK_STATE_COLORS.unknown.edgeStyle).toBe('solid');
  });
});

describe('ZONE_STYLES', () => {
  it('has entry for every zone', () => {
    for (const zone of ALL_ZONES) {
      expect(ZONE_STYLES[zone]).toBeDefined();
    }
  });

  it('each entry has floorColor', () => {
    for (const zone of ALL_ZONES) {
      expect(ZONE_STYLES[zone].floorColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});

describe('LINK_STATE_COLORS — visual clarity', () => {
  it('blocked opacity is boosted to 0.7', () => {
    expect(LINK_STATE_COLORS.blocked.opacity).toBe(0.7);
  });

  it('unknown opacity is boosted to 0.3', () => {
    expect(LINK_STATE_COLORS.unknown.opacity).toBe(0.3);
  });
});

describe('accent ring constants', () => {
  it('ACCENT_RING_HEIGHT is a positive number', () => {
    expect(ACCENT_RING_HEIGHT).toBeGreaterThan(0);
  });

  it('ACCENT_EMISSIVE_INTENSITY is a positive number', () => {
    expect(ACCENT_EMISSIVE_INTENSITY).toBeGreaterThan(0);
  });
});

describe('color collision safety', () => {
  it('no method hex collides with any link-state hex', () => {
    const methodHexes = Object.values(METHOD_COLORS);
    const stateHexes = Object.values(LINK_STATE_COLORS).map((s) => s.hex);
    for (const mh of methodHexes) {
      for (const sh of stateHexes) {
        expect(mh).not.toBe(sh);
      }
    }
  });
});
