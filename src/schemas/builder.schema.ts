import { z } from 'zod';

export const BuilderJobStatusEnum = z.enum([
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
]);

export const TaskTypeEnum = z.enum([
  'new-resource',
  'refactor',
  'bugfix',
  'schema-migration',
  'test-gen',
  'doc-gen',
]);

export const BuilderOptionsSchema = z
  .object({
    dryRun: z.boolean().default(false),
    targetTag: z.string().min(1).max(50).optional(),
    includeModel: z.boolean().default(true),
    includeTests: z.boolean().default(true),
    taskType: TaskTypeEnum.optional(),
  })
  .strict();

export const BuilderPromptSchema = z.object({
  prompt: z.string().min(10).max(2000),
  options: BuilderOptionsSchema.optional(),
});

export const BuilderGeneratedFileSchema = z.object({
  path: z.string().min(1),
  content: z.string(),
  action: z.enum(['created', 'modified']),
});

export const BuilderJobResultSchema = z.object({
  files: z.array(BuilderGeneratedFileSchema),
  prUrl: z.string().optional(),
  prNumber: z.number().int().positive().optional(),
  branch: z.string().optional(),
  validationPassed: z.boolean().optional(),
  validationErrors: z.array(z.string()).optional(),
  tokenUsage: z
    .object({
      inputTokens: z.number().int().nonnegative(),
      outputTokens: z.number().int().nonnegative(),
    })
    .optional(),
  diffs: z
    .array(
      z.object({
        path: z.string(),
        diff: z.string(),
      })
    )
    .optional(),
  planCoverage: z
    .object({
      planned: z.array(z.string()),
      generated: z.array(z.string()),
      missing: z.array(z.string()),
    })
    .optional(),
  impactedFiles: z.array(z.string()).optional(),
});

export const BuilderJobErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  step: BuilderJobStatusEnum.optional(),
});

export const BuilderPlanFileTypeEnum = z.enum([
  'schema',
  'model',
  'service',
  'route',
  'test',
  'config',
  'middleware',
]);

export const BuilderPlanFileSchema = z.object({
  path: z.string().min(1),
  type: BuilderPlanFileTypeEnum,
  action: z.enum(['create', 'modify']),
  description: z.string().min(1).max(500),
});

export const BuilderPlanSchema = z.object({
  files: z.array(BuilderPlanFileSchema).min(1),
  summary: z.string().min(1).max(1000),
  taskType: TaskTypeEnum.optional(),
  contextFiles: z.array(z.string().min(1)).optional(),
});

export const BuilderApproveSchema = z.object({
  plan: BuilderPlanSchema,
});

export const BuilderJobSchema = z.object({
  id: z.string(),
  prompt: z.string(),
  status: BuilderJobStatusEnum,
  options: BuilderOptionsSchema.optional(),
  plan: BuilderPlanSchema.optional(),
  result: BuilderJobResultSchema.optional(),
  error: BuilderJobErrorSchema.optional(),
  userId: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const BuilderJobQuerySchema = z.object({
  status: BuilderJobStatusEnum.optional(),
});

export type BuilderJobStatus = z.infer<typeof BuilderJobStatusEnum>;
export type BuilderOptions = z.infer<typeof BuilderOptionsSchema>;
export type BuilderPrompt = z.infer<typeof BuilderPromptSchema>;
export type BuilderGeneratedFile = z.infer<typeof BuilderGeneratedFileSchema>;
export type BuilderJobResult = z.infer<typeof BuilderJobResultSchema>;
export type BuilderJobError = z.infer<typeof BuilderJobErrorSchema>;
export type BuilderJob = z.infer<typeof BuilderJobSchema>;
export type BuilderJobQuery = z.infer<typeof BuilderJobQuerySchema>;
export type BuilderPlanFileType = z.infer<typeof BuilderPlanFileTypeEnum>;
export type BuilderPlanFile = z.infer<typeof BuilderPlanFileSchema>;
export type BuilderPlan = z.infer<typeof BuilderPlanSchema>;
export type BuilderApprove = z.infer<typeof BuilderApproveSchema>;
export type TaskType = z.infer<typeof TaskTypeEnum>;
