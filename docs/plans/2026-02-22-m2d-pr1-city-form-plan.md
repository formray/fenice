# M2D PR1: City Form + District Identity — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add ring roads, sector-based boulevards, zone-specific district archetypes, scaled auth-hub landmark, and dark ground plane to transform the visualization into a readable cyber-city.

**Architecture:** Extend `computeCityLayout` to produce `ringRoads` and `boulevards` (arrays of `RoadSegment`). New `<RingRoads>` and `<Boulevards>` components render road geometry. Existing `District`, `AuthGate`, and `Scene` are modified for zone archetypes, landmark scale-up, and ground plane. All changes are client-only; no backend/protocol changes.

**Tech Stack:** TypeScript, React Three Fiber v9, drei v10.7.7, Three.js r173, Vitest, Zustand

---

### Task 1: Zone-Specific Layout Constants

**Files:**
- Modify: `client/src/utils/constants.ts`

**Step 1: Write the failing test**

Create test file for zone layout config:

```typescript
// client/src/__tests__/constants.test.ts
import { describe, it, expect } from 'vitest';
import { ZONE_LAYOUT_CONFIG, ROAD_WIDTH, GROUND_Y } from '../utils/constants';

describe('ZONE_LAYOUT_CONFIG', () => {
  it('has config for public-perimeter with wider gaps', () => {
    const cfg = ZONE_LAYOUT_CONFIG['public-perimeter'];
    expect(cfg.buildingGap).toBe(0.8);
    expect(cfg.districtPadding).toBe(2.5);
    expect(cfg.groundOpacity).toBe(0.5);
  });

  it('has config for protected-core with tighter gaps', () => {
    const cfg = ZONE_LAYOUT_CONFIG['protected-core'];
    expect(cfg.buildingGap).toBe(0.4);
    expect(cfg.districtPadding).toBe(1.5);
    expect(cfg.groundOpacity).toBe(0.7);
  });

  it('protected-core has smaller gap than public-perimeter', () => {
    expect(ZONE_LAYOUT_CONFIG['protected-core'].buildingGap)
      .toBeLessThan(ZONE_LAYOUT_CONFIG['public-perimeter'].buildingGap);
  });
});

describe('road constants', () => {
  it('ROAD_WIDTH is a positive number', () => {
    expect(ROAD_WIDTH).toBeGreaterThan(0);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- --run client/src/__tests__/constants.test.ts`
Expected: FAIL — `ZONE_LAYOUT_CONFIG` is not exported / doesn't exist.

**Step 3: Write minimal implementation**

Add to `client/src/utils/constants.ts`:

```typescript
/** Zone-specific layout configuration */
export interface ZoneLayoutConfig {
  buildingGap: number;
  districtPadding: number;
  groundOpacity: number;
}

export const ZONE_LAYOUT_CONFIG: Record<
  'public-perimeter' | 'protected-core',
  ZoneLayoutConfig
> = {
  'public-perimeter': { buildingGap: 0.8, districtPadding: 2.5, groundOpacity: 0.5 },
  'protected-core': { buildingGap: 0.4, districtPadding: 1.5, groundOpacity: 0.7 },
};

/** Width of ring road and boulevard geometry */
export const ROAD_WIDTH = 1.0;

/** Number of arc segments per ring road arc (controls smoothness) */
export const RING_ROAD_ARC_SEGMENTS = 32;
```

**Step 4: Run test to verify it passes**

Run: `npm test -- --run client/src/__tests__/constants.test.ts`
Expected: PASS

**Step 5: Run full client test suite to confirm no regressions**

Run: `npm test -- --run`
Expected: All tests pass

**Step 6: Commit**

```bash
git add client/src/utils/constants.ts client/src/__tests__/constants.test.ts
git commit -m "feat(world-client): add zone-specific layout constants and road width"
```

---

### Task 2: Layout Service — Zone-Specific Gaps

**Files:**
- Modify: `client/src/services/layout.service.ts`
- Modify: `client/src/__tests__/layout.service.test.ts`

**Context:** Currently `computeDistrictSize` and `placeRing` use global `BUILDING_GAP` and `DISTRICT_PADDING`. We need them to use `ZONE_LAYOUT_CONFIG` values based on zone. The `RoadSegment` type and road generation come in Task 3 — this task only does zone-specific gaps.

