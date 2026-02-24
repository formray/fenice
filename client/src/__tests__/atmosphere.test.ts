import { describe, it, expect } from 'vitest';
import {
  COSMIC_PALETTE,
  SCENE_FOG,
  BLOOM_CONFIG,
  VIGNETTE_CONFIG,
  CHROMATIC_ABERRATION_CONFIG,
  NOISE_CONFIG,
} from '../utils/atmosphere';

describe('COSMIC_PALETTE', () => {
  it('has all required colors as valid hex strings', () => {
    const hexPattern = /^#[0-9A-Fa-f]{6}$/;
    expect(COSMIC_PALETTE.bgDeep).toMatch(hexPattern);
    expect(COSMIC_PALETTE.bgNight).toMatch(hexPattern);
    expect(COSMIC_PALETTE.accentCyan).toMatch(hexPattern);
    expect(COSMIC_PALETTE.accentMagenta).toMatch(hexPattern);
    expect(COSMIC_PALETTE.accentAmber).toMatch(hexPattern);
    expect(COSMIC_PALETTE.neutralGlow).toMatch(hexPattern);
    expect(COSMIC_PALETTE.fogColor).toMatch(hexPattern);
  });
});

describe('SCENE_FOG', () => {
  it('has density in valid range', () => {
    expect(SCENE_FOG.density).toBeGreaterThanOrEqual(0.005);
    expect(SCENE_FOG.density).toBeLessThanOrEqual(0.02);
  });
});

describe('BLOOM_CONFIG', () => {
  it('has intensity >= 1 for cinematic bloom', () => {
    expect(BLOOM_CONFIG.intensity).toBeGreaterThanOrEqual(1.0);
  });
  it('has luminanceThreshold < 0.5 to catch emissive elements', () => {
    expect(BLOOM_CONFIG.luminanceThreshold).toBeLessThan(0.5);
  });
});

describe('VIGNETTE_CONFIG', () => {
  it('has darkness between 0 and 1', () => {
    expect(VIGNETTE_CONFIG.darkness).toBeGreaterThan(0);
    expect(VIGNETTE_CONFIG.darkness).toBeLessThanOrEqual(1);
  });
});

describe('CHROMATIC_ABERRATION_CONFIG', () => {
  it('has small offset values for subtle effect', () => {
    expect(CHROMATIC_ABERRATION_CONFIG.offset[0]).toBeLessThan(0.01);
    expect(CHROMATIC_ABERRATION_CONFIG.offset[1]).toBeLessThan(0.01);
  });
});

describe('NOISE_CONFIG', () => {
  it('has low opacity for subtle film grain', () => {
    expect(NOISE_CONFIG.opacity).toBeGreaterThan(0);
    expect(NOISE_CONFIG.opacity).toBeLessThanOrEqual(0.15);
  });
});
