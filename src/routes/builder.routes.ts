import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { BuilderService } from '../services/builder.service.js';
import {
  BuilderPromptSchema,
  BuilderJobSchema,
  BuilderJobStatusEnum,
  BuilderJobQuerySchema,
  BuilderApproveSchema,
} from '../schemas/builder.schema.js';
import type { BuilderJob } from '../schemas/builder.schema.js';
import type { BuilderJobDocument } from '../models/builder-job.model.js';
import type { WorldWsManager } from '../ws/world-manager.js';
import { CursorPaginationSchema, ErrorResponseSchema } from '../schemas/common.schema.js';
import { requireRole } from '../middleware/rbac.js';
import { AppError } from '../utils/errors.js';

type AuthEnv = {
  Variables: {
    userId: string;
    email: string;
    role: string;
    requestId: string;
  };
};

// Lazy-init singleton — receives optional WorldWsManager for real-time world updates
let builderService: BuilderService | null = null;

function getBuilderService(): BuilderService {
  builderService ??= new BuilderService();
  return builderService;
}

export function initBuilderService(wsManager: WorldWsManager): void {
  builderService = new BuilderService(wsManager);
}

function serializeJob(job: BuilderJobDocument): BuilderJob {
  const json = job.toJSON() as Record<string, unknown>;
  return {
    id: json['id'] as string,
    prompt: json['prompt'] as string,
    status: json['status'] as BuilderJob['status'],
    options: json['options'] as BuilderJob['options'],
    plan: json['plan'] as BuilderJob['plan'],
    result: json['result'] as BuilderJob['result'],
    error: json['error'] as BuilderJob['error'],
    userId: json['userId'] as string,
    createdAt: String(json['createdAt']),
    updatedAt: String(json['updatedAt']),
  };
}

function checkBuilderEnabled(): void {
  const enabled = process.env['BUILDER_ENABLED'];
  if (enabled !== 'true') {
    throw new AppError(503, 'BUILDER_DISABLED', 'AI Builder is currently disabled');
  }
}

// --- Route definitions ---

const generateRoute = createRoute({
  method: 'post',
  path: '/builder/generate',
  tags: ['Builder'],
  summary: 'Submit a prompt to generate a new API endpoint',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: BuilderPromptSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    202: {
      description: 'Job queued',
      content: {
        'application/json': {
          schema: z.object({
            jobId: z.string(),
            status: BuilderJobStatusEnum,
          }),
        },
      },
    },
    400: {
      description: 'Validation error',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden — admin only',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    503: {
      description: 'Builder disabled',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const getJobRoute = createRoute({
  method: 'get',
  path: '/builder/jobs/{id}',
  tags: ['Builder'],
  summary: 'Get builder job by ID',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      id: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: 'Job details',
      content: {
        'application/json': {
          schema: BuilderJobSchema,
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    404: {
      description: 'Job not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const listJobsRoute = createRoute({
  method: 'get',
  path: '/builder/jobs',
  tags: ['Builder'],
  summary: 'List builder jobs with pagination',
  security: [{ Bearer: [] }],
  request: {
    query: CursorPaginationSchema.extend(BuilderJobQuerySchema.shape),
  },
  responses: {
    200: {
      description: 'Paginated job list',
      content: {
        'application/json': {
          schema: z.object({
            data: z.array(BuilderJobSchema),
            pagination: z.object({
              hasNext: z.boolean(),
              nextCursor: z.string().nullable(),
            }),
          }),
        },
      },
    },
    401: {
      description: 'Not authenticated',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
    403: {
      description: 'Forbidden — admin only',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const approveRoute = createRoute({
  method: 'post',
  path: '/builder/jobs/{id}/approve',
  tags: ['Builder'],
  summary: 'Approve a builder plan and start code generation',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({ id: z.string().min(1) }),
    body: {
      content: { 'application/json': { schema: BuilderApproveSchema } },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Plan approved, generation started',
      content: { 'application/json': { schema: z.object({ status: z.literal('generating') }) } },
    },
    400: {
      description: 'Invalid state or body',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Job not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    503: {
      description: 'Builder disabled',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

const rejectRoute = createRoute({
  method: 'post',
  path: '/builder/jobs/{id}/reject',
  tags: ['Builder'],
  summary: 'Reject a builder plan',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({ id: z.string().min(1) }),
  },
  responses: {
    200: {
      description: 'Plan rejected',
      content: { 'application/json': { schema: z.object({ status: z.literal('rejected') }) } },
    },
    400: {
      description: 'Invalid state',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    401: {
      description: 'Not authenticated',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    403: {
      description: 'Forbidden',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    404: {
      description: 'Job not found',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
    503: {
      description: 'Builder disabled',
      content: { 'application/json': { schema: ErrorResponseSchema } },
    },
  },
});

// --- Router ---

export const builderRouter = new OpenAPIHono<AuthEnv>();

// RBAC: admin-only for generate, list, approve, reject
builderRouter.post('/builder/generate', requireRole('admin'));
builderRouter.get('/builder/jobs', requireRole('admin'));
builderRouter.post('/builder/jobs/:id/approve', requireRole('admin'));
builderRouter.post('/builder/jobs/:id/reject', requireRole('admin'));

builderRouter.openapi(generateRoute, async (c) => {
  checkBuilderEnabled();
  const body = c.req.valid('json');
  const userId = c.get('userId');
  const job = await getBuilderService().generate(body.prompt, userId, body.options);
  const json = job.toJSON() as Record<string, unknown>;
  return c.json(
    {
      jobId: json['id'] as string,
      status: json['status'] as BuilderJob['status'],
    },
    202
  );
});

builderRouter.openapi(getJobRoute, async (c) => {
  const { id } = c.req.valid('param');
  const job = await getBuilderService().getJob(id);
  return c.json(serializeJob(job), 200);
});

builderRouter.openapi(listJobsRoute, async (c) => {
  const { cursor, limit, sort, order, ...filterParams } = c.req.valid('query');
  const filter: Record<string, unknown> = {};
  if (filterParams.status) {
    filter['status'] = filterParams.status;
  }
  const result = await getBuilderService().listJobs(filter, { cursor, limit, sort, order });
  return c.json(
    {
      data: result.data.map(serializeJob),
      pagination: result.pagination,
    },
    200
  );
});

builderRouter.openapi(approveRoute, async (c) => {
  checkBuilderEnabled();
  const { id } = c.req.valid('param');
  const { plan } = c.req.valid('json');
  await getBuilderService().approve(id, plan);
  return c.json({ status: 'generating' as const }, 200);
});

builderRouter.openapi(rejectRoute, async (c) => {
  checkBuilderEnabled();
  const { id } = c.req.valid('param');
  await getBuilderService().reject(id);
  return c.json({ status: 'rejected' as const }, 200);
});
