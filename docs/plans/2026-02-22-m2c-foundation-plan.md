# M2C Foundation Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Map M2B semantic state to Light Tron visuals — link-state colors, radial zone layout, auth-gate node, semantic overlays — all client-only, no wire changes.

**Architecture:** Visual token maps (`LINK_STATE_COLORS`, `ZONE_STYLES`) drive Building/Edge/District materials. Layout service computes radial concentric rings (auth-hub center, protected-core inner, public-perimeter outer) with dynamic radii. Components read `endpointSemantics` and `authGate` from store. Visual precedence: selection/hover > linkState > zone > method color.

**Tech Stack:** TypeScript, React 19, React Three Fiber 9, @react-three/drei 10, Zustand 5, Vitest 4

**Branch:** `feat/m2c-foundation` (from `main`)

---

## Task 1: Visual token maps

**Files:**
- Modify: `client/src/utils/colors.ts`
- Modify: `client/src/__tests__/colors.test.ts`

**Step 1: Write failing tests**

Add to `client/src/__tests__/colors.test.ts`:

```typescript
import { LINK_STATE_COLORS, ZONE_STYLES } from '../utils/colors';
import type { LinkState, Zone } from '../types/semantic';

const ALL_LINK_STATES: LinkState[] = ['ok', 'degraded', 'blocked', 'unknown'];
const ALL_ZONES: Zone[] = ['public-perimeter', 'protected-core', 'auth-hub'];

describe('LINK_STATE_COLORS', () => {
  it('has entry for every link state', () => {
    for (const state of ALL_LINK_STATES) {
      expect(LINK_STATE_COLORS[state]).toBeDefined();
    }
  });

  it('each entry has hex, emissiveIntensity, opacity', () => {
    for (const state of ALL_LINK_STATES) {
      const entry = LINK_STATE_COLORS[state];
      expect(entry.hex).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(typeof entry.emissiveIntensity).toBe('number');
      expect(typeof entry.opacity).toBe('number');
    }
  });

  it('blocked emissive is lower than degraded', () => {
    expect(LINK_STATE_COLORS.blocked.emissiveIntensity).toBeLessThan(
      LINK_STATE_COLORS.degraded.emissiveIntensity
    );
  });

  it('blocked opacity is lowest among active states', () => {
    expect(LINK_STATE_COLORS.blocked.opacity).toBeLessThanOrEqual(
      LINK_STATE_COLORS.degraded.opacity
    );
    expect(LINK_STATE_COLORS.blocked.opacity).toBeLessThanOrEqual(
      LINK_STATE_COLORS.ok.opacity
    );
  });

  it('each entry has edgeStyle', () => {
    expect(LINK_STATE_COLORS.ok.edgeStyle).toBe('solid');
    expect(LINK_STATE_COLORS.degraded.edgeStyle).toBe('solid');
    expect(LINK_STATE_COLORS.blocked.edgeStyle).toBe('dashed');
    expect(LINK_STATE_COLORS.unknown.edgeStyle).toBe('solid');
  });
});

describe('ZONE_STYLES', () => {
  it('has entry for every zone', () => {
    for (const zone of ALL_ZONES) {
      expect(ZONE_STYLES[zone]).toBeDefined();
    }
  });

  it('each entry has floorColor', () => {
    for (const zone of ALL_ZONES) {
      expect(ZONE_STYLES[zone].floorColor).toMatch(/^#[0-9A-Fa-f]{6}$/);
    }
  });
});
```

**Step 2: Run test to verify failure**

Run: `cd client && npx vitest run src/__tests__/colors.test.ts`
Expected: FAIL — `LINK_STATE_COLORS` is not exported

**Step 3: Implement token maps**

Add to `client/src/utils/colors.ts`:

