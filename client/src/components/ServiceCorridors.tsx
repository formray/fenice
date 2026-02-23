import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import type { Position3D, DistrictLayout } from '../services/layout.service';
import type { WorldEndpoint } from '../types/world';
import type { SemanticState, AuthGateState, LinkState } from '../types/semantic';
import { LINK_STATE_COLORS } from '../utils/colors';

const CORRIDOR_Y = 0.06;
const CORRIDOR_LANE_STEP = 0.44;

export interface ServiceCorridorPath {
  serviceId: string;
  points: [number, number, number][];
  linkState: LinkState;
}

function centeredLaneOffset(index: number, total: number, step: number): number {
  return (index - (total - 1) / 2) * step;
}

function dedupePolyline(points: [number, number, number][]): [number, number, number][] {
  const deduped: [number, number, number][] = [];
  for (const p of points) {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev[0] !== p[0] || prev[2] !== p[2]) deduped.push(p);
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
): [number, number, number][] {
  const gateLaneX = gatePosition.x + laneOffset;
  const gateLaneZ = gatePosition.z + laneOffset * 0.35;

  return dedupePolyline([
    [districtCenter.x, CORRIDOR_Y, districtCenter.z],
    [districtCenter.x, CORRIDOR_Y, gateLaneZ],
    [gateLaneX, CORRIDOR_Y, gateLaneZ],
    [gateLaneX, CORRIDOR_Y, gatePosition.z],
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

export function ServiceCorridors({
  districts,
  endpoints,
  endpointSemantics,
  authGate,
  gatePosition,
}: ServiceCorridorsProps): React.JSX.Element {
  const corridors = useMemo(
    () => computeServiceCorridors(districts, endpoints, endpointSemantics, authGate, gatePosition),
    [districts, endpoints, endpointSemantics, authGate, gatePosition]
  );

  return (
    <group>
      {corridors.map((corridor) => {
        const style = LINK_STATE_COLORS[corridor.linkState];
        const dashed = corridor.linkState === 'blocked' || style.edgeStyle === 'dashed';
        const dashProps = dashed ? { dashSize: 0.6, gapSize: 0.35 } : {};

        return (
          <group key={`corridor-${corridor.serviceId}`}>
            <Line
              points={corridor.points}
              color={style.hex}
              lineWidth={4.2}
              opacity={0.2}
              transparent
            />
            <Line
              points={corridor.points}
              color={style.hex}
              lineWidth={2.8}
              opacity={Math.max(0.58, style.opacity)}
              transparent
              dashed={dashed}
              {...dashProps}
            />
          </group>
        );
      })}
    </group>
  );
}