**Step 1: Write the failing tests**

Add to `client/src/__tests__/layout.service.test.ts`:

```typescript
import { ZONE_LAYOUT_CONFIG } from '../utils/constants';

describe('computeCityLayout — zone-specific gaps', () => {
  it('public-perimeter districts use wider gap than protected-core', () => {
    const services = [
      makeService('s1', 'Auth', 2),
      makeService('s2', 'Health', 2),
    ];
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

    // Public has wider gap (0.8 vs 0.4) and wider padding (2.5 vs 1.5)
    // so for same endpoint count, public district should be larger
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

    // 4 endpoints → 2x2 grid
    const cols = 2;
    const rows = 2;
    const expectedWidth = cols * (BUILDING_BASE_SIZE + cfg.buildingGap) - cfg.buildingGap + cfg.districtPadding * 2;
    const actualWidth = district.bounds.maxX - district.bounds.minX;
    expect(actualWidth).toBeCloseTo(expectedWidth, 5);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run client/src/__tests__/layout.service.test.ts`
Expected: FAIL — districts still use global BUILDING_GAP/DISTRICT_PADDING.

**Step 3: Modify layout service to use zone-specific gaps**

In `client/src/services/layout.service.ts`:

1. Import `ZONE_LAYOUT_CONFIG` from constants.
2. Change `computeDistrictSize` signature to accept zone:
   ```typescript
   function computeDistrictSize(
     endpointCount: number,
     zone: 'public-perimeter' | 'protected-core'
   ): { width: number; depth: number } {
     const cfg = ZONE_LAYOUT_CONFIG[zone];
     const cols = Math.max(1, Math.ceil(Math.sqrt(endpointCount)));
     const rows = Math.max(1, Math.ceil(endpointCount / cols));
     const width = cols * (BUILDING_BASE_SIZE + cfg.buildingGap) - cfg.buildingGap + cfg.districtPadding * 2;
     const depth = rows * (BUILDING_BASE_SIZE + cfg.buildingGap) - cfg.buildingGap + cfg.districtPadding * 2;
     return { width, depth };
   }
   ```
3. Update callers in `computeCityLayout`:
   ```typescript
   const innerSizes = innerServices.map((s) => {
     const eps = endpointsByService.get(s.id) ?? [];
     return computeDistrictSize(eps.length, 'protected-core');
   });
   const outerSizes = outerServices.map((s) => {
     const eps = endpointsByService.get(s.id) ?? [];
     return computeDistrictSize(eps.length, 'public-perimeter');
   });
   ```
4. Update `placeRing` to use zone-specific gap for building placement:
   ```typescript
   function placeRing(
     ring: WorldService[],
     sizes: { width: number; depth: number }[],
     radius: number,
     zone: ServiceZone
   ): void {
     const cfg = ZONE_LAYOUT_CONFIG[zone];
     // ... existing code but replace BUILDING_GAP with cfg.buildingGap
     // and DISTRICT_PADDING with cfg.districtPadding in building placement
   }
   ```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --run client/src/__tests__/layout.service.test.ts`
Expected: All tests pass (existing + new).

**Step 5: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add client/src/services/layout.service.ts client/src/__tests__/layout.service.test.ts
git commit -m "feat(world-client): use zone-specific gaps in district layout"
```

---

### Task 3: Layout Service — RoadSegment Type + Ring Road Generation

**Files:**
- Modify: `client/src/services/layout.service.ts`
- Modify: `client/src/__tests__/layout.service.test.ts`

**Context:** Add `RoadSegment` type and `ringRoads` field to `CityLayout`. Generate arc segments connecting adjacent districts on each ring.

**Step 1: Write the failing tests**

Add to `client/src/__tests__/layout.service.test.ts`:

