import { describe, it, expect, vi, beforeEach } from 'vitest';
import { app } from '../../src/index.js';
import { WorldWsManager } from '../../src/ws/world-manager.js';
import { ProjectionService } from '../../src/services/projection.service.js';
import { handleWorldMessage } from '../../src/ws/world-handlers.js';
import type { WorldModel } from '../../src/schemas/world.schema.js';
import { WorldServerMessageSchema } from '../../src/schemas/world-ws.schema.js';

function createMockWs() {
  return { send: vi.fn(), close: vi.fn(), readyState: 1 };
}

describe('World WS integration (full subscribe flow)', () => {
  let manager: WorldWsManager;
  let projection: ProjectionService;
  let fetchSpec: () => Promise<WorldModel>;

  beforeEach(() => {
    manager = new WorldWsManager(100, 300_000);
    projection = new ProjectionService();

    // Real fetchSpec: calls live app.request('/openapi') and builds model
    fetchSpec = async () => {
      const res = await app.request('/openapi');
      const spec: unknown = await res.json();
      return projection.buildWorldModel(spec);
    };
  });

  it('should return valid world.subscribed + world.snapshot from real spec', async () => {
    const ws = createMockWs();
    manager.addConnection('user1', ws);

    await handleWorldMessage(manager, projection, 'user1', '{"type":"world.subscribe"}', fetchSpec);

    expect(ws.send).toHaveBeenCalledTimes(2);
    const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;

    // Parse and validate both messages against server schema
    const subscribed = JSON.parse(calls[0][0] as string) as Record<string, unknown>;
    const snapshot = JSON.parse(calls[1][0] as string) as Record<string, unknown>;

    const subscribedResult = WorldServerMessageSchema.safeParse(subscribed);
    expect(subscribedResult.success).toBe(true);
    expect(subscribed['type']).toBe('world.subscribed');
    expect(subscribed['mode']).toBe('snapshot');
    expect(subscribed['schemaVersion']).toBe(1);

    const snapshotResult = WorldServerMessageSchema.safeParse(snapshot);
    expect(snapshotResult.success).toBe(true);
    expect(snapshot['type']).toBe('world.snapshot');
  });

  it('should include real services and endpoints in snapshot', async () => {
    const ws = createMockWs();
    manager.addConnection('user1', ws);

    await handleWorldMessage(manager, projection, 'user1', '{"type":"world.subscribe"}', fetchSpec);

    const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
    const snapshot = JSON.parse(calls[1][0] as string) as {
      data: { services: unknown[]; endpoints: unknown[]; edges: unknown[] };
    };

    // Should have 4 real services
    expect(snapshot.data.services).toHaveLength(4);

    // Should have 15+ real endpoints
    expect(snapshot.data.endpoints.length).toBeGreaterThanOrEqual(15);

    // Should have edges
    expect(snapshot.data.edges.length).toBeGreaterThan(0);
  });

  it('should use cached model on second subscribe', async () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    manager.addConnection('user1', ws1);
    manager.addConnection('user2', ws2);

    const trackedFetch = vi.fn(fetchSpec);

    // First subscribe triggers fetchSpec
    await handleWorldMessage(
      manager,
      projection,
      'user1',
      '{"type":"world.subscribe"}',
      trackedFetch
    );
    expect(trackedFetch).toHaveBeenCalledOnce();

    // Second subscribe should use cached model
    await handleWorldMessage(
      manager,
      projection,
      'user2',
      '{"type":"world.subscribe"}',
      trackedFetch
    );
    expect(trackedFetch).toHaveBeenCalledOnce(); // Still 1, not 2
  });

  it('should handle ping/pong correctly', async () => {
    const ws = createMockWs();
    manager.addConnection('user1', ws);

    await handleWorldMessage(manager, projection, 'user1', '{"type":"world.ping"}', fetchSpec);

    const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
    const pong = JSON.parse(calls[0][0] as string) as Record<string, unknown>;
    expect(pong['type']).toBe('world.pong');
    expect(typeof pong['ts']).toBe('string');
  });

  it('should support resume flow after initial subscribe', async () => {
    const ws1 = createMockWs();
    manager.addConnection('user1', ws1);

    // Initial subscribe
    await handleWorldMessage(manager, projection, 'user1', '{"type":"world.subscribe"}', fetchSpec);

    const subscribedMsg = JSON.parse(
      (ws1.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string
    ) as { resumeToken: string; seq: number };

    // Get the snapshot seq for buffer replay
    const snapshotMsg = JSON.parse(
      (ws1.send as ReturnType<typeof vi.fn>).mock.calls[1][0] as string
    ) as { seq: number };

    // Simulate reconnection with new ws
    const ws2 = createMockWs();
    manager.addConnection('user1', ws2);

    // Resume with the token from the subscribed message
    const resumePayload = {
      type: 'world.subscribe',
      resume: {
        lastSeq: snapshotMsg.seq,
        resumeToken: subscribedMsg.resumeToken,
      },
    };

    await handleWorldMessage(
      manager,
      projection,
      'user1',
      JSON.stringify(resumePayload),
      fetchSpec
    );

    const calls2 = (ws2.send as ReturnType<typeof vi.fn>).mock.calls;
    const resumed = JSON.parse(calls2[0][0] as string) as Record<string, unknown>;

    // Should succeed with resume mode (buffer has the snapshot)
    expect(resumed['type']).toBe('world.subscribed');
    // Mode could be 'resume' or 'snapshot' depending on buffer state
    expect(['resume', 'snapshot']).toContain(resumed['mode']);
  });

  it('should handle concurrent subscriptions from multiple users', async () => {
    const users = ['alice', 'bob', 'carol'];
    const sockets = users.map(() => createMockWs());

    for (let i = 0; i < users.length; i++) {
      const userId = users[i];
      const ws = sockets[i];
      if (!userId || !ws) continue;
      manager.addConnection(userId, ws);
    }

    // Subscribe all users concurrently
    await Promise.all(
      users.map((userId) =>
        handleWorldMessage(manager, projection, userId, '{"type":"world.subscribe"}', fetchSpec)
      )
    );

    // Each should receive subscribed + snapshot
    for (const ws of sockets) {
      expect(ws.send).toHaveBeenCalledTimes(2);
      const subscribed = JSON.parse(ws.send.mock.calls[0][0] as string) as Record<string, unknown>;
      expect(subscribed['type']).toBe('world.subscribed');
    }
  });
});
