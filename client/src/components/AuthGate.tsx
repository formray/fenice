import { useRef } from 'react';
import type { Mesh } from 'three';
import { Line } from '@react-three/drei';
import { useWorldStore } from '../stores/world.store';
import { LINK_STATE_COLORS } from '../utils/colors';
import type { Position3D } from '../services/layout.service';

interface AuthGateProps {
  position: Position3D;
}

export function AuthGate({ position }: AuthGateProps): React.JSX.Element {
  const meshRef = useRef<Mesh>(null);
  const authGate = useWorldStore((s) => s.authGate);
  const linkStyle = LINK_STATE_COLORS[authGate.linkState];

  const RING_RADIUS = 2.5;
  const RING_SEGMENTS = 48;
  const ringPoints: [number, number, number][] = [];
  for (let i = 0; i <= RING_SEGMENTS; i++) {
    const angle = (i / RING_SEGMENTS) * 2 * Math.PI;
    ringPoints.push([
      position.x + RING_RADIUS * Math.cos(angle),
      0.02,
      position.z + RING_RADIUS * Math.sin(angle),
    ]);
  }

  const ACCENT_COUNT = 4;
  const ACCENT_INNER = RING_RADIUS + 0.2;
  const ACCENT_OUTER = RING_RADIUS + 1.5;
  const accentLines: [number, number, number][][] = [];
  for (let i = 0; i < ACCENT_COUNT; i++) {
    const angle = (i / ACCENT_COUNT) * 2 * Math.PI;
    accentLines.push([
      [
        position.x + ACCENT_INNER * Math.cos(angle),
        0.02,
        position.z + ACCENT_INNER * Math.sin(angle),
      ],
      [
        position.x + ACCENT_OUTER * Math.cos(angle),
        0.02,
        position.z + ACCENT_OUTER * Math.sin(angle),
      ],
    ]);
  }

  return (
    <group>
      <mesh ref={meshRef} position={[position.x, 2.0, position.z]}>
        <octahedronGeometry args={[1.5, 0]} />
        <meshStandardMaterial
          color={linkStyle.hex}
          emissive={linkStyle.hex}
          emissiveIntensity={authGate.open ? 0.5 : 0.1}
          roughness={0.3}
          metalness={0.4}
          transparent={!authGate.open}
          opacity={authGate.open ? 1.0 : 0.4}
        />
      </mesh>
      {/* Ground ring marker */}
      <Line points={ringPoints} color={linkStyle.hex} lineWidth={1.5} opacity={0.3} transparent />
      {/* Radial accent lines */}
      {accentLines.map((pts, idx) => (
        <Line
          key={`gate-accent-${idx}`}
          points={pts}
          color={linkStyle.hex}
          lineWidth={1}
          opacity={0.2}
          transparent
        />
      ))}
    </group>
  );
}