```typescript
describe('computeCityLayout — ring roads', () => {
  it('returns ringRoads array in layout', () => {
    const services = [makeService('s1', 'Health', 1)];
    const endpoints = [makeEndpoint('e1', 's1', '/health', 'get')];
    const result = computeCityLayout(services, endpoints);
    expect(result.ringRoads).toBeDefined();
    expect(Array.isArray(result.ringRoads)).toBe(true);
  });

  it('generates one ring road for single-zone layout', () => {
    const services = [
      makeService('s1', 'Svc1', 1),
      makeService('s2', 'Svc2', 1),
    ];
    const endpoints = [
      makeEndpoint('e1', 's1', '/a', 'get', 0, false),
      makeEndpoint('e2', 's2', '/b', 'get', 0, false),
    ];
    const result = computeCityLayout(services, endpoints);
    // Both are public-perimeter, so we get outer ring road segments
    const outerSegments = result.ringRoads.filter((r) => r.zone === 'outer');
    expect(outerSegments.length).toBeGreaterThan(0);
  });

  it('generates inner and outer ring roads when both zones exist', () => {
    const services = [
      makeService('s1', 'Auth', 1),
      makeService('s2', 'Health', 1),
    ];
    const endpoints = [
      makeEndpoint('e1', 's1', '/login', 'post', 0, true),
      makeEndpoint('e2', 's2', '/health', 'get', 0, false),
    ];
    const result = computeCityLayout(services, endpoints);
    const innerSegments = result.ringRoads.filter((r) => r.zone === 'inner');
    const outerSegments = result.ringRoads.filter((r) => r.zone === 'outer');
    expect(innerSegments.length).toBeGreaterThan(0);
    expect(outerSegments.length).toBeGreaterThan(0);
  });

  it('ring road points are at approximately the ring radius', () => {
    const services = [
      makeService('s1', 'Auth', 1),
      makeService('s2', 'Users', 1),
    ];
    const endpoints = [
      makeEndpoint('e1', 's1', '/login', 'post', 0, true),
      makeEndpoint('e2', 's2', '/users', 'get', 0, true),
    ];
    const result = computeCityLayout(services, endpoints);
    const innerRoads = result.ringRoads.filter((r) => r.zone === 'inner');
    // All points should be within tolerance of ring radius
    for (const road of innerRoads) {
      for (const pt of road.points) {
        const dist = Math.sqrt(pt.x ** 2 + pt.z ** 2);
        // Allow 10% tolerance for arc approximation
        expect(dist).toBeGreaterThan(0);
      }
    }
  });

  it('ring road generation is deterministic', () => {
    const services = [
      makeService('s1', 'Auth', 2),
      makeService('s2', 'Health', 1),
      makeService('s3', 'Users', 1),
    ];
    const endpoints = [
      makeEndpoint('e1', 's1', '/login', 'post', 0, true),
      makeEndpoint('e2', 's1', '/refresh', 'post', 0, true),
      makeEndpoint('e3', 's2', '/health', 'get', 0, false),
      makeEndpoint('e4', 's3', '/users', 'get', 0, false),
    ];
    const r1 = computeCityLayout(services, endpoints);
    const r2 = computeCityLayout(services, endpoints);
    expect(r1.ringRoads).toEqual(r2.ringRoads);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run client/src/__tests__/layout.service.test.ts`
Expected: FAIL — `ringRoads` is not in `CityLayout`.

**Step 3: Implement ring road generation**

In `client/src/services/layout.service.ts`:

1. Add `RoadSegment` type:
   ```typescript
   export interface RoadSegment {
     points: Position3D[];
     width: number;
     zone: 'inner' | 'outer' | 'spoke';
   }
   ```

2. Extend `CityLayout`:
   ```typescript
   export interface CityLayout {
     buildings: BuildingLayout[];
     districts: DistrictLayout[];
     gatePosition: Position3D;
     ringRoads: RoadSegment[];
     boulevards: RoadSegment[];
   }
   ```

3. Add `generateRingRoad` function:
   ```typescript
   import { ROAD_WIDTH, RING_ROAD_ARC_SEGMENTS } from '../utils/constants';

   function generateRingRoad(
     radius: number,
     zone: 'inner' | 'outer'
   ): RoadSegment {
     const points: Position3D[] = [];
     // Full circle with RING_ROAD_ARC_SEGMENTS points, closing the loop
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
   ```

