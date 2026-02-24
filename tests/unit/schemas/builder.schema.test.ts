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
  TaskTypeEnum,
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

// ============================================================
// M5 Builder v2 — Batch 1: Schema & Model Foundation
// ============================================================

describe('TaskTypeEnum (Task 1)', () => {
  const validTypes = [
    'new-resource',
    'refactor',
    'bugfix',
    'schema-migration',
    'test-gen',
    'doc-gen',
  ];

  it('should accept all 6 valid task types', () => {
    for (const type of validTypes) {
      expect(() => TaskTypeEnum.parse(type)).not.toThrow();
    }
  });

  it('should reject invalid task type', () => {
    expect(() => TaskTypeEnum.parse('deploy')).toThrow();
    expect(() => TaskTypeEnum.parse('new_resource')).toThrow();
    expect(() => TaskTypeEnum.parse('')).toThrow();
  });
});

describe('BuilderOptionsSchema with taskType (Task 1)', () => {
  it('should accept valid taskType', () => {
    const result = BuilderOptionsSchema.parse({ taskType: 'new-resource' });
    expect(result.taskType).toBe('new-resource');
  });

  it('should accept options without taskType (optional)', () => {
    const result = BuilderOptionsSchema.parse({});
    expect(result.taskType).toBeUndefined();
  });

  it('should reject invalid taskType', () => {
    expect(() => BuilderOptionsSchema.parse({ taskType: 'invalid-type' })).toThrow();
  });

  it('should still reject unknown properties (strict)', () => {
    expect(() => BuilderOptionsSchema.parse({ taskType: 'bugfix', somethingElse: true })).toThrow();
  });

  it('should accept taskType alongside other options', () => {
    const result = BuilderOptionsSchema.parse({
      dryRun: true,
      taskType: 'refactor',
      includeTests: false,
    });
    expect(result.dryRun).toBe(true);
    expect(result.taskType).toBe('refactor');
    expect(result.includeTests).toBe(false);
  });
});

describe('BuilderPlanSchema with contextFiles and taskType (Task 2)', () => {
  const validPlan = {
    files: [
      {
        path: 'src/schemas/product.schema.ts',
        type: 'schema' as const,
        action: 'create' as const,
        description: 'Product schema',
      },
    ],
    summary: 'Add product resource',
  };

  it('should accept plan with contextFiles', () => {
    const plan = {
      ...validPlan,
      contextFiles: ['src/schemas/common.schema.ts', 'src/models/user.model.ts'],
    };
    const result = BuilderPlanSchema.parse(plan);
    expect(result.contextFiles).toEqual([
      'src/schemas/common.schema.ts',
      'src/models/user.model.ts',
    ]);
  });

  it('should accept plan with taskType', () => {
    const plan = {
      ...validPlan,
      taskType: 'new-resource',
    };
    const result = BuilderPlanSchema.parse(plan);
    expect(result.taskType).toBe('new-resource');
  });

  it('should accept plan with both contextFiles and taskType', () => {
    const plan = {
      ...validPlan,
      contextFiles: ['src/config/env.ts'],
      taskType: 'bugfix',
    };
    const result = BuilderPlanSchema.parse(plan);
    expect(result.contextFiles).toEqual(['src/config/env.ts']);
    expect(result.taskType).toBe('bugfix');
  });

  it('should accept plan without contextFiles and taskType (optional)', () => {
    const result = BuilderPlanSchema.parse(validPlan);
    expect(result.contextFiles).toBeUndefined();
    expect(result.taskType).toBeUndefined();
  });

  it('should reject contextFiles with empty strings', () => {
    const plan = {
      ...validPlan,
      contextFiles: [''],
    };
    expect(() => BuilderPlanSchema.parse(plan)).toThrow();
  });

  it('should reject invalid taskType in plan', () => {
    const plan = {
      ...validPlan,
      taskType: 'invalid',
    };
    expect(() => BuilderPlanSchema.parse(plan)).toThrow();
  });
});

