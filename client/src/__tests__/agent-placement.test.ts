import { describe, it, expect } from 'vitest';
import { AGENT_LAYOUT, agentPositionAt, placeAgent } from '../utils/agent-placement';

describe('agent-placement', () => {
  it('placeAgent is deterministic per agentId', () => {
    const a = placeAgent('alpha');
    const b = placeAgent('alpha');
    expect(a).toEqual(b);
  });

  it('placeAgent gives different placements for different ids', () => {
    const a = placeAgent('alpha');
    const b = placeAgent('beta');
    expect(a).not.toEqual(b);
  });

  it('y stays within configured band', () => {
    for (const id of ['a', 'b', 'c', 'session-aaaaaa', 'session-bbbbbb']) {
      const { y } = placeAgent(id);
      expect(y).toBeGreaterThanOrEqual(AGENT_LAYOUT.yMin);
      expect(y).toBeLessThanOrEqual(AGENT_LAYOUT.yMax);
    }
  });

  it('agentPositionAt traces a circle of radius ringRadius in the X/Z plane', () => {
    const id = 'agent-1';
    for (const t of [0, 5, 12, 100]) {
      const p = agentPositionAt(id, t);
      const r = Math.hypot(p.x, p.z);
      expect(Math.abs(r - AGENT_LAYOUT.ringRadius)).toBeLessThan(1e-6);
    }
  });

  it('agentPositionAt advances over time (orbital motion)', () => {
    const a = agentPositionAt('agent-1', 0);
    const b = agentPositionAt('agent-1', 10);
    expect(a).not.toEqual(b);
  });
});
