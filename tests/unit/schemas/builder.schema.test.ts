import { describe, it, expect } from 'vitest';
import {
  BuilderPromptSchema,
  BuilderJobSchema,
  BuilderJobStatusEnum,
  BuilderOptionsSchema,
  BuilderGeneratedFileSchema,
  BuilderJobResultSchema,
  BuilderJobErrorSchema,
  BuilderJobQuerySchema,
  BuilderPlanFileSchema,
  BuilderPlanSchema,
  BuilderApproveSchema,
} from '../../../src/schemas/builder.schema.js';

describe('BuilderJobStatusEnum', () => {
  it('should accept all valid statuses', () => {
    const statuses = [
      'queued',
      'reading_context',
      'generating',
      'writing_files',
      'validating',
      'creating_pr',
      'completed',
      'failed',
    ];
    for (const status of statuses) {
      expect(() => BuilderJobStatusEnum.parse(status)).not.toThrow();
    }
  });

  it('should accept planning status', () => {
    expect(() => BuilderJobStatusEnum.parse('planning')).not.toThrow();
  });

  it('should accept plan_ready status', () => {
    expect(() => BuilderJobStatusEnum.parse('plan_ready')).not.toThrow();
  });

  it('should accept rejected status', () => {
    expect(() => BuilderJobStatusEnum.parse('rejected')).not.toThrow();
  });

  it('should reject invalid status', () => {
    expect(() => BuilderJobStatusEnum.parse('running')).toThrow();
  });
});

describe('BuilderOptionsSchema', () => {
  it('should apply defaults', () => {
    const result = BuilderOptionsSchema.parse({});
    expect(result.dryRun).toBe(false);
    expect(result.includeModel).toBe(true);
    expect(result.includeTests).toBe(true);
  });

  it('should accept valid options', () => {
    const input = { dryRun: true, targetTag: 'products', includeModel: false, includeTests: false };
    const result = BuilderOptionsSchema.parse(input);
    expect(result.dryRun).toBe(true);
    expect(result.targetTag).toBe('products');
    expect(result.includeModel).toBe(false);
  });

  it('should reject unknown properties (strict)', () => {
    expect(() => BuilderOptionsSchema.parse({ unknown: 'field' })).toThrow();
  });

  it('should reject targetTag exceeding 50 chars', () => {
    expect(() => BuilderOptionsSchema.parse({ targetTag: 'a'.repeat(51) })).toThrow();
  });
});

describe('BuilderPromptSchema', () => {
  it('should accept a valid prompt', () => {
    const input = { prompt: 'Add a GET /api/v1/products endpoint that lists all products' };
    expect(() => BuilderPromptSchema.parse(input)).not.toThrow();
  });

  it('should reject prompt shorter than 10 chars', () => {
    expect(() => BuilderPromptSchema.parse({ prompt: 'too short' })).toThrow();
  });

  it('should reject prompt longer than 2000 chars', () => {
    expect(() => BuilderPromptSchema.parse({ prompt: 'x'.repeat(2001) })).toThrow();
  });

  it('should accept prompt with options', () => {
    const input = {
      prompt: 'Add a products endpoint with CRUD operations',
      options: { dryRun: true },
    };
    const result = BuilderPromptSchema.parse(input);
    expect(result.options?.dryRun).toBe(true);
  });

  it('should accept prompt without options', () => {
    const input = { prompt: 'Add a products endpoint with CRUD operations' };
    const result = BuilderPromptSchema.parse(input);
    expect(result.options).toBeUndefined();
  });
});

describe('BuilderGeneratedFileSchema', () => {
  it('should accept a valid generated file', () => {
    const file = {
      path: 'src/schemas/product.schema.ts',
      content: 'export const ProductSchema = z.object({});',
      action: 'created',
    };
    expect(() => BuilderGeneratedFileSchema.parse(file)).not.toThrow();
  });

  it('should reject invalid action', () => {
    expect(() =>
      BuilderGeneratedFileSchema.parse({
        path: 'src/test.ts',
        content: 'test',
        action: 'deleted',
      })
    ).toThrow();
  });
});

describe('BuilderJobResultSchema', () => {
  it('should accept a valid result with PR info', () => {
    const result = {
      files: [{ path: 'src/test.ts', content: 'code', action: 'created' }],
      prUrl: 'https://github.com/formray/fenice/pull/1',
      prNumber: 1,
      branch: 'builder/abc-products',
      validationPassed: true,
    };
    expect(() => BuilderJobResultSchema.parse(result)).not.toThrow();
  });

  it('should accept a minimal result', () => {
    const result = { files: [] };
    expect(() => BuilderJobResultSchema.parse(result)).not.toThrow();
  });
});

