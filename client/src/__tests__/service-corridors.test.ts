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

describe('computeCorridorPoints', () => {
  it('returns orthogonal 90-degree polyline', () => {
    const points = computeCorridorPoints({ x: 10, z: -8 }, { x: 0, y: 0, z: 0 }, 0.4);
    expect(points.length).toBeGreaterThanOrEqual(3);

    for (let i = 1; i < points.length; i++) {
      const prev = points[i - 1]!;
      const curr = points[i]!;
      const sameX = prev[0] === curr[0];
      const sameZ = prev[2] === curr[2];
      expect(sameX || sameZ).toBe(true);
    }
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
});
