import { describe, it, expect } from 'vitest';
import { computeEdgePoints, worstLinkState } from '../components/Edges';
import type { Position3D } from '../services/layout.service';

describe('computeEdgePoints — edge routing', () => {
  const gate: Position3D = { x: 0, y: 0, z: 0 };
  const source: Position3D = { x: -10, y: 0, z: 0 };
  const target: Position3D = { x: 10, y: 0, z: 0 };

  const isOrthogonalPath = (points: [number, number, number][]): boolean => {
    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!;
      const curr = points[i]!;
      const sameX = prev[0] === curr[0];
      const sameZ = prev[2] === curr[2];
      if (!sameX && !sameZ) return false;
    }
    return true;
  };

  it('auth-gated edge routes through gate center', () => {
    const points = computeEdgePoints(source, target, gate, true);
    expect(points).toHaveLength(3);
    expect(points[1]).toEqual([0, 0.05, 0]);
  });

  it('non-auth-gated edge routes direct', () => {
    const points = computeEdgePoints(source, target, gate, false);
    expect(points).toHaveLength(2);
  });

  it('non-auth route with hubs uses orthogonal lane segments', () => {
    const points = computeEdgePoints(source, target, gate, false, {
      sourceHub: { x: -12, y: 0, z: -7 },
      targetHub: { x: 11, y: 0, z: 8 },
      laneOffset: 0.4,
    });

    expect(points.length).toBeGreaterThanOrEqual(4);
    expect(points[0]).toEqual([-10, 0.05, 0]);
    expect(points[points.length - 1]).toEqual([10, 0.05, 0]);
    expect(isOrthogonalPath(points)).toBe(true);
  });

  it('auth-gated route with hubs uses orthogonal gate corridor', () => {
    const points = computeEdgePoints(source, target, gate, true, {
      sourceHub: { x: -12, y: 0, z: -6 },
      targetHub: { x: 11, y: 0, z: 7 },
      laneOffset: 0.5,
      gateLaneOffset: 0.3,
    });

    expect(points.length).toBeGreaterThanOrEqual(5);
    expect(points[0]).toEqual([-10, 0.05, 0]);
    expect(points[points.length - 1]).toEqual([10, 0.05, 0]);
    expect(points.some((p) => p[0] === 0.3)).toBe(true);
    expect(isOrthogonalPath(points)).toBe(true);
  });
});

describe('worstLinkState — precedence', () => {
  it('blocked wins over degraded and unknown', () => {
    expect(worstLinkState('blocked', 'degraded')).toBe('blocked');
    expect(worstLinkState('unknown', 'blocked')).toBe('blocked');
  });

  it('degraded wins over ok and unknown', () => {
    expect(worstLinkState('degraded', 'ok')).toBe('degraded');
    expect(worstLinkState('unknown', 'degraded')).toBe('degraded');
  });

  it('ok wins over unknown', () => {
    expect(worstLinkState('ok', 'unknown')).toBe('ok');
  });
});