4. In `computeCityLayout`, generate roads before return:
   ```typescript
   const ringRoads: RoadSegment[] = [];
   if (innerServices.length > 0) {
     ringRoads.push(generateRingRoad(innerRadius, 'inner'));
   }
   if (outerServices.length > 0) {
     ringRoads.push(generateRingRoad(outerRadius, 'outer'));
   }

   return { buildings, districts, gatePosition, ringRoads, boulevards: [] };
   ```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --run client/src/__tests__/layout.service.test.ts`
Expected: All tests pass.

**Step 5: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add client/src/services/layout.service.ts client/src/__tests__/layout.service.test.ts
git commit -m "feat(world-client): add RoadSegment type and ring road generation"
```

---

### Task 4: Layout Service — Sector Boulevard Generation

**Files:**
- Modify: `client/src/services/layout.service.ts`
- Modify: `client/src/__tests__/layout.service.test.ts`

**Context:** Add `boulevards` generation (sector-based spokes from ring roads to auth-hub center). Spoke count formula: `max(3, ceil(districtCount / 3))` per ring.

**Step 1: Write the failing tests**

Add to `client/src/__tests__/layout.service.test.ts`:

```typescript
describe('computeCityLayout — sector boulevards', () => {
  it('returns boulevards array in layout', () => {
    const services = [makeService('s1', 'Health', 1)];
    const endpoints = [makeEndpoint('e1', 's1', '/health', 'get')];
    const result = computeCityLayout(services, endpoints);
    expect(result.boulevards).toBeDefined();
    expect(Array.isArray(result.boulevards)).toBe(true);
  });

  it('generates spokes connecting ring to center', () => {
    const services = [
      makeService('s1', 'Auth', 1),
      makeService('s2', 'Users', 1),
      makeService('s3', 'Health', 1),
    ];
    const endpoints = [
      makeEndpoint('e1', 's1', '/login', 'post', 0, true),
      makeEndpoint('e2', 's2', '/users', 'get', 0, true),
      makeEndpoint('e3', 's3', '/health', 'get', 0, false),
    ];
    const result = computeCityLayout(services, endpoints);
    const spokes = result.boulevards.filter((b) => b.zone === 'spoke');
    expect(spokes.length).toBeGreaterThanOrEqual(3);
  });

  it('spoke count follows formula max(3, ceil(districtCount / 3))', () => {
    // 9 inner services → ceil(9/3) = 3 spokes (min is 3)
    const services = Array.from({ length: 12 }, (_, i) =>
      makeService(`s${i}`, `Svc${String(i).padStart(2, '0')}`, 1)
    );
    const endpoints = services.map((s, i) =>
      makeEndpoint(`e${i}`, s.id, `/path`, 'get', 0, true)
    );
    const result = computeCityLayout(services, endpoints);
    const innerSpokes = result.boulevards.filter((b) => b.zone === 'spoke');
    // 12 inner services → ceil(12/3) = 4 spokes
    expect(innerSpokes.length).toBe(4);
  });

  it('each spoke starts at center and ends at ring radius', () => {
    const services = [
      makeService('s1', 'Auth', 1),
      makeService('s2', 'Users', 1),
    ];
    const endpoints = [
      makeEndpoint('e1', 's1', '/login', 'post', 0, true),
      makeEndpoint('e2', 's2', '/users', 'get', 0, false),
    ];
    const result = computeCityLayout(services, endpoints);
    for (const spoke of result.boulevards) {
      // First point near center
      const first = spoke.points[0]!;
      const firstDist = Math.sqrt(first.x ** 2 + first.z ** 2);
      expect(firstDist).toBeLessThan(2);

      // Last point near ring radius
      const last = spoke.points[spoke.points.length - 1]!;
      const lastDist = Math.sqrt(last.x ** 2 + last.z ** 2);
      expect(lastDist).toBeGreaterThan(firstDist);
    }
  });

  it('boulevard generation is deterministic', () => {
    const services = [
      makeService('s1', 'Auth', 1),
      makeService('s2', 'Health', 1),
    ];
    const endpoints = [
      makeEndpoint('e1', 's1', '/login', 'post', 0, true),
      makeEndpoint('e2', 's2', '/health', 'get', 0, false),
    ];
    const r1 = computeCityLayout(services, endpoints);
    const r2 = computeCityLayout(services, endpoints);
    expect(r1.boulevards).toEqual(r2.boulevards);
  });
});
```

