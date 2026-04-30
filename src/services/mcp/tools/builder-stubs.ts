import type { ToolHandler } from '../types.js';

/**
 * Mutating builder tools — surface only in M7.1.
 *
 * These declare the contract so MCP clients can discover them via
 * `tools/list`, but invocation returns a "not yet implemented" error.
 *
 * In M7.b they will delegate to the existing two-phase builder pipeline,
 * preserving the human plan-approval gate. For now they're admin-only.
 */

export const createEndpointTool: ToolHandler = {
  definition: {
    name: 'create_endpoint',
    description:
      'Create a new API endpoint via the FENICE builder. Triggers a builder job that requires human plan approval before code generation. Returns the job ID for status tracking.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          minLength: 10,
          maxLength: 2000,
          description: 'Natural language description of the endpoint to create',
        },
      },
      required: ['prompt'],
    },
    minRole: 'admin',
    readOnly: false,
  },

  async handle() {
    return {
      content: [
        {
          type: 'text',
          text: 'create_endpoint is registered but not yet wired to the builder pipeline. Will be enabled in M7.b — track via /api/v1/builder/generate in the meantime.',
        },
      ],
      isError: true,
    };
  },
};

export const modifyEndpointTool: ToolHandler = {
  definition: {
    name: 'modify_endpoint',
    description:
      'Modify an existing API endpoint via the FENICE builder. Triggers a builder job with human plan approval gate.',
    inputSchema: {
      type: 'object',
      properties: {
        path: {
          type: 'string',
          description: 'Endpoint path to modify',
        },
        method: {
          type: 'string',
          enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
          description: 'HTTP method',
        },
        prompt: {
          type: 'string',
          minLength: 10,
          maxLength: 2000,
          description: 'Natural language description of the modification',
        },
      },
      required: ['path', 'prompt'],
    },
    minRole: 'admin',
    readOnly: false,
  },

  async handle() {
    return {
      content: [
        {
          type: 'text',
          text: 'modify_endpoint is registered but not yet wired to the builder pipeline. Will be enabled in M7.b.',
        },
      ],
      isError: true,
    };
  },
};
