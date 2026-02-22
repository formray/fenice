import { useRef, useState } from 'react';
import type { Mesh } from 'three';
import type { ThreeEvent } from '@react-three/fiber';
import type { WorldEndpoint } from '../types/world';
import type { BuildingLayout } from '../services/layout.service';
import { METHOD_COLORS, LINK_STATE_COLORS } from '../utils/colors';
import { useSelectionStore } from '../stores/selection.store';
import { useWorldStore } from '../stores/world.store';

interface BuildingProps {
  layout: BuildingLayout;
  endpoint: WorldEndpoint;
}

export function Building({ layout, endpoint }: BuildingProps): React.JSX.Element {
  const meshRef = useRef<Mesh>(null);
  const [hovered, setHovered] = useState(false);
  const selectedId = useSelectionStore((s) => s.selectedId);
  const setSelected = useSelectionStore((s) => s.setSelected);
  const semantics = useWorldStore((s) => s.endpointSemantics[endpoint.id]);
  const isSelected = selectedId === endpoint.id;
  const methodColor = METHOD_COLORS[endpoint.method];

  const linkStyle = semantics ? LINK_STATE_COLORS[semantics.linkState] : LINK_STATE_COLORS.unknown;

  // Visual precedence: selection/hover > linkState > method color
  const baseColor = isSelected ? '#ffffff' : methodColor;
  const emissiveColor = hovered ? methodColor : linkStyle.hex;
  const emissiveIntensity = hovered ? 0.4 : linkStyle.emissiveIntensity;
  const opacity = isSelected || hovered ? 1.0 : linkStyle.opacity;

  const handleClick = (e: ThreeEvent<MouseEvent>): void => {
    e.stopPropagation();
    setSelected(isSelected ? null : endpoint.id);
  };

  return (
    <mesh
      ref={meshRef}
      position={[layout.position.x, layout.height / 2, layout.position.z]}
      onClick={handleClick}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
        document.body.style.cursor = 'pointer';
      }}
      onPointerOut={() => {
        setHovered(false);
        document.body.style.cursor = 'auto';
      }}
    >
      <boxGeometry args={[layout.width, layout.height, layout.depth]} />
      <meshStandardMaterial
        color={baseColor}
        emissive={emissiveColor}
        emissiveIntensity={emissiveIntensity}
        roughness={0.6}
        metalness={0.1}
        transparent={opacity < 1}
        opacity={opacity}
      />
    </mesh>
  );
}
