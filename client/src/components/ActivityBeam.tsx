import { useMemo, useRef } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import type { ActiveBeam } from '../types/agent';
import { ROLE_COLORS, BEAM_TTL_MS } from '../types/agent';
import { useAgentStore } from '../stores/agent.store';
import { agentPositionAt } from '../utils/agent-placement';

interface ActivityBeamProps {
  beam: ActiveBeam;
  /**
   * Target world position (precomputed by the parent so we don't recompute the
   * cosmos layout per beam).
   */
  targetPosition: { x: number; y: number; z: number };
}

const BEAM = {
  segments: 32,
  radialSegments: 4,
  tubeRadius: 0.06,
  archHeight: 4,
  baseOpacity: 0.85,
} as const;

/**
 * A short-lived luminous tube from the agent's current orbit position to a
 * target planet/service. Fades alpha linearly over BEAM_TTL_MS.
 */
export function ActivityBeam({ beam, targetPosition }: ActivityBeamProps): React.JSX.Element {
  const tubeRef = useRef<THREE.Mesh>(null);
  const materialRef = useRef<THREE.MeshBasicMaterial>(null);
  const role = useAgentStore((s) => s.agents[beam.agentId]?.role ?? 'generic');
  const color = ROLE_COLORS[role];

  // We rebuild the curve each frame (cheap — 32 segments, single tube).
  // Because the agent's orbital position changes slowly, freezing geometry
  // at beam-start would still look fine, but real-time tracking feels alive.
  const tmpStart = useMemo(() => new THREE.Vector3(), []);
  const tmpEnd = useMemo(
    () => new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z),
    [targetPosition]
  );

  useFrame((state) => {
    const tube = tubeRef.current;
    const material = materialRef.current;
    if (!tube || !material) return;

    const elapsed = Date.now() - beam.startedAt;
    const lifeFraction = Math.min(1, elapsed / BEAM_TTL_MS);

    // Fade out: full opacity for the first half, then linear decay
    const fade = lifeFraction < 0.5 ? 1 : 1 - (lifeFraction - 0.5) / 0.5;
    material.opacity = BEAM.baseOpacity * fade;

    // Update geometry — agent moves along its orbit
    const t = state.clock.elapsedTime;
    const agentPos = agentPositionAt(beam.agentId, t);
    tmpStart.set(agentPos.x, agentPos.y, agentPos.z);

    const mid = tmpStart.clone().lerp(tmpEnd, 0.5);
    mid.y += BEAM.archHeight;
    const curve = new THREE.CatmullRomCurve3([tmpStart.clone(), mid, tmpEnd.clone()]);

    // Replace geometry. Disposing the old one avoids GPU memory leaks.
    const oldGeometry = tube.geometry;
    tube.geometry = new THREE.TubeGeometry(
      curve,
      BEAM.segments,
      BEAM.tubeRadius,
      BEAM.radialSegments,
      false
    );
    oldGeometry.dispose();
  });

  return (
    <mesh ref={tubeRef}>
      <tubeGeometry
        args={[
          new THREE.CatmullRomCurve3([
            new THREE.Vector3(0, 0, 0),
            new THREE.Vector3(0, BEAM.archHeight, 0),
            new THREE.Vector3(targetPosition.x, targetPosition.y, targetPosition.z),
          ]),
          BEAM.segments,
          BEAM.tubeRadius,
          BEAM.radialSegments,
          false,
        ]}
      />
      <meshBasicMaterial
        ref={materialRef}
        color={color}
        transparent
        opacity={BEAM.baseOpacity}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </mesh>
  );
}
