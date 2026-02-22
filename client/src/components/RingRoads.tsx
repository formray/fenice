import type { RoadSegment } from '../services/layout.service';
import { RoadPolyline } from './RoadPolyline';
import { useViewStore } from '../stores/view.store';

interface RingRoadsProps {
  roads: RoadSegment[];
}

export function RingRoads({ roads }: RingRoadsProps): React.JSX.Element {
  const visualMode = useViewStore((s) => s.visualMode);
  const surfaceColor = visualMode === 'light' ? '#b4c9ef' : '#060d20';
  const surfaceOpacity = visualMode === 'light' ? 0.74 : 0.72;
  const markingColor = visualMode === 'light' ? '#1f4fc7' : '#00E5FF';
  const markingOpacity = visualMode === 'light' ? 0.3 : 0.22;

  return (
    <group>
      {roads.map((road, i) => (
        <RoadPolyline
          key={`ring-${road.zone}-${i}`}
          points={road.points}
          width={road.width}
          surfaceColor={surfaceColor}
          surfaceOpacity={surfaceOpacity}
          markingColor={markingColor}
          markingOpacity={markingOpacity}
        />
      ))}
    </group>
  );
}
