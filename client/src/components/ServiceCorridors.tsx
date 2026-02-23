import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { Position3D, DistrictLayout } from '../services/layout.service';
import type { WorldEndpoint } from '../types/world';
import type { SemanticState, AuthGateState, LinkState } from '../types/semantic';
import { LINK_STATE_COLORS } from '../utils/colors';
import { RoadPolyline } from './RoadPolyline';
import { useViewStore } from '../stores/view.store';

const CORRIDOR_Y = 0.06;
const CORRIDOR_LANE_STEP = 0.3;
const DISTRIBUTOR_RADIUS = 3.2;

export interface ServiceCorridorPath {
  serviceId: string;
  points: Position3D[];
  linkState: LinkState;
}

function centeredLaneOffset(index: number, total: number, step: number): number {
  return (index - (total - 1) / 2) * step;
}

function dedupePolyline(points: Position3D[]): Position3D[] {
  const deduped: Position3D[] = [];
  for (const p of points) {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev.x !== p.x || prev.z !== p.z) deduped.push(p);
  }
  return deduped;
}

export function worstServiceLinkState(states: LinkState[]): LinkState {
  if (states.length === 0) return 'unknown';
  const precedence: LinkState[] = ['blocked', 'degraded', 'ok', 'unknown'];
  return [...states].sort((a, b) => precedence.indexOf(a) - precedence.indexOf(b))[0] ?? 'unknown';
}

export function computeCorridorPoints(
  districtCenter: { x: number; z: number },
  gatePosition: Position3D,
  laneOffset: number
): Position3D[] {
  // Radial angle from gate to district
  const serviceAngle = Math.atan2(
    districtCenter.z - gatePosition.z,
    districtCenter.x - gatePosition.x
  );

  // Dock point on the distributor ring
  const dockX = gatePosition.x + DISTRIBUTOR_RADIUS * Math.cos(serviceAngle);
  const dockZ = gatePosition.z + DISTRIBUTOR_RADIUS * Math.sin(serviceAngle);

  // Perpendicular offset (rotated 90 degrees from radial direction)
  const perpAngle = serviceAngle + Math.PI / 2;
  const offX = laneOffset * Math.cos(perpAngle);
  const offZ = laneOffset * Math.sin(perpAngle);

  // Intermediate waypoint at 55% of the distance from gate to district
  const dist = Math.hypot(districtCenter.x - gatePosition.x, districtCenter.z - gatePosition.z);
  const midRadius = dist * 0.55;
  const midX = gatePosition.x + midRadius * Math.cos(serviceAngle) + offX;
  const midZ = gatePosition.z + midRadius * Math.sin(serviceAngle) + offZ;

  return dedupePolyline([
    { x: districtCenter.x + offX, y: CORRIDOR_Y, z: districtCenter.z + offZ },
    { x: midX, y: CORRIDOR_Y, z: midZ },
    { x: dockX + offX, y: CORRIDOR_Y, z: dockZ + offZ },
  ]);
}

export function computeServiceCorridors(
  districts: DistrictLayout[],
  endpoints: WorldEndpoint[],
  endpointSemantics: Record<string, SemanticState>,
  authGate: AuthGateState,
  gatePosition: Position3D
): ServiceCorridorPath[] {
  const districtByService = new Map(districts.map((d) => [d.serviceId, d]));

  const endpointsByService = new Map<string, WorldEndpoint[]>();
  for (const ep of endpoints) {
    const list = endpointsByService.get(ep.serviceId) ?? [];
    list.push(ep);
    endpointsByService.set(ep.serviceId, list);
  }

  // Only protected services (hasAuth) have corridors through auth gate.
  const protectedServices = Array.from(endpointsByService.entries())
    .filter(([, eps]) => eps.some((ep) => ep.hasAuth))
    .map(([serviceId, eps]) => ({ serviceId, eps, district: districtByService.get(serviceId) }))
    .filter(
      (entry): entry is { serviceId: string; eps: WorldEndpoint[]; district: DistrictLayout } =>
        Boolean(entry.district)
    )
    .sort((a, b) => a.district.tag.localeCompare(b.district.tag));

  return protectedServices.map((entry, index) => {
    const laneOffset = centeredLaneOffset(index, protectedServices.length, CORRIDOR_LANE_STEP);
    const serviceStates = entry.eps.map(
      (ep) => endpointSemantics[ep.id]?.linkState ?? ('unknown' as LinkState)
    );
    const serviceState = worstServiceLinkState(serviceStates);
    const linkState = authGate.open ? serviceState : 'blocked';

    return {
      serviceId: entry.serviceId,
      linkState,
      points: computeCorridorPoints(entry.district.center, gatePosition, laneOffset),
    };
  });
}

