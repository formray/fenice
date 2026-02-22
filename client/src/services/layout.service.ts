import type { WorldService, WorldEndpoint } from '../types/world';
import {
  BUILDING_BASE_SIZE,
  BUILDING_GAP,
  DISTRICT_PADDING,
  DISTRICT_GAP,
  DISTRICTS_PER_ROW,
  MIN_HEIGHT,
  MAX_HEIGHT,
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
  center: { x: number; z: number };
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number };
}

export interface CityLayout {
  buildings: BuildingLayout[];
  districts: DistrictLayout[];
}

/**
 * Compute deterministic grid layout for the city.
 *
 * Services are sorted alphabetically by tag and arranged in a row-major grid.
 * Within each district, endpoints are arranged in a sub-grid.
 * Building height scales with parameterCount.
 *
 * Same input always produces the same output (no randomness).
 */
export function computeCityLayout(
  services: WorldService[],
  endpoints: WorldEndpoint[]
): CityLayout {
  if (services.length === 0 || endpoints.length === 0) {
    return { buildings: [], districts: [] };
  }

  // Sort services alphabetically for deterministic layout
  const sortedServices = [...services].sort((a, b) => a.tag.localeCompare(b.tag));

  // Group endpoints by serviceId
  const endpointsByService = new Map<string, WorldEndpoint[]>();
  for (const ep of endpoints) {
    const list = endpointsByService.get(ep.serviceId) ?? [];
    list.push(ep);
    endpointsByService.set(ep.serviceId, list);
  }

  // Find max parameterCount for height normalization
  const maxParams = Math.max(1, ...endpoints.map((e) => e.parameterCount));

  const buildings: BuildingLayout[] = [];
  const districts: DistrictLayout[] = [];

  // Track cumulative offsets for the district grid
  const districtSizes: { width: number; depth: number }[] = [];

  // First pass: compute sizes for each district
  for (const service of sortedServices) {
    const serviceEndpoints = endpointsByService.get(service.id) ?? [];
    const count = serviceEndpoints.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(count)));
    const rows = Math.max(1, Math.ceil(count / cols));

    const width = cols * (BUILDING_BASE_SIZE + BUILDING_GAP) - BUILDING_GAP + DISTRICT_PADDING * 2;
    const depth = rows * (BUILDING_BASE_SIZE + BUILDING_GAP) - BUILDING_GAP + DISTRICT_PADDING * 2;

    districtSizes.push({ width, depth });
  }

  // Compute max width per column and max depth per row in the district grid
  const numDistrictRows = Math.ceil(sortedServices.length / DISTRICTS_PER_ROW);
  const colWidths: number[] = [];
  const rowDepths: number[] = [];

  for (let i = 0; i < DISTRICTS_PER_ROW; i++) {
    let maxW = 0;
    for (let j = 0; j < numDistrictRows; j++) {
      const idx = j * DISTRICTS_PER_ROW + i;
      if (idx < districtSizes.length) {
        maxW = Math.max(maxW, districtSizes[idx]!.width);
      }
    }
    colWidths.push(maxW);
  }

  for (let j = 0; j < numDistrictRows; j++) {
    let maxD = 0;
    for (let i = 0; i < DISTRICTS_PER_ROW; i++) {
      const idx = j * DISTRICTS_PER_ROW + i;
      if (idx < districtSizes.length) {
        maxD = Math.max(maxD, districtSizes[idx]!.depth);
      }
    }
    rowDepths.push(maxD);
  }

  // Second pass: place districts and buildings
  for (let sIdx = 0; sIdx < sortedServices.length; sIdx++) {
    const service = sortedServices[sIdx]!;
    const col = sIdx % DISTRICTS_PER_ROW;
    const row = Math.floor(sIdx / DISTRICTS_PER_ROW);

    // Compute district origin (top-left corner)
    let originX = 0;
    for (let c = 0; c < col; c++) {
      originX += (colWidths[c] ?? 0) + DISTRICT_GAP;
    }
    let originZ = 0;
    for (let r = 0; r < row; r++) {
      originZ += (rowDepths[r] ?? 0) + DISTRICT_GAP;
    }

    const dWidth = districtSizes[sIdx]!.width;
    const dDepth = districtSizes[sIdx]!.depth;

    districts.push({
      serviceId: service.id,
      tag: service.tag,
      center: { x: originX + dWidth / 2, z: originZ + dDepth / 2 },
      bounds: {
        minX: originX,
        maxX: originX + dWidth,
        minZ: originZ,
        maxZ: originZ + dDepth,
      },
    });

    // Place endpoints within district
    const serviceEndpoints = endpointsByService.get(service.id) ?? [];
    // Sort endpoints deterministically by path+method
    const sorted = [...serviceEndpoints].sort((a, b) => {
      const pathCmp = a.path.localeCompare(b.path);
      return pathCmp !== 0 ? pathCmp : a.method.localeCompare(b.method);
    });

    const epCount = sorted.length;
    const cols = Math.max(1, Math.ceil(Math.sqrt(epCount)));

    for (let eIdx = 0; eIdx < sorted.length; eIdx++) {
      const ep = sorted[eIdx]!;
      const eCol = eIdx % cols;
      const eRow = Math.floor(eIdx / cols);

      const x = originX + DISTRICT_PADDING + eCol * (BUILDING_BASE_SIZE + BUILDING_GAP);
      const z = originZ + DISTRICT_PADDING + eRow * (BUILDING_BASE_SIZE + BUILDING_GAP);

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

  return { buildings, districts };
}
