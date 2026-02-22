import { Line } from '@react-three/drei';
import type { WorldEdge } from '../types/world';
import type { BuildingLayout } from '../services/layout.service';

interface EdgesProps {
  edges: WorldEdge[];
  buildingLayouts: BuildingLayout[];
}

export function Edges({ edges, buildingLayouts }: EdgesProps): React.JSX.Element {
  const posMap = new Map(buildingLayouts.map((b) => [b.endpointId, b.position]));

  return (
    <group>
      {edges.map((edge) => {
        const source = posMap.get(edge.sourceId);
        const target = posMap.get(edge.targetId);
        if (!source || !target) return null;

        return (
          <Line
            key={edge.id}
            points={[
              [source.x, 0.05, source.z],
              [target.x, 0.05, target.z],
            ]}
            color="#555555"
            lineWidth={1}
            opacity={0.3}
            transparent
          />
        );
      })}
    </group>
  );
}
