import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import type { WorldEdge, WorldEndpoint } from '../types/world';
import type { BuildingLayout, Position3D } from '../services/layout.service';
import type { SemanticState } from '../types/semantic';
import { LINK_STATE_COLORS } from '../utils/colors';
import type { LinkState } from '../types/semantic';
import { useSelectionStore } from '../stores/selection.store';

const ROUTE_Y = 0.05;
const LANE_STEP = 0.28;
const AUTH_LANE_STEP = 0.36;

interface EdgeRouteHints {
  sourceHub?: Position3D | undefined;
  targetHub?: Position3D | undefined;
  laneOffset?: number | undefined;
  gateLaneOffset?: number | undefined;
}

interface PreparedEdgeRoute {
  edge: WorldEdge;
  source: Position3D;
  target: Position3D;
  sourceEp: WorldEndpoint;
  targetEp: WorldEndpoint;
  isIntraService: boolean;
  isAuthBoundary: boolean;
  laneOffset: number;
  gateLaneOffset: number;
}

function centeredLaneOffset(index: number, total: number, step: number): number {
  return (index - (total - 1) / 2) * step;
}

function dedupeAndSimplify(points: [number, number, number][]): [number, number, number][] {
  if (points.length <= 2) return points;

  const deduped: [number, number, number][] = [];
  for (const p of points) {
    const prev = deduped[deduped.length - 1];
    if (!prev || prev[0] !== p[0] || prev[2] !== p[2]) deduped.push(p);
  }

  const simplified: [number, number, number][] = [];
  for (const p of deduped) {
    while (simplified.length >= 2) {
      const a = simplified[simplified.length - 2]!;
      const b = simplified[simplified.length - 1]!;
      const sameX = a[0] === b[0] && b[0] === p[0];
      const sameZ = a[2] === b[2] && b[2] === p[2];
      if (sameX || sameZ) simplified.pop();
      else break;
    }
    simplified.push(p);
  }

  return simplified;
}

interface EdgesProps {
  edges: WorldEdge[];
  buildingLayouts: BuildingLayout[];
  endpointSemantics: Record<string, SemanticState>;
  endpointMap: Map<string, WorldEndpoint>;
  gatePosition: Position3D;
  selectedServiceOnly?: boolean | undefined;
}

/** Determine worst linkState between two endpoints for edge coloring */
export function worstLinkState(a: LinkState | undefined, b: LinkState | undefined): LinkState {
  const precedence: LinkState[] = ['blocked', 'degraded', 'ok', 'unknown'];
  const aIdx = precedence.indexOf(a ?? 'unknown');
  const bIdx = precedence.indexOf(b ?? 'unknown');
  return precedence[Math.min(aIdx, bIdx)] ?? 'unknown';
}

