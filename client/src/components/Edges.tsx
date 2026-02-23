import { Line } from '@react-three/drei';
import type { WorldEdge, WorldEndpoint } from '../types/world';
import type { BuildingLayout, Position3D } from '../services/layout.service';
import type { SemanticState } from '../types/semantic';
import { LINK_STATE_COLORS } from '../utils/colors';
import type { LinkState } from '../types/semantic';
import { useSelectionStore } from '../stores/selection.store';

interface EdgesProps {
  edges: WorldEdge[];
  buildingLayouts: BuildingLayout[];
  endpointSemantics: Record<string, SemanticState>;
  endpointMap: Map<string, WorldEndpoint>;
  gatePosition: Position3D;
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
  const selectedId = useSelectionStore((s) => s.selectedId);

  return (
    <group>
      {edges.map((edge) => {
        const source = posMap.get(edge.sourceId);
        const target = posMap.get(edge.targetId);
        if (!source || !target) return null;

        const sourceEp = endpointMap.get(edge.sourceId);
        const targetEp = endpointMap.get(edge.targetId);
        const isAuthBoundary = !!sourceEp && !!targetEp && sourceEp.hasAuth !== targetEp.hasAuth;
        const isIntraService =
          !!sourceEp && !!targetEp && sourceEp.serviceId === targetEp.serviceId;
        const isRelatedToSelection =
          selectedId !== null && (edge.sourceId === selectedId || edge.targetId === selectedId);

        // Reduce visual clutter: hide intra-service lines unless selected, but always keep auth-boundary routes.
        if (isIntraService && !isAuthBoundary && !isRelatedToSelection) return null;

        const sourceSem = endpointSemantics[edge.sourceId];
        const targetSem = endpointSemantics[edge.targetId];
        const edgeLinkState = worstLinkState(sourceSem?.linkState, targetSem?.linkState);
        const style = LINK_STATE_COLORS[edgeLinkState];

        const points = computeEdgePoints(source, target, gatePosition, isAuthBoundary);

        const isDashed = style.edgeStyle === 'dashed';
        const dashProps = isDashed ? { dashSize: 0.5, gapSize: 0.3 } : {};
        const baseWidth = isDashed ? 1 : 1.5;
        const routeWidth = isAuthBoundary ? 4.5 : baseWidth;
        const baseOpacity = style.opacity;
        const routeOpacity = isAuthBoundary
          ? Math.max(0.78, baseOpacity)
          : isIntraService
            ? Math.min(baseOpacity, 0.18)
            : baseOpacity;

        return (
          <group key={edge.id}>
            {isAuthBoundary && (
              <Line
                points={points}
                color={style.hex}
                lineWidth={routeWidth + 1.5}
                opacity={0.2}
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