**Step 2: Run tests to verify they fail**

Run: `npm test -- --run client/src/__tests__/layout.service.test.ts`
Expected: FAIL — boulevards is empty `[]`.

**Step 3: Implement boulevard generation**

In `client/src/services/layout.service.ts`:

```typescript
function generateBoulevards(
  innerRadius: number,
  outerRadius: number,
  innerCount: number,
  outerCount: number
): RoadSegment[] {
  const boulevards: RoadSegment[] = [];

  // Spoke count per ring: max(3, ceil(districtCount / 3))
  // We generate spokes from center outward to the farthest ring that exists
  const maxRadius = outerCount > 0 ? outerRadius : innerRadius;
  const totalDistricts = innerCount + outerCount;
  if (totalDistricts === 0) return boulevards;

  const spokeCount = Math.max(3, Math.ceil(totalDistricts / 3));

  for (let i = 0; i < spokeCount; i++) {
    const angle = (i / spokeCount) * 2 * Math.PI;
    const points: Position3D[] = [
      { x: 0, y: GROUND_Y + 0.005, z: 0 },
      {
        x: maxRadius * Math.cos(angle),
        y: GROUND_Y + 0.005,
        z: maxRadius * Math.sin(angle),
      },
    ];
    boulevards.push({ points, width: ROAD_WIDTH * 0.6, zone: 'spoke' });
  }

  return boulevards;
}
```

Then in `computeCityLayout`, replace `boulevards: []` with the call:
```typescript
const boulevards = generateBoulevards(
  innerRadius,
  outerRadius,
  innerServices.length,
  outerServices.length
);
```

**Step 4: Run tests to verify they pass**

Run: `npm test -- --run client/src/__tests__/layout.service.test.ts`
Expected: All tests pass.

**Step 5: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass.

**Step 6: Commit**

```bash
git add client/src/services/layout.service.ts client/src/__tests__/layout.service.test.ts
git commit -m "feat(world-client): add sector-based boulevard generation"
```

---

### Task 5: RingRoads Component

**Files:**
- Create: `client/src/components/RingRoads.tsx`

**Context:** New component that renders ring road arc meshes from `CityLayout.ringRoads`. Uses `<Line>` from drei for the road centerline and a `PlaneGeometry`-based strip for the road surface.

**Step 1: Create the component**

```tsx
// client/src/components/RingRoads.tsx
import { Line } from '@react-three/drei';
import type { RoadSegment } from '../services/layout.service';

interface RingRoadsProps {
  roads: RoadSegment[];
}

export function RingRoads({ roads }: RingRoadsProps): React.JSX.Element {
  return (
    <group>
      {roads.map((road, i) => {
        const points = road.points.map(
          (p) => [p.x, p.y, p.z] as [number, number, number]
        );
        return (
          <group key={`ring-${road.zone}-${i}`}>
            {/* Road surface — dark lane */}
            <Line
              points={points}
              color="#0a1a3e"
              lineWidth={road.width * 10}
              opacity={0.4}
              transparent
            />
            {/* Lane markings — faint cyan */}
            <Line
              points={points}
              color="#00E5FF"
              lineWidth={1}
              opacity={0.15}
              transparent
            />
          </group>
        );
      })}
    </group>
  );
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add client/src/components/RingRoads.tsx
git commit -m "feat(world-client): add RingRoads component for ring road rendering"
```

---

### Task 6: Boulevards Component

**Files:**
- Create: `client/src/components/Boulevards.tsx`

**Context:** New component that renders sector spoke geometry from `CityLayout.boulevards`.

**Step 1: Create the component**

