# M2D Visual Upgrade Design — High-Readability Tron City

Date: 2026-02-22
Status: Approved
Owner: Claude (runtime) + Giuseppe (approval)
Branches: `feat/m2d-pr1`, `feat/m2d-pr2`, `feat/m2d-pr3` (sequential)

## Goal

Transform the M2C semantic visualization into a living cyber-city for API operations. In 5 seconds the user must understand: (1) what is public vs protected, (2) where auth gate controls flow, (3) what is broken or degraded. Three sequential PRs: city form, flow language, camera + atmosphere.

## Creative North Star

Build a living cyber-city for API operations, not a debug graph. Light Tron aesthetic: emissive neon, dark backgrounds, clean geometry. Readability always wins over spectacle.

## Hard Constraints

1. No backend changes, no protocol/WS schema changes.
2. Do not change M2A/M2B semantics or rules.
3. Maintain deterministic layout behavior.
4. Keep low-motion and low-power fallback.
5. Preserve test stability (95 client + 415 backend).
6. Target >= 50 FPS in demo scene.

## Decisions (all Giuseppe-approved)

1. **Ring roads**: Rendered lane-like ground geometry, not implied. Mandatory for readability.
2. **Boulevards**: Hub-and-spoke by sector, NOT 1 boulevard per district. Districts connect to ring road, ring road connects to auth-hub via sector spokes.
3. **Grid**: Keep optional faint grid (toggle) for debug orientation. Do not remove entirely.
4. **Flow motion**: Lightweight dash markers (dashOffset animation), not particle emitters.
5. **Degraded jitter**: Deterministic from `hash(edge.id) + time`, no `Math.random()` per frame.
6. **Edge animation**: Shared global phase via single `useFrame`, not per-edge hooks. Use instancing for markers if graph grows.
7. **Quality auto-fallback**: Auto-demotion only (high->medium->low), never auto-promote in same session. Cooldown between tier drops to prevent oscillation.
8. **Bloom**: Default intensity 0.25-0.3 (lower than typical), threshold high, to avoid washing out semantic colors.

---

## PR1: City Form + District Identity

### Ring Road System

Two concentric ring roads rendered as low-height mesh strips on the ground plane:

- **Inner ring road** at `innerRadius`: connects adjacent protected-core districts
- **Outer ring road** at `outerRadius`: connects adjacent public-perimeter districts
- **Road geometry**: `PlaneGeometry` strips (width ~1.0, y=0.005), following arc segments between district positions on each ring
- **Road color**: muted cyan/blue base (`#0a1a3e` body, `#00E5FF` lane markings at 0.15 opacity)
- **Semantic-neutral in PR1**: PR2 overlays flow state onto roads

### Hub-and-Spoke Boulevards

NOT one boulevard per district. Instead, sector-based spoke system:

- Divide each ring into N sectors (e.g., 4 sectors for inner ring, 4-6 for outer)
- One radial spoke per sector connects the ring road to the auth-hub center
- Spoke placement: at sector midpoint angles, evenly distributed
- Districts connect to ring road, ring road connects to auth-hub via spokes
- Reduces visual clutter vs 1-spoke-per-district

Spoke count: `max(3, ceil(ring.districtCount / 3))` — scales but stays readable.

### District Archetypes

Zone-specific gap/padding constants differentiate district character:

| Zone | Building gap | District padding | Ground opacity | Border | Character |
|------|------------|-----------------|---------------|--------|-----------|
| public-perimeter | 0.8 (wider) | 2.5 | 0.5 | none | Open, airy |
| protected-core | 0.4 (tighter) | 1.5 | 0.7 | cyan wireframe + corner accents | Dense, fortified |
| auth-hub (gate) | — | — | — | ground ring marker | Monumental landmark |

Constants become zone-aware: `ZONE_LAYOUT_CONFIG` record mapping zone to `{ buildingGap, districtPadding, groundOpacity }`.

### Auth-Hub Landmark

Scale up from current octahedron:
- Radius: 1.5 (was 0.8), y-position: 2.0 (was 1.0)
- Ground-level ring marker: thin circle line at radius ~2.5 around gate
- 4 radial accent lines extending outward from gate to sector spoke entry points

### Ground Plane

- Replace bare 60x60 GridHelper with a dark ground plane covering scene footprint
- **Keep faint grid as optional overlay** (toggle via `useQualityStore` or HUD control) for debug/orientation
- Grid defaults to OFF in production, ON in dev mode

### Layout Service Changes

