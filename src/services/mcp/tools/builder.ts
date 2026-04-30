import type { ToolHandler } from '../types.js';

/**
 * Builder MCP tools — both mutating (create_endpoint, modify_endpoint)
 * and read-only (builder_get_job, builder_list_jobs).
 *
 * Mutating tools delegate to the existing two-phase BuilderService, which
 * preserves the human plan-approval gate. Agents trigger a job, get a jobId,
 * and follow it with builder_get_job. The plan never executes without a
 * human approving via POST /api/v1/builder/jobs/:id/approve.
 */

interface CreateEndpointArgs {
  prompt?: string;
  options?: {
    dryRun?: boolean;
    includeModel?: boolean;
    includeTests?: boolean;
  };
}

interface ModifyEndpointArgs extends CreateEndpointArgs {
  path?: string;
  method?: string;
}

interface JobIdArgs {
  jobId?: string;
}

interface ListJobsArgs {
  status?: string;
  cursor?: string;
  limit?: number;
}

function requireBuilder(ctx: { getBuilderService?: () => unknown }): unknown {
  if (!ctx.getBuilderService) {
    return null;
  }
  return ctx.getBuilderService();
}

export const createEndpointTool: ToolHandler = {
  definition: {
    name: 'create_endpoint',
    description:
      'Create a new API endpoint via the FENICE builder. Returns a jobId. The job enters the plan_ready state and requires a human to approve via POST /api/v1/builder/jobs/:id/approve before code is generated.',
    inputSchema: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          minLength: 10,
          maxLength: 2000,
          description: 'Natural language description of the endpoint to create',
        },
        options: {
          type: 'object',
          properties: {
            dryRun: {
              type: 'boolean',
              default: false,
              description: 'If true, generate code but do not write files or create PR',
            },
            includeModel: { type: 'boolean', default: true },
            includeTests: { type: 'boolean', default: true },
          },
        },
      },
      required: ['prompt'],
    },
    minRole: 'admin',
    readOnly: false,
  },

  async handle(args, ctx, caller) {
    const { prompt, options } = (args ?? {}) as CreateEndpointArgs;
    if (!prompt || prompt.length < 10) {
      return {
        content: [{ type: 'text', text: 'prompt must be at least 10 characters' }],
        isError: true,
      };
    }

    const builder = requireBuilder(ctx) as {
      generate: (p: string, u: string, o?: unknown) => Promise<{ _id: { toString(): string } }>;
    } | null;
    if (!builder) {
      return {
        content: [
          {
            type: 'text',
            text: 'Builder service is not available — set BUILDER_ENABLED=true and configure ANTHROPIC_API_KEY + GITHUB_TOKEN.',
          },
        ],
        isError: true,
      };
    }

    try {
      const job = await builder.generate(prompt, caller.userId, options);
      return {
        content: [
          {
            type: 'json',
            data: {
              jobId: job._id.toString(),
              status: 'queued',
              message:
                'Builder job created. Plan generation has started — poll builder_get_job for status. A human must approve the plan before code is generated.',
            },
          },
        ],
        isError: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Builder service error';
      return {
        content: [{ type: 'text', text: `Failed to create job: ${message}` }],
        isError: true,
      };
    }
  },
};

