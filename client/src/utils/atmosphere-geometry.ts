/**
 * Generate star positions distributed on a sphere surface.
 * Uses Fibonacci sphere for even distribution.
 */
export function generateStarPositions(count: number, radius: number): Float32Array {
  const positions = new Float32Array(count * 3);
  const goldenRatio = (1 + Math.sqrt(5)) / 2;

  for (let i = 0; i < count; i++) {
    const theta = (2 * Math.PI * i) / goldenRatio;
    const phi = Math.acos(1 - (2 * (i + 0.5)) / count);
    const r = radius * (0.8 + 0.2 * Math.random());

    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
    positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    positions[i * 3 + 2] = r * Math.cos(phi);
  }

  return positions;
}

/**
 * Generate random star sizes within a range.
 */
export function generateStarSizes(count: number, min: number, max: number): Float32Array {
  const sizes = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    sizes[i] = min + Math.random() * (max - min);
  }
  return sizes;
}

/**
 * Generate dust particle positions within a cubic volume.
 */
export function generateDustPositions(count: number, spread: number): Float32Array {
  const positions = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = (Math.random() - 0.5) * spread;
    positions[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.6;
    positions[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  return positions;
}
