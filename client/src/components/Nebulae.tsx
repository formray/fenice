import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { NEBULA_CONFIG } from '../utils/atmosphere';

function createNebulaTexture(color: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;

  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color + '40');
  gradient.addColorStop(0.3, color + '20');
  gradient.addColorStop(0.7, color + '08');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);

  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface NebulaData {
  position: [number, number, number];
  scale: number;
  rotation: number;
  texture: THREE.CanvasTexture;
  rotationSpeed: number;
}

export function Nebulae(): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);

  const nebulae = useMemo<NebulaData[]>(() => {
    return NEBULA_CONFIG.colors.map((color, i) => {
      const angle = (i / NEBULA_CONFIG.count) * Math.PI * 2 + Math.random() * 0.5;
      const dist = 80 + Math.random() * 40;
      return {
        position: [Math.cos(angle) * dist, (Math.random() - 0.5) * 40, Math.sin(angle) * dist] as [
          number,
          number,
          number,
        ],
        scale:
          NEBULA_CONFIG.minScale +
          Math.random() * (NEBULA_CONFIG.maxScale - NEBULA_CONFIG.minScale),
        rotation: Math.random() * Math.PI * 2,
        texture: createNebulaTexture(color),
        rotationSpeed: NEBULA_CONFIG.rotationSpeed * (0.8 + Math.random() * 0.4),
      };
    });
  }, []);

  useFrame(() => {
    if (!groupRef.current) return;
    for (let i = 0; i < groupRef.current.children.length; i++) {
      const child = groupRef.current.children[i];
      if (child) {
        child.rotation.z += nebulae[i]!.rotationSpeed;
      }
    }
  });

  return (
    <group ref={groupRef}>
      {nebulae.map((n, i) => (
        <sprite
          key={`nebula-${i}`}
          position={n.position}
          scale={[n.scale, n.scale, 1]}
          rotation={[0, 0, n.rotation]}
        >
          <spriteMaterial
            map={n.texture}
            transparent
            opacity={NEBULA_CONFIG.opacity}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
          />
        </sprite>
      ))}
    </group>
  );
}
