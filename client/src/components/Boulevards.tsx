import type { RoadSegment } from '../services/layout.service';
import { RoadPolyline } from './RoadPolyline';
import { useViewStore } from '../stores/view.store';

interface BoulevardProps {
  boulevards: RoadSegment[];
}

export function Boulevards({ boulevards }: BoulevardProps): React.JSX.Element {
  const visualMode = useViewStore((s) => s.visualMode);
  const surfaceColor = visualMode === 'light' ? '#bfd1f3' : '#07132a';
  const surfaceOpacity = visualMode === 'light' ? 0.78 : 0.68;
  const markingColor = visualMode === 'light' ? '#1f4fc7' : '#00E5FF';
  const markingOpacity = visualMode === 'light' ? 0.32 : 0.2;

  return (
    <group>
      {boulevards.map((blvd, i) => (
        <RoadPolyline
          key={`blvd-${i}`}
          points={blvd.points}
          width={blvd.width}
          surfaceColor={surfaceColor}
          surfaceOpacity={surfaceOpacity}
          markingColor={markingColor}
          markingOpacity={markingOpacity}
        />
      ))}
    </group>
  );
}