`computeCityLayout` returns extended `CityLayout`:

```
CityLayout {
  buildings: BuildingLayout[];
  districts: DistrictLayout[];
  gatePosition: Position3D;
  ringRoads: RoadSegment[];      // NEW: arc segments per ring
  boulevards: RoadSegment[];     // NEW: sector spokes to gate
}

RoadSegment {
  points: Position3D[];          // polyline waypoints
  width: number;
  zone: 'inner' | 'outer' | 'spoke';
}
```

### Component Changes

| File | Change |
|------|--------|
| `layout.service.ts` | Zone-specific gaps, ring road generation, sector boulevard generation |
| `constants.ts` | `ZONE_LAYOUT_CONFIG`, road width, spoke count formula |
| `City.tsx` | Render `<RingRoads>`, `<Boulevards>`, larger AuthGate |
| `District.tsx` | Protected-core corner accents, zone-specific ground opacity |
| `AuthGate.tsx` | Scale 1.5, y=2.0, ground ring, spoke accent lines |
| `Scene.tsx` | Dark ground plane, optional faint grid toggle |
| New: `RingRoads.tsx` | Ring road arc mesh rendering |
| New: `Boulevards.tsx` | Sector spoke mesh rendering |

### Tests

- Layout determinism preserved (same input = same roads + districts + boulevards)
- Zone-specific gaps applied correctly
- Ring road segment count matches district count on each ring
- Spoke count follows formula: `max(3, ceil(districtCount / 3))`
- No building/district overlap with zone-specific spacing
- Stress test: 20 services with roads, no overlap
- Road segments are within ring radius bounds

---

## PR2: Flow Language + Semantic Legibility

### Curved Flow Lanes

Replace straight `<Line>` edges with curved splines:

- `CatmullRomCurve3` with 3-4 control points per edge
- Control points: source → midpoint (elevated y=0.3) → target
- Auth-gated edges: source → approach → gate center → exit → target (5 control points)
- Render with `<Line>` using 20-30 interpolated points from curve
- No TubeGeometry (stays lightweight)

### Directional Flow Markers

Animated dashes along each edge spline:

| State | Marker behavior | Speed | Visual |
|-------|----------------|-------|--------|
| ok | Steady moving dashes | 1.0x | Cyan dashes flowing source→target |
| degraded | Deterministic jitter | 0.7x ± seeded variation | Amber dashes with stutter |
| blocked | Static, broken gap | 0 (no motion) | Red dashes with barrier indicator |
| unknown | Very slow, faint | 0.2x | Gray dim, barely moving |

**Degraded jitter**: `speed = baseSpeed * (0.7 + 0.3 * sin(hash(edge.id) * 7.13 + elapsedTime * 3.0))`. Deterministic — same edge always has same jitter pattern at same time. No `Math.random()`.

### Shared Global Animation Phase

**Critical**: Do NOT create a `useFrame` per edge. Instead:

- Single `useFrame` in `Edges.tsx` (or parent) computes global `elapsedTime`
- Each `FlowEdge` receives `elapsedTime` as prop, computes its own `dashOffset` from that
- For large graphs (>100 edges), consider InstancedMesh for marker geometry
- `dashOffset = elapsedTime * flowSpeed * speedMultiplier(edge.id)`

### Blocked Edge Barrier

Small barrier indicator at edge midpoint for blocked edges:
- Short perpendicular line crossing the edge (or small `×` mesh)
- Red color, static, reinforces "broken/cut" beyond dashing

### Quality Toggle

`useQualityStore` (new Zustand store):

| Tier | Flow markers | Curve segments |
|------|-------------|---------------|
| high | Animated dashes + subtle trail | 30 segments |
| low | Static directional chevrons (`>` at 1/3 and 2/3), no animation | 16 segments |

### LinkStateStyle Extension

Add `flowSpeed` to `LinkStateStyle` in `colors.ts`:

```
ok:       { ..., flowSpeed: 1.0 }
degraded: { ..., flowSpeed: 0.7 }
blocked:  { ..., flowSpeed: 0.0 }
unknown:  { ..., flowSpeed: 0.2 }
```

### Component Changes

| File | Change |
|------|--------|
| `Edges.tsx` | Single useFrame for global time, delegate to FlowEdge |
| New: `FlowEdge.tsx` | Curved spline, dashOffset from global time, quality-aware |
| `colors.ts` | Add `flowSpeed` to `LinkStateStyle` |
| New: `stores/quality.store.ts` | Quality tier state, auto-detection |
| `constants.ts` | Flow constants (base speed, dash size, curve segments) |

