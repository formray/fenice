import { OpenAPIHono, createRoute, z } from '@hono/zod-openapi';
import { UploadService } from '../services/upload.service.js';
import {
  InitUploadSchema,
  InitUploadResponseSchema,
  ChunkParamsSchema,
  ChunkResponseSchema,
  CompleteUploadSchema,
  CompleteUploadResponseSchema,
} from '../schemas/upload.schema.js';
import { ErrorResponseSchema } from '../schemas/common.schema.js';
import { loadEnv } from '../config/env.js';
import { createAdapters } from '../adapters/index.js';

// Lazy-init pattern: avoid running loadEnv() at import time (breaks tests)
let uploadService: UploadService | null = null;

function getUploadService(): UploadService {
  if (!uploadService) {
    const env = loadEnv();
    const adapters = createAdapters();
    uploadService = new UploadService(adapters.storage, {
      maxSizeBytes: env.UPLOAD_MAX_SIZE_BYTES,
      chunkSizeBytes: env.UPLOAD_CHUNK_SIZE_BYTES,
      sessionTimeoutMs: env.UPLOAD_SESSION_TIMEOUT_MS,
      maxConcurrent: env.UPLOAD_MAX_CONCURRENT,
    });
  }
  return uploadService;
}

// --- Route definitions ---

const initUploadRoute = createRoute({
  method: 'post',
  path: '/upload/init',
  tags: ['Upload'],
  summary: 'Initialize a chunked file upload',
  security: [{ Bearer: [] }],
  request: {
    body: {
      content: {
        'application/json': {
          schema: InitUploadSchema,
        },
      },
      required: true,
    },
  },
  responses: {
    201: {
      description: 'Upload session created',
      content: {
        'application/json': {
          schema: InitUploadResponseSchema,
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
  },
});

const uploadChunkRoute = createRoute({
  method: 'put',
  path: '/upload/{uploadId}/chunk/{index}',
  tags: ['Upload'],
  summary: 'Upload a single chunk',
  security: [{ Bearer: [] }],
  request: {
    params: ChunkParamsSchema,
    body: {
      content: {
        'application/octet-stream': {
          schema: z.string().openapi({ type: 'string', format: 'binary' }),
        },
      },
      required: true,
    },
  },
  responses: {
    200: {
      description: 'Chunk uploaded',
      content: {
        'application/json': {
          schema: ChunkResponseSchema,
        },
      },
    },
    400: {
      description: 'Invalid chunk',
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
    404: {
      description: 'Upload session not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const completeUploadRoute = createRoute({
  method: 'post',
  path: '/upload/{uploadId}/complete',
  tags: ['Upload'],
  summary: 'Complete a chunked upload and assemble file',
  security: [{ Bearer: [] }],
  request: {
    params: CompleteUploadSchema,
  },
  responses: {
    200: {
      description: 'Upload completed',
      content: {
        'application/json': {
          schema: CompleteUploadResponseSchema,
        },
      },
    },
    400: {
      description: 'Upload incomplete or invalid',
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
    404: {
      description: 'Upload session not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

const cancelUploadRoute = createRoute({
  method: 'delete',
  path: '/upload/{uploadId}',
  tags: ['Upload'],
  summary: 'Cancel an upload and clean up chunks',
  security: [{ Bearer: [] }],
  request: {
    params: z.object({
      uploadId: z.string().min(1),
    }),
  },
  responses: {
    200: {
      description: 'Upload cancelled',
      content: {
        'application/json': {
          schema: z.object({
            success: z.boolean(),
            message: z.string(),
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
    404: {
      description: 'Upload session not found',
      content: {
        'application/json': {
          schema: ErrorResponseSchema,
        },
      },
    },
  },
});

// --- Router ---

type UploadEnv = {
  Variables: {
    userId: string;
    email: string;
    role: string;
    requestId: string;
  };
};

export const uploadRouter = new OpenAPIHono<UploadEnv>();

// NOTE: Auth middleware is applied in src/index.ts via app.use('/api/v1/upload/*', authMiddleware)

uploadRouter.openapi(initUploadRoute, async (c) => {
  const body = c.req.valid('json');
  const userId = c.get('userId');
  const service = getUploadService();

  const result = service.initUpload(userId, body);

  return c.json(
    {
      uploadId: result.uploadId,
      chunkSize: result.chunkSize,
      totalChunks: result.totalChunks,
      expiresAt: result.expiresAt.toISOString(),
    },
    201
  );
});

uploadRouter.openapi(uploadChunkRoute, async (c) => {
  const { uploadId, index } = c.req.valid('param');
  const service = getUploadService();

  const arrayBuffer = await c.req.arrayBuffer();
  const data = Buffer.from(arrayBuffer);

  const progress = await service.uploadChunk(uploadId, index, data);

  return c.json(progress, 200);
});

uploadRouter.openapi(completeUploadRoute, async (c) => {
  const { uploadId } = c.req.valid('param');
  const service = getUploadService();

  const result = await service.completeUpload(uploadId);

  return c.json(
    {
      fileId: result.fileId,
      fileUrl: result.fileUrl,
      filename: result.filename,
      contentType: result.contentType,
      size: result.size,
      createdAt: result.createdAt.toISOString(),
    },
    200
  );
});

uploadRouter.openapi(cancelUploadRoute, async (c) => {
  const { uploadId } = c.req.valid('param');
  const service = getUploadService();

  await service.cancelUpload(uploadId);

  return c.json({ success: true as const, message: 'Upload cancelled' }, 200);
});