describe('BuilderJobErrorSchema', () => {
  it('should accept a valid error', () => {
    const error = {
      code: 'GENERATION_FAILED',
      message: 'Claude API returned an error',
      step: 'generating',
    };
    expect(() => BuilderJobErrorSchema.parse(error)).not.toThrow();
  });

  it('should accept error without step', () => {
    const error = { code: 'UNKNOWN', message: 'Something went wrong' };
    expect(() => BuilderJobErrorSchema.parse(error)).not.toThrow();
  });
});

describe('BuilderJobSchema', () => {
  it('should validate a complete job object', () => {
    const job = {
      id: 'job-123',
      prompt: 'Add a products endpoint',
      status: 'completed',
      options: { dryRun: false, includeModel: true, includeTests: true },
      result: {
        files: [{ path: 'src/test.ts', content: 'code', action: 'created' }],
        prUrl: 'https://github.com/formray/fenice/pull/1',
      },
      userId: 'user-456',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(() => BuilderJobSchema.parse(job)).not.toThrow();
  });

  it('should validate a queued job without result/error', () => {
    const job = {
      id: 'job-123',
      prompt: 'Add a products endpoint',
      status: 'queued',
      userId: 'user-456',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(() => BuilderJobSchema.parse(job)).not.toThrow();
  });

  it('should reject invalid status', () => {
    const job = {
      id: 'job-123',
      prompt: 'Add a products endpoint',
      status: 'invalid',
      userId: 'user-456',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    expect(() => BuilderJobSchema.parse(job)).toThrow();
  });
});

describe('BuilderJobQuerySchema', () => {
  it('should accept empty query (all jobs)', () => {
    const result = BuilderJobQuerySchema.parse({});
    expect(result.status).toBeUndefined();
  });

  it('should accept status filter', () => {
    const result = BuilderJobQuerySchema.parse({ status: 'completed' });
    expect(result.status).toBe('completed');
  });

  it('should reject invalid status filter', () => {
    expect(() => BuilderJobQuerySchema.parse({ status: 'invalid' })).toThrow();
  });
});

describe('BuilderPlanFileSchema', () => {
  it('should accept a valid plan file', () => {
    const file = {
      path: 'src/schemas/product.schema.ts',
      type: 'schema',
      action: 'create',
      description: 'Product schema with name, price, and category fields',
    };
    expect(() => BuilderPlanFileSchema.parse(file)).not.toThrow();
  });

  it('should reject invalid type (controller)', () => {
    const file = {
      path: 'src/controllers/product.controller.ts',
      type: 'controller',
      action: 'create',
      description: 'Product controller',
    };
    expect(() => BuilderPlanFileSchema.parse(file)).toThrow();
  });

  it('should reject invalid action (delete)', () => {
    const file = {
      path: 'src/schemas/product.schema.ts',
      type: 'schema',
      action: 'delete',
      description: 'Remove product schema',
    };
    expect(() => BuilderPlanFileSchema.parse(file)).toThrow();
  });
});

describe('BuilderPlanSchema', () => {
  it('should accept a valid plan', () => {
    const plan = {
      files: [
        {
          path: 'src/schemas/product.schema.ts',
          type: 'schema',
          action: 'create',
          description: 'Product schema with name, price, and category fields',
        },
        {
          path: 'src/models/product.model.ts',
          type: 'model',
          action: 'create',
          description: 'Mongoose model for products collection',
        },
      ],
      summary: 'Add product resource with schema, model, service, and routes',
    };
    expect(() => BuilderPlanSchema.parse(plan)).not.toThrow();
  });

  it('should reject empty files array', () => {
    const plan = {
      files: [],
      summary: 'Empty plan',
    };
    expect(() => BuilderPlanSchema.parse(plan)).toThrow();
  });

  it('should reject missing summary', () => {
    const plan = {
      files: [
        {
          path: 'src/schemas/product.schema.ts',
          type: 'schema',
          action: 'create',
          description: 'Product schema',
        },
      ],
    };
    expect(() => BuilderPlanSchema.parse(plan)).toThrow();
  });
});

describe('BuilderApproveSchema', () => {
  it('should accept a valid approve body', () => {
    const body = {
      plan: {
        files: [
          {
            path: 'src/schemas/product.schema.ts',
            type: 'schema',
            action: 'create',
            description: 'Product schema with name, price, and category fields',
          },
        ],
        summary: 'Add product resource',
      },
    };
    expect(() => BuilderApproveSchema.parse(body)).not.toThrow();
  });
});
