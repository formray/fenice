import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { DUST_CONFIG } from '../utils/atmosphere';
import { generateDustPositions } from '../utils/atmosphere-geometry';

export function DustParticles(): React.JSX.Element {
  const pointsRef = useRef<THREE.Points>(null);

  const basePositions = useMemo(
    () => generateDustPositions(DUST_CONFIG.count, DUST_CONFIG.spread),
    []
  );

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const posAttr = geo.getAttribute('position');
    if (!posAttr) return;
    const arr = posAttr.array as Float32Array;
    const t = clock.elapsedTime * DUST_CONFIG.driftSpeed;

    for (let i = 0; i < DUST_CONFIG.count; i++) {
      const i3 = i * 3;
      arr[i3] = basePositions[i3]! + Math.sin(t + i * 0.73) * 0.3;
      arr[i3 + 1] = basePositions[i3 + 1]! + Math.cos(t + i * 1.17) * 0.2;
      arr[i3 + 2] = basePositions[i3 + 2]! + Math.sin(t + i * 0.91) * 0.3;
    }
    posAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[basePositions.slice(), 3]} />
      </bufferGeometry>
      <pointsMaterial
        color={DUST_CONFIG.color}
        size={DUST_CONFIG.maxSize}
        sizeAttenuation
        transparent
        opacity={DUST_CONFIG.opacity}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
