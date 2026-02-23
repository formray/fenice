import { describe, expect, it } from 'vitest';
import {
  computeCorridorPoints,
  computeServiceCorridors,
  worstServiceLinkState,
} from '../components/ServiceCorridors';
import type { DistrictLayout, Position3D } from '../services/layout.service';
import type { WorldEndpoint } from '../types/world';
import type { AuthGateState, SemanticState } from '../types/semantic';

describe('worstServiceLinkState', () => {
  it('blocked has highest priority', () => {
    expect(worstServiceLinkState(['ok', 'blocked', 'degraded'])).toBe('blocked');
  });

  it('degraded beats ok and unknown', () => {
    expect(worstServiceLinkState(['unknown', 'ok', 'degraded'])).toBe('degraded');
  });
});

describe('computeCorridorPoints (radial algorithm)', () => {
  const gate: Position3D = { x: 0, y: 0, z: 0 };

  it('returns 3 points (district, mid, dock)', () => {
    const points = computeCorridorPoints({ x: 10, z: 0 }, gate, 0);
    expect(points).toHaveLength(3);
  });

  it('dock point sits near DISTRIBUTOR_RADIUS from gate', () => {
    const points = computeCorridorPoints({ x: 10, z: 0 }, gate, 0);
    const dock = points[points.length - 1]!;
    const dockDist = Math.hypot(dock.x - gate.x, dock.z - gate.z);
    // DISTRIBUTOR_RADIUS = 3.2
    expect(dockDist).toBeCloseTo(3.2, 1);
  });

  it('corridor points fan radially toward the district angle', () => {
    // District at angle ~45 degrees
    const district = { x: 10, z: 10 };
    const points = computeCorridorPoints(district, gate, 0);
    const expectedAngle = Math.atan2(district.z, district.x); // ~PI/4

    // Dock point should be along the same radial angle
    const dock = points[points.length - 1]!;
    const dockAngle = Math.atan2(dock.z - gate.z, dock.x - gate.x);
    expect(dockAngle).toBeCloseTo(expectedAngle, 1);
  });

  it('lane offsets produce parallel corridors', () => {
    const district = { x: 10, z: 0 };
    const points0 = computeCorridorPoints(district, gate, 0);
    const pointsPos = computeCorridorPoints(district, gate, 0.3);
    const pointsNeg = computeCorridorPoints(district, gate, -0.3);

    // All dock points should be at roughly the same distance from gate
    const dock0 = Math.hypot(points0[2]!.x, points0[2]!.z);
    const dockPos = Math.hypot(pointsPos[2]!.x, pointsPos[2]!.z);
    const dockNeg = Math.hypot(pointsNeg[2]!.x, pointsNeg[2]!.z);
    expect(dockPos).toBeCloseTo(dock0, 0);
    expect(dockNeg).toBeCloseTo(dock0, 0);

    // Offset corridors should be separated in perpendicular direction (z for x-aligned district)
    expect(pointsPos[2]!.z).not.toBeCloseTo(points0[2]!.z, 1);
    expect(pointsNeg[2]!.z).not.toBeCloseTo(points0[2]!.z, 1);
  });

  it('mid waypoint is between district and gate at ~55% distance', () => {
    const district = { x: 20, z: 0 };
    const points = computeCorridorPoints(district, gate, 0);
    const mid = points[1]!;
    const midDist = Math.hypot(mid.x - gate.x, mid.z - gate.z);
    const fullDist = Math.hypot(district.x - gate.x, district.z - gate.z);
    expect(midDist / fullDist).toBeCloseTo(0.55, 1);
  });

  it('all points have y = CORRIDOR_Y (0.06)', () => {
    const points = computeCorridorPoints({ x: 5, z: -8 }, gate, 0.15);
    for (const p of points) {
      expect(p.y).toBeCloseTo(0.06, 5);
    }
  });

  it('handles non-origin gate position', () => {
    const gateOff: Position3D = { x: 3, y: 0, z: 5 };
    const points = computeCorridorPoints({ x: 13, z: 5 }, gateOff, 0);
    // Dock should be DISTRIBUTOR_RADIUS away from the gate along x-axis
    const dock = points[points.length - 1]!;
    const dockDist = Math.hypot(dock.x - gateOff.x, dock.z - gateOff.z);
    expect(dockDist).toBeCloseTo(3.2, 1);
  });
});

describe('computeServiceCorridors', () => {
  const gate: Position3D = { x: 0, y: 0, z: 0 };
  const districts: DistrictLayout[] = [
    {
      serviceId: 'service:auth',
      tag: 'Auth',
      zone: 'protected-core',
      center: { x: 8, z: 4 },
      bounds: { minX: 6, maxX: 10, minZ: 2, maxZ: 6 },
    },
    {
      serviceId: 'service:public',
      tag: 'Public',
      zone: 'public-perimeter',
      center: { x: -10, z: -6 },
      bounds: { minX: -12, maxX: -8, minZ: -8, maxZ: -4 },
    },
  ];

  const endpoints: WorldEndpoint[] = [
    {
      id: 'ep-auth-1',
      serviceId: 'service:auth',
      path: '/api/v1/auth/login',
      method: 'post',
      summary: 'Login',
      hasAuth: true,
      parameterCount: 1,
    },
    {
      id: 'ep-auth-2',
      serviceId: 'service:auth',
      path: '/api/v1/auth/me',
      method: 'get',
      summary: 'Me',
      hasAuth: true,
      parameterCount: 0,
    },
    {
      id: 'ep-public-1',
      serviceId: 'service:public',
      path: '/api/v1/health',
      method: 'get',
      summary: 'Health',
      hasAuth: false,
      parameterCount: 0,
    },
  ];

  const semantics: Record<string, SemanticState> = {
    'ep-auth-1': { linkState: 'ok', zone: 'protected-core' },
    'ep-auth-2': { linkState: 'degraded', zone: 'protected-core', reason: 'latency_high' },
    'ep-public-1': { linkState: 'ok', zone: 'public-perimeter' },
  };

  it('builds corridors only for protected services', () => {
    const authGate: AuthGateState = {
      id: 'auth-gate:main',
      zone: 'auth-hub',
      open: true,
      linkState: 'ok',
    };

    const corridors = computeServiceCorridors(districts, endpoints, semantics, authGate, gate);
    expect(corridors).toHaveLength(1);
    expect(corridors[0]?.serviceId).toBe('service:auth');
    expect(corridors[0]?.linkState).toBe('degraded');
  });

  it('forces blocked corridors when auth gate is closed', () => {
    const authGate: AuthGateState = {
      id: 'auth-gate:main',
      zone: 'auth-hub',
      open: false,
      linkState: 'blocked',
      reason: 'auth_required_no_session',
    };

    const corridors = computeServiceCorridors(districts, endpoints, semantics, authGate, gate);
    expect(corridors).toHaveLength(1);
    expect(corridors[0]?.linkState).toBe('blocked');
  });

  it('corridor points are radial (not orthogonal)', () => {
    const authGate: AuthGateState = {
      id: 'auth-gate:main',
      zone: 'auth-hub',
      open: true,
      linkState: 'ok',
    };

    const corridors = computeServiceCorridors(districts, endpoints, semantics, authGate, gate);
    const points = corridors[0]!.points;
    expect(points.length).toBeGreaterThanOrEqual(3);

    // Verify dock point is near DISTRIBUTOR_RADIUS from gate
    const dock = points[points.length - 1]!;
    const dockDist = Math.hypot(dock.x, dock.z);
    expect(dockDist).toBeCloseTo(3.2, 0);
  });
});
