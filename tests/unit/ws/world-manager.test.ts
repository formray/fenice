import { describe, it, expect, beforeEach } from 'vitest';
import {
  WorldWsManager,
  encodeResumeToken,
  decodeResumeToken,
} from '../../../src/ws/world-manager.js';
import type { WorldModel } from '../../../src/schemas/world.schema.js';

function createMockWs() {
  return { send: vi.fn(), close: vi.fn(), readyState: 1 };
}

import { vi } from 'vitest';

const DUMMY_MODEL: WorldModel = {
  schemaVersion: 1,
  generatedAt: '2026-02-21T12:00:00.000Z',
  services: [],
  endpoints: [],
  edges: [],
};

describe('WorldWsManager', () => {
  let manager: WorldWsManager;

  beforeEach(() => {
    manager = new WorldWsManager(10, 300_000); // buffer=10, ttl=5min
  });

  describe('connections', () => {
    it('should add and track a connection', () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);
      expect(manager.isConnected('user1')).toBe(true);
    });

    it('should remove a connection', () => {
      manager.addConnection('user1', createMockWs());
      manager.removeConnection('user1');
      expect(manager.isConnected('user1')).toBe(false);
    });

    it('should return false for unknown user', () => {
      expect(manager.isConnected('unknown')).toBe(false);
    });

    it('should return connection via getConnection', () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);
      expect(manager.getConnection('user1')).toBe(ws);
    });

    it('should return undefined for unknown connection', () => {
      expect(manager.getConnection('unknown')).toBeUndefined();
    });

    it('should close previous connection when replacing same user', () => {
      const oldWs = createMockWs();
      const newWs = createMockWs();

      manager.addConnection('user1', oldWs);
      manager.addConnection('user1', newWs);

      expect(oldWs.close).toHaveBeenCalledOnce();
      expect(manager.getConnection('user1')).toBe(newWs);
    });

    it('should not remove newer connection when stale socket closes', () => {
      const oldWs = createMockWs();
      const newWs = createMockWs();

      manager.addConnection('user1', oldWs);
      manager.addConnection('user1', newWs);

      manager.removeConnection('user1', oldWs);

      expect(manager.isConnected('user1')).toBe(true);
      expect(manager.getConnection('user1')).toBe(newWs);
    });

    it('should report whether connection is current', () => {
      const ws = createMockWs();
      const otherWs = createMockWs();

      manager.addConnection('user1', ws);

      expect(manager.isCurrentConnection('user1', ws)).toBe(true);
      expect(manager.isCurrentConnection('user1', otherWs)).toBe(false);
    });
  });

  describe('seq', () => {
    it('should start at 0', () => {
      expect(manager.getCurrentSeq()).toBe(0);
    });

    it('should increment monotonically', () => {
      expect(manager.nextSeq()).toBe(1);
      expect(manager.nextSeq()).toBe(2);
      expect(manager.nextSeq()).toBe(3);
    });

    it('should return current seq without incrementing', () => {
      manager.nextSeq();
      manager.nextSeq();
      expect(manager.getCurrentSeq()).toBe(2);
      expect(manager.getCurrentSeq()).toBe(2);
    });
  });

  describe('world model', () => {
    it('should return null before setting model', () => {
      expect(manager.getWorldModel()).toBeNull();
    });

    it('should store and retrieve model', () => {
      manager.setWorldModel(DUMMY_MODEL);
      expect(manager.getWorldModel()).toBe(DUMMY_MODEL);
    });
  });

  describe('ring buffer', () => {
    it('should add messages to buffer', () => {
      manager.addToBuffer(1, '{"type":"test1"}');
      manager.addToBuffer(2, '{"type":"test2"}');
      const msgs = manager.getBufferedMessagesFrom(1);
      expect(msgs).toHaveLength(2);
    });

    it('should return messages from a given seq (inclusive)', () => {
      manager.addToBuffer(1, '{"seq":1}');
      manager.addToBuffer(2, '{"seq":2}');
      manager.addToBuffer(3, '{"seq":3}');
      const msgs = manager.getBufferedMessagesFrom(2);
      expect(msgs).toHaveLength(2);
      expect(msgs?.[0].data).toBe('{"seq":2}');
      expect(msgs?.[1].data).toBe('{"seq":3}');
    });

    it('should return null when requested seq is too old (evicted)', () => {
      // Buffer size is 10, add 12 messages
      for (let i = 1; i <= 12; i++) {
        manager.addToBuffer(i, `{"seq":${i}}`);
      }
      // seq 1 and 2 should be evicted
      expect(manager.getBufferedMessagesFrom(1)).toBeNull();
      expect(manager.getBufferedMessagesFrom(2)).toBeNull();
      // seq 3 should still be available
      expect(manager.getBufferedMessagesFrom(3)).not.toBeNull();
    });

    it('should return empty array when fromSeq is ahead of buffer', () => {
      manager.addToBuffer(1, '{"seq":1}');
      const msgs = manager.getBufferedMessagesFrom(5);
      expect(msgs).toEqual([]);
    });

    it('should evict oldest when buffer exceeds size', () => {
      const mgr = new WorldWsManager(3, 300_000);
      mgr.addToBuffer(1, 'a');
      mgr.addToBuffer(2, 'b');
      mgr.addToBuffer(3, 'c');
      mgr.addToBuffer(4, 'd'); // evicts seq 1
      expect(mgr.getBufferedMessagesFrom(1)).toBeNull();
      const msgs = mgr.getBufferedMessagesFrom(2);
      expect(msgs).toHaveLength(3);
    });
  });

  describe('sendTo', () => {
    it('should send string to connected user', () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);
      manager.sendTo('user1', '{"type":"test"}');
      expect(ws.send).toHaveBeenCalledWith('{"type":"test"}');
    });

    it('should not send to disconnected user', () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);
      manager.removeConnection('user1');
      manager.sendTo('user1', '{"type":"test"}');
      expect(ws.send).not.toHaveBeenCalled();
    });

    it('should not send if readyState is not OPEN', () => {
      const ws = createMockWs();
      ws.readyState = 0; // CONNECTING
      manager.addConnection('user1', ws);
      manager.sendTo('user1', '{"type":"test"}');
      expect(ws.send).not.toHaveBeenCalled();
    });
  });

  describe('broadcastDelta', () => {
    it('allocates monotonic seq and broadcasts to subscribed', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      manager.addConnection('u1', ws1);
      manager.addConnection('u2', ws2);
      manager.markSubscribed('u1');
      // u2 not subscribed

      const events = [
        {
          type: 'endpoint.health.updated' as const,
          entityId: 'ep:1',
          payload: { status: 'healthy' as const },
        },
      ];
      const result = manager.broadcastDelta(events);

      expect(result.seq).toBe(1);
      expect(ws1.send).toHaveBeenCalledTimes(1);
      expect(ws2.send).not.toHaveBeenCalled();

      const firstCall = ws1.send.mock.calls[0];
      const sent = JSON.parse(String(firstCall?.[0]));
      expect(sent.type).toBe('world.delta');
      expect(sent.schemaVersion).toBe(1);
      expect(sent.seq).toBe(1);
      expect(sent.events).toHaveLength(1);
      expect(typeof sent.ts).toBe('string');
    });

    it('adds delta to ring buffer', () => {
      const ws = createMockWs();
      manager.addConnection('u1', ws);
      manager.markSubscribed('u1');

      manager.broadcastDelta([]);
      const buffered = manager.getBufferedMessagesFrom(1);
      expect(buffered).not.toBeNull();
      expect(buffered).toHaveLength(1);
    });

    it('seq increments across multiple deltas', () => {
      const ws = createMockWs();
      manager.addConnection('u1', ws);
      manager.markSubscribed('u1');

      const r1 = manager.broadcastDelta([]);
      const r2 = manager.broadcastDelta([]);
      const r3 = manager.broadcastDelta([]);

      expect(r1.seq).toBe(1);
      expect(r2.seq).toBe(2);
      expect(r3.seq).toBe(3);
    });
  });

  describe('broadcastToSubscribed', () => {
    it('should send to all subscribed connections', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      manager.addConnection('user1', ws1);
      manager.addConnection('user2', ws2);
      manager.markSubscribed('user1');
      manager.markSubscribed('user2');
      manager.broadcastToSubscribed('{"type":"update"}');
      expect(ws1.send).toHaveBeenCalledWith('{"type":"update"}');
      expect(ws2.send).toHaveBeenCalledWith('{"type":"update"}');
    });

    it('should not send to unsubscribed connections', () => {
      const ws1 = createMockWs();
      const ws2 = createMockWs();
      manager.addConnection('user1', ws1);
      manager.addConnection('user2', ws2);
      manager.markSubscribed('user1');
      // user2 not subscribed
      manager.broadcastToSubscribed('{"type":"update"}');
      expect(ws1.send).toHaveBeenCalled();
      expect(ws2.send).not.toHaveBeenCalled();
    });
  });
});

describe('Resume token encode/decode', () => {
  it('should round-trip encode and decode', () => {
    const data = { userId: 'user1', lastSeq: 42, ts: 1708531200000 };
    const token = encodeResumeToken(data);
    const decoded = decodeResumeToken(token);
    expect(decoded).toEqual(data);
  });

  it('should return null for invalid base64', () => {
    expect(decodeResumeToken('not-base64!!!')).toBeNull();
  });

  it('should return null for valid base64 but invalid JSON', () => {
    const token = Buffer.from('not-json').toString('base64');
    expect(decodeResumeToken(token)).toBeNull();
  });

  it('should return null for missing fields', () => {
    const token = Buffer.from(JSON.stringify({ userId: 'x' })).toString('base64');
    expect(decodeResumeToken(token)).toBeNull();
  });

  it('should return null for empty string', () => {
    expect(decodeResumeToken('')).toBeNull();
  });

  it('should return null for null/undefined', () => {
    expect(decodeResumeToken(null)).toBeNull();
    expect(decodeResumeToken(undefined)).toBeNull();
  });
});