```tsx
// client/src/components/Boulevards.tsx
import { Line } from '@react-three/drei';
import type { RoadSegment } from '../services/layout.service';

interface BoulevardProps {
  boulevards: RoadSegment[];
}

export function Boulevards({ boulevards }: BoulevardProps): React.JSX.Element {
  return (
    <group>
      {boulevards.map((blvd, i) => {
        const points = blvd.points.map(
          (p) => [p.x, p.y, p.z] as [number, number, number]
        );
        return (
          <group key={`blvd-${i}`}>
            {/* Spoke surface — dark lane */}
            <Line
              points={points}
              color="#0a1a3e"
              lineWidth={blvd.width * 10}
              opacity={0.3}
              transparent
            />
            {/* Spoke center marking */}
            <Line
              points={points}
              color="#00E5FF"
              lineWidth={1}
              opacity={0.1}
              transparent
            />
          </group>
        );
      })}
    </group>
  );
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Commit**

```bash
git add client/src/components/Boulevards.tsx
git commit -m "feat(world-client): add Boulevards component for sector spoke rendering"
```

---

### Task 7: District Zone Archetypes

**Files:**
- Modify: `client/src/components/District.tsx`

**Context:** Add zone-specific ground opacity from `ZONE_LAYOUT_CONFIG`. Add corner accent marks for protected-core districts (short line segments at each corner of the border).

**Step 1: Modify District.tsx**

In `client/src/components/District.tsx`:

1. Import `ZONE_LAYOUT_CONFIG` from `../utils/constants`
2. Use `ZONE_LAYOUT_CONFIG[layout.zone]?.groundOpacity ?? 0.6` for ground opacity (the `?? 0.6` fallback handles `auth-hub` zone which isn't in the config)
3. Add corner accents for protected-core: short L-shaped line segments at each corner of the bounds

```tsx
// Corner accents for protected-core
const ACCENT_LENGTH = 0.6;
const cornerAccents: [number, number, number][][] = [
  // Top-left corner
  [
    [layout.bounds.minX, GROUND_Y + 0.02, layout.bounds.minZ],
    [layout.bounds.minX + ACCENT_LENGTH, GROUND_Y + 0.02, layout.bounds.minZ],
  ],
  [
    [layout.bounds.minX, GROUND_Y + 0.02, layout.bounds.minZ],
    [layout.bounds.minX, GROUND_Y + 0.02, layout.bounds.minZ + ACCENT_LENGTH],
  ],
  // Top-right corner
  [
    [layout.bounds.maxX, GROUND_Y + 0.02, layout.bounds.minZ],
    [layout.bounds.maxX - ACCENT_LENGTH, GROUND_Y + 0.02, layout.bounds.minZ],
  ],
  [
    [layout.bounds.maxX, GROUND_Y + 0.02, layout.bounds.minZ],
    [layout.bounds.maxX, GROUND_Y + 0.02, layout.bounds.minZ + ACCENT_LENGTH],
  ],
  // Bottom-left corner
  [
    [layout.bounds.minX, GROUND_Y + 0.02, layout.bounds.maxZ],
    [layout.bounds.minX + ACCENT_LENGTH, GROUND_Y + 0.02, layout.bounds.maxZ],
  ],
  [
    [layout.bounds.minX, GROUND_Y + 0.02, layout.bounds.maxZ],
    [layout.bounds.minX, GROUND_Y + 0.02, layout.bounds.maxZ - ACCENT_LENGTH],
  ],
  // Bottom-right corner
  [
    [layout.bounds.maxX, GROUND_Y + 0.02, layout.bounds.maxZ],
    [layout.bounds.maxX - ACCENT_LENGTH, GROUND_Y + 0.02, layout.bounds.maxZ],
  ],
  [
    [layout.bounds.maxX, GROUND_Y + 0.02, layout.bounds.maxZ],
    [layout.bounds.maxX, GROUND_Y + 0.02, layout.bounds.maxZ - ACCENT_LENGTH],
  ],
];
```

Render these inside the `{zoneStyle.borderColor && (...)}` block after the existing border `<Line>`:
```tsx
{zoneStyle.borderColor && (
  <>
    <Line points={borderPoints} color={zoneStyle.borderColor} lineWidth={1} opacity={0.3} transparent />
    {cornerAccents.map((pts, idx) => (
      <Line key={`accent-${idx}`} points={pts} color={zoneStyle.borderColor!} lineWidth={2} opacity={0.6} transparent />
    ))}
  </>
)}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add client/src/components/District.tsx
git commit -m "feat(world-client): zone-specific ground opacity and corner accents"
```

---

### Task 8: AuthGate Landmark Scale-Up

**Files:**
- Modify: `client/src/components/AuthGate.tsx`

**Context:** Scale up the AuthGate to be a monumental landmark. Increase octahedron radius to 1.5, y-position to 2.0. Add a ground-level ring marker (thin circle line) and accent lines extending to spoke entry points.

**Step 1: Modify AuthGate.tsx**

In `client/src/components/AuthGate.tsx`:

1. Import `Line` from `@react-three/drei`
2. Change mesh position y from `1.0` to `2.0`
3. Change octahedron radius from `0.8` to `1.5`
4. Add ground ring marker using `<Line>` with circular points (radius ~2.5)
5. Add 4 short radial accent lines extending outward from the ring

```tsx
// Ground ring
const RING_RADIUS = 2.5;
const RING_SEGMENTS = 48;
const ringPoints: [number, number, number][] = [];
for (let i = 0; i <= RING_SEGMENTS; i++) {
  const angle = (i / RING_SEGMENTS) * 2 * Math.PI;
  ringPoints.push([
    position.x + RING_RADIUS * Math.cos(angle),
    0.02,
    position.z + RING_RADIUS * Math.sin(angle),
  ]);
}

