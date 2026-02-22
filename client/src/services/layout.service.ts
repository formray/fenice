import type { WorldService, WorldEndpoint } from '../types/world';
import {
  BUILDING_BASE_SIZE,
  DISTRICT_GAP,
  GROUND_Y,
  MIN_HEIGHT,
  MAX_HEIGHT,
  MIN_INNER_RADIUS,
  MIN_OUTER_RADIUS,
  RING_GAP,
  RING_ROAD_ARC_SEGMENTS,
  ROAD_WIDTH,
  ZONE_LAYOUT_CONFIG,
} from '../utils/constants';

export interface Position3D {
  x: number;
  y: number;
  z: number;
}

export interface BuildingLayout {
  endpointId: string;
  position: Position3D;
  height: number;
  width: number;
  depth: number;
}

export interface DistrictLayout {
  serviceId: string;
  tag: string;
  zone: 'public-perimeter' | 'protected-core';
  center: { x: number; z: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface RoadSegment {
  points: Position3D[];
  width: number;
  zone: 'inner' | 'outer' | 'spoke';
}

export interface CityLayout {
  buildings: BuildingLayout[];
  districts: DistrictLayout[];
  gatePosition: Position3D;
  ringRoads: RoadSegment[];
  boulevards: RoadSegment[];
}

type ServiceZone = 'public-perimeter' | 'protected-core';

function classifyServiceZone(
  serviceId: string,
  endpointsByService: Map<string, WorldEndpoint[]>
): ServiceZone {
  const eps = endpointsByService.get(serviceId) ?? [];
  const authCount = eps.filter((e) => e.hasAuth).length;
  return authCount > 0 ? 'protected-core' : 'public-perimeter';
}

function computeDistrictSize(
  endpointCount: number,
  zone: 'public-perimeter' | 'protected-core'
): { width: number; depth: number } {
  const cfg = ZONE_LAYOUT_CONFIG[zone];
  const cols = Math.max(1, Math.ceil(Math.sqrt(endpointCount)));
  const rows = Math.max(1, Math.ceil(endpointCount / cols));
  const width =
    cols * (BUILDING_BASE_SIZE + cfg.buildingGap) - cfg.buildingGap + cfg.districtPadding * 2;
  const depth =
    rows * (BUILDING_BASE_SIZE + cfg.buildingGap) - cfg.buildingGap + cfg.districtPadding * 2;
  return { width, depth };
}

function computeRingRadius(
  districts: { width: number; depth: number }[],
  minRadius: number
): number {
  if (districts.length === 0) return minRadius;
  // Use diagonal of each district to ensure rectangular bounds don't overlap
  const totalArc = districts.reduce(
    (sum, d) => sum + Math.sqrt(d.width * d.width + d.depth * d.depth) + DISTRICT_GAP,
    0
  );
  const computed = totalArc / (2 * Math.PI);
  return Math.max(minRadius, computed);
}

function generateRingRoad(radius: number, zone: 'inner' | 'outer'): RoadSegment {
  const points: Position3D[] = [];
  for (let i = 0; i <= RING_ROAD_ARC_SEGMENTS; i++) {
    const angle = (i / RING_ROAD_ARC_SEGMENTS) * 2 * Math.PI;
    points.push({
      x: radius * Math.cos(angle),
      y: GROUND_Y + 0.005,
      z: radius * Math.sin(angle),
    });
  }
  return { points, width: ROAD_WIDTH, zone };
}

/**
 * Compute deterministic radial zone layout for the city.
 *
 * Services are classified into zones (protected-core / public-perimeter)
 * based on whether any endpoint has auth. Protected-core services are
 * placed on an inner ring, public-perimeter on an outer ring.
 *
 * Within each zone, services are sorted alphabetically by tag and placed
 * angularly around their ring. Dynamic radius grows with district count/size.
 *
 * Same input always produces the same output (no randomness).
 */
export function computeCityLayout(
  services: WorldService[],
  endpoints: WorldEndpoint[]
): CityLayout {
  const gatePosition: Position3D = { x: 0, y: 0, z: 0 };

  if (services.length === 0 || endpoints.length === 0) {
    return { buildings: [], districts: [], gatePosition, ringRoads: [], boulevards: [] };
  }

  const sortedServices = [...services].sort((a, b) => a.tag.localeCompare(b.tag));

  const endpointsByService = new Map<string, WorldEndpoint[]>();
  for (const ep of endpoints) {
    const list = endpointsByService.get(ep.serviceId) ?? [];
    list.push(ep);
    endpointsByService.set(ep.serviceId, list);
  }

  const maxParams = Math.max(1, ...endpoints.map((e) => e.parameterCount));

  const innerServices: WorldService[] = [];
  const outerServices: WorldService[] = [];

  for (const svc of sortedServices) {
    const zone = classifyServiceZone(svc.id, endpointsByService);
    if (zone === 'protected-core') innerServices.push(svc);
    else outerServices.push(svc);
  }

  const innerSizes = innerServices.map((s) => {
    const eps = endpointsByService.get(s.id) ?? [];
    return computeDistrictSize(eps.length, 'protected-core');
  });
  const outerSizes = outerServices.map((s) => {
    const eps = endpointsByService.get(s.id) ?? [];
    return computeDistrictSize(eps.length, 'public-perimeter');
  });

  const innerRadius = computeRingRadius(innerSizes, MIN_INNER_RADIUS);
  // Outer radius must be far enough from inner ring that no rectangular bounds overlap.
  // Account for the half-diagonal of the largest inner district extending outward,
  // plus the half-diagonal of the largest outer district extending inward, plus gap.
  const maxInnerHalfDiag =
    innerSizes.length > 0
      ? Math.max(...innerSizes.map((d) => Math.sqrt(d.width * d.width + d.depth * d.depth) / 2))
      : 0;
  const maxOuterHalfDiag =
    outerSizes.length > 0
      ? Math.max(...outerSizes.map((d) => Math.sqrt(d.width * d.width + d.depth * d.depth) / 2))
      : 0;
  const minOuterFromInner = innerRadius + maxInnerHalfDiag + RING_GAP + maxOuterHalfDiag;
  const outerRadius = Math.max(minOuterFromInner, computeRingRadius(outerSizes, MIN_OUTER_RADIUS));

  const buildings: BuildingLayout[] = [];
  const districts: DistrictLayout[] = [];

  function placeRing(
    ring: WorldService[],
    sizes: { width: number; depth: number }[],
    radius: number,
    zone: ServiceZone
  ): void {
    const count = ring.length;
    if (count === 0) return;

    const cfg = ZONE_LAYOUT_CONFIG[zone];

    for (let i = 0; i < count; i++) {
      const service = ring[i]!;
      const size = sizes[i]!;
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2;

      const centerX = radius * Math.cos(angle);
      const centerZ = radius * Math.sin(angle);

      districts.push({
        serviceId: service.id,
        tag: service.tag,
        zone,
        center: { x: centerX, z: centerZ },
        bounds: {
          minX: centerX - size.width / 2,
          maxX: centerX + size.width / 2,
          minZ: centerZ - size.depth / 2,
          maxZ: centerZ + size.depth / 2,
        },
      });

      const serviceEndpoints = endpointsByService.get(service.id) ?? [];
      const sorted = [...serviceEndpoints].sort((a, b) => {
        const pathCmp = a.path.localeCompare(b.path);
        return pathCmp !== 0 ? pathCmp : a.method.localeCompare(b.method);
      });

      const cols = Math.max(1, Math.ceil(Math.sqrt(sorted.length)));
      const originX = centerX - size.width / 2;
      const originZ = centerZ - size.depth / 2;

      for (let eIdx = 0; eIdx < sorted.length; eIdx++) {
        const ep = sorted[eIdx]!;
        const eCol = eIdx % cols;
        const eRow = Math.floor(eIdx / cols);

        const x = originX + cfg.districtPadding + eCol * (BUILDING_BASE_SIZE + cfg.buildingGap);
        const z = originZ + cfg.districtPadding + eRow * (BUILDING_BASE_SIZE + cfg.buildingGap);
        const normalizedHeight = maxParams > 0 ? ep.parameterCount / maxParams : 0;
        const height = MIN_HEIGHT + normalizedHeight * (MAX_HEIGHT - MIN_HEIGHT);

        buildings.push({
          endpointId: ep.id,
          position: { x, y: 0, z },
          height,
          width: BUILDING_BASE_SIZE,
          depth: BUILDING_BASE_SIZE,
        });
      }
    }
  }

  placeRing(innerServices, innerSizes, innerRadius, 'protected-core');
  placeRing(outerServices, outerSizes, outerRadius, 'public-perimeter');

  const ringRoads: RoadSegment[] = [];
  if (innerServices.length > 0) {
    ringRoads.push(generateRingRoad(innerRadius, 'inner'));
  }
  if (outerServices.length > 0) {
    ringRoads.push(generateRingRoad(outerRadius, 'outer'));
  }

  return { buildings, districts, gatePosition, ringRoads, boulevards: [] };
}
