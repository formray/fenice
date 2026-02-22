import { describe, it, expect } from 'vitest';
import { computeCityLayout } from '../services/layout.service';
import type { WorldService, WorldEndpoint } from '../types/world';
import { MIN_HEIGHT, MAX_HEIGHT, BUILDING_BASE_SIZE } from '../utils/constants';

function makeService(id: string, tag: string, endpointCount: number): WorldService {
  return { id, tag, endpointCount };
}

function makeEndpoint(
  id: string,
  serviceId: string,
  path: string,
  method: WorldEndpoint['method'] = 'get',
  parameterCount = 0
): WorldEndpoint {
  return { id, serviceId, path, method, summary: '', hasAuth: false, parameterCount };
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

  it('sorts services alphabetically by tag', () => {
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
    const heights = result.buildings.map((b) => b.height);

    // e1 has 0 params → MIN_HEIGHT, e2 has max params → MAX_HEIGHT
    expect(heights[0]).toBeCloseTo(MIN_HEIGHT, 5);
    expect(heights[1]).toBeCloseTo(MAX_HEIGHT, 5);
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