interface ServiceCorridorsProps {
  districts: DistrictLayout[];
  endpoints: WorldEndpoint[];
  endpointSemantics: Record<string, SemanticState>;
  authGate: AuthGateState;
  gatePosition: Position3D;
}

interface PolylineCache {
  cumulative: number[];
  total: number;
}

function buildPolylineCache(points: Position3D[]): PolylineCache {
  const cumulative: number[] = [0];
  let total = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1]!;
    const b = points[i]!;
    total += Math.hypot(b.x - a.x, b.z - a.z);
    cumulative.push(total);
  }
  return { cumulative, total };
}

function samplePolyline(points: Position3D[], cache: PolylineCache, t: number): Position3D {
  if (points.length === 0) return { x: 0, y: CORRIDOR_Y, z: 0 };
  if (points.length === 1 || cache.total <= 0.0001) return points[0]!;

  const distance = Math.max(0, Math.min(1, t)) * cache.total;
  let segIndex = 0;
  while (segIndex < cache.cumulative.length - 1 && cache.cumulative[segIndex + 1]! < distance) {
    segIndex += 1;
  }

  const start = points[segIndex]!;
  const end = points[Math.min(segIndex + 1, points.length - 1)]!;
  const segStart = cache.cumulative[segIndex]!;
  const segEnd = cache.cumulative[Math.min(segIndex + 1, cache.cumulative.length - 1)]!;
  const segLen = Math.max(0.0001, segEnd - segStart);
  const localT = (distance - segStart) / segLen;

  return {
    x: start.x + (end.x - start.x) * localT,
    y: start.y + (end.y - start.y) * localT,
    z: start.z + (end.z - start.z) * localT,
  };
}

function flowSpeedForState(state: LinkState): number {
  switch (state) {
    case 'ok':
      return 2.1;
    case 'degraded':
      return 1.2;
    case 'unknown':
      return 0.7;
    case 'blocked':
      return 0;
  }
}

interface CorridorFlowMarkerProps {
  points: Position3D[];
  color: string;
  speed: number;
  phase: number;
}

function CorridorFlowMarker({
  points,
  color,
  speed,
  phase,
}: CorridorFlowMarkerProps): React.JSX.Element | null {
  const groupRef = useRef<THREE.Group>(null);
  const progressRef = useRef<number>(phase);
  const cache = useMemo(() => buildPolylineCache(points), [points]);
  const isMoving = speed > 0;

  useFrame((_, delta) => {
    if (!groupRef.current || points.length < 2) return;

    if (isMoving) {
      const normalizedSpeed = speed / Math.max(1, cache.total);
      progressRef.current = (progressRef.current + delta * normalizedSpeed) % 1;
    }

    const p = samplePolyline(points, cache, progressRef.current);
    groupRef.current.position.set(p.x, p.y + 0.09, p.z);
  });

  if (points.length < 2) return null;

  return (
    <group ref={groupRef}>
      <mesh>
        <sphereGeometry args={[0.09, 10, 10]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.2}
          roughness={0.2}
          metalness={0.1}
        />
      </mesh>
      {/* Halo glow sphere */}
      <mesh>
        <sphereGeometry args={[0.22, 12, 12]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}

export function ServiceCorridors({
  districts,
  endpoints,
  endpointSemantics,
  authGate,
  gatePosition,
}: ServiceCorridorsProps): React.JSX.Element {
  const visualMode = useViewStore((s) => s.visualMode);
  const corridors = useMemo(
    () => computeServiceCorridors(districts, endpoints, endpointSemantics, authGate, gatePosition),
    [districts, endpoints, endpointSemantics, authGate, gatePosition]
  );

  return (
    <group>
      {corridors.map((corridor) => {
        const style = LINK_STATE_COLORS[corridor.linkState];
        const flowSpeed = flowSpeedForState(corridor.linkState);
        const surfaceColor = visualMode === 'light' ? '#c7d6f2' : '#08142b';
        const surfaceOpacity = visualMode === 'light' ? 0.84 : 0.92;
        const markingOpacity =
          corridor.linkState === 'blocked' ? 0.4 : Math.max(0.7, style.opacity);
        const corridorWidth = corridor.linkState === 'blocked' ? 1.2 : 1.45;

        return (
          <group key={`corridor-${corridor.serviceId}`}>
            <RoadPolyline
              points={corridor.points}
              width={corridorWidth}
              surfaceColor={surfaceColor}
              surfaceOpacity={surfaceOpacity}
              markingColor={style.hex}
              markingOpacity={markingOpacity}
              markingEmissiveIntensity={1.05}
              showHalo
            />
            <CorridorFlowMarker
              points={corridor.points}
              color={style.hex}
              speed={flowSpeed}
              phase={0}
            />
            <CorridorFlowMarker
              points={corridor.points}
              color={style.hex}
              speed={flowSpeed}
              phase={0.5}
            />
          </group>
        );
      })}
    </group>
  );
}
