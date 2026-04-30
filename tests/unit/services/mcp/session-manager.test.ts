import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { SessionManager } from '../../../../src/services/mcp/session-manager.js';
import type { WorldDeltaEvent } from '../../../../src/schemas/world-delta.schema.js';

interface RecordedBroadcast {
  events: WorldDeltaEvent[];
  ts: string;
  seq: number;
}

class FakeWorldWsManager {
  recorded: RecordedBroadcast[] = [];
  private seqCounter = 0;
  broadcastDelta(events: WorldDeltaEvent[]): { seq: number; ts: string } {
    this.seqCounter += 1;
    const entry = {
      events,
      ts: new Date().toISOString(),
      seq: this.seqCounter,
    };
    this.recorded.push(entry);
    return { seq: entry.seq, ts: entry.ts };
  }
}

function makeManager(throttlePerSec = 100): {
  manager: SessionManager;
  worldWs: FakeWorldWsManager;
} {
  const worldWs = new FakeWorldWsManager();
  const manager = new SessionManager(() => worldWs as unknown as never, {
    ttlMs: 60_000,
    throttlePerSec,
    cleanupIntervalMs: 60_000,
  });
  return { manager, worldWs };
}

describe('SessionManager', () => {
  let manager: SessionManager;
  let worldWs: FakeWorldWsManager;

  beforeEach(() => {
    ({ manager, worldWs } = makeManager());
  });

  afterEach(() => {
    manager.reset();
  });

  describe('register / unregister', () => {
    it('emits agent.connected on register', () => {
      manager.register({
        sessionId: 'sess-1',
        name: 'demo-bot',
        version: '0.1.0',
        role: 'monitor',
        userId: 'u1',
      });

      expect(worldWs.recorded).toHaveLength(1);
      const event = worldWs.recorded[0]?.events[0];
      expect(event?.type).toBe('agent.connected');
      if (event?.type === 'agent.connected') {
        expect(event.payload.agentId).toBe('sess-1');
        expect(event.payload.role).toBe('monitor');
      }
    });

    it('emits agent.disconnected on unregister', () => {
      manager.register({
        sessionId: 'sess-1',
        name: 'a',
        version: '1',
        role: 'generic',
        userId: 'u1',
      });
      worldWs.recorded.length = 0;

      manager.unregister('sess-1');
      expect(worldWs.recorded).toHaveLength(1);
      expect(worldWs.recorded[0]?.events[0]?.type).toBe('agent.disconnected');
      expect(manager.has('sess-1')).toBe(false);
    });

    it('unregister is a no-op for unknown session', () => {
      manager.unregister('never-existed');
      expect(worldWs.recorded).toHaveLength(0);
    });
  });

  describe('activity', () => {
    beforeEach(() => {
      manager.register({
        sessionId: 'sess-1',
        name: 'a',
        version: '1',
        role: 'generic',
        userId: 'u1',
      });
      worldWs.recorded.length = 0;
    });

    it('emits started then completed on a successful tool call', () => {
      manager.startActivity('sess-1', 'list_endpoints');
      manager.completeActivity('sess-1', 'list_endpoints', 42, false);

      expect(worldWs.recorded).toHaveLength(2);
      const first = worldWs.recorded[0]?.events[0];
      const second = worldWs.recorded[1]?.events[0];
      expect(first?.type).toBe('agent.activity');
      expect(second?.type).toBe('agent.activity');
      if (first?.type === 'agent.activity') {
        expect(first.payload.status).toBe('started');
      }
      if (second?.type === 'agent.activity') {
        expect(second.payload.status).toBe('completed');
        expect(second.payload.durationMs).toBe(42);
      }
    });

    it('marks completed event as failed when tool errored', () => {
      manager.startActivity('sess-1', 'check_health');
      manager.completeActivity('sess-1', 'check_health', 10, true);

      const second = worldWs.recorded[1]?.events[0];
      if (second?.type === 'agent.activity') {
        expect(second.payload.status).toBe('failed');
      } else {
        throw new Error('expected agent.activity');
      }
    });

    it('startActivity flips status to busy and sets currentTool', () => {
      manager.startActivity('sess-1', 'list_endpoints');
      const view = manager.list().find((s) => s.id === 'sess-1');
      expect(view?.status).toBe('busy');
      expect(view?.currentTool).toBe('list_endpoints');
    });

    it('completeActivity returns status to connected and clears currentTool', () => {
      manager.startActivity('sess-1', 'list_endpoints');
      manager.completeActivity('sess-1', 'list_endpoints', 10, false);
      const view = manager.list().find((s) => s.id === 'sess-1');
      expect(view?.status).toBe('connected');
      expect(view?.currentTool).toBeUndefined();
    });
  });

  describe('throttle', () => {
    it('drops activity events beyond throttlePerSec within a 1s window', () => {
      const { manager: m, worldWs: ws } = makeManager(3);
      m.register({
        sessionId: 'sess-1',
        name: 'a',
        version: '1',
        role: 'generic',
        userId: 'u1',
      });
      ws.recorded.length = 0;

      for (let i = 0; i < 10; i++) {
        m.startActivity('sess-1', `tool-${i}`);
      }

      // Throttle limits to 3 within the window — non-activity events still emit
      expect(ws.recorded.length).toBe(3);
      m.reset();
    });

    it('opens a new throttle window after 1 second elapses', async () => {
      const { manager: m, worldWs: ws } = makeManager(2);
      m.register({
        sessionId: 'sess-1',
        name: 'a',
        version: '1',
        role: 'generic',
        userId: 'u1',
      });
      ws.recorded.length = 0;

      m.startActivity('sess-1', 'tool-1');
      m.startActivity('sess-1', 'tool-2');
      m.startActivity('sess-1', 'tool-3'); // dropped
      expect(ws.recorded.length).toBe(2);

      await new Promise((r) => setTimeout(r, 1100));

      m.startActivity('sess-1', 'tool-4');
      expect(ws.recorded.length).toBe(3);
      m.reset();
    });
  });

  describe('list / heartbeat', () => {
    it('returns ISO timestamps in views', () => {
      manager.register({
        sessionId: 'sess-1',
        name: 'a',
        version: '1',
        role: 'tester',
        userId: 'u1',
      });
      const [view] = manager.list();
      expect(view?.connectedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(view?.lastSeenAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(view?.role).toBe('tester');
    });

    it('heartbeat updates lastSeenAt', async () => {
      manager.register({
        sessionId: 'sess-1',
        name: 'a',
        version: '1',
        role: 'generic',
        userId: 'u1',
      });
      const before = manager.list()[0]?.lastSeenAt;
      await new Promise((r) => setTimeout(r, 10));
      manager.heartbeat('sess-1');
      const after = manager.list()[0]?.lastSeenAt;
      expect(after).not.toBe(before);
    });

    it('heartbeat for unknown session is a no-op', () => {
      manager.heartbeat('never-existed');
      // Just shouldn't throw
    });
  });
});
