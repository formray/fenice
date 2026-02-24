import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { STAR_FIELD_CONFIG } from '../utils/atmosphere';
import { generateStarPositions, generateStarSizes } from '../utils/atmosphere-geometry';

export function StarField(): React.JSX.Element {
  const pointsRef = useRef<THREE.Points>(null);

  const { positions, sizes, colors } = useMemo(() => {
    const pos = generateStarPositions(STAR_FIELD_CONFIG.count, STAR_FIELD_CONFIG.radius);
    const sz = generateStarSizes(
      STAR_FIELD_CONFIG.count,
      STAR_FIELD_CONFIG.minSize,
      STAR_FIELD_CONFIG.maxSize
    );
    const colorArr = new Float32Array(STAR_FIELD_CONFIG.count * 3);
    const palette = STAR_FIELD_CONFIG.colors.map((hex) => new THREE.Color(hex));
    for (let i = 0; i < STAR_FIELD_CONFIG.count; i++) {
      const c = palette[i % palette.length]!;
      colorArr[i * 3] = c.r;
      colorArr[i * 3 + 1] = c.g;
      colorArr[i * 3 + 2] = c.b;
    }
    return { positions: pos, sizes: sz, colors: colorArr };
  }, []);

  useFrame(({ clock }) => {
    if (!pointsRef.current) return;
    const geo = pointsRef.current.geometry;
    const sizeAttr = geo.getAttribute('size');
    if (!sizeAttr) return;
    const arr = sizeAttr.array as Float32Array;
    const t = clock.elapsedTime * STAR_FIELD_CONFIG.twinkleSpeed;
    for (let i = 0; i < arr.length; i++) {
      arr[i] = sizes[i]! * (0.7 + 0.3 * Math.sin(t + i * 1.37));
    }
    sizeAttr.needsUpdate = true;
  });

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
      </bufferGeometry>
      <pointsMaterial
        vertexColors
        sizeAttenuation
        transparent
        opacity={0.9}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  );
}