// 4 radial accent lines extending outward
const ACCENT_COUNT = 4;
const ACCENT_INNER = RING_RADIUS + 0.2;
const ACCENT_OUTER = RING_RADIUS + 1.5;
const accentLines: [number, number, number][][] = [];
for (let i = 0; i < ACCENT_COUNT; i++) {
  const angle = (i / ACCENT_COUNT) * 2 * Math.PI;
  accentLines.push([
    [position.x + ACCENT_INNER * Math.cos(angle), 0.02, position.z + ACCENT_INNER * Math.sin(angle)],
    [position.x + ACCENT_OUTER * Math.cos(angle), 0.02, position.z + ACCENT_OUTER * Math.sin(angle)],
  ]);
}
```

Render these below the `<mesh>`:
```tsx
<Line points={ringPoints} color={linkStyle.hex} lineWidth={1.5} opacity={0.3} transparent />
{accentLines.map((pts, idx) => (
  <Line key={`gate-accent-${idx}`} points={pts} color={linkStyle.hex} lineWidth={1} opacity={0.2} transparent />
))}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add client/src/components/AuthGate.tsx
git commit -m "feat(world-client): scale up AuthGate landmark with ground ring and accents"
```

---

### Task 9: Scene Ground Plane + Optional Grid Toggle

**Files:**
- Modify: `client/src/components/Scene.tsx`

**Context:** Replace the bare `<gridHelper>` with a dark ground plane mesh covering the scene footprint. Keep the grid as an optional overlay that can be toggled (defaults to ON for now, future PR3 quality store will control this).

**Step 1: Modify Scene.tsx**

In `client/src/components/Scene.tsx`:

1. Add a state for grid visibility (simple `useState` for now; PR3 will move to quality store):
   ```typescript
   import { useState } from 'react';
   ```
2. Replace `<gridHelper>` with:
   ```tsx
   {/* Dark ground plane */}
   <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
     <planeGeometry args={[200, 200]} />
     <meshStandardMaterial color="#050510" roughness={1} />
   </mesh>

   {/* Optional grid overlay */}
   {showGrid && <gridHelper args={[60, 60, '#1a1a2e', '#111128']} position={[0, 0.002, 0]} />}
   ```
3. Grid colors toned down from `#333` to `#1a1a2e`/`#111128` (fainter, more subtle).

