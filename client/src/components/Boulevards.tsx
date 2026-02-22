import { Line } from '@react-three/drei';
import type { RoadSegment } from '../services/layout.service';

interface BoulevardProps {
  boulevards: RoadSegment[];
}

export function Boulevards({ boulevards }: BoulevardProps): React.JSX.Element {
  return (
    <group>
      {boulevards.map((blvd, i) => {
        const points = blvd.points.map((p) => [p.x, p.y, p.z] as [number, number, number]);
        return (
          <group key={`blvd-${i}`}>
            {/* Spoke surface — dark lane */}
            <Line
              points={points}
              color="#0a1a3e"
              lineWidth={blvd.width * 10}
              opacity={0.3}
              transparent
            />
            {/* Spoke center marking */}
            <Line points={points} color="#00E5FF" lineWidth={1} opacity={0.1} transparent />
          </group>
        );
      })}
    </group>
  );
}
