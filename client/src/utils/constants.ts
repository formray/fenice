/** Width and depth of each building */
export const BUILDING_BASE_SIZE = 1.0;

/** Gap between buildings within a district */
export const BUILDING_GAP = 0.5;

/** Padding around each district */
export const DISTRICT_PADDING = 2.0;

/** Gap between districts */
export const DISTRICT_GAP = 4.0;

/** Minimum building height */
export const MIN_HEIGHT = 0.5;

/** Maximum building height */
export const MAX_HEIGHT = 3.0;

/** Minimum radius for inner ring (protected-core) */
export const MIN_INNER_RADIUS = 8;

/** Minimum radius for outer ring (public-perimeter) */
export const MIN_OUTER_RADIUS = 16;

/** Ring padding between inner and outer */
export const RING_GAP = 6;

/** Ground plane Y offset (slightly above grid) */
export const GROUND_Y = 0.01;

/** Zone-specific layout configuration */
export interface ZoneLayoutConfig {
  buildingGap: number;
  districtPadding: number;
  groundOpacity: number;
}

export const ZONE_LAYOUT_CONFIG: Record<'public-perimeter' | 'protected-core', ZoneLayoutConfig> = {
  'public-perimeter': { buildingGap: 0.8, districtPadding: 2.5, groundOpacity: 0.5 },
  'protected-core': { buildingGap: 0.4, districtPadding: 1.5, groundOpacity: 0.7 },
};

/** Width of ring road and boulevard geometry */
export const ROAD_WIDTH = 1.0;

/** Number of arc segments per ring road arc (controls smoothness) */
export const RING_ROAD_ARC_SEGMENTS = 32;
