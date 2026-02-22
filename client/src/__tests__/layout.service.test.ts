import { describe, it, expect } from 'vitest';
import { computeCityLayout } from '../services/layout.service';
import type { WorldService, WorldEndpoint } from '../types/world';
import { MIN_HEIGHT, MAX_HEIGHT, BUILDING_BASE_SIZE, ZONE_LAYOUT_CONFIG } from '../utils/constants';

function makeService(id: string, tag: string, endpointCount: number): WorldService {
  return { id, tag, endpointCount };
}

function makeEndpoint(
  id: string,
  serviceId: string,
  path: string,
  method: WorldEndpoint['method'] = 'get',
  parameterCount = 0,
  hasAuth = false
): WorldEndpoint {
  return { id, serviceId, path, method, summary: '', hasAuth, parameterCount };
}

describe('computeCityLayout', () => {
  it('returns empty layout for empty input', () => {
    const result = computeCityLayout([], []);
    expect(result.buildings).toHaveLength(0);
    expect(result.districts).toHaveLength(0);
  });

  it('returns empty layout when services exist but no endpoints', () => {
    const services = [makeService('s1', 'Auth', 0)];
    const result = computeCityLayout(services, []);
    expect(result.buildings).toHaveLength(0);
    expect(result.districts).toHaveLength(0);
  });

  it('returns empty layout when endpoints exist but no services', () => {
    const endpoints = [makeEndpoint('e1', 's1', '/health')];
    const result = computeCityLayout([], endpoints);
    expect(result.buildings).toHaveLength(0);
    expect(result.districts).toHaveLength(0);
  });

  it('produces one district and one building for a single service/endpoint', () => {
    const services = [makeService('s1', 'Health', 1)];
    const endpoints = [makeEndpoint('e1', 's1', '/health')];
    const result = computeCityLayout(services, endpoints);

    expect(result.districts).toHaveLength(1);
    expect(result.buildings).toHaveLength(1);
    expect(result.districts[0]!.tag).toBe('Health');
    expect(result.buildings[0]!.endpointId).toBe('e1');
  });

  it('is deterministic — same input produces same output', () => {
    const services = [makeService('s1', 'Users', 2), makeService('s2', 'Auth', 1)];
    const endpoints = [
      makeEndpoint('e1', 's1', '/users', 'get', 3),
      makeEndpoint('e2', 's1', '/users', 'post', 1),
      makeEndpoint('e3', 's2', '/auth/login', 'post', 2),
    ];

    const result1 = computeCityLayout(services, endpoints);
    const result2 = computeCityLayout(services, endpoints);

    expect(result1).toEqual(result2);
  });

  it('sorts services alphabetically by tag within each zone', () => {
    const services = [
      makeService('s1', 'Zebra', 1),
      makeService('s2', 'Alpha', 1),
      makeService('s3', 'Mango', 1),
    ];
    const endpoints = [
      makeEndpoint('e1', 's1', '/zebra'),
      makeEndpoint('e2', 's2', '/alpha'),
      makeEndpoint('e3', 's3', '/mango'),
    ];

    const result = computeCityLayout(services, endpoints);
    // All are public-perimeter (no auth), so sorted alphabetically within that zone
    const tags = result.districts.map((d) => d.tag);
    expect(tags).toEqual(['Alpha', 'Mango', 'Zebra']);
  });

  it('scales building height based on parameterCount', () => {
    const services = [makeService('s1', 'Test', 2)];
    const endpoints = [
      makeEndpoint('e1', 's1', '/a', 'get', 0),
      makeEndpoint('e2', 's1', '/b', 'get', 10),
    ];

    const result = computeCityLayout(services, endpoints);
    const buildingA = result.buildings.find((b) => b.endpointId === 'e1')!;
    const buildingB = result.buildings.find((b) => b.endpointId === 'e2')!;

    // e1 has 0 params → MIN_HEIGHT, e2 has max params → MAX_HEIGHT
    expect(buildingA.height).toBeCloseTo(MIN_HEIGHT, 5);
    expect(buildingB.height).toBeCloseTo(MAX_HEIGHT, 5);
  });

  it('handles all endpoints having zero parameters', () => {
    const services = [makeService('s1', 'Test', 2)];
    const endpoints = [
      makeEndpoint('e1', 's1', '/a', 'get', 0),
      makeEndpoint('e2', 's1', '/b', 'post', 0),
    ];

    const result = computeCityLayout(services, endpoints);
    // All buildings should have MIN_HEIGHT when maxParams = 0
    for (const b of result.buildings) {
      expect(b.height).toBeCloseTo(MIN_HEIGHT, 5);
    }
  });

  it('sets correct building dimensions', () => {
    const services = [makeService('s1', 'Test', 1)];
    const endpoints = [makeEndpoint('e1', 's1', '/test')];

    const result = computeCityLayout(services, endpoints);
    expect(result.buildings[0]!.width).toBe(BUILDING_BASE_SIZE);
    expect(result.buildings[0]!.depth).toBe(BUILDING_BASE_SIZE);
  });

  it('handles multiple services with multiple endpoints', () => {
    const services = [
      makeService('s1', 'Auth', 3),
      makeService('s2', 'Users', 2),
      makeService('s3', 'Health', 1),
      makeService('s4', 'Upload', 4),
    ];
    const endpoints = [
      makeEndpoint('e1', 's1', '/auth/login', 'post', 2),
      makeEndpoint('e2', 's1', '/auth/register', 'post', 3),
      makeEndpoint('e3', 's1', '/auth/logout', 'post', 0),
      makeEndpoint('e4', 's2', '/users', 'get', 5),
      makeEndpoint('e5', 's2', '/users/:id', 'get', 1),
      makeEndpoint('e6', 's3', '/health', 'get', 0),
      makeEndpoint('e7', 's4', '/upload/init', 'post', 2),
      makeEndpoint('e8', 's4', '/upload/chunk', 'post', 1),
      makeEndpoint('e9', 's4', '/upload/complete', 'post', 1),
      makeEndpoint('e10', 's4', '/upload/cancel', 'delete', 0),
    ];

    const result = computeCityLayout(services, endpoints);
    expect(result.districts).toHaveLength(4);
    expect(result.buildings).toHaveLength(10);

    // All building positions should be unique
    const positions = result.buildings.map((b) => `${b.position.x},${b.position.z}`);
    const uniquePositions = new Set(positions);
    expect(uniquePositions.size).toBe(positions.length);
  });

  it('places all buildings within their district bounds', () => {
    const services = [makeService('s1', 'Auth', 3), makeService('s2', 'Users', 2)];
    const endpoints = [
      makeEndpoint('e1', 's1', '/auth/login', 'post'),
      makeEndpoint('e2', 's1', '/auth/register', 'post'),
      makeEndpoint('e3', 's1', '/auth/logout', 'post'),
      makeEndpoint('e4', 's2', '/users', 'get'),
      makeEndpoint('e5', 's2', '/users/:id', 'get'),
    ];

    const result = computeCityLayout(services, endpoints);

    // Build a map of serviceId → district bounds
    const districtBoundsMap = new Map(result.districts.map((d) => [d.serviceId, d.bounds]));

    // Build a map of endpointId → serviceId
    const epServiceMap = new Map(endpoints.map((e) => [e.id, e.serviceId]));

    for (const building of result.buildings) {
      const serviceId = epServiceMap.get(building.endpointId);
      expect(serviceId).toBeDefined();
      const bounds = districtBoundsMap.get(serviceId!);
      expect(bounds).toBeDefined();

      // Building center should be within district bounds
      expect(building.position.x).toBeGreaterThanOrEqual(bounds!.minX);
      expect(building.position.x + building.width).toBeLessThanOrEqual(bounds!.maxX);
      expect(building.position.z).toBeGreaterThanOrEqual(bounds!.minZ);
      expect(building.position.z + building.depth).toBeLessThanOrEqual(bounds!.maxZ);
    }
  });
});

