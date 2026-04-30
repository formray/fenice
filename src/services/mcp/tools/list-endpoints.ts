import type { ToolHandler } from '../types.js';
import { ProjectionService } from '../../projection.service.js';

interface ListEndpointsArgs {
  service?: string; // filter by service tag (case-insensitive)
  method?: string; // filter by HTTP method
}

/**
 * `list_endpoints` — returns the API surface as a flat list of endpoints,
 * derived from the live OpenAPI document via ProjectionService.
 *
 * Read-only. Available to any role >= agent.
 */
export const listEndpointsTool: ToolHandler = {
  definition: {
    name: 'list_endpoints',
    description:
      'List all API endpoints exposed by FENICE. Returns service grouping, HTTP method, path, summary, and auth requirement.',
    inputSchema: {
      type: 'object',
      properties: {
        service: {
          type: 'string',
          description: 'Optional service tag filter (case-insensitive)',
        },
        method: {
          type: 'string',
          description: 'Optional HTTP method filter (GET, POST, etc.)',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
        },
      },
    },
    minRole: 'agent',
    readOnly: true,
  },

  async handle(args, ctx) {
    const { service, method } = (args ?? {}) as ListEndpointsArgs;
    const spec = ctx.getOpenApiDocument();

    const projection = new ProjectionService();
    const world = projection.buildWorldModel(spec);

    let endpoints = world.endpoints;

    if (service) {
      const needle = service.toLowerCase();
      const matchingServiceIds = new Set(
        world.services.filter((s) => s.tag.toLowerCase() === needle).map((s) => s.id)
      );
      endpoints = endpoints.filter((e) => matchingServiceIds.has(e.serviceId));
    }

    if (method) {
      const needle = method.toUpperCase();
      endpoints = endpoints.filter((e) => e.method.toUpperCase() === needle);
    }

    return {
      content: [
        {
          type: 'json',
          data: {
            count: endpoints.length,
            endpoints: endpoints.map((e) => ({
              id: e.id,
              service: e.serviceId,
              method: e.method.toUpperCase(),
              path: e.path,
              summary: e.summary,
              hasAuth: e.hasAuth,
              parameterCount: e.parameterCount,
            })),
          },
        },
      ],
      isError: false,
    };
  },
};
