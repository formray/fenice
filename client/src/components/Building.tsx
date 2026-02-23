import { useRef } from 'react';
import type { Mesh } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import type { WorldEndpoint } from '../types/world';
import type { BuildingLayout } from '../services/layout.service';
import {
  METHOD_COLORS,
  LINK_STATE_COLORS,
  ACCENT_RING_HEIGHT,
  ACCENT_EMISSIVE_INTENSITY,
} from '../utils/colors';
import { useSelectionStore } from '../stores/selection.store';
import { useWorldStore } from '../stores/world.store';

interface BuildingProps {
  layout: BuildingLayout;
  endpoint: WorldEndpoint;
}

export function Building({ layout, endpoint }: BuildingProps): React.JSX.Element {
  const meshRef = useRef<Mesh>(null);
  const selectedId = useSelectionStore((s) => s.selectedId);
  const setSelected = useSelectionStore((s) => s.setSelected);
  const semantics = useWorldStore((s) => s.endpointSemantics[endpoint.id]);
  const isSelected = selectedId === endpoint.id;
  const methodColor = METHOD_COLORS[endpoint.method];

  const linkStyle = semantics ? LINK_STATE_COLORS[semantics.linkState] : LINK_STATE_COLORS.unknown;

  // Visual precedence: selection > method color (body is always method-colored)
  const baseColor = isSelected ? '#ffffff' : methodColor;
  const accentBandY = ACCENT_RING_HEIGHT + 0.06;

  const handleClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    setSelected(isSelected ? null : endpoint.id);
  };

  return (
    <group>
      {/* Building body — method color, no semantic glow */}
      <RoundedBox
        ref={meshRef}
        args={[layout.width, layout.height, layout.depth]}
        radius={0.08}
        smoothness={4}
        position={[layout.position.x, layout.height / 2, layout.position.z]}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          document.body.style.cursor = 'pointer';
        }}
        onPointerOut={() => {
          document.body.style.cursor = 'auto';
        }}
      >
        <meshStandardMaterial
          color={baseColor}
          emissive="#000000"
          emissiveIntensity={0.02}
          roughness={0.6}
          metalness={0.1}
          transparent={false}
          opacity={1.0}
        />
      </RoundedBox>

      {/* Link-state accent band near the base, slightly raised for camera readability */}
      <mesh position={[layout.position.x, accentBandY, layout.position.z]}>
        <boxGeometry args={[layout.width + 0.1, ACCENT_RING_HEIGHT, layout.depth + 0.1]} />
        <meshStandardMaterial
          color={linkStyle.hex}
          emissive={linkStyle.hex}
          emissiveIntensity={ACCENT_EMISSIVE_INTENSITY}
          roughness={0.3}
          metalness={0.2}
          transparent={linkStyle.opacity < 1}
          opacity={linkStyle.opacity}
        />
      </mesh>
    </group>
  );
}
