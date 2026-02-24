import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { ServiceStarLayout } from '../services/cosmos-layout.service';
import { SERVICE_STAR } from '../utils/cosmos';
import { METHOD_COLORS } from '../utils/colors';
import { useWorldStore } from '../stores/world.store';
import { useCosmosSettingsStore } from '../stores/cosmos-settings.store';

/** Create a procedural radial glow texture. */
function createGlowTexture(color: string): THREE.CanvasTexture {
  const size = 128;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color + '80');
  gradient.addColorStop(0.4, color + '30');
  gradient.addColorStop(0.7, color + '10');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface ServiceStarProps {
  star: ServiceStarLayout;
}

export function ServiceStar({ star }: ServiceStarProps): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  const endpoints = useWorldStore((s) => s.endpoints);
  const coreRadius = useCosmosSettingsStore((s) => s.starCoreRadius);
  const emissiveIntensity = useCosmosSettingsStore((s) => s.starEmissiveIntensity);
  const glowScale = useCosmosSettingsStore((s) => s.starGlowScale);

  // Determine star color from the dominant method of its endpoints
  const starColor = useMemo(() => {
    const serviceEps = endpoints.filter((e) => e.serviceId === star.serviceId);
    const method = serviceEps[0]?.method ?? 'get';
    return METHOD_COLORS[method];
  }, [endpoints, star.serviceId]);

  const glowTexture = useMemo(() => createGlowTexture(starColor), [starColor]);
  const coronaTexture = useMemo(() => createGlowTexture(starColor), [starColor]);

  // Gentle pulse animation
  useFrame(({ clock }) => {
    if (!groupRef.current) return;
    const t = clock.elapsedTime * SERVICE_STAR.pulseSpeed;
    const scale =
      SERVICE_STAR.pulseMin +
      ((SERVICE_STAR.pulseMax - SERVICE_STAR.pulseMin) / 2) * (1 + Math.sin(t));
    groupRef.current.scale.setScalar(scale);
  });

  return (
    <group ref={groupRef} position={[star.position.x, star.position.y, star.position.z]}>
      {/* Core star sphere */}
      <mesh>
        <sphereGeometry args={[coreRadius, 32, 32]} />
        <meshPhysicalMaterial
          color={starColor}
          emissive={starColor}
          emissiveIntensity={emissiveIntensity}
          roughness={SERVICE_STAR.roughness}
          metalness={SERVICE_STAR.metalness}
        />
      </mesh>

      {/* Large glow sprite */}
      <sprite scale={[glowScale, glowScale, 1]}>
        <spriteMaterial
          map={glowTexture}
          transparent
          opacity={SERVICE_STAR.glowOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      {/* Corona sprite (smaller, brighter) */}
      <sprite scale={[SERVICE_STAR.coronaScale, SERVICE_STAR.coronaScale, 1]}>
        <spriteMaterial
          map={coronaTexture}
          transparent
          opacity={SERVICE_STAR.coronaOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      {/* Point light to illuminate nearby planets */}
      <pointLight color={starColor} intensity={1.0} distance={20} decay={2} />

      {/* Label */}
      <Html center occlude={false} position={[0, coreRadius + 1.2, 0]}>
        <div
          style={{
            pointerEvents: 'none',
            fontSize: '13px',
            fontWeight: 600,
            color: '#e0f0ff',
            textShadow: '0 0 8px rgba(0,0,0,0.9)',
            whiteSpace: 'nowrap',
          }}
        >
          {star.tag}
        </div>
      </Html>
    </group>
  );
}
