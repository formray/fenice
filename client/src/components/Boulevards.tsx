import type { RoadSegment } from '../services/layout.service';
import { RoadPolyline } from './RoadPolyline';

interface BoulevardProps {
  boulevards: RoadSegment[];
}

export function Boulevards({ boulevards }: BoulevardProps): React.JSX.Element {
  return (
    <group>
      {boulevards.map((blvd, i) => (
        <RoadPolyline
          key={`blvd-${i}`}
          points={blvd.points}
          width={blvd.width}
          surfaceColor="#07132a"
          surfaceOpacity={0.68}
          markingColor="#00E5FF"
          markingOpacity={0.2}
        />
      ))}
    </group>
  );
}
