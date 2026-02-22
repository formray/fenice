import { describe, it, expect } from 'vitest';
import {
  WorldServiceSchema,
  WorldEndpointSchema,
  WorldEdgeSchema,
  WorldModelSchema,
} from '../../../src/schemas/world.schema.js';

describe('World model schemas', () => {
  describe('WorldServiceSchema', () => {
    it('should validate a valid service', () => {
      const result = WorldServiceSchema.safeParse({
        id: 'service:auth',
        tag: 'Auth',
        endpointCount: 5,
      });
      expect(result.success).toBe(true);
    });

    it('should reject service with empty id', () => {
      const result = WorldServiceSchema.safeParse({
        id: '',
        tag: 'Auth',
        endpointCount: 5,
      });
      expect(result.success).toBe(false);
    });

    it('should reject service with negative endpointCount', () => {
      const result = WorldServiceSchema.safeParse({
        id: 'service:auth',
        tag: 'Auth',
        endpointCount: -1,
      });
      expect(result.success).toBe(false);
    });

    it('should reject service with missing fields', () => {
      const result = WorldServiceSchema.safeParse({ id: 'service:auth' });
      expect(result.success).toBe(false);
    });
  });

  describe('WorldEndpointSchema', () => {
    it('should validate a valid endpoint', () => {
      const result = WorldEndpointSchema.safeParse({
        id: 'endpoint:get:/api/v1/health',
        serviceId: 'service:health',
        path: '/api/v1/health',
        method: 'get',
        summary: 'Health check',
        hasAuth: false,
        parameterCount: 0,
      });
      expect(result.success).toBe(true);
    });

    it('should validate endpoint with auth and parameters', () => {
      const result = WorldEndpointSchema.safeParse({
        id: 'endpoint:post:/api/v1/auth/login',
        serviceId: 'service:auth',
        path: '/api/v1/auth/login',
        method: 'post',
        summary: 'Login',
        hasAuth: true,
        parameterCount: 1,
      });
      expect(result.success).toBe(true);
    });

    it('should reject endpoint with invalid method', () => {
      const result = WorldEndpointSchema.safeParse({
        id: 'endpoint:foo:/path',
        serviceId: 'service:x',
        path: '/path',
        method: 'foo',
        summary: 'Bad',
        hasAuth: false,
        parameterCount: 0,
      });
      expect(result.success).toBe(false);
    });

    it('should reject endpoint with negative parameterCount', () => {
      const result = WorldEndpointSchema.safeParse({
        id: 'endpoint:get:/path',
        serviceId: 'service:x',
        path: '/path',
        method: 'get',
        summary: 'Bad',
        hasAuth: false,
        parameterCount: -2,
      });
      expect(result.success).toBe(false);
    });

    it('should reject endpoint with empty path', () => {
      const result = WorldEndpointSchema.safeParse({
        id: 'endpoint:get:',
        serviceId: 'service:x',
        path: '',
        method: 'get',
        summary: 'Bad',
        hasAuth: false,
        parameterCount: 0,
      });
      expect(result.success).toBe(false);
    });
  });

  describe('WorldEdgeSchema', () => {
    it('should validate a valid edge', () => {
      const result = WorldEdgeSchema.safeParse({
        id: 'edge:endpoint:get:/a->endpoint:post:/b',
        sourceId: 'endpoint:get:/a',
        targetId: 'endpoint:post:/b',
        type: 'same_service',
      });
      expect(result.success).toBe(true);
    });

    it('should reject edge with invalid type', () => {
      const result = WorldEdgeSchema.safeParse({
        id: 'edge:x->y',
        sourceId: 'x',
        targetId: 'y',
        type: 'unknown_type',
      });
      expect(result.success).toBe(false);
    });

    it('should reject edge with empty sourceId', () => {
      const result = WorldEdgeSchema.safeParse({
        id: 'edge:->y',
        sourceId: '',
        targetId: 'y',
        type: 'same_service',
      });
      expect(result.success).toBe(false);
    });
  });

  describe('WorldModelSchema', () => {
    const validModel = {
      schemaVersion: 1 as const,
      generatedAt: '2026-02-21T12:00:00.000Z',
      services: [{ id: 'service:health', tag: 'Health', endpointCount: 2 }],
      endpoints: [
        {
          id: 'endpoint:get:/api/v1/health',
          serviceId: 'service:health',
          path: '/api/v1/health',
          method: 'get' as const,
          summary: 'Health check',
          hasAuth: false,
          parameterCount: 0,
        },
        {
          id: 'endpoint:get:/api/v1/health/detailed',
          serviceId: 'service:health',
          path: '/api/v1/health/detailed',
          method: 'get' as const,
          summary: 'Detailed health',
          hasAuth: false,
          parameterCount: 0,
        },
      ],
      edges: [
        {
          id: 'edge:endpoint:get:/api/v1/health->endpoint:get:/api/v1/health/detailed',
          sourceId: 'endpoint:get:/api/v1/health',
          targetId: 'endpoint:get:/api/v1/health/detailed',
          type: 'same_service' as const,
        },
      ],
    };

    it('should validate a complete world model', () => {
      const result = WorldModelSchema.safeParse(validModel);
      expect(result.success).toBe(true);
    });

    it('should enforce schemaVersion literal 1', () => {
      const result = WorldModelSchema.safeParse({
        ...validModel,
        schemaVersion: 2,
      });
      expect(result.success).toBe(false);
    });

    it('should reject invalid generatedAt timestamp', () => {
      const result = WorldModelSchema.safeParse({
        ...validModel,
        generatedAt: 'not-a-date',
      });
      expect(result.success).toBe(false);
    });

    it('should validate an empty world model (no services/endpoints/edges)', () => {
      const result = WorldModelSchema.safeParse({
        schemaVersion: 1,
        generatedAt: '2026-02-21T12:00:00.000Z',
        services: [],
        endpoints: [],
        edges: [],
      });
      expect(result.success).toBe(true);
    });

    it('should reject model with missing services array', () => {
      const noServices = {
        schemaVersion: validModel.schemaVersion,
        generatedAt: validModel.generatedAt,
        endpoints: validModel.endpoints,
        edges: validModel.edges,
      };
      const result = WorldModelSchema.safeParse(noServices);
      expect(result.success).toBe(false);
    });

    it('should reject model with invalid endpoint inside', () => {
      const result = WorldModelSchema.safeParse({
        ...validModel,
        endpoints: [{ id: 'bad' }],
      });
      expect(result.success).toBe(false);
    });
  });
});
