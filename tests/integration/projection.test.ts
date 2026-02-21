import { describe, it, expect } from 'vitest';
import { app } from '../../src/index.js';
import { ProjectionService } from '../../src/services/projection.service.js';
import { WorldModelSchema } from '../../src/schemas/world.schema.js';

describe('ProjectionService integration (live OpenAPI spec)', () => {
  it('should parse live FENICE OpenAPI spec into valid WorldModel', async () => {
    const res = await app.request('/openapi');
    expect(res.status).toBe(200);
    const spec: unknown = await res.json();

    const projection = new ProjectionService();
    const model = projection.buildWorldModel(spec);

    // Validate against schema
    const result = WorldModelSchema.safeParse(model);
    expect(result.success).toBe(true);
  });

  it('should discover 4 services from the real spec', async () => {
    const res = await app.request('/openapi');
    const spec: unknown = await res.json();

    const projection = new ProjectionService();
    const model = projection.buildWorldModel(spec);

    const tags = model.services.map((s) => s.tag).sort();
    expect(tags).toEqual(['Auth', 'Health', 'Upload', 'Users']);
  });

  it('should discover 15+ endpoints from the real spec', async () => {
    const res = await app.request('/openapi');
    const spec: unknown = await res.json();

    const projection = new ProjectionService();
    const model = projection.buildWorldModel(spec);

    // FENICE has 17 endpoints across 4 tag groups
    expect(model.endpoints.length).toBeGreaterThanOrEqual(15);
  });

  it('should have correct endpointCount per service', async () => {
    const res = await app.request('/openapi');
    const spec: unknown = await res.json();

    const projection = new ProjectionService();
    const model = projection.buildWorldModel(spec);

    for (const service of model.services) {
      const count = model.endpoints.filter((e) => e.serviceId === service.id).length;
      expect(service.endpointCount).toBe(count);
    }
  });

  it('should detect auth on secured endpoints', async () => {
    const res = await app.request('/openapi');
    const spec: unknown = await res.json();

    const projection = new ProjectionService();
    const model = projection.buildWorldModel(spec);

    // Users endpoints should have auth
    const usersEndpoints = model.endpoints.filter((e) => e.serviceId === 'service:users');
    expect(usersEndpoints.length).toBeGreaterThan(0);
    for (const ep of usersEndpoints) {
      expect(ep.hasAuth).toBe(true);
    }

    // Health endpoints should NOT have auth
    const healthEndpoints = model.endpoints.filter((e) => e.serviceId === 'service:health');
    expect(healthEndpoints.length).toBeGreaterThan(0);
    for (const ep of healthEndpoints) {
      expect(ep.hasAuth).toBe(false);
    }
  });

  it('should generate same_service edges within tag groups', async () => {
    const res = await app.request('/openapi');
    const spec: unknown = await res.json();

    const projection = new ProjectionService();
    const model = projection.buildWorldModel(spec);

    expect(model.edges.length).toBeGreaterThan(0);
    for (const edge of model.edges) {
      expect(edge.type).toBe('same_service');
      // Source and target should belong to the same service
      const source = model.endpoints.find((e) => e.id === edge.sourceId);
      const target = model.endpoints.find((e) => e.id === edge.targetId);
      expect(source).toBeDefined();
      expect(target).toBeDefined();
      expect(source?.serviceId).toBe(target?.serviceId);
    }
  });

  it('should cache model after build', async () => {
    const res = await app.request('/openapi');
    const spec: unknown = await res.json();

    const projection = new ProjectionService();
    expect(projection.getCachedModel()).toBeNull();

    projection.buildWorldModel(spec);
    const cached = projection.getCachedModel();
    expect(cached).not.toBeNull();
    expect(cached?.services.length).toBeGreaterThan(0);
  });
});