```typescript
import type { LinkState, Zone } from '../types/semantic';

export interface LinkStateStyle {
  hex: string;
  emissiveIntensity: number;
  opacity: number;
  edgeStyle: 'solid' | 'dashed';
}

export interface ZoneStyle {
  floorColor: string;
  borderColor?: string | undefined;
}

export const LINK_STATE_COLORS: Record<LinkState, LinkStateStyle> = {
  ok: { hex: '#00E5FF', emissiveIntensity: 0.15, opacity: 0.8, edgeStyle: 'solid' },
  degraded: { hex: '#FFB300', emissiveIntensity: 0.3, opacity: 0.6, edgeStyle: 'solid' },
  blocked: { hex: '#FF1744', emissiveIntensity: 0.1, opacity: 0.3, edgeStyle: 'dashed' },
  unknown: { hex: '#616161', emissiveIntensity: 0.0, opacity: 0.2, edgeStyle: 'solid' },
};

export const ZONE_STYLES: Record<Zone, ZoneStyle> = {
  'public-perimeter': { floorColor: '#0a0a1e' },
  'protected-core': { floorColor: '#0d0a1e', borderColor: '#00E5FF' },
  'auth-hub': { floorColor: '#1a0a2e' },
};
```

**Step 4: Run tests**

Run: `cd client && npx vitest run src/__tests__/colors.test.ts`
Expected: all PASS

**Step 5: Commit**

```bash
git add client/src/utils/colors.ts client/src/__tests__/colors.test.ts
git commit -m "feat(world-client): add link-state + zone visual token maps (M2C)

LINK_STATE_COLORS: ok/degraded/blocked/unknown with emissive/opacity/edgeStyle.
ZONE_STYLES: public-perimeter/protected-core/auth-hub floor colors.
Blocked emissive (0.1) below degraded (0.3) — cut/off not energetic.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Radial zone layout

**Files:**
- Modify: `client/src/services/layout.service.ts`
- Modify: `client/src/__tests__/layout.service.test.ts`
- Modify: `client/src/utils/constants.ts`

**Step 1: Write failing tests**

Replace/extend `client/src/__tests__/layout.service.test.ts`. Keep existing `makeService` and `makeEndpoint` helpers but update `makeEndpoint` to accept `hasAuth` parameter. Add new tests for radial layout:

```typescript
// Update makeEndpoint signature to accept hasAuth:
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

