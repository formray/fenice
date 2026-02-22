import type { RoadSegment } from '../services/layout.service';
import { RoadPolyline } from './RoadPolyline';

interface RingRoadsProps {
  roads: RoadSegment[];
}

export function RingRoads({ roads }: RingRoadsProps): React.JSX.Element {
  return (
    <group>
      {roads.map((road, i) => (
        <RoadPolyline
          key={`ring-${road.zone}-${i}`}
          points={road.points}
          width={road.width}
          surfaceColor="#060d20"
          surfaceOpacity={0.72}
          markingColor="#00E5FF"
          markingOpacity={0.22}
        />
      ))}
    </group>
  );
}
