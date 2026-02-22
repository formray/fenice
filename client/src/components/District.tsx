import { Text } from '@react-three/drei';
import type { DistrictLayout } from '../services/layout.service';
import { GROUND_Y } from '../utils/constants';

interface DistrictProps {
  layout: DistrictLayout;
}

export function District({ layout }: DistrictProps): React.JSX.Element {
  const width = layout.bounds.maxX - layout.bounds.minX;
  const depth = layout.bounds.maxZ - layout.bounds.minZ;

  return (
    <group>
      {/* Ground plane */}
      <mesh position={[layout.center.x, GROUND_Y, layout.center.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial color="#1a1a2e" transparent opacity={0.6} roughness={0.9} />
      </mesh>

      {/* Service tag label */}
      <Text
        position={[layout.bounds.minX + 0.5, 0.1, layout.bounds.minZ - 0.3]}
        fontSize={0.6}
        color="#888888"
        anchorX="left"
        anchorY="middle"
      >
        {layout.tag}
      </Text>
    </group>
  );
}
