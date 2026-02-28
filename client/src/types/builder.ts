/**
 * Client-side builder types.
 * Mirrors backend Zod schemas in src/schemas/builder.schema.ts.
 */

export type BuilderJobStatus =
  | 'queued'
  | 'planning'
  | 'plan_ready'
  | 'reading_context'
  | 'generating'
  | 'writing_files'
  | 'validating'
  | 'creating_pr'
  | 'committing'
  | 'completed'
  | 'completed_draft'
  | 'rolled_back'
  | 'failed'
  | 'rejected';

export type IntegrationMode = 'pr' | 'direct';

export type TaskType =
  | 'new-resource'
  | 'refactor'
  | 'bugfix'
  | 'schema-migration'
  | 'test-gen'
  | 'doc-gen';

export interface BuilderGeneratedFile {
  path: string;
  content: string;
  action: 'created' | 'modified';
}

export interface DiffEntry {
  path: string;
  diff: string;
}

export interface PlanCoverage {
  planned: string[];
  generated: string[];
  missing: string[];
}

export interface BuilderJobResult {
  files: BuilderGeneratedFile[];
  prUrl?: string | undefined;
  prNumber?: number | undefined;
  branch?: string | undefined;
  commitHash?: string | undefined;
  integrationMode?: IntegrationMode | undefined;
  validationPassed?: boolean | undefined;
  validationErrors?: string[] | undefined;
  tokenUsage?: { inputTokens: number; outputTokens: number } | undefined;
  diffs?: DiffEntry[] | undefined;
  planCoverage?: PlanCoverage | undefined;
  impactedFiles?: string[] | undefined;
}

export interface BuilderJobError {
  code: string;
  message: string;
  step?: BuilderJobStatus | undefined;
}

export type BuilderPlanFileType = 'schema' | 'model' | 'service' | 'route' | 'test';

export interface BuilderPlanFile {
  path: string;
  type: BuilderPlanFileType;
  action: 'create' | 'modify';
  description: string;
}

export interface BuilderPlan {
  files: BuilderPlanFile[];
  summary: string;
  taskType?: TaskType | undefined;
}

export interface BuilderProgressPayload {
  jobId: string;
  status: BuilderJobStatus;
  message: string;
  detail?: string | undefined;
}

export interface BuilderJob {
  id: string;
  prompt: string;
  status: BuilderJobStatus;
  plan?: BuilderPlan | undefined;
  result?: BuilderJobResult | undefined;
  error?: BuilderJobError | undefined;
  userId: string;
  createdAt: string;
  updatedAt: string;
}
