/**
 * W1-T10: Contract tests — WS protocol producer/consumer
 *
 * These tests verify that **every message the server actually produces** passes
 * Zod validation against the canonical schemas, guaranteeing the contract
 * between backend (producer) and frontend client (consumer).
 *
 * If a field is added/removed/renamed on the server, these tests will catch the
 * drift before it reaches the client at runtime.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { handleWorldMessage } from '../../../src/ws/world-handlers.js';
import { WorldWsManager, encodeResumeToken } from '../../../src/ws/world-manager.js';
import { ProjectionService } from '../../../src/services/projection.service.js';
import {
  WorldServerMessageSchema,
  WorldClientMessageSchema,
} from '../../../src/schemas/world-ws.schema.js';
import { WorldModelSchema } from '../../../src/schemas/world.schema.js';
import type { WorldModel } from '../../../src/schemas/world.schema.js';

// ─── Helpers ────────────────────────────────────────────────────────────────

function createMockWs() {
  return { send: vi.fn(), close: vi.fn(), readyState: 1 };
}

/** Collect all JSON messages sent through the mock WS. */
function sentMessages(ws: ReturnType<typeof createMockWs>): unknown[] {
  return ws.send.mock.calls.map((c: [string]) => JSON.parse(c[0]));
}

const OPENAPI_FIXTURE = {
  openapi: '3.1.0',
  info: { title: 'Contract Test API', version: '1.0.0' },
  paths: {
    '/users': {
      get: { tags: ['Users'], summary: 'List users', parameters: [{ name: 'page', in: 'query' }] },
      post: {
        tags: ['Users'],
        summary: 'Create user',
        security: [{ bearer: [] }],
        requestBody: { content: { 'application/json': {} } },
      },
    },
    '/health': {
      get: { tags: ['Health'], summary: 'Health check' },
    },
  },
};

// ─── Suite ──────────────────────────────────────────────────────────────────

