import { describe, it, expect, beforeAll } from 'vitest';
import { computeCosmosLayout, computeOrbitPoint } from '../services/cosmos-layout.service';
import type { CosmosLayout } from '../services/cosmos-layout.service';
import type { WorldService, WorldEndpoint } from '../types/world';
import { ENDPOINT_PLANET } from '../utils/cosmos';

const SERVICES: WorldService[] = [
  { id: 'auth-svc', tag: 'Auth', endpointCount: 2 },
  { id: 'users-svc', tag: 'Users', endpointCount: 2 },
  { id: 'health-svc', tag: 'Health', endpointCount: 1 },
];

const ENDPOINTS: WorldEndpoint[] = [
  {
    id: 'ep-login',
    serviceId: 'auth-svc',
    method: 'post',
    path: '/login',
    summary: 'Login',
    hasAuth: false,
    parameterCount: 0,
  },
  {
    id: 'ep-signup',
    serviceId: 'auth-svc',
    method: 'post',
    path: '/signup',
    summary: 'Signup',
    hasAuth: false,
    parameterCount: 0,
  },
  {
    id: 'ep-me',
    serviceId: 'users-svc',
    method: 'get',
    path: '/me',
    summary: 'Get me',
    hasAuth: true,
    parameterCount: 0,
  },
  {
    id: 'ep-update',
    serviceId: 'users-svc',
    method: 'patch',
    path: '/me',
    summary: 'Update me',
    hasAuth: true,
    parameterCount: 1,
  },
  {
    id: 'ep-health',
    serviceId: 'health-svc',
    method: 'get',
    path: '/health',
    summary: 'Health',
    hasAuth: false,
    parameterCount: 0,
  },
];

describe('computeCosmosLayout', () => {
  let layout: CosmosLayout;

  beforeAll(() => {
    layout = computeCosmosLayout(SERVICES, ENDPOINTS);
  });

  it('returns one star per service', () => {
    expect(layout.stars).toHaveLength(3);
    expect(layout.stars.map((s) => s.serviceId).sort()).toEqual([
      'auth-svc',
      'health-svc',
      'users-svc',
    ]);
  });

  it('returns one planet per endpoint', () => {
    expect(layout.planets).toHaveLength(5);
  });

  it('classifies services with auth endpoints as protected-core', () => {
    const usersStar = layout.stars.find((s) => s.serviceId === 'users-svc');
    expect(usersStar?.zone).toBe('protected-core');
  });

  it('classifies services with only public endpoints as public-perimeter', () => {
    const healthStar = layout.stars.find((s) => s.serviceId === 'health-svc');
    expect(healthStar?.zone).toBe('public-perimeter');
  });

  it('places protected stars closer to origin than public ones', () => {
    const protectedStars = layout.stars.filter((s) => s.zone === 'protected-core');
    const publicStars = layout.stars.filter((s) => s.zone === 'public-perimeter');
    for (const p of protectedStars) {
      const pDist = Math.sqrt(p.position.x ** 2 + p.position.z ** 2);
      for (const pub of publicStars) {
        const pubDist = Math.sqrt(pub.position.x ** 2 + pub.position.z ** 2);
        expect(pDist).toBeLessThan(pubDist);
      }
    }
  });

  it('planets reference their parent star position as orbitCenter', () => {
    for (const planet of layout.planets) {
      const parentStar = layout.stars.find((s) => s.serviceId === planet.serviceId);
      expect(parentStar).toBeDefined();
      expect(planet.orbitCenter).toEqual(parentStar!.position);
    }
  });

  it('orbit radius grows with endpoint count', () => {
    const authStar = layout.stars.find((s) => s.serviceId === 'auth-svc')!;
    const healthStar = layout.stars.find((s) => s.serviceId === 'health-svc')!;
    // auth has 2 endpoints, health has 1 — auth orbit should be >= health orbit
    expect(authStar.orbitRadius).toBeGreaterThanOrEqual(healthStar.orbitRadius);
  });

  it('wormhole is at origin', () => {
    expect(layout.wormholePosition).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('is deterministic — same input produces same output', () => {
    const layout2 = computeCosmosLayout(SERVICES, ENDPOINTS);
    expect(layout.stars).toEqual(layout2.stars);
    expect(layout.planets).toEqual(layout2.planets);
  });

  it('planets have orbit phases evenly distributed', () => {
    const authPlanets = layout.planets.filter((p) => p.serviceId === 'auth-svc');
    if (authPlanets.length >= 2) {
      const phases = authPlanets.map((p) => p.orbitPhase);
      const gap = Math.abs(phases[1]! - phases[0]!);
      expect(gap).toBeCloseTo(Math.PI, 0); // 2 planets → ~PI apart
    }
  });

  it('planet sizes are within configured range', () => {
    for (const planet of layout.planets) {
      expect(planet.size).toBeGreaterThanOrEqual(ENDPOINT_PLANET.minSize);
      expect(planet.size).toBeLessThanOrEqual(ENDPOINT_PLANET.maxSize);
    }
  });

  it('handles empty input gracefully', () => {
    const empty = computeCosmosLayout([], []);
    expect(empty.stars).toHaveLength(0);
    expect(empty.planets).toHaveLength(0);
    expect(empty.wormholePosition).toEqual({ x: 0, y: 0, z: 0 });
  });
});

describe('computeOrbitPoint', () => {
  it('at tilt=0, orbit is flat on XZ plane', () => {
    const pt = computeOrbitPoint({ x: 0, y: 0, z: 0 }, 5, 0, 0);
    expect(pt.x).toBeCloseTo(5);
    expect(pt.y).toBeCloseTo(0);
    expect(pt.z).toBeCloseTo(0);
  });

  it('adds center offset', () => {
    const pt = computeOrbitPoint({ x: 10, y: 5, z: 10 }, 5, 0, 0);
    expect(pt.x).toBeCloseTo(15);
    expect(pt.y).toBeCloseTo(5);
    expect(pt.z).toBeCloseTo(10);
  });

  it('at angle=PI/2, x returns to center and z extends', () => {
    const pt = computeOrbitPoint({ x: 0, y: 0, z: 0 }, 5, Math.PI / 2, 0);
    expect(pt.x).toBeCloseTo(0);
    expect(pt.z).toBeCloseTo(5);
  });
});