// Add new describe block:
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
    const services = [
      makeService('s1', 'Auth', 1),
      makeService('s2', 'Health', 1),
    ];
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

    // Verify no district overlap
    for (let i = 0; i < result.districts.length; i++) {
      for (let j = i + 1; j < result.districts.length; j++) {
        const a = result.districts[i]!;
        const b = result.districts[j]!;
        const overlapX = a.bounds.minX < b.bounds.maxX && a.bounds.maxX > b.bounds.minX;
        const overlapZ = a.bounds.minZ < b.bounds.maxZ && a.bounds.maxZ > b.bounds.minZ;
        expect(overlapX && overlapZ).toBe(false);
      }
    }

    // Verify no building overlap
    for (let i = 0; i < result.buildings.length; i++) {
      for (let j = i + 1; j < result.buildings.length; j++) {
        const a = result.buildings[i]!;
        const b = result.buildings[j]!;
        const dx = Math.abs(a.position.x - b.position.x);
        const dz = Math.abs(a.position.z - b.position.z);
        const minSep = BUILDING_BASE_SIZE * 0.5;
        expect(dx >= minSep || dz >= minSep).toBe(true);
      }
    }
  });

  it('dynamic radii grow with service count', () => {
    const make = (count: number) => {
      const svcs = Array.from({ length: count }, (_, i) =>
        makeService(`s${i}`, `Svc${i}`, 2)
      );
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
```

**Step 2: Run tests to verify failure**

Run: `cd client && npx vitest run src/__tests__/layout.service.test.ts`
Expected: FAIL — `gatePosition` and `zone` don't exist on layout types

**Step 3: Update constants**

Add to `client/src/utils/constants.ts`:

```typescript
/** Minimum radius for inner ring (protected-core) */
export const MIN_INNER_RADIUS = 8;

/** Minimum radius for outer ring (public-perimeter) */
export const MIN_OUTER_RADIUS = 16;

/** Ring padding between inner and outer */
export const RING_GAP = 6;
```

**Step 4: Rewrite layout service**

Replace `client/src/services/layout.service.ts` with radial zone layout. Key changes:

1. `DistrictLayout` gets a `zone` field: `zone: 'public-perimeter' | 'protected-core'`
2. `CityLayout` gets `gatePosition: Position3D`
3. Zone classification: majority `hasAuth` in service → `protected-core`, else `public-perimeter`
4. Dynamic radius: `R = max(minRadius, totalArcWidth / (2 * PI)) + padding`
5. Districts placed angularly around rings, sorted alphabetically within each zone
6. Within-district sub-grid layout unchanged (same building placement logic)

The implementation preserves the existing `BuildingLayout`, `DistrictLayout` (extended), `CityLayout` (extended) interfaces and the `computeCityLayout` function signature.

```typescript
import type { WorldService, WorldEndpoint } from '../types/world';
import type { Zone } from '../types/semantic';
import {
  BUILDING_BASE_SIZE,
  BUILDING_GAP,
  DISTRICT_PADDING,
  DISTRICT_GAP,
  MIN_HEIGHT,
  MAX_HEIGHT,
  MIN_INNER_RADIUS,
  MIN_OUTER_RADIUS,
  RING_GAP,
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

export interface CityLayout {
  buildings: BuildingLayout[];
  districts: DistrictLayout[];
  gatePosition: Position3D;
}

type ServiceZone = 'public-perimeter' | 'protected-core';

function classifyServiceZone(
  serviceId: string,
  endpointsByService: Map<string, WorldEndpoint[]>
): ServiceZone {
  const eps = endpointsByService.get(serviceId) ?? [];
  const authCount = eps.filter((e) => e.hasAuth).length;
  // Any auth endpoint → protected (conservative)
  return authCount > 0 ? 'protected-core' : 'public-perimeter';
}

function computeDistrictSize(endpointCount: number): { width: number; depth: number } {
  const cols = Math.max(1, Math.ceil(Math.sqrt(endpointCount)));
  const rows = Math.max(1, Math.ceil(endpointCount / cols));
  const width = cols * (BUILDING_BASE_SIZE + BUILDING_GAP) - BUILDING_GAP + DISTRICT_PADDING * 2;
  const depth = rows * (BUILDING_BASE_SIZE + BUILDING_GAP) - BUILDING_GAP + DISTRICT_PADDING * 2;
  return { width, depth };
}

function computeRingRadius(
  districts: { width: number; depth: number }[],
  minRadius: number
): number {
  if (districts.length === 0) return minRadius;
  // Total arc needed = sum of district diagonals + gaps
  const totalArc = districts.reduce(
    (sum, d) => sum + Math.max(d.width, d.depth) + DISTRICT_GAP,
    0
  );
  const computed = totalArc / (2 * Math.PI);
  return Math.max(minRadius, computed);
}

export function computeCityLayout(
  services: WorldService[],
  endpoints: WorldEndpoint[]
): CityLayout {
  const gatePosition: Position3D = { x: 0, y: 0, z: 0 };

  if (services.length === 0 || endpoints.length === 0) {
    return { buildings: [], districts: [], gatePosition };
  }

  const sortedServices = [...services].sort((a, b) => a.tag.localeCompare(b.tag));

  const endpointsByService = new Map<string, WorldEndpoint[]>();
  for (const ep of endpoints) {
    const list = endpointsByService.get(ep.serviceId) ?? [];
    list.push(ep);
    endpointsByService.set(ep.serviceId, list);
  }

  const maxParams = Math.max(1, ...endpoints.map((e) => e.parameterCount));

  // Classify and split services by zone
  const innerServices: WorldService[] = []; // protected-core
  const outerServices: WorldService[] = []; // public-perimeter

  for (const svc of sortedServices) {
    const zone = classifyServiceZone(svc.id, endpointsByService);
    if (zone === 'protected-core') innerServices.push(svc);
    else outerServices.push(svc);
  }

  // Compute sizes for dynamic radius
  const innerSizes = innerServices.map((s) => {
    const eps = endpointsByService.get(s.id) ?? [];
    return computeDistrictSize(eps.length);
  });
  const outerSizes = outerServices.map((s) => {
    const eps = endpointsByService.get(s.id) ?? [];
    return computeDistrictSize(eps.length);
  });

  const innerRadius = computeRingRadius(innerSizes, MIN_INNER_RADIUS);
  const outerRadius = Math.max(
    innerRadius + RING_GAP,
    computeRingRadius(outerSizes, MIN_OUTER_RADIUS)
  );

  const buildings: BuildingLayout[] = [];
  const districts: DistrictLayout[] = [];

  // Place districts on ring
  function placeRing(
    ring: WorldService[],
    sizes: { width: number; depth: number }[],
    radius: number,
    zone: ServiceZone
  ): void {
    const count = ring.length;
    if (count === 0) return;

    for (let i = 0; i < count; i++) {
      const service = ring[i]!;
      const size = sizes[i]!;
      const angle = (i / count) * 2 * Math.PI - Math.PI / 2; // start from top

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

      // Place buildings within district
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
  }

  placeRing(innerServices, innerSizes, innerRadius, 'protected-core');
  placeRing(outerServices, outerSizes, outerRadius, 'public-perimeter');

  return { buildings, districts, gatePosition };
}
```

**Step 5: Update existing tests**

Existing tests that reference the old grid layout need updating:
- `makeEndpoint` helper needs `hasAuth` parameter
- Tests checking alphabetical sorting now check within-zone sorting
- "places all buildings within their district bounds" test still applies
- "handles multiple services" test still checks unique positions

Update the existing tests to work with the radial layout (positions change, but determinism, bounds, and uniqueness still hold).

**Step 6: Run all tests**

Run: `cd client && npx vitest run src/__tests__/layout.service.test.ts`
Expected: all PASS

**Step 7: Commit**

```bash
git add client/src/services/layout.service.ts client/src/__tests__/layout.service.test.ts client/src/utils/constants.ts
git commit -m "feat(world-client): radial zone layout with dynamic radii (M2C)

Auth-hub center, protected-core inner ring, public-perimeter outer.
Dynamic radius from district count/size. Zone classification by hasAuth.
No overlap stress-tested at 20 services.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Building semantic rendering

**Files:**
- Modify: `client/src/components/Building.tsx`

**Step 1: Update Building component**

Read `endpointSemantics[endpoint.id]` from store. Map linkState to emissive color and opacity. Maintain selection/hover override (visual precedence).

```typescript
import { useRef, useState } from 'react';
import type { Mesh } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { WorldEndpoint } from '../types/world';
import type { BuildingLayout } from '../services/layout.service';
import { METHOD_COLORS, LINK_STATE_COLORS } from '../utils/colors';
import { useSelectionStore } from '../stores/selection.store';
import { useWorldStore } from '../stores/world.store';

interface BuildingProps {
  layout: BuildingLayout;
  endpoint: WorldEndpoint;
}

export function Building({ layout, endpoint }: BuildingProps): React.JSX.Element {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const selectedId = useSelectionStore((s) => s.selectedId);
  const setSelected = useSelectionStore((s) => s.setSelected);
  const semantics = useWorldStore((s) => s.endpointSemantics[endpoint.id]);
  const isSelected = selectedId === endpoint.id;
  const methodColor = METHOD_COLORS[endpoint.method];

  const linkStyle = semantics ? LINK_STATE_COLORS[semantics.linkState] : LINK_STATE_COLORS.unknown;

  // Visual precedence: selection/hover > linkState > method color
  const baseColor = isSelected ? '#ffffff' : methodColor;
  const emissiveColor = hovered ? methodColor : linkStyle.hex;
  const emissiveIntensity = hovered ? 0.4 : linkStyle.emissiveIntensity;
  const opacity = isSelected || hovered ? 1.0 : linkStyle.opacity;

  const handleClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    setSelected(isSelected ? null : endpoint.id);
  };

  return (
    <mesh
      ref={meshRef}
      position={[layout.position.x, layout.height / 2, layout.position.z]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <boxGeometry args={[layout.width, layout.height, layout.depth]} />
      <meshStandardMaterial
        color={baseColor}
        emissive={emissiveColor}
        emissiveIntensity={emissiveIntensity}
        roughness={0.6}
        metalness={0.1}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}
```

**Step 2: Run client tests**

Run: `cd client && npx vitest run`
Expected: all PASS (no component render tests — Building is a visual component)

**Step 3: Commit**

```bash
git add client/src/components/Building.tsx
git commit -m "feat(world-client): semantic link-state glow on buildings (M2C)

emissive color + intensity from linkState tokens.
Blocked = dim/off (0.1), degraded = amber (0.3), ok = cyan (0.15).
Selection/hover overrides linkState for interaction clarity.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Edge semantic rendering + auth-gated routing

**Files:**
- Modify: `client/src/components/Edges.tsx`
- Add to: `client/src/__tests__/colors.test.ts` (edge routing helper test)

**Step 1: Write edge routing tests**

Add to `client/src/__tests__/colors.test.ts` (or create separate test if cleaner):

Create `client/src/__tests__/edge-routing.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { computeEdgePoints } from '../components/Edges';
import type { Position3D } from '../services/layout.service';

describe('computeEdgePoints — edge routing', () => {
  const gate: Position3D = { x: 0, y: 0, z: 0 };
  const source: Position3D = { x: -10, y: 0, z: 0 };
  const target: Position3D = { x: 10, y: 0, z: 0 };

  it('auth-gated edge routes through gate center', () => {
    const points = computeEdgePoints(source, target, gate, true);
    expect(points).toHaveLength(3);
    expect(points[1]).toEqual([0, 0.05, 0]);
  });

  it('non-auth-gated edge routes direct', () => {
    const points = computeEdgePoints(source, target, gate, false);
    expect(points).toHaveLength(2);
  });
});
```

**Step 2: Implement Edges with semantic coloring and routing**

```typescript
import { Line } from '@react-three/drei';
import type { WorldEdge, WorldEndpoint } from '../types/world';
import type { BuildingLayout, Position3D } from '../services/layout.service';
import type { SemanticState } from '../types/semantic';
import { LINK_STATE_COLORS } from '../utils/colors';
import type { LinkState } from '../types/semantic';

interface EdgesProps {
  edges: WorldEdge[];
  buildingLayouts: BuildingLayout[];
  endpointSemantics: Record<string, SemanticState>;
  endpointMap: Map<string, WorldEndpoint>;
  gatePosition: Position3D;
}

/** Determine worst linkState between two endpoints for edge coloring */
function worstLinkState(a: LinkState | undefined, b: LinkState | undefined): LinkState {
  const precedence: LinkState[] = ['blocked', 'unknown', 'degraded', 'ok'];
  const aIdx = precedence.indexOf(a ?? 'unknown');
  const bIdx = precedence.indexOf(b ?? 'unknown');
  return precedence[Math.min(aIdx, bIdx)] ?? 'unknown';
}

/** Compute edge waypoints — auth-gated edges route through gate center */
export function computeEdgePoints(
  source: Position3D,
  target: Position3D,
  gatePosition: Position3D,
  isAuthGated: boolean
): [number, number, number][] {
  const y = 0.05;
  if (isAuthGated) {
    return [
      [source.x, y, source.z],
      [gatePosition.x, y, gatePosition.z],
      [target.x, y, target.z],
    ];
  }
  return [
    [source.x, y, source.z],
    [target.x, y, target.z],
  ];
}

export function Edges({
  edges,
  buildingLayouts,
  endpointSemantics,
  endpointMap,
  gatePosition,
}: EdgesProps): React.JSX.Element {
  const posMap = new Map(buildingLayouts.map((b) => [b.endpointId, b.position]));

  return (
    <group>
      {edges.map((edge) => {
        const source = posMap.get(edge.sourceId);
        const target = posMap.get(edge.targetId);
        if (!source || !target) return null;

        const sourceEp = endpointMap.get(edge.sourceId);
        const targetEp = endpointMap.get(edge.targetId);
        const sourceSem = endpointSemantics[edge.sourceId];
        const targetSem = endpointSemantics[edge.targetId];
        const edgeLinkState = worstLinkState(sourceSem?.linkState, targetSem?.linkState);
        const style = LINK_STATE_COLORS[edgeLinkState];

        // Auth-gated: source is public (!hasAuth) AND target is protected (hasAuth)
        const isAuthGated = !!sourceEp && !sourceEp.hasAuth && !!targetEp && targetEp.hasAuth;
        const points = computeEdgePoints(source, target, gatePosition, isAuthGated);

        return (
          <Line
            key={edge.id}
            points={points}
            color={style.hex}
            lineWidth={style.edgeStyle === 'dashed' ? 1 : 1.5}
            opacity={style.opacity}
            transparent
            dashed={style.edgeStyle === 'dashed'}
            dashSize={style.edgeStyle === 'dashed' ? 0.5 : undefined}
            gapSize={style.edgeStyle === 'dashed' ? 0.3 : undefined}
          />
        );
      })}
    </group>
  );
}
```

**Step 3: Run tests**

Run: `cd client && npx vitest run`
Expected: all PASS

**Step 4: Commit**

```bash
git add client/src/components/Edges.tsx client/src/__tests__/edge-routing.test.ts
git commit -m "feat(world-client): semantic edge coloring + auth-gated routing (M2C)

Edge color = worst linkState of source/target pair.
Blocked edges dashed. Auth-gated edges route through gate center.
Non-auth cross-zone edges direct (preserve topology).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: District zone styling

**Files:**
- Modify: `client/src/components/District.tsx`

**Step 1: Update District with zone visuals**

```typescript
import { Text, Line } from '@react-three/drei';
import type { DistrictLayout } from '../services/layout.service';
import { GROUND_Y } from '../utils/constants';
import { ZONE_STYLES } from '../utils/colors';

interface DistrictProps {
  layout: DistrictLayout;
}

export function District({ layout }: DistrictProps): React.JSX.Element {
  const width = layout.bounds.maxX - layout.bounds.minX;
  const depth = layout.bounds.maxZ - layout.bounds.minZ;
  const zoneStyle = ZONE_STYLES[layout.zone];

  // Border wireframe for protected-core
  const borderPoints: [number, number, number][] = [
    [layout.bounds.minX, GROUND_Y + 0.01, layout.bounds.minZ],
    [layout.bounds.maxX, GROUND_Y + 0.01, layout.bounds.minZ],
    [layout.bounds.maxX, GROUND_Y + 0.01, layout.bounds.maxZ],
    [layout.bounds.minX, GROUND_Y + 0.01, layout.bounds.maxZ],
    [layout.bounds.minX, GROUND_Y + 0.01, layout.bounds.minZ],
  ];

  return (
    <group>
      {/* Ground plane */}
      <mesh position={[layout.center.x, GROUND_Y, layout.center.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color={zoneStyle.floorColor} transparent opacity={0.6} roughness={0.9} />
      </mesh>

      {/* Zone border (protected-core only) */}
      {zoneStyle.borderColor && (
        <Line
          points={borderPoints}
          color={zoneStyle.borderColor}
          lineWidth={1}
          opacity={0.3}
          transparent
        />
      )}

      {/* Service tag label */}
      <Text
        position={[layout.bounds.minX + 0.5, 0.1, layout.bounds.minZ - 0.3]}
        fontSize={0.6}
        color="#888888"
        anchorX="left"
        anchorY="middle"
      >
        {layout.tag}
      </Text>
    </group>
  );
}
```

**Step 2: Run client tests**

Run: `cd client && npx vitest run`
Expected: all PASS

**Step 3: Commit**

```bash
git add client/src/components/District.tsx
git commit -m "feat(world-client): zone-styled district ground planes (M2C)

protected-core: darker floor + cyan border wireframe.
public-perimeter: neutral floor, no border.
Zone styling is background only — linkState always wins.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: AuthGate component + City wiring

**Files:**
- Create: `client/src/components/AuthGate.tsx`
- Modify: `client/src/components/City.tsx`

**Step 1: Create AuthGate component**

```typescript
import { useRef } from 'react';
import type { Mesh } from 'three';
import { useWorldStore } from '../stores/world.store';
import { LINK_STATE_COLORS } from '../utils/colors';
import type { Position3D } from '../services/layout.service';

interface AuthGateProps {
  position: Position3D;
}

export function AuthGate({ position }: AuthGateProps): React.JSX.Element {
  const meshRef = useRef<Mesh>(null);
  const authGate = useWorldStore((s) => s.authGate);
  const linkStyle = LINK_STATE_COLORS[authGate.linkState];

  return (
    <mesh
      ref={meshRef}
      position={[position.x, 1.0, position.z]}
    >
      <octahedronGeometry args={[0.8, 0]} />
      <meshStandardMaterial
        color={linkStyle.hex}
        emissive={linkStyle.hex}
        emissiveIntensity={authGate.open ? 0.5 : 0.1}
        roughness={0.3}
        metalness={0.4}
        transparent={!authGate.open}
        opacity={authGate.open ? 1.0 : 0.4}
      />
    </mesh>
  );
}
```

**Step 2: Update City component**

```typescript
import { useMemo } from 'react';
import { useWorldStore } from '../stores/world.store';
import { computeCityLayout } from '../services/layout.service';
import { Building } from './Building';
import { Edges } from './Edges';
import { District } from './District';
import { AuthGate } from './AuthGate';

export function City(): React.JSX.Element | null {
  const services = useWorldStore((s) => s.services);
  const endpoints = useWorldStore((s) => s.endpoints);
  const edges = useWorldStore((s) => s.edges);
  const endpointSemantics = useWorldStore((s) => s.endpointSemantics);

  const layout = useMemo(() => computeCityLayout(services, endpoints), [services, endpoints]);

  const endpointMap = useMemo(() => new Map(endpoints.map((e) => [e.id, e])), [endpoints]);

  if (endpoints.length === 0) return null;

  return (
    <group>
      <AuthGate position={layout.gatePosition} />
      {layout.districts.map((d) => (
        <District key={d.serviceId} layout={d} />
      ))}
      {layout.buildings.map((b) => {
        const endpoint = endpointMap.get(b.endpointId);
        if (!endpoint) return null;
        return <Building key={b.endpointId} layout={b} endpoint={endpoint} />;
      })}
      <Edges
        edges={edges}
        buildingLayouts={layout.buildings}
        endpointSemantics={endpointSemantics}
        endpointMap={endpointMap}
        gatePosition={layout.gatePosition}
      />
    </group>
  );
}
```

**Step 3: Run client tests**

Run: `cd client && npx vitest run`
Expected: all PASS

**Step 4: Commit**

```bash
git add client/src/components/AuthGate.tsx client/src/components/City.tsx
git commit -m "feat(world-client): auth-gate node + city wiring (M2C)

Octahedron mesh at world center. Open = cyan glow, closed = dim red.
City passes semantics to Edges, renders AuthGate.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: HUD link-state legend

**Files:**
- Modify: `client/src/components/HUD.tsx`

**Step 1: Add link-state legend section**

Add below the existing method legend:

```typescript
import { useWorldStore } from '../stores/world.store';
import { METHOD_COLORS, METHOD_LABELS, LINK_STATE_COLORS } from '../utils/colors';
import type { HttpMethod } from '../types/world';
import type { LinkState } from '../types/semantic';

const LEGEND_METHODS: HttpMethod[] = ['get', 'post', 'put', 'patch', 'delete'];

const LEGEND_LINK_STATES: { state: LinkState; label: string }[] = [
  { state: 'ok', label: 'OK' },
  { state: 'degraded', label: 'Degraded' },
  { state: 'blocked', label: 'Blocked' },
  { state: 'unknown', label: 'Unknown' },
];

// In the JSX, after the method legend div, add:
{/* Link state legend */}
<div
  style={{
    display: 'flex',
    flexDirection: 'column',
    gap: '4px',
    marginTop: '16px',
    borderTop: '1px solid #333',
    paddingTop: '12px',
  }}
>
  <div style={{ fontSize: '10px', color: '#666', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '4px' }}>
    Link State
  </div>
  {LEGEND_LINK_STATES.map(({ state, label }) => (
    <div
      key={state}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        fontSize: '11px',
        color: '#aaa',
      }}
    >
      <div
        style={{
          width: '12px',
          height: '12px',
          borderRadius: '50%',
          backgroundColor: LINK_STATE_COLORS[state].hex,
          opacity: LINK_STATE_COLORS[state].opacity,
          flexShrink: 0,
        }}
      />
      {label}
    </div>
  ))}
</div>
```

**Step 2: Run client tests**

Run: `cd client && npx vitest run`
Expected: all PASS

**Step 3: Commit**

```bash
git add client/src/components/HUD.tsx
git commit -m "feat(world-client): link-state legend in HUD overlay (M2C)

ok/degraded/blocked/unknown with color dots.
Separated from method legend with divider.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: SidePanel semantic badge

**Files:**
- Modify: `client/src/components/SidePanel.tsx`

**Step 1: Add semantic state display**

Read `endpointSemantics[selectedId]` and `endpointOverlays[selectedId]` from store. Show linkState badge, reason, zone, health status, and metrics summary after the existing metadata section.

Add to SidePanel between the existing metadata grid and the related endpoints section:

```typescript
// New store reads at component top:
const endpointSemantics = useWorldStore((s) => s.endpointSemantics);
const endpointOverlays = useWorldStore((s) => s.endpointOverlays);

// In JSX, after the metadata grid:
const semantics = endpoint ? endpointSemantics[endpoint.id] : undefined;
const overlay = endpoint ? endpointOverlays[endpoint.id] : undefined;

{/* Semantic state */}
{semantics && (
  <div style={{ marginBottom: '20px' }}>
    <div style={{ fontSize: '12px', color: '#888', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '8px' }}>
      Semantic State
    </div>
    <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: '8px 12px', fontSize: '13px' }}>
      <span style={{ color: '#888' }}>Link state</span>
      <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{
          width: '8px', height: '8px', borderRadius: '50%',
          backgroundColor: LINK_STATE_COLORS[semantics.linkState].hex,
          display: 'inline-block',
        }} />
        {semantics.linkState}
      </span>

      {semantics.reason && (
        <>
          <span style={{ color: '#888' }}>Reason</span>
          <span style={{ fontFamily: 'monospace', fontSize: '12px' }}>{semantics.reason}</span>
        </>
      )}

      <span style={{ color: '#888' }}>Zone</span>
      <span>{semantics.zone}</span>

      {overlay?.health && (
        <>
          <span style={{ color: '#888' }}>Health</span>
          <span>{overlay.health.status}</span>
        </>
      )}

      {overlay?.metrics && (
        <>
          <span style={{ color: '#888' }}>p95</span>
          <span>{overlay.metrics.p95.toFixed(0)}ms</span>
          <span style={{ color: '#888' }}>Error rate</span>
          <span>{(overlay.metrics.errorRate * 100).toFixed(1)}%</span>
        </>
      )}
    </div>
  </div>
)}
```

Add import at top: `import { LINK_STATE_COLORS } from '../utils/colors';`

**Step 2: Run client tests**

Run: `cd client && npx vitest run`
Expected: all PASS

**Step 3: Commit**

```bash
git add client/src/components/SidePanel.tsx
git commit -m "feat(world-client): semantic badge in side panel (M2C)

Shows linkState dot+label, reason, zone, health, p95, error rate.
Reads endpointSemantics + endpointOverlays from store.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Decision log + full validation + PR

**Files:**
- Modify: `docs/3d-world/FENICE_3D_World_Decision_Log.md`

**Step 1: Add M2C decisions**

Append to the `## 2026-02-22` section:

```markdown
8. Decisione: Light Tron scope per M2C Foundation.
   - Emissive glow su buildings, edge colorati e dashed per blocked. No bloom, no animazioni.
   - Precedenza visiva: selection/hover > linkState > zone > method color.
   - Blocked = cut/off (emissive 0.10, opacity 0.3, dashed edge). Non energetico.
   - Owner: Giuseppe (approvato)

9. Decisione: layout radiale a zone concentriche.
   - auth-hub al centro, protected-core ring interno, public-perimeter ring esterno.
   - Raggi dinamici calcolati da count/size dei district (no overlap).
   - Edge auth-gated passano per il gate center. Edge non-auth restano diretti.
   - Owner: Giuseppe (approvato)
```

**Step 2: Commit**

```bash
git add docs/3d-world/FENICE_3D_World_Decision_Log.md
git commit -m "docs(world): add M2C Light Tron + radial layout decisions

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

**Step 3: Full validation**

```bash
cd client && npm run lint && npm run typecheck && npx vitest run && npm run build
cd .. && npm run lint && npm run typecheck && npm test && npm run build
```

All must pass. No backend regression (415 tests). Client tests include new M2C tests.

**Step 4: FPS measurement**

Open dev server (`cd client && npm run dev`), load demo scene, check browser devtools Performance tab for FPS baseline. Note in PR body.

**Step 5: Push + create PR**

```bash
git push -u origin feat/m2c-foundation
gh pr create --base main --title "feat(world): M2C Foundation — Light Tron semantic visuals" --body "..."
```

PR body must include:
- File links to all modified/created files
- Before/after screenshots
- KPI note with FPS pre/post
- Dashed-edge rendering impact callout
- Validation output (all checks passing)
- Mapping: which component renders which semantic signal

---
