import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectionService } from '../../../src/services/projection.service.js';
import { WorldModelSchema } from '../../../src/schemas/world.schema.js';

function makeSpec(paths: Record<string, Record<string, unknown>> = {}): unknown {
  return {
    openapi: '3.1.0',
    info: { title: 'Test', version: '1.0.0' },
    paths,
  };
}

describe('ProjectionService', () => {
  let service: ProjectionService;

  beforeEach(() => {
    service = new ProjectionService();
  });

  describe('buildWorldModel', () => {
    it('should return empty world model for spec with no paths', () => {
      const model = service.buildWorldModel(makeSpec());
      expect(model.schemaVersion).toBe(1);
      expect(model.services).toHaveLength(0);
      expect(model.endpoints).toHaveLength(0);
      expect(model.edges).toHaveLength(0);
      expect(model.generatedAt).toBeTruthy();
    });

    it('should group endpoints by tag into services', () => {
      const spec = makeSpec({
        '/health': {
          get: { tags: ['Health'], summary: 'Health check' },
        },
        '/health/detailed': {
          get: { tags: ['Health'], summary: 'Detailed health' },
        },
        '/auth/login': {
          post: { tags: ['Auth'], summary: 'Login' },
        },
      });
      const model = service.buildWorldModel(spec);

      expect(model.services).toHaveLength(2);
      expect(model.services.map((s) => s.tag).sort()).toEqual(['Auth', 'Health']);

      const healthService = model.services.find((s) => s.tag === 'Health');
      expect(healthService?.id).toBe('service:health');
      expect(healthService?.endpointCount).toBe(2);

      const authService = model.services.find((s) => s.tag === 'Auth');
      expect(authService?.id).toBe('service:auth');
      expect(authService?.endpointCount).toBe(1);
    });

    it('should use "Untagged" for endpoints without tags', () => {
      const spec = makeSpec({
        '/misc': {
          get: { summary: 'No tags' },
        },
      });
      const model = service.buildWorldModel(spec);

      expect(model.services).toHaveLength(1);
      expect(model.services[0].tag).toBe('Untagged');
      expect(model.services[0].id).toBe('service:untagged');
    });

    it('should generate correct endpoint ids', () => {
      const spec = makeSpec({
        '/auth/login': {
          post: { tags: ['Auth'], summary: 'Login' },
        },
      });
      const model = service.buildWorldModel(spec);

      expect(model.endpoints).toHaveLength(1);
      expect(model.endpoints[0].id).toBe('endpoint:post:/auth/login');
      expect(model.endpoints[0].serviceId).toBe('service:auth');
      expect(model.endpoints[0].path).toBe('/auth/login');
      expect(model.endpoints[0].method).toBe('post');
    });

    it('should detect hasAuth from security array', () => {
      const spec = makeSpec({
        '/public': {
          get: { tags: ['Health'], summary: 'Public' },
        },
        '/protected': {
          get: { tags: ['Health'], summary: 'Protected', security: [{ Bearer: [] }] },
        },
      });
      const model = service.buildWorldModel(spec);

      const pub = model.endpoints.find((e) => e.path === '/public');
      const prot = model.endpoints.find((e) => e.path === '/protected');
      expect(pub?.hasAuth).toBe(false);
      expect(prot?.hasAuth).toBe(true);
    });

    it('should count parameters correctly', () => {
      const spec = makeSpec({
        '/users/{id}': {
          get: {
            tags: ['Users'],
            summary: 'Get user',
            security: [{ Bearer: [] }],
            parameters: [{ name: 'id', in: 'path' }],
          },
        },
        '/auth/signup': {
          post: {
            tags: ['Auth'],
            summary: 'Signup',
            requestBody: { content: { 'application/json': { schema: {} } } },
          },
        },
        '/upload/{uploadId}/chunk/{index}': {
          put: {
            tags: ['Upload'],
            summary: 'Upload chunk',
            security: [{ Bearer: [] }],
            parameters: [
              { name: 'uploadId', in: 'path' },
              { name: 'index', in: 'path' },
            ],
            requestBody: { content: { 'application/octet-stream': { schema: {} } } },
          },
        },
      });
      const model = service.buildWorldModel(spec);

      const getUser = model.endpoints.find((e) => e.path === '/users/{id}');
      expect(getUser?.parameterCount).toBe(1); // 1 path param

      const signup = model.endpoints.find((e) => e.path === '/auth/signup');
      expect(signup?.parameterCount).toBe(1); // 1 requestBody

      const chunk = model.endpoints.find((e) => e.path === '/upload/{uploadId}/chunk/{index}');
      expect(chunk?.parameterCount).toBe(3); // 2 path params + 1 requestBody
    });

    it('should generate pairwise edges within same service', () => {
      const spec = makeSpec({
        '/health': {
          get: { tags: ['Health'], summary: 'Health' },
        },
        '/health/detailed': {
          get: { tags: ['Health'], summary: 'Detailed' },
        },
      });
      const model = service.buildWorldModel(spec);

      expect(model.edges).toHaveLength(1);
      expect(model.edges[0].type).toBe('same_service');
      expect(model.edges[0].sourceId).toBe('endpoint:get:/health');
      expect(model.edges[0].targetId).toBe('endpoint:get:/health/detailed');
    });

    it('should generate n*(n-1)/2 edges for n endpoints in same service', () => {
      const spec = makeSpec({
        '/a': { get: { tags: ['X'], summary: 'A' } },
        '/b': { get: { tags: ['X'], summary: 'B' } },
        '/c': { get: { tags: ['X'], summary: 'C' } },
      });
      const model = service.buildWorldModel(spec);

      // 3 endpoints → 3 edges (3*2/2)
      expect(model.edges).toHaveLength(3);
    });

    it('should NOT generate edges across different services', () => {
      const spec = makeSpec({
        '/health': { get: { tags: ['Health'], summary: 'Health' } },
        '/auth/login': { post: { tags: ['Auth'], summary: 'Login' } },
      });
      const model = service.buildWorldModel(spec);

      expect(model.edges).toHaveLength(0);
    });

    it('should produce a valid WorldModel (schema validation)', () => {
      const spec = makeSpec({
        '/health': { get: { tags: ['Health'], summary: 'Health check' } },
        '/auth/login': { post: { tags: ['Auth'], summary: 'Login' } },
      });
      const model = service.buildWorldModel(spec);

      const result = WorldModelSchema.safeParse(model);
      expect(result.success).toBe(true);
    });

    it('should handle multiple methods on the same path', () => {
      const spec = makeSpec({
        '/users/{id}': {
          get: { tags: ['Users'], summary: 'Get user', security: [{ Bearer: [] }] },
          patch: { tags: ['Users'], summary: 'Update user', security: [{ Bearer: [] }] },
          delete: { tags: ['Users'], summary: 'Delete user', security: [{ Bearer: [] }] },
        },
      });
      const model = service.buildWorldModel(spec);

      expect(model.endpoints).toHaveLength(3);
      expect(model.services).toHaveLength(1);
      expect(model.services[0].endpointCount).toBe(3);
      // 3 endpoints → 3 edges
      expect(model.edges).toHaveLength(3);
    });
  });

  describe('caching', () => {
    it('getCachedModel should return null before buildWorldModel', () => {
      expect(service.getCachedModel()).toBeNull();
    });

    it('getCachedModel should return model after buildWorldModel', () => {
      const spec = makeSpec({
        '/health': { get: { tags: ['Health'], summary: 'Health' } },
      });
      const model = service.buildWorldModel(spec);
      expect(service.getCachedModel()).toBe(model);
    });

    it('clearCache should reset cached model to null', () => {
      const spec = makeSpec({
        '/health': { get: { tags: ['Health'], summary: 'Health' } },
      });
      service.buildWorldModel(spec);
      service.clearCache();
      expect(service.getCachedModel()).toBeNull();
    });

    it('buildWorldModel should update cached model on subsequent calls', () => {
      const spec1 = makeSpec({
        '/a': { get: { tags: ['A'], summary: 'A' } },
      });
      const spec2 = makeSpec({
        '/b': { get: { tags: ['B'], summary: 'B' } },
      });
      const model1 = service.buildWorldModel(spec1);
      const model2 = service.buildWorldModel(spec2);
      expect(model1).not.toBe(model2);
      expect(service.getCachedModel()).toBe(model2);
    });
  });
});
