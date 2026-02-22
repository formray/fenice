import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleWorldMessage } from '../../../src/ws/world-handlers.js';
import { WorldWsManager } from '../../../src/ws/world-manager.js';
import { ProjectionService } from '../../../src/services/projection.service.js';
import type { WorldModel } from '../../../src/schemas/world.schema.js';

function createMockWs() {
  return { send: vi.fn(), close: vi.fn(), readyState: 1 };
}

const DUMMY_MODEL: WorldModel = {
  schemaVersion: 1,
  generatedAt: '2026-02-21T12:00:00.000Z',
  services: [{ id: 'service:health', tag: 'Health', endpointCount: 1 }],
  endpoints: [
    {
      id: 'endpoint:get:/health',
      serviceId: 'service:health',
      path: '/health',
      method: 'get',
      summary: 'Health check',
      hasAuth: false,
      parameterCount: 0,
    },
  ],
  edges: [],
};

describe('handleWorldMessage', () => {
  let manager: WorldWsManager;
  let projection: ProjectionService;
  let fetchSpec: () => Promise<WorldModel>;

  beforeEach(() => {
    manager = new WorldWsManager(10, 300_000);
    projection = new ProjectionService();
    fetchSpec = vi.fn(async () => {
      projection.buildWorldModel({
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: {
          '/health': { get: { tags: ['Health'], summary: 'Health check' } },
        },
      });
      const model = projection.getCachedModel();
      if (!model) throw new Error('Model should be cached');
      return model;
    });
  });

  describe('world.ping', () => {
    it('should respond with world.pong', async () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);
      await handleWorldMessage(manager, projection, 'user1', '{"type":"world.ping"}', fetchSpec);

      expect(ws.send).toHaveBeenCalledOnce();
      const sent = JSON.parse((ws.send as ReturnType<typeof vi.fn>).mock.calls[0][0] as string);
      expect(sent.type).toBe('world.pong');
      expect(sent.ts).toBeTruthy();
    });
  });

  describe('world.subscribe (no resume)', () => {
    it('should send world.subscribed + world.snapshot', async () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);
      await handleWorldMessage(
        manager,
        projection,
        'user1',
        '{"type":"world.subscribe"}',
        fetchSpec
      );

      expect(ws.send).toHaveBeenCalledTimes(2);
      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const subscribed = JSON.parse(calls[0][0] as string);
      const snapshot = JSON.parse(calls[1][0] as string);

      expect(subscribed.type).toBe('world.subscribed');
      expect(subscribed.mode).toBe('snapshot');
      expect(subscribed.schemaVersion).toBe(1);
      expect(subscribed.seq).toBeGreaterThan(0);

      expect(snapshot.type).toBe('world.snapshot');
      expect(snapshot.data.services).toHaveLength(1);
      expect(snapshot.data.endpoints).toHaveLength(1);
    });

    it('should use cached model if available', async () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);

      // Pre-cache model
      projection.buildWorldModel({
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: { '/a': { get: { tags: ['A'], summary: 'A' } } },
      });

      await handleWorldMessage(
        manager,
        projection,
        'user1',
        '{"type":"world.subscribe"}',
        fetchSpec
      );

      // fetchSpec should NOT have been called since cached model exists
      expect(fetchSpec).not.toHaveBeenCalled();
    });

    it('should call fetchSpec when no cached model', async () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);
      await handleWorldMessage(
        manager,
        projection,
        'user1',
        '{"type":"world.subscribe"}',
        fetchSpec
      );

      expect(fetchSpec).toHaveBeenCalledOnce();
    });
  });

  describe('world.subscribe (with resume)', () => {
    it('should replay buffered messages when resume is valid', async () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);

      // Set up some buffered messages
      const model = DUMMY_MODEL;
      manager.setWorldModel(model);
      projection.buildWorldModel({
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: { '/health': { get: { tags: ['Health'], summary: 'Health check' } } },
      });

      // Add buffered messages at seq 1, 2, 3
      manager.addToBuffer(1, '{"type":"world.snapshot","seq":1}');
      manager.addToBuffer(2, '{"type":"world.delta","seq":2}');
      manager.addToBuffer(3, '{"type":"world.delta","seq":3}');

      // Create resume token for user1, lastSeq 1
      const { encodeResumeToken } = await import('../../../src/ws/world-manager.js');
      const token = encodeResumeToken({ userId: 'user1', lastSeq: 1, ts: Date.now() });

      await handleWorldMessage(
        manager,
        projection,
        'user1',
        JSON.stringify({ type: 'world.subscribe', resume: { lastSeq: 1, resumeToken: token } }),
        fetchSpec
      );

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      // First: world.subscribed (resume mode)
      const subscribed = JSON.parse(calls[0][0] as string);
      expect(subscribed.type).toBe('world.subscribed');
      expect(subscribed.mode).toBe('resume');
      expect(subscribed.fromSeq).toBe(2);

      // Then: replayed buffered messages (seq 2 and 3)
      expect(calls.length).toBe(3); // subscribed + 2 replayed messages
    });

    it('should fallback to snapshot when buffer is insufficient', async () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);

      // No buffered messages at all
      projection.buildWorldModel({
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: { '/health': { get: { tags: ['Health'], summary: 'Health check' } } },
      });

      const { encodeResumeToken } = await import('../../../src/ws/world-manager.js');
      const token = encodeResumeToken({ userId: 'user1', lastSeq: 1, ts: Date.now() });

      await handleWorldMessage(
        manager,
        projection,
        'user1',
        JSON.stringify({ type: 'world.subscribe', resume: { lastSeq: 1, resumeToken: token } }),
        fetchSpec
      );

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const subscribed = JSON.parse(calls[0][0] as string);
      // Falls back to snapshot mode
      expect(subscribed.type).toBe('world.subscribed');
      expect(subscribed.mode).toBe('snapshot');
    });

    it('should fallback to snapshot when userId does not match', async () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);

      projection.buildWorldModel({
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: { '/health': { get: { tags: ['Health'], summary: 'Health check' } } },
      });

      const { encodeResumeToken } = await import('../../../src/ws/world-manager.js');
      // Token is for user2, but connection is user1
      const token = encodeResumeToken({ userId: 'user2', lastSeq: 1, ts: Date.now() });

      await handleWorldMessage(
        manager,
        projection,
        'user1',
        JSON.stringify({ type: 'world.subscribe', resume: { lastSeq: 1, resumeToken: token } }),
        fetchSpec
      );

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const subscribed = JSON.parse(calls[0][0] as string);
      expect(subscribed.mode).toBe('snapshot');
    });

    it('should fallback to snapshot when token is expired', async () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);

      projection.buildWorldModel({
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: { '/health': { get: { tags: ['Health'], summary: 'Health check' } } },
      });

      const { encodeResumeToken } = await import('../../../src/ws/world-manager.js');
      // Token from 10 minutes ago, TTL is 5 minutes
      const token = encodeResumeToken({
        userId: 'user1',
        lastSeq: 1,
        ts: Date.now() - 600_000,
      });

      await handleWorldMessage(
        manager,
        projection,
        'user1',
        JSON.stringify({ type: 'world.subscribe', resume: { lastSeq: 1, resumeToken: token } }),
        fetchSpec
      );

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const subscribed = JSON.parse(calls[0][0] as string);
      expect(subscribed.mode).toBe('snapshot');
    });

    it('should fallback to snapshot when token timestamp is in the future', async () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);

      projection.buildWorldModel({
        openapi: '3.1.0',
        info: { title: 'Test', version: '1.0.0' },
        paths: { '/health': { get: { tags: ['Health'], summary: 'Health check' } } },
      });

      const { encodeResumeToken } = await import('../../../src/ws/world-manager.js');
      const token = encodeResumeToken({
        userId: 'user1',
        lastSeq: 1,
        ts: Date.now() + 60_000,
      });

      await handleWorldMessage(
        manager,
        projection,
        'user1',
        JSON.stringify({ type: 'world.subscribe', resume: { lastSeq: 1, resumeToken: token } }),
        fetchSpec
      );

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const subscribed = JSON.parse(calls[0][0] as string);
      expect(subscribed.mode).toBe('snapshot');
    });
  });

  describe('error handling', () => {
    it('should send world.error for invalid JSON', async () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);
      await handleWorldMessage(manager, projection, 'user1', 'not-json', fetchSpec);

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const sent = JSON.parse(calls[0][0] as string);
      expect(sent.type).toBe('world.error');
      expect(sent.code).toBe('INVALID_JSON');
      expect(sent.retryable).toBe(false);
    });

    it('should send world.error for invalid message format', async () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);
      await handleWorldMessage(manager, projection, 'user1', '{"type":"invalid.type"}', fetchSpec);

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const sent = JSON.parse(calls[0][0] as string);
      expect(sent.type).toBe('world.error');
      expect(sent.code).toBe('INVALID_MESSAGE');
    });

    it('should send world.error when fetchSpec fails', async () => {
      const ws = createMockWs();
      manager.addConnection('user1', ws);
      const failingFetch = vi.fn(async (): Promise<WorldModel> => {
        throw new Error('Spec fetch failed');
      });

      await handleWorldMessage(
        manager,
        projection,
        'user1',
        '{"type":"world.subscribe"}',
        failingFetch
      );

      const calls = (ws.send as ReturnType<typeof vi.fn>).mock.calls;
      const sent = JSON.parse(calls[0][0] as string);
      expect(sent.type).toBe('world.error');
      expect(sent.code).toBe('FETCH_SPEC_FAILED');
      expect(sent.retryable).toBe(true);
    });
  });
});