### Tests

- Curve control points computed correctly (3 points direct, 5 points auth-gated)
- Auth-gated curves pass through gate center
- flowSpeed values present for all 4 link states
- Quality store defaults and tier switching
- Deterministic jitter: same edge.id + same time = same offset

---

## PR3: Camera + Atmosphere + UX Readability

### Camera System

**Default hero camera**: Computed from layout bounding box. Elevated isometric view framing entire city with auth-hub centered. Replace hardcoded `[20, 20, 20]` with `computeHeroCamera(cityLayout)`.

**Auto-fit**: On initial load and layout change, smoothly animate camera to frame full city. Uses bounding sphere of all districts + padding.

**Focus on selection**: When user selects an endpoint:
- Smoothly animate OrbitControls target to selected building position
- Camera moves closer (zoom) and re-centers
- On deselect, return to overview
- Animation: `useFrame` lerp on controls.target + camera.position (~60 frames, ease-out)

### Post-Processing

Install `@react-three/postprocessing`. Add `<EffectComposer>` to Scene.

**Bloom**:
- Intensity: **0.25-0.3** (lower than typical, preserve semantic color clarity)
- Threshold: **0.7** (only bright emissives bloom — gate, active edges, buildings with linkState glow)
- Radius: 0.4
- Text, ground planes, roads, HUD unaffected (below threshold)

**Fog**:
- Exponential fog: color `#0a0a1e`, density **0.006-0.008**
- Depth separation — far districts slightly faded
- Light enough that all districts remain readable at max zoom-out

**No tone mapping change. No vignette. No color grading.**

### Quality Tiers (Extended)

| Tier | Bloom | Fog | Flow animation | Camera |
|------|-------|-----|---------------|--------|
| high | 0.25 intensity | 0.008 density | animated markers | smooth lerp |
| medium | 0.15 intensity | 0.004 density | animated markers | smooth lerp |
| low | none | none | static chevrons | instant snap |

### Auto-Fallback (Demotion Only)

- FPS monitor: rolling 120-frame window
- If avg < 45 FPS for 2 consecutive windows → drop one tier
- **Never auto-promote** in the same session (user can manually promote)
- **Cooldown**: minimum 10 seconds between tier drops to prevent oscillation
- User manual override always respected (can force any tier)

### Acceptance Rule

If readability drops or FPS goes below target, reduce effects automatically. Semantic colors (blocked/degraded/ok/unknown) must remain unambiguous at all quality tiers.

### Component Changes

| File | Change |
|------|--------|
| `Scene.tsx` | `<EffectComposer>` with Bloom, fog on scene, quality-aware |
| New: `hooks/useAutoCamera.ts` | Hero camera, auto-fit, selection focus |
| `stores/quality.store.ts` | Extend with bloom/fog tiers, FPS monitor, auto-demotion, cooldown |
| `constants.ts` | Bloom/fog constants per quality tier, camera defaults |
| `package.json` | Add `@react-three/postprocessing` |

### Tests

- Hero camera position correct for various layout sizes
- Quality tier transitions (high → medium → low)
- Auto-demotion threshold logic (2 consecutive windows < 45 FPS)
- No auto-promotion in same session
- Cooldown timer prevents rapid oscillation
- Bloom/fog disabled cleanly at low tier
- Existing 95 client tests unaffected

---

## Performance Gates

- Target >= 50 FPS in demo scene at each PR
- If performance drops, quality tier auto-demotes
- Each PR includes pre/post FPS note
- Dashed-edge / curve rendering impact called out explicitly

## Deliverables Per PR

1. Code + tests
2. Before/after screenshots (top-down + perspective + focused auth-gate shot)
3. Short rationale: what changed and why it improves readability
4. Risk note + fallback behavior

## File Plan Summary

### PR1 (City Form)
New: `RingRoads.tsx`, `Boulevards.tsx`
Modified: `layout.service.ts`, `constants.ts`, `City.tsx`, `District.tsx`, `AuthGate.tsx`, `Scene.tsx`, layout tests

### PR2 (Flow Language)
New: `FlowEdge.tsx`, `stores/quality.store.ts`
Modified: `Edges.tsx`, `colors.ts`, `constants.ts`, edge routing tests

### PR3 (Camera + Atmosphere)
New: `hooks/useAutoCamera.ts`
Modified: `Scene.tsx`, `stores/quality.store.ts`, `constants.ts`, `package.json`
