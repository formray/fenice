import { describe, it, expect } from 'vitest';
import {
  WorldClientMessageSchema,
  WorldServerMessageSchema,
} from '../../../src/schemas/world-ws.schema.js';

describe('World WS protocol schemas', () => {
  describe('WorldClientMessageSchema', () => {
    it('should validate world.subscribe without resume', () => {
      const result = WorldClientMessageSchema.safeParse({ type: 'world.subscribe' });
      expect(result.success).toBe(true);
    });

    it('should validate world.subscribe with resume', () => {
      const result = WorldClientMessageSchema.safeParse({
        type: 'world.subscribe',
        resume: { lastSeq: 42, resumeToken: 'abc123' },
      });
      expect(result.success).toBe(true);
    });

    it('should reject world.subscribe with partial resume (missing resumeToken)', () => {
      const result = WorldClientMessageSchema.safeParse({
        type: 'world.subscribe',
        resume: { lastSeq: 42 },
      });
      expect(result.success).toBe(false);
    });

    it('should validate world.ping', () => {
      const result = WorldClientMessageSchema.safeParse({ type: 'world.ping' });
      expect(result.success).toBe(true);
    });

    it('should reject unknown type', () => {
      const result = WorldClientMessageSchema.safeParse({ type: 'world.unknown' });
      expect(result.success).toBe(false);
    });
  });

  describe('WorldServerMessageSchema', () => {
    it('should validate world.subscribed in snapshot mode', () => {
      const result = WorldServerMessageSchema.safeParse({
        type: 'world.subscribed',
        schemaVersion: 1,
        seq: 1,
        ts: '2026-02-21T12:00:00.000Z',
        mode: 'snapshot',
      });
      expect(result.success).toBe(true);
    });

    it('should validate world.subscribed in resume mode', () => {
      const result = WorldServerMessageSchema.safeParse({
        type: 'world.subscribed',
        schemaVersion: 1,
        seq: 5,
        ts: '2026-02-21T12:00:00.000Z',
        mode: 'resume',
        resumeToken: 'token123',
        fromSeq: 3,
      });
      expect(result.success).toBe(true);
    });

    it('should validate world.snapshot', () => {
      const result = WorldServerMessageSchema.safeParse({
        type: 'world.snapshot',
        schemaVersion: 1,
        seq: 1,
        ts: '2026-02-21T12:00:00.000Z',
        data: {
          services: [{ id: 'service:health', tag: 'Health', endpointCount: 1 }],
          endpoints: [
            {
              id: 'endpoint:get:/health',
              serviceId: 'service:health',
              path: '/health',
              method: 'get',
              summary: 'Health',
              hasAuth: false,
              parameterCount: 0,
            },
          ],
          edges: [],
        },
      });
      expect(result.success).toBe(true);
    });

    it('should validate world.delta with empty events', () => {
      const result = WorldServerMessageSchema.safeParse({
        type: 'world.delta',
        schemaVersion: 1,
        seq: 2,
        ts: '2026-02-21T12:00:00.000Z',
        events: [],
      });
      expect(result.success).toBe(true);
    });

    it('world.delta with typed events validates against schema', () => {
      const result = WorldServerMessageSchema.safeParse({
        type: 'world.delta',
        schemaVersion: 1,
        seq: 3,
        ts: '2026-02-22T10:00:00.000Z',
        events: [
          {
            type: 'endpoint.metrics.updated',
            entityId: 'endpoint:get:/health',
            payload: { rps: 120, p50: 12, p95: 45, errorRate: 0.01 },
          },
          {
            type: 'endpoint.health.updated',
            entityId: 'endpoint:get:/health',
            payload: { status: 'healthy' },
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it('world.delta rejects events with unknown type', () => {
      const result = WorldServerMessageSchema.safeParse({
        type: 'world.delta',
        schemaVersion: 1,
        seq: 4,
        ts: '2026-02-22T10:00:00.000Z',
        events: [{ type: 'bogus.event', entityId: 'x' }],
      });
      expect(result.success).toBe(false);
    });

    it('should validate world.error', () => {
      const result = WorldServerMessageSchema.safeParse({
        type: 'world.error',
        code: 'INVALID_RESUME',
        message: 'Resume token expired',
        retryable: true,
      });
      expect(result.success).toBe(true);
    });

    it('should validate world.pong', () => {
      const result = WorldServerMessageSchema.safeParse({
        type: 'world.pong',
        ts: '2026-02-21T12:00:00.000Z',
      });
      expect(result.success).toBe(true);
    });

    it('should reject unknown server message type', () => {
      const result = WorldServerMessageSchema.safeParse({ type: 'world.unknown' });
      expect(result.success).toBe(false);
    });

    it('should reject world.snapshot with invalid endpoint data', () => {
      const result = WorldServerMessageSchema.safeParse({
        type: 'world.snapshot',
        schemaVersion: 1,
        seq: 1,
        ts: '2026-02-21T12:00:00.000Z',
        data: {
          services: [],
          endpoints: [{ id: 'bad' }],
          edges: [],
        },
      });
      expect(result.success).toBe(false);
    });

    it('should reject world.error without required fields', () => {
      const result = WorldServerMessageSchema.safeParse({
        type: 'world.error',
        code: 'SOME_ERROR',
      });
      expect(result.success).toBe(false);
    });
  });
});
