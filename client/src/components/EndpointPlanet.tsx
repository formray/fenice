import { useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { ThreeEvent } from '@react-three/fiber';
import type { EndpointPlanetLayout } from '../services/cosmos-layout.service';
import type { WorldEndpoint } from '../types/world';
import { ENDPOINT_PLANET, METHOD_SHAPES } from '../utils/cosmos';
import type { PlanetShape } from '../utils/cosmos';
import { METHOD_COLORS, LINK_STATE_COLORS } from '../utils/colors';
import { useSelectionStore } from '../stores/selection.store';
import { useWorldStore } from '../stores/world.store';
import { useViewStore } from '../stores/view.store';
import { useCosmosSettingsStore } from '../stores/cosmos-settings.store';

interface EndpointPlanetProps {
  planet: EndpointPlanetLayout;
  endpoint: WorldEndpoint;
}

function PlanetGeometry({
  method,
  size,
}: {
  method: WorldEndpoint['method'];
  size: number;
}): React.JSX.Element {
  const shape: PlanetShape =
    (METHOD_SHAPES as Partial<Record<string, PlanetShape>>)[method] ?? 'sphere';
  switch (shape) {
    case 'sphere':
      return <icosahedronGeometry args={[size, 2]} />;
    case 'icosahedron':
      return <icosahedronGeometry args={[size, 0]} />;
    case 'torus':
      return <torusGeometry args={[size, size * 0.4, 12, 24]} />;
    case 'octahedron':
      return <octahedronGeometry args={[size, 0]} />;
    case 'dodecahedron':
      return <dodecahedronGeometry args={[size, 0]} />;
  }
}

export function EndpointPlanet({ planet, endpoint }: EndpointPlanetProps): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const [hovered, setHovered] = useState(false);

  const selectedId = useSelectionStore((s) => s.selectedId);
  const setSelected = useSelectionStore((s) => s.setSelected);
  const semantics = useWorldStore((s) => s.endpointSemantics[endpoint.id]);
  const setFocusTarget = useViewStore((s) => s.setFocusTarget);
  const orbitSpeedMultiplier = useCosmosSettingsStore((s) => s.orbitSpeed);

  const isSelected = selectedId === endpoint.id;
  const methodColor = METHOD_COLORS[endpoint.method];
  const linkStyle = semantics ? LINK_STATE_COLORS[semantics.linkState] : LINK_STATE_COLORS.unknown;

  const handleClick = useCallback(
    (e: ThreeEvent<MouseEvent>) => {
      e.stopPropagation();
      setSelected(isSelected ? null : endpoint.id);
      // Click-to-focus: camera targets this planet's orbit center
      if (!isSelected) {
        setFocusTarget([planet.orbitCenter.x, planet.orbitCenter.y, planet.orbitCenter.z]);
      }
    },
    [isSelected, endpoint.id, setSelected, setFocusTarget, planet.orbitCenter]
  );

  const handlePointerOver = useCallback((e: ThreeEvent<PointerEvent>) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  }, []);

  const handlePointerOut = useCallback(() => {
    setHovered(false);
    document.body.style.cursor = 'auto';
  }, []);

  // Orbit + self-rotation animation
  useFrame(({ clock }) => {
    if (!groupRef.current || !meshRef.current) return;
    const speedRatio = orbitSpeedMultiplier / ENDPOINT_PLANET.baseOrbitSpeed;
    const t = clock.elapsedTime * planet.orbitSpeed * speedRatio + planet.orbitPhase;

    // Tilted orbit position
    const xOrbit = Math.cos(t) * planet.orbitRadius;
    const zOrbit = Math.sin(t) * planet.orbitRadius;
    groupRef.current.position.set(
      planet.orbitCenter.x + xOrbit,
      planet.orbitCenter.y + zOrbit * Math.sin(planet.orbitTilt),
      planet.orbitCenter.z + zOrbit * Math.cos(planet.orbitTilt)
    );

    // Self-rotation
    meshRef.current.rotation.y += ENDPOINT_PLANET.selfRotationSpeed;

    // Hover scale
    const targetScale = hovered ? ENDPOINT_PLANET.hoverScale : 1;
    const s = groupRef.current.scale.x;
    const newScale = THREE.MathUtils.lerp(s, targetScale, 0.1);
    groupRef.current.scale.setScalar(newScale);
  });

  return (
    <group ref={groupRef}>
      {/* Planet body */}
      <mesh
        ref={meshRef}
        onClick={handleClick}
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
      >
        <PlanetGeometry method={endpoint.method} size={planet.size} />
        <meshPhysicalMaterial
          color={isSelected ? '#ffffff' : methodColor}
          emissive={methodColor}
          emissiveIntensity={isSelected ? 0.6 : ENDPOINT_PLANET.emissiveIntensity}
          roughness={ENDPOINT_PLANET.roughness}
          metalness={ENDPOINT_PLANET.metalness}
          clearcoat={ENDPOINT_PLANET.clearcoat}
          clearcoatRoughness={ENDPOINT_PLANET.clearcoatRoughness}
          transparent={linkStyle.opacity < 1}
          opacity={linkStyle.opacity}
        />
      </mesh>

      {/* Wireframe overlay */}
      <mesh>
        <PlanetGeometry method={endpoint.method} size={planet.size * 1.02} />
        <meshBasicMaterial
          color={methodColor}
          wireframe
          transparent
          opacity={
            hovered ? ENDPOINT_PLANET.wireframeOpacity * 2 : ENDPOINT_PLANET.wireframeOpacity
          }
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