describe('W1-T10 — WS Protocol Contract Tests', () => {
  let manager: WorldWsManager;
  let projection: ProjectionService;
  let fetchSpec: () => Promise<WorldModel>;

  beforeEach(() => {
    manager = new WorldWsManager(50, 300_000);
    projection = new ProjectionService();
    fetchSpec = vi.fn(async () => {
      return projection.buildWorldModel(OPENAPI_FIXTURE);
    });
  });

  // ── 1. Client → Server contract ──────────────────────────────────────────

  describe('client → server message contract', () => {
    it('world.subscribe (no resume) passes schema validation', () => {
      const msg = { type: 'world.subscribe' };
      const result = WorldClientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('world.subscribe (with resume) passes schema validation', () => {
      const msg = {
        type: 'world.subscribe',
        resume: { lastSeq: 5, resumeToken: 'abc123' },
      };
      const result = WorldClientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('world.ping passes schema validation', () => {
      const msg = { type: 'world.ping' };
      const result = WorldClientMessageSchema.safeParse(msg);
      expect(result.success).toBe(true);
    });

    it('rejects unknown message type', () => {
      const msg = { type: 'world.unknown' };
      const result = WorldClientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });

    it('rejects subscribe with invalid resume shape', () => {
      const msg = {
        type: 'world.subscribe',
        resume: { lastSeq: 'not-a-number', resumeToken: '' },
      };
      const result = WorldClientMessageSchema.safeParse(msg);
      expect(result.success).toBe(false);
    });
  });

  // ── 2. Server → Client contract: every produced message validates ────────

  describe('server → client message contract (snapshot flow)', () => {
    it('world.subscribed message validates against schema', async () => {
      const ws = createMockWs();
      manager.addConnection('u1', ws);

      await handleWorldMessage(manager, projection, 'u1', '{"type":"world.subscribe"}', fetchSpec);

      const msgs = sentMessages(ws);
      const subscribed = msgs[0];
      const result = WorldServerMessageSchema.safeParse(subscribed);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('world.subscribed');
      }
    });

    it('world.snapshot message validates against schema', async () => {
      const ws = createMockWs();
      manager.addConnection('u1', ws);

      await handleWorldMessage(manager, projection, 'u1', '{"type":"world.subscribe"}', fetchSpec);

      const msgs = sentMessages(ws);
      expect(msgs.length).toBeGreaterThanOrEqual(2);

      const snapshot = msgs[1];
      const result = WorldServerMessageSchema.safeParse(snapshot);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('world.snapshot');
      }
    });

    it('snapshot.data matches WorldModel structure', async () => {
      const ws = createMockWs();
      manager.addConnection('u1', ws);

      await handleWorldMessage(manager, projection, 'u1', '{"type":"world.subscribe"}', fetchSpec);

      const msgs = sentMessages(ws);
      const snapshot = msgs[1] as Record<string, unknown>;
      const data = snapshot['data'] as Record<string, unknown>;

      // Validate the data payload directly against WorldModelSchema
      // (We need to add schemaVersion + generatedAt since WorldModel has them,
      //  but the snapshot.data only carries services/endpoints/edges.)
      expect(data).toHaveProperty('services');
      expect(data).toHaveProperty('endpoints');
      expect(data).toHaveProperty('edges');
      expect(Array.isArray(data['services'])).toBe(true);
      expect(Array.isArray(data['endpoints'])).toBe(true);
      expect(Array.isArray(data['edges'])).toBe(true);
    });

    it('snapshot contains correct service/endpoint/edge counts for fixture', async () => {
      const ws = createMockWs();
      manager.addConnection('u1', ws);

      await handleWorldMessage(manager, projection, 'u1', '{"type":"world.subscribe"}', fetchSpec);

      const msgs = sentMessages(ws);
      const snapshot = msgs[1] as Record<string, unknown>;
      const data = snapshot['data'] as {
        services: unknown[];
        endpoints: unknown[];
        edges: unknown[];
      };

      // Fixture has 2 services (Users, Health), 3 endpoints, edges within Users (1 edge)
      expect(data.services).toHaveLength(2);
      expect(data.endpoints).toHaveLength(3);
      expect(data.edges).toHaveLength(1); // GET /users <-> POST /users same_service
    });

    it('subscribed message contains required fields', async () => {
      const ws = createMockWs();
      manager.addConnection('u1', ws);

      await handleWorldMessage(manager, projection, 'u1', '{"type":"world.subscribe"}', fetchSpec);

      const msgs = sentMessages(ws);
      const sub = msgs[0] as Record<string, unknown>;

      expect(sub['type']).toBe('world.subscribed');
      expect(sub['schemaVersion']).toBe(1);
      expect(typeof sub['seq']).toBe('number');
      expect(typeof sub['ts']).toBe('string');
      expect(sub['mode']).toBe('snapshot');
      expect(typeof sub['resumeToken']).toBe('string');
    });

    it('snapshot message seq is greater than subscribed seq', async () => {
      const ws = createMockWs();
      manager.addConnection('u1', ws);

      await handleWorldMessage(manager, projection, 'u1', '{"type":"world.subscribe"}', fetchSpec);

      const msgs = sentMessages(ws);
      const sub = msgs[0] as { seq: number };
      const snap = msgs[1] as { seq: number };

      expect(snap.seq).toBeGreaterThan(sub.seq);
    });
  });

  // ── 3. Server → Client contract: resume flow ─────────────────────────────

  describe('server → client message contract (resume flow)', () => {
    it('world.subscribed in resume mode validates against schema', async () => {
      const ws = createMockWs();
      manager.addConnection('u1', ws);

      // Pre-fill buffer
      manager.addToBuffer(
        1,
        JSON.stringify({
          type: 'world.snapshot',
          seq: 1,
          schemaVersion: 1,
          ts: new Date().toISOString(),
          data: { services: [], endpoints: [], edges: [] },
        })
      );
      manager.addToBuffer(
        2,
        JSON.stringify({
          type: 'world.delta',
          seq: 2,
          schemaVersion: 1,
          ts: new Date().toISOString(),
          events: [],
        })
      );

      // Pre-cache model
      projection.buildWorldModel(OPENAPI_FIXTURE);

      const token = encodeResumeToken({ userId: 'u1', lastSeq: 1, ts: Date.now() });
      await handleWorldMessage(
        manager,
        projection,
        'u1',
        JSON.stringify({ type: 'world.subscribe', resume: { lastSeq: 1, resumeToken: token } }),
        fetchSpec
      );

      const msgs = sentMessages(ws);
      const subscribed = msgs[0];
      const result = WorldServerMessageSchema.safeParse(subscribed);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('world.subscribed');
        if (result.data.type === 'world.subscribed') {
          expect(result.data.mode).toBe('resume');
          expect(result.data.fromSeq).toBeDefined();
        }
      }
    });
  });

  // ── 4. Server → Client contract: ping/pong ───────────────────────────────

  describe('server → client message contract (ping/pong)', () => {
    it('world.pong validates against schema', async () => {
      const ws = createMockWs();
      manager.addConnection('u1', ws);

      await handleWorldMessage(manager, projection, 'u1', '{"type":"world.ping"}', fetchSpec);

      const msgs = sentMessages(ws);
      const pong = msgs[0];
      const result = WorldServerMessageSchema.safeParse(pong);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('world.pong');
      }
    });

    it('pong contains ISO timestamp', async () => {
      const ws = createMockWs();
      manager.addConnection('u1', ws);

      await handleWorldMessage(manager, projection, 'u1', '{"type":"world.ping"}', fetchSpec);

      const msgs = sentMessages(ws);
      const pong = msgs[0] as { ts: string };
      // Verify it's a valid ISO date
      expect(new Date(pong.ts).toISOString()).toBe(pong.ts);
    });
  });

  // ── 5. Server → Client contract: error messages ──────────────────────────

  describe('server → client message contract (errors)', () => {
    it('INVALID_JSON error validates against schema', async () => {
      const ws = createMockWs();
      manager.addConnection('u1', ws);

      await handleWorldMessage(manager, projection, 'u1', '{bad-json', fetchSpec);

      const msgs = sentMessages(ws);
      const err = msgs[0];
      const result = WorldServerMessageSchema.safeParse(err);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.type).toBe('world.error');
        if (result.data.type === 'world.error') {
          expect(result.data.code).toBe('INVALID_JSON');
          expect(typeof result.data.message).toBe('string');
          expect(result.data.retryable).toBe(false);
        }
      }
    });

    it('INVALID_MESSAGE error validates against schema', async () => {
      const ws = createMockWs();
      manager.addConnection('u1', ws);

      await handleWorldMessage(manager, projection, 'u1', '{"type":"world.bad"}', fetchSpec);

      const msgs = sentMessages(ws);
      const err = msgs[0];
      const result = WorldServerMessageSchema.safeParse(err);
      expect(result.success).toBe(true);
      if (result.success && result.data.type === 'world.error') {
        expect(result.data.code).toBe('INVALID_MESSAGE');
        expect(result.data.retryable).toBe(false);
      }
    });

    it('FETCH_SPEC_FAILED error validates against schema', async () => {
      const ws = createMockWs();
      manager.addConnection('u1', ws);
      const failFetch = async (): Promise<WorldModel> => {
        throw new Error('Network error');
      };

      await handleWorldMessage(manager, projection, 'u1', '{"type":"world.subscribe"}', failFetch);

      const msgs = sentMessages(ws);
      const err = msgs[0];
      const result = WorldServerMessageSchema.safeParse(err);
      expect(result.success).toBe(true);
      if (result.success && result.data.type === 'world.error') {
        expect(result.data.code).toBe('FETCH_SPEC_FAILED');
        expect(result.data.retryable).toBe(true);
      }
    });
  });

  // ── 6. Cross-boundary: WorldModel produced by ProjectionService ──────────

  describe('projection service → world model contract', () => {
    it('buildWorldModel output validates against WorldModelSchema', () => {
      const model = projection.buildWorldModel(OPENAPI_FIXTURE);
      const result = WorldModelSchema.safeParse(model);
      expect(result.success).toBe(true);
    });

    it('every endpoint has valid method enum', () => {
      const model = projection.buildWorldModel(OPENAPI_FIXTURE);
      const validMethods = ['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace'];
      for (const ep of model.endpoints) {
        expect(validMethods).toContain(ep.method);
      }
    });

    it('every endpoint references an existing service', () => {
      const model = projection.buildWorldModel(OPENAPI_FIXTURE);
      const serviceIds = new Set(model.services.map((s) => s.id));
      for (const ep of model.endpoints) {
        expect(serviceIds.has(ep.serviceId)).toBe(true);
      }
    });

    it('every edge references existing endpoints', () => {
      const model = projection.buildWorldModel(OPENAPI_FIXTURE);
      const endpointIds = new Set(model.endpoints.map((e) => e.id));
      for (const edge of model.edges) {
        expect(endpointIds.has(edge.sourceId)).toBe(true);
        expect(endpointIds.has(edge.targetId)).toBe(true);
      }
    });

    it('service endpointCount matches actual endpoint count', () => {
      const model = projection.buildWorldModel(OPENAPI_FIXTURE);
      for (const svc of model.services) {
        const actual = model.endpoints.filter((e) => e.serviceId === svc.id).length;
        expect(svc.endpointCount).toBe(actual);
      }
    });

    it('hasAuth is correctly derived from security field', () => {
      const model = projection.buildWorldModel(OPENAPI_FIXTURE);
      const postUsers = model.endpoints.find((e) => e.method === 'post' && e.path === '/users');
      const getUsers = model.endpoints.find((e) => e.method === 'get' && e.path === '/users');
      const getHealth = model.endpoints.find((e) => e.method === 'get' && e.path === '/health');

      expect(postUsers?.hasAuth).toBe(true);
      expect(getUsers?.hasAuth).toBe(false);
      expect(getHealth?.hasAuth).toBe(false);
    });

    it('parameterCount includes query params + requestBody', () => {
      const model = projection.buildWorldModel(OPENAPI_FIXTURE);
      const getUsers = model.endpoints.find((e) => e.method === 'get' && e.path === '/users');
      const postUsers = model.endpoints.find((e) => e.method === 'post' && e.path === '/users');
      const getHealth = model.endpoints.find((e) => e.method === 'get' && e.path === '/health');

      expect(getUsers?.parameterCount).toBe(1); // 1 query param
      expect(postUsers?.parameterCount).toBe(1); // 1 requestBody
      expect(getHealth?.parameterCount).toBe(0);
    });
  });

  // ── 7. Resume token contract ─────────────────────────────────────────────

  describe('resume token encode/decode contract', () => {
    it('encodeResumeToken produces base64 string', () => {
      const token = encodeResumeToken({ userId: 'u1', lastSeq: 5, ts: Date.now() });
      expect(typeof token).toBe('string');
      // Should be valid base64
      expect(Buffer.from(token, 'base64').toString('base64')).toBe(token);
    });

    it('round-trips through encode/decode', async () => {
      const { decodeResumeToken } = await import('../../../src/ws/world-manager.js');
      const data = { userId: 'user-abc', lastSeq: 42, ts: 1700000000000 };
      const token = encodeResumeToken(data);
      const decoded = decodeResumeToken(token);
      expect(decoded).toEqual(data);
    });

    it('decodeResumeToken returns null for invalid base64', async () => {
      const { decodeResumeToken } = await import('../../../src/ws/world-manager.js');
      expect(decodeResumeToken('not-valid-base64!!!')).toBeNull();
    });

    it('decodeResumeToken returns null for null/undefined', async () => {
      const { decodeResumeToken } = await import('../../../src/ws/world-manager.js');
      expect(decodeResumeToken(null)).toBeNull();
      expect(decodeResumeToken(undefined)).toBeNull();
    });
  });

  // ── 8. Seq ordering contract ─────────────────────────────────────────────

  describe('sequence ordering contract', () => {
    it('seq is strictly monotonically increasing across messages', async () => {
      const ws = createMockWs();
      manager.addConnection('u1', ws);

      // First flow: subscribe
      await handleWorldMessage(manager, projection, 'u1', '{"type":"world.subscribe"}', fetchSpec);

      // Second flow: ping
      await handleWorldMessage(manager, projection, 'u1', '{"type":"world.ping"}', fetchSpec);

      const msgs = sentMessages(ws);
      // msgs[0] = subscribed (seq N), msgs[1] = snapshot (seq N+1), msgs[2] = pong (no seq)
      const subscribed = msgs[0] as { seq: number };
      const snapshot = msgs[1] as { seq: number };

      expect(subscribed.seq).toBeGreaterThan(0);
      expect(snapshot.seq).toBeGreaterThan(subscribed.seq);
    });

    it('buffer preserves seq order', () => {
      manager.addToBuffer(1, 'a');
      manager.addToBuffer(2, 'b');
      manager.addToBuffer(3, 'c');

      const buffered = manager.getBufferedMessagesFrom(1);
      expect(buffered).not.toBeNull();
      if (buffered) {
        const seqs = buffered.map((m) => m.seq);
        expect(seqs).toEqual([1, 2, 3]);
      }
    });

    it('buffer evicts oldest entries when full', () => {
      // Manager with bufferSize = 3
      const smallManager = new WorldWsManager(3, 300_000);
      smallManager.addToBuffer(1, 'a');
      smallManager.addToBuffer(2, 'b');
      smallManager.addToBuffer(3, 'c');
      smallManager.addToBuffer(4, 'd');

      // seq 1 should be evicted
      expect(smallManager.getBufferedMessagesFrom(1)).toBeNull();
      expect(smallManager.getBufferedMessagesFrom(2)).toHaveLength(3);
    });
  });
});
