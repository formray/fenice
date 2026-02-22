import { describe, it, expect } from 'vitest';
import { ZONE_LAYOUT_CONFIG, ROAD_WIDTH } from '../utils/constants';

describe('ZONE_LAYOUT_CONFIG', () => {
  it('has config for public-perimeter with wider gaps', () => {
    const cfg = ZONE_LAYOUT_CONFIG['public-perimeter'];
    expect(cfg.buildingGap).toBe(0.8);
    expect(cfg.districtPadding).toBe(2.5);
    expect(cfg.groundOpacity).toBe(0.5);
  });

  it('has config for protected-core with tighter gaps', () => {
    const cfg = ZONE_LAYOUT_CONFIG['protected-core'];
    expect(cfg.buildingGap).toBe(0.4);
    expect(cfg.districtPadding).toBe(1.5);
    expect(cfg.groundOpacity).toBe(0.7);
  });

  it('protected-core has smaller gap than public-perimeter', () => {
    expect(ZONE_LAYOUT_CONFIG['protected-core'].buildingGap).toBeLessThan(
      ZONE_LAYOUT_CONFIG['public-perimeter'].buildingGap
    );
  });
});

describe('road constants', () => {
  it('ROAD_WIDTH is a positive number', () => {
    expect(ROAD_WIDTH).toBeGreaterThan(0);
  });
});