describe('computeCityLayout — radial zone layout', () => {
  it('places auth gate at origin in layout metadata', () => {
    const services = [makeService('s1', 'Users', 1)];
    const endpoints = [makeEndpoint('e1', 's1', '/users', 'get', 0, true)];
    const result = computeCityLayout(services, endpoints);
    expect(result.gatePosition).toEqual({ x: 0, y: 0, z: 0 });
  });

  it('classifies service with hasAuth endpoints as protected-core', () => {
    const services = [makeService('s1', 'Auth', 2)];
    const endpoints = [
      makeEndpoint('e1', 's1', '/login', 'post', 0, true),
      makeEndpoint('e2', 's1', '/register', 'post', 0, true),
    ];
    const result = computeCityLayout(services, endpoints);
    expect(result.districts[0]!.zone).toBe('protected-core');
  });

  it('classifies service with no auth endpoints as public-perimeter', () => {
    const services = [makeService('s1', 'Health', 1)];
    const endpoints = [makeEndpoint('e1', 's1', '/health', 'get', 0, false)];
    const result = computeCityLayout(services, endpoints);
    expect(result.districts[0]!.zone).toBe('public-perimeter');
  });

  it('classifies mixed-auth service as protected-core (conservative)', () => {
    const services = [makeService('s1', 'Users', 2)];
    const endpoints = [
      makeEndpoint('e1', 's1', '/users', 'get', 0, false),
      makeEndpoint('e2', 's1', '/users/me', 'get', 0, true),
    ];
    const result = computeCityLayout(services, endpoints);
    expect(result.districts[0]!.zone).toBe('protected-core');
  });

  it('protected-core districts are closer to center than public-perimeter', () => {
    const services = [makeService('s1', 'Auth', 1), makeService('s2', 'Health', 1)];
    const endpoints = [
      makeEndpoint('e1', 's1', '/login', 'post', 0, true),
      makeEndpoint('e2', 's2', '/health', 'get', 0, false),
    ];
    const result = computeCityLayout(services, endpoints);
    const protectedDist = result.districts.find((d) => d.zone === 'protected-core')!;
    const publicDist = result.districts.find((d) => d.zone === 'public-perimeter')!;
    const distProtected = Math.sqrt(protectedDist.center.x ** 2 + protectedDist.center.z ** 2);
    const distPublic = Math.sqrt(publicDist.center.x ** 2 + publicDist.center.z ** 2);
    expect(distProtected).toBeLessThan(distPublic);
  });

  it('is deterministic — same input same output', () => {
    const services = [
      makeService('s1', 'Users', 2),
      makeService('s2', 'Auth', 1),
      makeService('s3', 'Health', 1),
    ];
    const endpoints = [
      makeEndpoint('e1', 's1', '/users', 'get', 3, true),
      makeEndpoint('e2', 's1', '/users', 'post', 1, true),
      makeEndpoint('e3', 's2', '/login', 'post', 2, true),
      makeEndpoint('e4', 's3', '/health', 'get', 0, false),
    ];
    const r1 = computeCityLayout(services, endpoints);
    const r2 = computeCityLayout(services, endpoints);
    expect(r1).toEqual(r2);
  });

  it('no building overlap — stress test 20 services', () => {
    const services = Array.from({ length: 20 }, (_, i) =>
      makeService(`s${i}`, `Service${String(i).padStart(2, '0')}`, 3)
    );
    const endpoints = services.flatMap((s, si) =>
      Array.from({ length: 3 }, (_, ei) =>
        makeEndpoint(`e${si}_${ei}`, s.id, `/path${ei}`, 'get', ei, si % 2 === 0)
      )
    );
    const result = computeCityLayout(services, endpoints);

    for (let i = 0; i < result.districts.length; i++) {
      for (let j = i + 1; j < result.districts.length; j++) {
        const a = result.districts[i]!;
        const b = result.districts[j]!;
        const overlapX = a.bounds.minX < b.bounds.maxX && a.bounds.maxX > b.bounds.minX;
        const overlapZ = a.bounds.minZ < b.bounds.maxZ && a.bounds.maxZ > b.bounds.minZ;
        expect(overlapX && overlapZ).toBe(false);
      }
    }

    for (let i = 0; i < result.buildings.length; i++) {
      for (let j = i + 1; j < result.buildings.length; j++) {
        const a = result.buildings[i]!;
        const b = result.buildings[j]!;
        const dx = Math.abs(a.position.x - b.position.x);
        const dz = Math.abs(a.position.z - b.position.z);
        const overlapBX = dx < BUILDING_BASE_SIZE;
        const overlapBZ = dz < BUILDING_BASE_SIZE;
        expect(overlapBX && overlapBZ).toBe(false);
      }
    }
  });

  it('dynamic radii grow with service count', () => {
    const make = (count: number) => {
      const svcs = Array.from({ length: count }, (_, i) => makeService(`s${i}`, `Svc${i}`, 2));
      const eps = svcs.flatMap((s, si) => [
        makeEndpoint(`e${si}_0`, s.id, `/a`, 'get', 0, true),
        makeEndpoint(`e${si}_1`, s.id, `/b`, 'post', 0, true),
      ]);
      return computeCityLayout(svcs, eps);
    };
    const small = make(3);
    const large = make(10);
    const maxDistSmall = Math.max(
      ...small.districts.map((d) => Math.sqrt(d.center.x ** 2 + d.center.z ** 2))
    );
    const maxDistLarge = Math.max(
      ...large.districts.map((d) => Math.sqrt(d.center.x ** 2 + d.center.z ** 2))
    );
    expect(maxDistLarge).toBeGreaterThan(maxDistSmall);
  });
});

