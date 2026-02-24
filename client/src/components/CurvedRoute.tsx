// client/src/components/CurvedRoute.tsx
import { useRef, useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { CosmosPosition } from '../services/cosmos-layout.service';
import { CURVED_ROUTE } from '../utils/cosmos';
import { useCosmosSettingsStore } from '../stores/cosmos-settings.store';

interface CurvedRouteProps {
  from: CosmosPosition;
  to: CosmosPosition;
  color: string;
  opacity?: number | undefined;
  tubeRadius?: number | undefined;
  pulseSize?: number | undefined;
}

export function CurvedRoute({
  from,
  to,
  color,
  opacity,
  tubeRadius,
  pulseSize,
}: CurvedRouteProps): React.JSX.Element {
  const pulseRef = useRef<THREE.Mesh>(null);
  const archHeight = useCosmosSettingsStore((s) => s.routeArchHeight);
  const settingsOpacity = useCosmosSettingsStore((s) => s.routeOpacity);

  // Settings opacity acts as the base; explicit opacity prop scales proportionally
  const baseOpacity =
    opacity != null ? opacity * (settingsOpacity / CURVED_ROUTE.opacity) : settingsOpacity;

  const curve = useMemo(() => {
    const start = new THREE.Vector3(from.x, from.y, from.z);
    const end = new THREE.Vector3(to.x, to.y, to.z);
    const mid = start.clone().lerp(end, 0.5);
    mid.y += archHeight;
    return new THREE.CatmullRomCurve3([start, mid, end]);
  }, [from, to, archHeight]);

  const tubeGeometry = useMemo(
    () =>
      new THREE.TubeGeometry(
        curve,
        CURVED_ROUTE.segments,
        tubeRadius ?? CURVED_ROUTE.tubeRadius,
        CURVED_ROUTE.radialSegments,
        false
      ),
    [curve, tubeRadius]
  );

  // Animate pulse sphere along the curve
  useFrame(({ clock }) => {
    if (!pulseRef.current) return;
    const t = (clock.elapsedTime * CURVED_ROUTE.pulseSpeed) % 1;
    const point = curve.getPoint(t);
    pulseRef.current.position.copy(point);
  });

  return (
    <group>
      {/* Tube route */}
      <mesh geometry={tubeGeometry}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={Math.min(baseOpacity, 1)}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Animated pulse */}
      <mesh ref={pulseRef}>
        <sphereGeometry args={[pulseSize ?? CURVED_ROUTE.pulseSize, 8, 8]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.9}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