export const modifyEndpointTool: ToolHandler = {
  definition: {
    name: 'modify_endpoint',
    description:
      'Modify an existing API endpoint. Bundles the path/method into the prompt and dispatches a builder job. Same plan-approve gate as create_endpoint.',
    inputSchema: {
      type: 'object',
      properties: {
        path: { type: 'string' },
        method: { type: 'string', enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
        prompt: {
          type: 'string',
          minLength: 10,
          maxLength: 2000,
          description: 'Natural language description of the modification',
        },
        options: {
          type: 'object',
          properties: {
            dryRun: { type: 'boolean', default: false },
            includeModel: { type: 'boolean', default: false },
            includeTests: { type: 'boolean', default: true },
          },
        },
      },
      required: ['path', 'prompt'],
    },
    minRole: 'admin',
    readOnly: false,
  },

  async handle(args, ctx, caller) {
    const { path, method, prompt, options } = (args ?? {}) as ModifyEndpointArgs;
    if (!path || !prompt || prompt.length < 10) {
      return {
        content: [{ type: 'text', text: 'path and prompt (>=10 chars) are required' }],
        isError: true,
      };
    }

    const builder = requireBuilder(ctx) as {
      generate: (p: string, u: string, o?: unknown) => Promise<{ _id: { toString(): string } }>;
    } | null;
    if (!builder) {
      return {
        content: [{ type: 'text', text: 'Builder service is not available' }],
        isError: true,
      };
    }

    const enrichedPrompt = method
      ? `Modify the existing endpoint ${method.toUpperCase()} ${path}. ${prompt}`
      : `Modify the existing endpoint ${path}. ${prompt}`;

    try {
      const job = await builder.generate(enrichedPrompt, caller.userId, options);
      return {
        content: [
          {
            type: 'json',
            data: {
              jobId: job._id.toString(),
              status: 'queued',
              targetPath: path,
              targetMethod: method?.toUpperCase(),
            },
          },
        ],
        isError: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Builder service error';
      return {
        content: [{ type: 'text', text: `Failed to create job: ${message}` }],
        isError: true,
      };
    }
  },
};

export const builderGetJobTool: ToolHandler = {
  definition: {
    name: 'builder_get_job',
    description:
      'Get the status, plan, and result of a builder job by id. Use after create_endpoint or modify_endpoint to follow progress.',
    inputSchema: {
      type: 'object',
      properties: {
        jobId: { type: 'string', description: 'The builder job id' },
      },
      required: ['jobId'],
    },
    minRole: 'agent',
    readOnly: true,
  },

  async handle(args, ctx) {
    const { jobId } = (args ?? {}) as JobIdArgs;
    if (!jobId) {
      return {
        content: [{ type: 'text', text: 'jobId is required' }],
        isError: true,
      };
    }

    const builder = requireBuilder(ctx) as {
      getJob: (id: string) => Promise<{ toJSON: () => unknown }>;
    } | null;
    if (!builder) {
      return {
        content: [{ type: 'text', text: 'Builder service is not available' }],
        isError: true,
      };
    }

    try {
      const job = await builder.getJob(jobId);
      return {
        content: [{ type: 'json', data: job.toJSON() }],
        isError: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Job not found';
      return {
        content: [{ type: 'text', text: message }],
        isError: true,
      };
    }
  },
};

export const builderListJobsTool: ToolHandler = {
  definition: {
    name: 'builder_list_jobs',
    description:
      'List builder jobs with optional status filter and cursor pagination. Useful for monitors that follow ongoing builds.',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: [
            'queued',
            'planning',
            'plan_ready',
            'rejected',
            'reading_context',
            'generating',
            'writing_files',
            'validating',
            'creating_pr',
            'completed',
            'failed',
          ],
        },
        cursor: { type: 'string' },
        limit: { type: 'number', minimum: 1, maximum: 100, default: 20 },
      },
    },
    minRole: 'agent',
    readOnly: true,
  },

  async handle(args, ctx) {
    const { status, cursor, limit = 20 } = (args ?? {}) as ListJobsArgs;

    const builder = requireBuilder(ctx) as {
      listJobs: (
        filter: Record<string, unknown>,
        opts: { cursor?: string; limit?: number }
      ) => Promise<{
        data: { toJSON: () => unknown }[];
        pagination: { hasNext: boolean; nextCursor: string | null };
      }>;
    } | null;
    if (!builder) {
      return {
        content: [{ type: 'text', text: 'Builder service is not available' }],
        isError: true,
      };
    }

    try {
      const filter: Record<string, unknown> = {};
      if (status) filter['status'] = status;

      const opts: { cursor?: string; limit: number } = { limit };
      if (cursor) opts.cursor = cursor;

      const result = await builder.listJobs(filter, opts);
      return {
        content: [
          {
            type: 'json',
            data: {
              count: result.data.length,
              jobs: result.data.map((j) => j.toJSON()),
              pagination: result.pagination,
            },
          },
        ],
        isError: false,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to list jobs';
      return {
        content: [{ type: 'text', text: message }],
        isError: true,
      };
    }
  },
};
