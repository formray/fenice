import type { ToolHandler } from '../types.js';

interface GetSchemaArgs {
  path?: string;
  method?: string;
}

/**
 * `get_schema` — returns the OpenAPI operation definition for a given (method, path).
 *
 * Read-only. Available to any role >= agent.
 */
export const getSchemaTool: ToolHandler = {
  definition: {
    name: 'get_schema',
    description:
      'Get the OpenAPI operation definition (parameters, requestBody, responses, security) for a specific endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Endpoint path (e.g. /api/v1/users/{id})',
        },
        method: {
          type: 'string',
          description: 'HTTP method (default: GET)',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          default: 'GET',
        },
      },
      required: ['path'],
    },
    minRole: 'agent',
    readOnly: true,
  },

  async handle(args, ctx) {
    const { path, method = 'GET' } = (args ?? {}) as GetSchemaArgs;

    if (!path) {
      return {
        content: [{ type: 'text', text: 'Missing required argument: path' }],
        isError: true,
      };
    }

    const spec = ctx.getOpenApiDocument() as { paths?: Record<string, Record<string, unknown>> };
    const pathItem = spec.paths?.[path];

    if (!pathItem) {
      return {
        content: [{ type: 'text', text: `No such path: ${path}` }],
        isError: true,
      };
    }

    const operation = pathItem[method.toLowerCase()];
    if (!operation) {
      return {
        content: [
          {
            type: 'text',
            text: `No ${method.toUpperCase()} operation defined for ${path}`,
          },
        ],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'json',
          data: {
            path,
            method: method.toUpperCase(),
            operation,
          },
        },
      ],
      isError: false,
    };
  },
};