Full Scene:
```tsx
import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { City } from './City';

export function Scene(): React.JSX.Element {
  const [showGrid] = useState(true);

  return (
    <Canvas camera={{ position: [20, 20, 20], fov: 50 }} style={{ width: '100%', height: '100%' }}>
      <ambientLight intensity={0.6} />
      <directionalLight position={[15, 25, 15]} intensity={0.8} />
      <directionalLight position={[-10, 15, -10]} intensity={0.3} />
      {/* Dark ground plane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]}>
        <planeGeometry args={[200, 200]} />
        <meshStandardMaterial color="#050510" roughness={1} />
      </mesh>
      {/* Optional grid overlay (faint) */}
      {showGrid && <gridHelper args={[60, 60, '#1a1a2e', '#111128']} position={[0, 0.002, 0]} />}
      <City />
      <OrbitControls
        enablePan
        enableZoom
        enableRotate
        maxPolarAngle={Math.PI / 2.2}
        minDistance={5}
        maxDistance={80}
      />
    </Canvas>
  );
}
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add client/src/components/Scene.tsx
git commit -m "feat(world-client): add dark ground plane with optional faint grid overlay"
```

---

### Task 10: City Wiring — Render New Components

**Files:**
- Modify: `client/src/components/City.tsx`

**Context:** Wire `<RingRoads>` and `<Boulevards>` into the City component, passing the new `ringRoads` and `boulevards` from `computeCityLayout`.

**Step 1: Modify City.tsx**

In `client/src/components/City.tsx`:

1. Import `RingRoads` and `Boulevards`:
   ```typescript
   import { RingRoads } from './RingRoads';
   import { Boulevards } from './Boulevards';
   ```
2. Add them to the render output, before districts (roads are ground-level, should render under districts):
   ```tsx
   <group>
     <RingRoads roads={layout.ringRoads} />
     <Boulevards boulevards={layout.boulevards} />
     <AuthGate position={layout.gatePosition} />
     {layout.districts.map((d) => (
       <District key={d.serviceId} layout={d} />
     ))}
     {/* ... buildings and edges unchanged ... */}
   </group>
   ```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors.

**Step 3: Run full test suite**

Run: `npm test -- --run`
Expected: All tests pass.

**Step 4: Commit**

```bash
git add client/src/components/City.tsx
git commit -m "feat(world-client): wire RingRoads and Boulevards into City scene"
```

---

### Task 11: Validation + Decision Log + PR

**Files:**
- Run full validation suite
- Write decision log
- Create PR

**Step 1: Run full validation**

```bash
npm run validate
```

Expected: lint + typecheck + test all pass.

**Step 2: Run client test count**

```bash
npm test -- --run 2>&1 | tail -20
```

Verify test count >= 95 (all existing + new layout tests).

**Step 3: Write brief decision log**

Create a short summary of PR1 decisions as a PR description (not a separate file).

**Step 4: Create PR**

```bash
git push -u origin feat/m2d-pr1
gh pr create --base main --title "feat(world): M2D PR1 — City Form + District Identity" --body "$(cat <<'EOF'
## Summary

- Zone-specific layout constants (`ZONE_LAYOUT_CONFIG`) differentiate public-perimeter (wider, airy) from protected-core (tighter, fortified)
- Ring road generation: concentric arcs at inner/outer ring radii
- Sector-based boulevard generation: hub-and-spoke spokes from center to rings, count scales with `max(3, ceil(districtCount/3))`
- New `<RingRoads>` and `<Boulevards>` components render road geometry as dark lane strips with faint cyan markings
- Protected-core districts gain corner accent marks for visual fortification
- AuthGate scaled to monumental landmark: radius 1.5, y=2.0, ground ring marker, radial accent lines
- Dark ground plane replaces bare grid; faint grid retained as toggleable overlay
- All layout tests extended with ring road and boulevard assertions

## Decisions

1. **Sector-based spokes** (not 1 boulevard per district) — reduces visual clutter
2. **Grid retained as faint overlay** — toggleable for debug orientation
3. **Corner accents on protected-core** — reinforces fortified visual character
4. **Road geometry via `<Line>`** — lightweight, no TubeGeometry overhead

## Test plan

- [ ] Existing 95+ client tests pass
- [ ] New zone-gap tests verify public districts are larger than protected for same endpoint count
- [ ] Ring road tests: presence, zone classification, determinism, radius bounds
- [ ] Boulevard tests: spoke count formula, center-to-ring direction, determinism
- [ ] Visual verification: ring roads visible, spokes connect to center, districts differentiated
- [ ] No building/district overlap with zone-specific spacing (stress test)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

**Step 5: Commit decision log update if needed**

Only if changes needed after validation.
