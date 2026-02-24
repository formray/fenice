// client/src/components/Wormhole.tsx
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import type { CosmosPosition } from '../services/cosmos-layout.service';
import { useWorldStore } from '../stores/world.store';
import { LINK_STATE_COLORS } from '../utils/colors';
import { WORMHOLE } from '../utils/cosmos';

/** Create a procedural radial portal texture. */
function createPortalTexture(color: string): THREE.CanvasTexture {
  const size = 256;
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  const gradient = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  gradient.addColorStop(0, color + '60');
  gradient.addColorStop(0.3, color + '30');
  gradient.addColorStop(0.6, color + '15');
  gradient.addColorStop(1, 'transparent');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

interface WormholeProps {
  position: CosmosPosition;
}

export function Wormhole({ position }: WormholeProps): React.JSX.Element {
  const ringRef = useRef<THREE.Mesh>(null);
  const portalRef = useRef<THREE.Mesh>(null);
  const authGate = useWorldStore((s) => s.authGate);
  const linkStyle = LINK_STATE_COLORS[authGate.linkState];

  const portalTexture = useMemo(() => createPortalTexture(linkStyle.hex), [linkStyle.hex]);
  const glowTexture = useMemo(() => createPortalTexture(linkStyle.hex), [linkStyle.hex]);

  useFrame(({ clock }) => {
    // Ring rotation
    if (ringRef.current) {
      ringRef.current.rotation.x = Math.PI / 2 + Math.sin(clock.elapsedTime * 0.3) * 0.1;
      ringRef.current.rotation.z += WORMHOLE.rotationSpeed * 0.01;
    }

    // Portal opacity pulse
    if (portalRef.current) {
      const mat = portalRef.current.material;
      if (mat instanceof THREE.MeshBasicMaterial) {
        mat.opacity = authGate.open
          ? WORMHOLE.portalOpacity + 0.05 * Math.sin(clock.elapsedTime * 2)
          : WORMHOLE.portalOpacity * 0.3;
      }
    }
  });

  return (
    <group position={[position.x, position.y, position.z]}>
      {/* Torus ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry
          args={[
            WORMHOLE.ringRadius,
            WORMHOLE.tubeRadius,
            WORMHOLE.ringRadialSegments,
            WORMHOLE.ringSegments,
          ]}
        />
        <meshPhysicalMaterial
          color={linkStyle.hex}
          emissive={linkStyle.hex}
          emissiveIntensity={
            authGate.open ? WORMHOLE.emissiveIntensity : WORMHOLE.emissiveIntensity * 0.3
          }
          metalness={WORMHOLE.metalness}
          roughness={WORMHOLE.roughness}
          clearcoat={WORMHOLE.clearcoat}
        />
      </mesh>

      {/* Inner portal surface */}
      <mesh ref={portalRef} rotation={[Math.PI / 2, 0, 0]}>
        <circleGeometry args={[WORMHOLE.portalRadius, 48]} />
        <meshBasicMaterial
          map={portalTexture}
          transparent
          opacity={WORMHOLE.portalOpacity}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Glow sprite */}
      <sprite scale={[6, 6, 1]}>
        <spriteMaterial
          map={glowTexture}
          transparent
          opacity={authGate.open ? 0.15 : 0.05}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </sprite>

      {/* Label */}
      <Html center occlude={false} position={[0, WORMHOLE.ringRadius + 1.0, 0]}>
        <div
          style={{
            pointerEvents: 'none',
            fontSize: '14px',
            fontWeight: 700,
            color: '#00e5ff',
            textShadow: '0 0 12px rgba(0,229,255,0.6), 0 0 4px rgba(0,0,0,0.9)',
            whiteSpace: 'nowrap',
            letterSpacing: '2px',
            textTransform: 'uppercase',
          }}
        >
          Gateway
        </div>
      </Html>

      {/* Point light */}
      <pointLight
        color={linkStyle.hex}
        intensity={authGate.open ? 1.5 : 0.3}
        distance={25}
        decay={2}
      />
    </group>
  );
}
