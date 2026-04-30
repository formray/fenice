import { seededRandom } from './cosmos';

/**
 * Layout constants shared between AgentEntity and ActivityBeam so the
 * beam endpoint matches the rendered probe position exactly.
 */
export const AGENT_LAYOUT = {
  ringRadius: 35,
  yMin: -5,
  yMax: 8,
  bodySize: 0.4,
  glowSize: 1.4,
  orbitSpeed: 0.04,
  spinSpeed: 0.6,
  busyPulseSpeed: 4,
  busyPulseAmplitude: 0.2,
} as const;

export interface AgentPlacement {
  angle0: number;
  y: number;
}

/** Deterministic [angle, y] placement from agentId. */
export function placeAgent(agentId: string): AgentPlacement {
  const angle0 = seededRandom(agentId, 0) * Math.PI * 2;
  const y = AGENT_LAYOUT.yMin + seededRandom(agentId, 1) * (AGENT_LAYOUT.yMax - AGENT_LAYOUT.yMin);
  return { angle0, y };
}

/** Compute the agent's current world position at time `t` (seconds). */
export function agentPositionAt(agentId: string, t: number): { x: number; y: number; z: number } {
  const { angle0, y } = placeAgent(agentId);
  const angle = angle0 + t * AGENT_LAYOUT.orbitSpeed;
  return {
    x: Math.cos(angle) * AGENT_LAYOUT.ringRadius,
    y,
    z: Math.sin(angle) * AGENT_LAYOUT.ringRadius,
  };
}