describe('BuilderJobStatusEnum with completed_draft (Task 3)', () => {
  it('should accept completed_draft status', () => {
    expect(() => BuilderJobStatusEnum.parse('completed_draft')).not.toThrow();
  });

  it('should still accept all original statuses plus completed_draft', () => {
    const allStatuses = [
      'queued',
      'planning',
      'plan_ready',
      'reading_context',
      'generating',
      'writing_files',
      'validating',
      'creating_pr',
      'completed',
      'completed_draft',
      'failed',
      'rejected',
    ];
    for (const status of allStatuses) {
      expect(() => BuilderJobStatusEnum.parse(status)).not.toThrow();
    }
  });
});

describe('BuilderJobResultSchema enriched fields (Task 3)', () => {
  const baseResult = {
    files: [{ path: 'src/test.ts', content: 'code', action: 'created' as const }],
  };

  it('should accept validationErrors', () => {
    const result = BuilderJobResultSchema.parse({
      ...baseResult,
      validationErrors: ['TS2345: Argument of type...', 'ESLint: no-unused-vars'],
    });
    expect(result.validationErrors).toHaveLength(2);
  });

  it('should accept tokenUsage', () => {
    const result = BuilderJobResultSchema.parse({
      ...baseResult,
      tokenUsage: { input: 15000, output: 3500 },
    });
    expect(result.tokenUsage?.input).toBe(15000);
    expect(result.tokenUsage?.output).toBe(3500);
  });

  it('should accept diffs', () => {
    const result = BuilderJobResultSchema.parse({
      ...baseResult,
      diffs: [
        { path: 'src/schemas/product.schema.ts', diff: '+export const ProductSchema...' },
        { path: 'src/models/product.model.ts', diff: '+import mongoose...' },
      ],
    });
    expect(result.diffs).toHaveLength(2);
    expect(result.diffs?.[0]?.path).toBe('src/schemas/product.schema.ts');
  });

  it('should accept planCoverage', () => {
    const result = BuilderJobResultSchema.parse({
      ...baseResult,
      planCoverage: {
        planned: ['src/schemas/product.schema.ts', 'src/models/product.model.ts'],
        generated: ['src/schemas/product.schema.ts'],
        missing: ['src/models/product.model.ts'],
      },
    });
    expect(result.planCoverage?.planned).toHaveLength(2);
    expect(result.planCoverage?.missing).toEqual(['src/models/product.model.ts']);
  });

  it('should accept impactedFiles', () => {
    const result = BuilderJobResultSchema.parse({
      ...baseResult,
      impactedFiles: ['src/index.ts', 'src/routes/product.routes.ts'],
    });
    expect(result.impactedFiles).toHaveLength(2);
  });

  it('should accept all enriched fields together', () => {
    const result = BuilderJobResultSchema.parse({
      ...baseResult,
      prUrl: 'https://github.com/formray/fenice/pull/42',
      prNumber: 42,
      branch: 'builder/abc-products',
      validationPassed: false,
      validationErrors: ['TS2345: type mismatch'],
      tokenUsage: { input: 20000, output: 5000 },
      diffs: [{ path: 'src/test.ts', diff: '+code' }],
      planCoverage: {
        planned: ['src/test.ts'],
        generated: ['src/test.ts'],
        missing: [],
      },
      impactedFiles: ['src/index.ts'],
    });
    expect(result.validationErrors).toHaveLength(1);
    expect(result.tokenUsage?.input).toBe(20000);
    expect(result.diffs).toHaveLength(1);
    expect(result.planCoverage?.missing).toEqual([]);
    expect(result.impactedFiles).toHaveLength(1);
  });

  it('should accept result without any enriched fields (backward compatible)', () => {
    const result = BuilderJobResultSchema.parse(baseResult);
    expect(result.validationErrors).toBeUndefined();
    expect(result.tokenUsage).toBeUndefined();
    expect(result.diffs).toBeUndefined();
    expect(result.planCoverage).toBeUndefined();
    expect(result.impactedFiles).toBeUndefined();
  });
});
