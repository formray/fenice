import { describe, it, expect } from 'vitest';
import { generateStarPositions, generateStarSizes } from '../utils/atmosphere-geometry';

describe('generateStarPositions', () => {
  it('returns Float32Array with 3 values per star', () => {
    const positions = generateStarPositions(100, 50);
    expect(positions).toBeInstanceOf(Float32Array);
    expect(positions.length).toBe(300);
  });

  it('all positions are within radius', () => {
    const radius = 50;
    const positions = generateStarPositions(100, radius);
    for (let i = 0; i < positions.length; i += 3) {
      const x = positions[i]!;
      const y = positions[i + 1]!;
      const z = positions[i + 2]!;
      const dist = Math.sqrt(x * x + y * y + z * z);
      expect(dist).toBeLessThanOrEqual(radius * 1.01);
    }
  });
});

describe('generateStarSizes', () => {
  it('returns Float32Array with 1 value per star', () => {
    const sizes = generateStarSizes(100, 0.3, 2.0);
    expect(sizes).toBeInstanceOf(Float32Array);
    expect(sizes.length).toBe(100);
  });

  it('all sizes within min/max range', () => {
    const sizes = generateStarSizes(100, 0.5, 3.0);
    for (let i = 0; i < sizes.length; i++) {
      expect(sizes[i]).toBeGreaterThanOrEqual(0.5);
      expect(sizes[i]).toBeLessThanOrEqual(3.0);
    }
  });
});
