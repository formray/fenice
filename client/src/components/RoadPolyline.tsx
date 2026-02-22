import type { Position3D } from '../services/layout.service';

interface RoadPolylineProps {
  points: Position3D[];
  width: number;
  surfaceColor: string;
  surfaceOpacity: number;
  markingColor: string;
  markingOpacity: number;
}

const ROAD_THICKNESS = 0.02;
const MARKING_THICKNESS = 0.006;

export function RoadPolyline({
  points,
  width,
  surfaceColor,
  surfaceOpacity,
  markingColor,
  markingOpacity,
}: RoadPolylineProps): React.JSX.Element {
  if (points.length < 2) return <></>;

  return (
    <group>
      {points.slice(0, -1).map((start, idx) => {
        const end = points[idx + 1];
        if (!end) return null;

        const dx = end.x - start.x;
        const dz = end.z - start.z;
        const length = Math.hypot(dx, dz);
        if (length < 0.001) return null;

        const centerX = (start.x + end.x) / 2;
        const centerZ = (start.z + end.z) / 2;
        const centerY = (start.y + end.y) / 2 + ROAD_THICKNESS / 2;
        const angle = Math.atan2(dz, dx);
        const markingLength = Math.max(0.05, length - 0.06);
        const markingWidth = Math.max(0.05, width * 0.08);

        return (
          <group key={`road-seg-${idx}`}>
            <mesh position={[centerX, centerY, centerZ]} rotation={[0, -angle, 0]}>
              <boxGeometry args={[length, ROAD_THICKNESS, width]} />
              <meshStandardMaterial
                color={surfaceColor}
                transparent
                opacity={surfaceOpacity}
                roughness={0.95}
                metalness={0.05}
              />
            </mesh>
            <mesh
              position={[centerX, centerY + ROAD_THICKNESS / 2 + MARKING_THICKNESS / 2, centerZ]}
              rotation={[0, -angle, 0]}
            >
              <boxGeometry args={[markingLength, MARKING_THICKNESS, markingWidth]} />
              <meshStandardMaterial
                color={markingColor}
                emissive={markingColor}
                emissiveIntensity={0.25}
                transparent
                opacity={markingOpacity}
                roughness={0.6}
                metalness={0.2}
              />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}
