import type {
  WorldModel,
  WorldService,
  WorldEndpoint,
  WorldEdge,
} from '../schemas/world.schema.js';

/**
 * OpenAPI operation shape (minimal subset we rely on).
 * Kept loose to avoid coupling to a specific OpenAPI typing library.
 */
interface OpenApiOperation {
  tags?: string[];
  summary?: string;
  security?: unknown[];
  parameters?: unknown[];
  requestBody?: unknown;
}

type OpenApiPaths = Record<string, Record<string, OpenApiOperation>>;

interface OpenApiSpec {
  paths?: OpenApiPaths;
}

// HTTP methods we recognise in the spec
const HTTP_METHODS = new Set(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);

/**
 * Transforms an OpenAPI 3.x spec into a WorldModel suitable for the 3D city visualisation.
 *
 * Mapping rules (from Codex M1 Checklist):
 * 1. Group by `tags[0]` → WorldService  (id: `service:<tag_lowercase>`)
 * 2. Each (path, method) → WorldEndpoint  (id: `endpoint:<method>:<path>`)
 * 3. `hasAuth` = `security` array non-empty
 * 4. `parameterCount` = path/query params + (requestBody ? 1 : 0)
 * 5. Pairwise edges within same service → WorldEdge type `same_service`
 */
export class ProjectionService {
  private cachedModel: WorldModel | null = null;

  buildWorldModel(spec: unknown): WorldModel {
    const openApiSpec = spec as OpenApiSpec;
    const paths = openApiSpec.paths ?? {};

    // Collect endpoints grouped by tag
    const tagEndpoints = new Map<string, WorldEndpoint[]>();

    for (const [path, methods] of Object.entries(paths)) {
      for (const [method, operation] of Object.entries(methods)) {
        if (!HTTP_METHODS.has(method)) continue;

        const op = operation;
        const tag = op.tags?.[0] ?? 'Untagged';
        const serviceId = `service:${tag.toLowerCase()}`;

        const endpoint: WorldEndpoint = {
          id: `endpoint:${method}:${path}`,
          serviceId,
          path,
          method: method as WorldEndpoint['method'],
          summary: op.summary ?? '',
          hasAuth: Array.isArray(op.security) && op.security.length > 0,
          parameterCount:
            (Array.isArray(op.parameters) ? op.parameters.length : 0) + (op.requestBody ? 1 : 0),
        };

        const existing = tagEndpoints.get(tag) ?? [];
        existing.push(endpoint);
        tagEndpoints.set(tag, existing);
      }
    }

    // Build services
    const services: WorldService[] = [];
    const allEndpoints: WorldEndpoint[] = [];

    for (const [tag, endpoints] of tagEndpoints) {
      services.push({
        id: `service:${tag.toLowerCase()}`,
        tag,
        endpointCount: endpoints.length,
      });
      allEndpoints.push(...endpoints);
    }

    // Build pairwise edges within each service
    const edges: WorldEdge[] = [];
    for (const endpoints of tagEndpoints.values()) {
      for (let i = 0; i < endpoints.length; i++) {
        const source = endpoints[i];
        if (!source) continue;
        for (let j = i + 1; j < endpoints.length; j++) {
          const target = endpoints[j];
          if (!target) continue;
          edges.push({
            id: `edge:${source.id}->${target.id}`,
            sourceId: source.id,
            targetId: target.id,
            type: 'same_service',
          });
        }
      }
    }

    const model: WorldModel = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      services,
      endpoints: allEndpoints,
      edges,
    };

    this.cachedModel = model;
    return model;
  }

  getCachedModel(): WorldModel | null {
    return this.cachedModel;
  }

  clearCache(): void {
    this.cachedModel = null;
  }
}
