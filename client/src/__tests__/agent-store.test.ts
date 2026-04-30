import { describe, it, expect, beforeEach } from 'vitest';
import { useAgentStore } from '../stores/agent.store';

describe('agent.store', () => {
  beforeEach(() => {
    useAgentStore.getState().reset();
  });

  it('applyConnected adds an agent with status "connected"', () => {
    useAgentStore.getState().applyConnected('sess-1', {
      agentId: 'sess-1',
      name: 'demo-bot',
      role: 'monitor',
    });
    const agents = useAgentStore.getState().agents;
    expect(agents['sess-1']?.name).toBe('demo-bot');
    expect(agents['sess-1']?.role).toBe('monitor');
    expect(agents['sess-1']?.status).toBe('connected');
  });

  it('applyDisconnected removes the agent', () => {
    useAgentStore.getState().applyConnected('sess-1', {
      agentId: 'sess-1',
      name: 'a',
      role: 'generic',
    });
    useAgentStore.getState().applyDisconnected('sess-1');
    expect(useAgentStore.getState().agents['sess-1']).toBeUndefined();
  });

  it('applyActivity flips status to busy on started, back to connected on completed', () => {
    useAgentStore.getState().applyConnected('sess-1', {
      agentId: 'sess-1',
      name: 'a',
      role: 'generic',
    });
    useAgentStore.getState().applyActivity('sess-1', {
      agentId: 'sess-1',
      tool: 'list_endpoints',
      status: 'started',
    });
    expect(useAgentStore.getState().agents['sess-1']?.status).toBe('busy');
    expect(useAgentStore.getState().agents['sess-1']?.currentTool).toBe('list_endpoints');

    useAgentStore.getState().applyActivity('sess-1', {
      agentId: 'sess-1',
      tool: 'list_endpoints',
      status: 'completed',
      durationMs: 12,
    });
    expect(useAgentStore.getState().agents['sess-1']?.status).toBe('connected');
    expect(useAgentStore.getState().agents['sess-1']?.currentTool).toBeUndefined();
  });

  it('applyActivity is a no-op for unknown agent', () => {
    useAgentStore.getState().applyActivity('never-seen', {
      agentId: 'never-seen',
      tool: 'x',
      status: 'started',
    });
    expect(useAgentStore.getState().feed).toHaveLength(0);
    expect(Object.keys(useAgentStore.getState().agents)).toHaveLength(0);
  });

  it('feed is capped and newest-first', () => {
    useAgentStore.getState().applyConnected('sess-1', {
      agentId: 'sess-1',
      name: 'a',
      role: 'generic',
    });
    for (let i = 0; i < 25; i++) {
      useAgentStore.getState().applyActivity('sess-1', {
        agentId: 'sess-1',
        tool: `tool-${i}`,
        status: 'completed',
        durationMs: 1,
      });
    }
    const feed = useAgentStore.getState().feed;
    expect(feed.length).toBe(20);
    // newest first → tool-24 should be at index 0
    expect(feed[0]?.tool).toBe('tool-24');
  });

  it('beam is created when activity has a target and status started', () => {
    useAgentStore.getState().applyConnected('sess-1', {
      agentId: 'sess-1',
      name: 'a',
      role: 'tester',
    });
    useAgentStore.getState().applyActivity('sess-1', {
      agentId: 'sess-1',
      tool: 'check_health',
      status: 'started',
      target: { type: 'service', id: 'service:health' },
    });
    expect(useAgentStore.getState().beams).toHaveLength(1);
    expect(useAgentStore.getState().beams[0]?.target.id).toBe('service:health');
  });

  it('no beam when started without target', () => {
    useAgentStore.getState().applyConnected('sess-1', {
      agentId: 'sess-1',
      name: 'a',
      role: 'generic',
    });
    useAgentStore.getState().applyActivity('sess-1', {
      agentId: 'sess-1',
      tool: 'list_endpoints',
      status: 'started',
    });
    expect(useAgentStore.getState().beams).toHaveLength(0);
  });

  it('pruneBeams drops expired beams past TTL', () => {
    useAgentStore.getState().applyConnected('sess-1', {
      agentId: 'sess-1',
      name: 'a',
      role: 'generic',
    });
    useAgentStore.getState().applyActivity('sess-1', {
      agentId: 'sess-1',
      tool: 'check_health',
      status: 'started',
      target: { type: 'service', id: 's:1' },
    });
    expect(useAgentStore.getState().beams).toHaveLength(1);

    // Pretend 5 seconds have passed
    useAgentStore.getState().pruneBeams(Date.now() + 5_000);
    expect(useAgentStore.getState().beams).toHaveLength(0);
  });

  it('disconnect clears all beams owned by that agent', () => {
    useAgentStore.getState().applyConnected('sess-1', {
      agentId: 'sess-1',
      name: 'a',
      role: 'generic',
    });
    useAgentStore.getState().applyActivity('sess-1', {
      agentId: 'sess-1',
      tool: 'x',
      status: 'started',
      target: { type: 'service', id: 's:1' },
    });
    useAgentStore.getState().applyDisconnected('sess-1');
    expect(useAgentStore.getState().beams).toHaveLength(0);
  });
});
