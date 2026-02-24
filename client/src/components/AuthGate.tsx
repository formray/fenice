import { useRef } from 'react';
import * as THREE from 'three';
import { Line } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useWorldStore } from '../stores/world.store';
import { LINK_STATE_COLORS } from '../utils/colors';
import type { Position3D } from '../services/layout.service';

interface AuthGateProps {
  position: Position3D;
}

export function AuthGate({ position }: AuthGateProps): React.JSX.Element {
  const meshRef = useRef<THREE.Mesh>(null);
  const hazeRef = useRef<THREE.Mesh>(null);
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

  const ACCENT_COUNT = 8;
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

  // Pulse animation: emissive intensity oscillates via useFrame
  useFrame(({ clock }) => {
    if (!meshRef.current) return;
    const mat = meshRef.current.material;
    if (!(mat instanceof THREE.MeshPhysicalMaterial)) return;

    if (authGate.open) {
      const pulse = 0.35 + 0.25 * Math.sin(clock.elapsedTime * 2.5);
      mat.emissiveIntensity = pulse;
      mat.opacity = 1.0;
    } else {
      const pulse = 0.05 + 0.06 * Math.sin(clock.elapsedTime * 1.2);
      mat.emissiveIntensity = pulse;
      mat.opacity = 0.4;
    }

    // Haze sphere breathes gently
    if (hazeRef.current) {
      const hazeMat = hazeRef.current.material;
      if (hazeMat instanceof THREE.MeshBasicMaterial) {
        hazeMat.opacity = authGate.open
          ? 0.06 + 0.03 * Math.sin(clock.elapsedTime * 1.8)
          : 0.02 + 0.01 * Math.sin(clock.elapsedTime * 0.8);
      }
    }
  });

  return (
    <group>
      <mesh ref={meshRef} position={[position.x, 2.0, position.z]}>
        <octahedronGeometry args={[1.5, 0]} />
        <meshPhysicalMaterial
          color={linkStyle.hex}
          emissive={linkStyle.hex}
          emissiveIntensity={authGate.open ? 0.5 : 0.1}
          roughness={0.2}
          metalness={0.5}
          clearcoat={1.0}
          clearcoatRoughness={0.05}
          transparent
          opacity={authGate.open ? 1.0 : 0.4}
        />
      </mesh>
      {/* Atmospheric haze sphere */}
      <mesh ref={hazeRef} position={[position.x, 1.5, position.z]}>
        <sphereGeometry args={[3.5, 24, 24]} />
        <meshBasicMaterial
          color={linkStyle.hex}
          transparent
          opacity={0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.BackSide}
        />
      </mesh>
      {/* Ground ring marker */}
      <Line points={ringPoints} color={linkStyle.hex} lineWidth={1.5} opacity={0.3} transparent />
      {/* Radial accent / docking guide lines */}
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
