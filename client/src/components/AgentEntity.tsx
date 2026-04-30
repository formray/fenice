import { useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { AgentEntity as AgentEntityType } from '../types/agent';
import { ROLE_COLORS } from '../types/agent';
import { AGENT_LAYOUT, placeAgent } from '../utils/agent-placement';

interface AgentEntityProps {
  agent: AgentEntityType;
}

export function AgentEntity({ agent }: AgentEntityProps): React.JSX.Element {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const { angle0, y } = placeAgent(agent.id);
  const color = ROLE_COLORS[agent.role];

  useFrame((_, delta) => {
    const group = groupRef.current;
    const mesh = meshRef.current;
    if (!group || !mesh) return;

    // Slow orbital motion
    group.userData['t'] = ((group.userData['t'] as number | undefined) ?? 0) + delta;
    const t = group.userData['t'] as number;
    const angle = angle0 + t * AGENT_LAYOUT.orbitSpeed;
    group.position.set(
      Math.cos(angle) * AGENT_LAYOUT.ringRadius,
      y,
      Math.sin(angle) * AGENT_LAYOUT.ringRadius
    );

    // Self-rotation
    mesh.rotation.x += delta * AGENT_LAYOUT.spinSpeed;
    mesh.rotation.y += delta * AGENT_LAYOUT.spinSpeed * 0.7;

    // Pulse when busy
    const isBusy = agent.status === 'busy';
    const baseScale = 1;
    const pulse = isBusy
      ? baseScale + Math.sin(t * AGENT_LAYOUT.busyPulseSpeed) * AGENT_LAYOUT.busyPulseAmplitude
      : baseScale;
    mesh.scale.setScalar(pulse);
  });

  return (
    <group ref={groupRef}>
      {/* Core body — octahedron probe */}
      <mesh ref={meshRef}>
        <octahedronGeometry args={[AGENT_LAYOUT.bodySize, 0]} />
        <meshPhysicalMaterial
          color={color}
          emissive={color}
          emissiveIntensity={1.4}
          metalness={0.6}
          roughness={0.2}
          clearcoat={0.8}
        />
      </mesh>

      {/* Glow halo — additive sprite-like sphere */}
      <mesh>
        <sphereGeometry args={[AGENT_LAYOUT.glowSize, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.15}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>
    </group>
  );
}