/** Compute edge waypoints — auth-gated edges route through gate center */
export function computeEdgePoints(
  source: Position3D,
  target: Position3D,
  gatePosition: Position3D,
  isAuthGated: boolean,
  hints?: EdgeRouteHints
): [number, number, number][] {
  const y = ROUTE_Y;
  const laneOffset = hints?.laneOffset ?? 0;
  const gateLaneOffset = hints?.gateLaneOffset ?? 0;
  const sourceHub = hints?.sourceHub;
  const targetHub = hints?.targetHub;

  if (!sourceHub || !targetHub) {
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

  if (isAuthGated) {
    // Auth corridor: source district lane -> gate lane -> target district lane
    const sourceLaneZ = sourceHub.z + laneOffset;
    const targetLaneZ = targetHub.z + laneOffset;
    const gateLaneX = gatePosition.x + gateLaneOffset;
    const gateLaneZ = gatePosition.z + gateLaneOffset * 0.4;

    return dedupeAndSimplify([
      [source.x, y, source.z],
      [source.x, y, sourceLaneZ],
      [gateLaneX, y, sourceLaneZ],
      [gateLaneX, y, gateLaneZ],
      [gateLaneX, y, targetLaneZ],
      [target.x, y, targetLaneZ],
      [target.x, y, target.z],
    ]);
  }

  // Non-auth route: district lane -> service corridor -> target lane
  const sourceLaneZ = sourceHub.z + laneOffset;
  const targetLaneZ = targetHub.z + laneOffset;
  const corridorX = (sourceHub.x + targetHub.x) / 2 + laneOffset;

  return dedupeAndSimplify([
    [source.x, y, source.z],
    [source.x, y, sourceLaneZ],
    [corridorX, y, sourceLaneZ],
    [corridorX, y, targetLaneZ],
    [target.x, y, targetLaneZ],
    [target.x, y, target.z],
  ]);
}

export function Edges({
  edges,
  buildingLayouts,
  endpointSemantics,
  endpointMap,
  gatePosition,
  selectedServiceOnly = false,
}: EdgesProps): React.JSX.Element {
  const posMap = useMemo(
    () => new Map(buildingLayouts.map((b) => [b.endpointId, b.position])),
    [buildingLayouts]
  );
  const selectedEndpointId = useSelectionStore((s) => s.selectedId);
  const selectedServiceId = selectedEndpointId
    ? endpointMap.get(selectedEndpointId)?.serviceId
    : undefined;

  const serviceHubs = useMemo(() => {
    const sums = new Map<string, { x: number; z: number; count: number }>();
    for (const building of buildingLayouts) {
      const endpoint = endpointMap.get(building.endpointId);
      if (!endpoint) continue;
      const acc = sums.get(endpoint.serviceId) ?? { x: 0, z: 0, count: 0 };
      acc.x += building.position.x;
      acc.z += building.position.z;
      acc.count += 1;
      sums.set(endpoint.serviceId, acc);
    }

    const hubs = new Map<string, Position3D>();
    for (const [serviceId, acc] of sums.entries()) {
      hubs.set(serviceId, {
        x: acc.x / acc.count,
        y: 0,
        z: acc.z / acc.count,
      });
    }

    return hubs;
  }, [buildingLayouts, endpointMap]);

  const preparedRoutes = useMemo<PreparedEdgeRoute[]>(() => {
    const visible: Array<PreparedEdgeRoute & { groupKey: string }> = [];

    for (const edge of edges) {
      const source = posMap.get(edge.sourceId);
      const target = posMap.get(edge.targetId);
      const sourceEp = endpointMap.get(edge.sourceId);
      const targetEp = endpointMap.get(edge.targetId);
      if (!source || !target || !sourceEp || !targetEp) continue;

      if (selectedServiceOnly && (!selectedServiceId || sourceEp.serviceId !== selectedServiceId))
        continue;

      const isAuthBoundary = sourceEp.hasAuth !== targetEp.hasAuth;
      const isIntraService = sourceEp.serviceId === targetEp.serviceId;
      // World view focuses on inter-service topology; intra-service mesh edges stay hidden.
      if (isIntraService && !isAuthBoundary) continue;

      const a = sourceEp.serviceId;
      const b = targetEp.serviceId;
      const pairKey = a < b ? `${a}|${b}` : `${b}|${a}`;
      const groupKey = isAuthBoundary ? `auth:${pairKey}` : `pair:${pairKey}`;

      visible.push({
        edge,
        source,
        target,
        sourceEp,
        targetEp,
        isIntraService,
        isAuthBoundary,
        groupKey,
        laneOffset: 0,
        gateLaneOffset: 0,
      });
    }

    const grouped = new Map<string, Array<PreparedEdgeRoute & { groupKey: string }>>();
    for (const route of visible) {
      const group = grouped.get(route.groupKey) ?? [];
      group.push(route);
      grouped.set(route.groupKey, group);
    }

    for (const group of grouped.values()) {
      group.sort((a, b) => a.edge.id.localeCompare(b.edge.id));
      const isAuthGroup = group[0]?.isAuthBoundary === true;
      const laneStep = isAuthGroup ? AUTH_LANE_STEP : LANE_STEP;

      for (let i = 0; i < group.length; i++) {
        const laneOffset = centeredLaneOffset(i, group.length, laneStep);
        group[i]!.laneOffset = laneOffset;
        group[i]!.gateLaneOffset = laneOffset * 0.9;
      }
    }

    return visible
      .map(({ groupKey: _groupKey, ...route }) => route)
      .sort((a, b) => Number(a.isAuthBoundary) - Number(b.isAuthBoundary));
  }, [edges, endpointMap, posMap, selectedServiceId, selectedServiceOnly]);

  return (
    <group>
      {preparedRoutes.map((route) => {
        const sourceSem = endpointSemantics[route.edge.sourceId];
        const targetSem = endpointSemantics[route.edge.targetId];
        const edgeLinkState = worstLinkState(sourceSem?.linkState, targetSem?.linkState);
        const style = LINK_STATE_COLORS[edgeLinkState];

        const points = computeEdgePoints(
          route.source,
          route.target,
          gatePosition,
          route.isAuthBoundary,
          {
            sourceHub: serviceHubs.get(route.sourceEp.serviceId),
            targetHub: serviceHubs.get(route.targetEp.serviceId),
            laneOffset: route.laneOffset,
            gateLaneOffset: route.gateLaneOffset,
          }
        );

        const isDashed = style.edgeStyle === 'dashed';
        const dashProps = isDashed ? { dashSize: 0.5, gapSize: 0.3 } : {};
        const baseWidth = isDashed ? 1 : 1.5;
        const routeWidth = route.isAuthBoundary ? 3.8 : baseWidth;
        const baseOpacity = style.opacity;
        const routeOpacity = route.isAuthBoundary
          ? Math.max(0.78, baseOpacity)
          : route.isIntraService
            ? Math.min(baseOpacity, 0.18)
            : baseOpacity;

        return (
          <group key={route.edge.id}>
            {route.isAuthBoundary && (
              <Line
                points={points}
                color={style.hex}
                lineWidth={routeWidth + 1.5}
                opacity={0.24}
                transparent
              />
            )}
            <Line
              points={points}
              color={style.hex}
              lineWidth={routeWidth}
              opacity={routeOpacity}
              transparent
              dashed={isDashed}
              {...dashProps}
            />
          </group>
        );
      })}
    </group>
  );
}