describe('computeCityLayout — zone-specific gaps', () => {
  it('public-perimeter districts use wider gap than protected-core', () => {
    const services = [makeService('s1', 'Auth', 2), makeService('s2', 'Health', 2)];
    const endpoints = [
      makeEndpoint('e1', 's1', '/login', 'post', 0, true),
      makeEndpoint('e2', 's1', '/refresh', 'post', 0, true),
      makeEndpoint('e3', 's2', '/health', 'get', 0, false),
      makeEndpoint('e4', 's2', '/ready', 'get', 0, false),
    ];
    const result = computeCityLayout(services, endpoints);
    const protectedDistrict = result.districts.find((d) => d.zone === 'protected-core')!;
    const publicDistrict = result.districts.find((d) => d.zone === 'public-perimeter')!;
    const protectedWidth = protectedDistrict.bounds.maxX - protectedDistrict.bounds.minX;
    const publicWidth = publicDistrict.bounds.maxX - publicDistrict.bounds.minX;
    expect(publicWidth).toBeGreaterThan(protectedWidth);
  });

  it('zone-specific district sizes match expected formula', () => {
    const services = [makeService('s1', 'Test', 4)];
    const endpoints = [
      makeEndpoint('e1', 's1', '/a', 'get', 0, false),
      makeEndpoint('e2', 's1', '/b', 'get', 0, false),
      makeEndpoint('e3', 's1', '/c', 'get', 0, false),
      makeEndpoint('e4', 's1', '/d', 'get', 0, false),
    ];
    const result = computeCityLayout(services, endpoints);
    const district = result.districts[0]!;
    const cfg = ZONE_LAYOUT_CONFIG['public-perimeter'];
    const cols = 2;
    const expectedWidth =
      cols * (BUILDING_BASE_SIZE + cfg.buildingGap) - cfg.buildingGap + cfg.districtPadding * 2;
    const actualWidth = district.bounds.maxX - district.bounds.minX;
    expect(actualWidth).toBeCloseTo(expectedWidth, 5);
  });
});
