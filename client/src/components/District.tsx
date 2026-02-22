import { Html, Line } from '@react-three/drei';
import type { DistrictLayout } from '../services/layout.service';
import { GROUND_Y, ZONE_LAYOUT_CONFIG } from '../utils/constants';
import { ZONE_STYLES } from '../utils/colors';

interface DistrictProps {
  layout: DistrictLayout;
}

export function District({ layout }: DistrictProps): React.JSX.Element {
  const width = layout.bounds.maxX - layout.bounds.minX;
  const depth = layout.bounds.maxZ - layout.bounds.minZ;
  const zoneStyle = ZONE_STYLES[layout.zone];

  // Border wireframe for protected-core
  const borderPoints: [number, number, number][] = [
    [layout.bounds.minX, GROUND_Y + 0.01, layout.bounds.minZ],
    [layout.bounds.maxX, GROUND_Y + 0.01, layout.bounds.minZ],
    [layout.bounds.maxX, GROUND_Y + 0.01, layout.bounds.maxZ],
    [layout.bounds.minX, GROUND_Y + 0.01, layout.bounds.maxZ],
    [layout.bounds.minX, GROUND_Y + 0.01, layout.bounds.minZ],
  ];

  // Corner accent marks for protected-core districts
  const ACCENT_LENGTH = 0.6;
  const accentY = GROUND_Y + 0.02;

  const cornerAccents: [number, number, number][][] = [
    // Top-left
    [
      [layout.bounds.minX, accentY, layout.bounds.minZ],
      [layout.bounds.minX + ACCENT_LENGTH, accentY, layout.bounds.minZ],
    ],
    [
      [layout.bounds.minX, accentY, layout.bounds.minZ],
      [layout.bounds.minX, accentY, layout.bounds.minZ + ACCENT_LENGTH],
    ],
    // Top-right
    [
      [layout.bounds.maxX, accentY, layout.bounds.minZ],
      [layout.bounds.maxX - ACCENT_LENGTH, accentY, layout.bounds.minZ],
    ],
    [
      [layout.bounds.maxX, accentY, layout.bounds.minZ],
      [layout.bounds.maxX, accentY, layout.bounds.minZ + ACCENT_LENGTH],
    ],
    // Bottom-left
    [
      [layout.bounds.minX, accentY, layout.bounds.maxZ],
      [layout.bounds.minX + ACCENT_LENGTH, accentY, layout.bounds.maxZ],
    ],
    [
      [layout.bounds.minX, accentY, layout.bounds.maxZ],
      [layout.bounds.minX, accentY, layout.bounds.maxZ - ACCENT_LENGTH],
    ],
    // Bottom-right
    [
      [layout.bounds.maxX, accentY, layout.bounds.maxZ],
      [layout.bounds.maxX - ACCENT_LENGTH, accentY, layout.bounds.maxZ],
    ],
    [
      [layout.bounds.maxX, accentY, layout.bounds.maxZ],
      [layout.bounds.maxX, accentY, layout.bounds.maxZ - ACCENT_LENGTH],
    ],
  ];

  return (
    <group>
      {/* Ground plane */}
      <mesh position={[layout.center.x, GROUND_Y, layout.center.z]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width, depth]} />
        <meshStandardMaterial
          color={zoneStyle.floorColor}
          transparent
          opacity={ZONE_LAYOUT_CONFIG[layout.zone].groundOpacity}
          roughness={0.9}
        />
      </mesh>

      {/* Zone border + corner accents (protected-core only) */}
      {zoneStyle.borderColor && (
        <>
          <Line
            points={borderPoints}
            color={zoneStyle.borderColor}
            lineWidth={1}
            opacity={0.3}
            transparent
          />
          {cornerAccents.map((pts, idx) => (
            <Line
              key={`accent-${idx}`}
              points={pts}
              color={zoneStyle.borderColor!}
              lineWidth={2}
              opacity={0.6}
              transparent
            />
          ))}
        </>
      )}

      {/* Service tag label in screen-space to avoid mirrored/clipped 3D text */}
      <Html position={[layout.center.x, 0.2, layout.bounds.minZ - 0.45]} center occlude={false}>
        <div
          style={{
            pointerEvents: 'none',
            fontSize: '20px',
            fontWeight: 600,
            color: '#c7d6ff',
            textShadow: '0 0 8px rgba(0,0,0,0.9)',
            whiteSpace: 'nowrap',
          }}
        >
          {layout.tag}
        </div>
      </Html>
    </group>
  );
}
