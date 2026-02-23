import { resolve } from 'node:path';
import { BuilderJobModel, type BuilderJobDocument } from '../models/builder-job.model.js';
import type { BuilderOptions, BuilderJobStatus, BuilderPlan } from '../schemas/builder.schema.js';
import type { PaginatedResponse } from '../schemas/common.schema.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import { decodeCursor, encodeCursor } from '../utils/pagination.js';
import { buildContextBundle } from './builder/context-reader.js';
import { generateCode, repairCode, generatePlan } from './builder/code-generator.js';
import { validateGeneratedFiles } from './builder/scope-policy.js';
import { writeGeneratedFiles } from './builder/file-writer.js';
import { createBranchAndCommit, pushBranch, cleanupBranch } from './builder/git-ops.js';
import { createPullRequest } from './builder/github-pr.js';
import { validateProject, formatValidationErrors } from './builder/validator.js';
import { BuilderWorldNotifier } from './builder/world-notifier.js';
import type { WorldWsManager } from '../ws/world-manager.js';
import { createLogger } from '../utils/logger.js';

const logger = createLogger('fenice', process.env['LOG_LEVEL'] ?? 'info');

const PIPELINE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes

function withTimeout<T>(promise: Promise<T>, ms: number, label: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new AppError(408, 'TIMEOUT', `${label} timed out after ${ms / 1000}s`));
    }, ms);
    promise.then(resolve, reject).finally(() => { clearTimeout(timer); });
  });
}

export class BuilderService {
  private readonly notifier: BuilderWorldNotifier | null;

  constructor(worldWsManager?: WorldWsManager) {
    this.notifier = worldWsManager ? new BuilderWorldNotifier(worldWsManager) : null;
  }

  async generate(
    prompt: string,
    userId: string,
    options?: BuilderOptions
  ): Promise<BuilderJobDocument> {
    const job = await BuilderJobModel.create({
      prompt,
      userId,
      status: 'queued',
      options: options ?? { dryRun: false, includeModel: true, includeTests: true },
    });

    void this.executePlanning(job._id.toString(), prompt);

    return job;
  }

  async getJob(jobId: string): Promise<BuilderJobDocument> {
    const job = await BuilderJobModel.findById(jobId);
    if (!job) throw new NotFoundError('Builder job not found');
    return job;
  }

  async listJobs(
    filter: Record<string, unknown>,
    options: {
      cursor?: string | undefined;
      limit?: number | undefined;
      sort?: string | undefined;
      order?: 'asc' | 'desc' | undefined;
    }
  ): Promise<PaginatedResponse<BuilderJobDocument>> {
    const { cursor, limit = 20, sort = 'createdAt', order = 'desc' } = options;
    const cursorData = decodeCursor(cursor);

    const query: Record<string, unknown> = { ...filter };

    if (cursorData) {
      const direction = order === 'desc' ? '$lt' : '$gt';
      query['$or'] = [
        { [sort]: { [direction]: cursorData.sortValue } },
        { [sort]: cursorData.sortValue, _id: { [direction]: cursorData.id } },
      ];
    }

    const sortObj: Record<string, 1 | -1> = {
      [sort]: order === 'desc' ? -1 : 1,
      _id: order === 'desc' ? -1 : 1,
    };

    const jobs = await BuilderJobModel.find(query)
      .sort(sortObj)
      .limit(limit + 1);

    const hasNext = jobs.length > limit;
    if (hasNext) jobs.pop();

    const lastJob = jobs[jobs.length - 1];
    const nextCursor =
      hasNext && lastJob
        ? encodeCursor({
            id: lastJob._id.toString(),
            sortValue: String(lastJob.get(sort)),
          })
        : null;

    return {
      data: jobs,
      pagination: { hasNext, nextCursor },
    };
  }

  async approve(jobId: string, plan: BuilderPlan): Promise<void> {
    const job = await BuilderJobModel.findById(jobId);
    if (!job) throw new NotFoundError('Builder job not found');
    if (job.status !== 'plan_ready') {
      throw new AppError(
        400,
        'INVALID_STATE',
        `Job is in '${job.status}' state, expected 'plan_ready'`
      );
    }

    await BuilderJobModel.findByIdAndUpdate(jobId, { plan, status: 'reading_context' });
    this.notifier?.emitProgress(jobId, 'reading_context');

    void this.executeGeneration(jobId, job.prompt, plan, job.options);
  }

  async reject(jobId: string): Promise<void> {
    const job = await BuilderJobModel.findById(jobId);
    if (!job) throw new NotFoundError('Builder job not found');
    if (job.status !== 'plan_ready') {
      throw new AppError(
        400,
        'INVALID_STATE',
        `Job is in '${job.status}' state, expected 'plan_ready'`
      );
    }

    await this.updateStatus(jobId, 'rejected');
    this.notifier?.emitProgress(jobId, 'rejected');
  }

  private async updateStatus(
    jobId: string,
    status: BuilderJobStatus,
    extra?: Record<string, unknown>
  ): Promise<void> {
    await BuilderJobModel.findByIdAndUpdate(jobId, { status, ...extra });
  }

  private getProjectRoot(): string {
    return resolve(process.cwd());
  }

  private getApiKey(): string {
    const key = process.env['ANTHROPIC_API_KEY'];
    if (!key) {
      throw new AppError(500, 'CONFIG_ERROR', 'ANTHROPIC_API_KEY is not configured');
    }
    return key;
  }

  private getGitHubConfig(): { token: string; owner: string; repo: string } {
    const token = process.env['GITHUB_TOKEN'];
    const owner = process.env['GITHUB_OWNER'];
    const repo = process.env['GITHUB_REPO'];
    if (!token || !owner || !repo) {
      throw new AppError(
        500,
        'CONFIG_ERROR',
        'GITHUB_TOKEN, GITHUB_OWNER, and GITHUB_REPO must be configured'
      );
    }
    return { token, owner, repo };
  }

  private async executePlanning(jobId: string, prompt: string): Promise<void> {
    try {
      await this.updateStatus(jobId, 'planning');
      this.notifier?.emitProgress(jobId, 'planning');

      const projectRoot = this.getProjectRoot();
      const context = await buildContextBundle(projectRoot);
      const apiKey = this.getApiKey();

      const { plan } = await withTimeout(
        generatePlan(prompt, context, apiKey),
        PIPELINE_TIMEOUT_MS,
        'Planning'
      );
      logger.info({ jobId, fileCount: plan.files.length }, 'Plan generated');

      await BuilderJobModel.findByIdAndUpdate(jobId, { plan, status: 'plan_ready' });
      this.notifier?.emitProgress(jobId, 'plan_ready');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const code = err instanceof AppError ? err.code : 'PLANNING_ERROR';
      logger.error({ jobId, error: message }, 'Planning failed');
      await this.updateStatus(jobId, 'failed', {
        error: { code, message, step: 'planning' as BuilderJobStatus },
      });
      this.notifier?.emitProgress(jobId, 'failed');
    }
  }

  private async executeGeneration(
    jobId: string,
    prompt: string,
    plan: BuilderPlan,
    options?: BuilderOptions
  ): Promise<void> {
    const isDryRun = options?.dryRun === true;
    let currentStep: BuilderJobStatus = 'reading_context';

    try {
      // Step 1: Read context (status already set to reading_context by approve())
      const projectRoot = this.getProjectRoot();
      const context = await buildContextBundle(projectRoot);
      logger.info({ jobId }, 'Context bundle built');

      // Step 2: Generate code via Claude API
      currentStep = 'generating';
      await this.updateStatus(jobId, currentStep);
      this.notifier?.emitProgress(jobId, currentStep);
      const apiKey = this.getApiKey();
      const notifier = this.notifier;
      const onToolActivity = notifier
        ? (tool: string, path: string): void => {
            notifier.emitToolActivity(jobId, tool, path);
          }
        : undefined;
      const result = await withTimeout(
        generateCode(prompt, context, projectRoot, apiKey, onToolActivity, plan),
        PIPELINE_TIMEOUT_MS,
        'Code generation'
      );
      logger.info(
        { jobId, fileCount: result.files.length, violations: result.violations.length },
        'Code generation complete'
      );

      // Check scope policy violations from generation
      if (result.violations.length > 0) {
        throw new AppError(
          400,
          'SCOPE_VIOLATION',
          `Scope policy violations: ${result.violations.map((v) => `${v.file}: ${v.reason}`).join('; ')}`
        );
      }

      // Final scope policy check on all files
      const policyViolations = validateGeneratedFiles(result.files);
      if (policyViolations.length > 0) {
        throw new AppError(
          400,
          'SCOPE_VIOLATION',
          `Scope policy violations: ${policyViolations.map((v) => `${v.file}: ${v.reason}`).join('; ')}`
        );
      }

      if (isDryRun) {
        // Dry run: store generated files but don't write to disk or create PR
        await this.updateStatus(jobId, 'completed', {
          result: {
            files: result.files,
            validationPassed: true,
          },
        });
        // Emit synthetic deltas so the 3D world previews new buildings
        this.notifier?.emitSyntheticDeltas(jobId, result.files);
        this.notifier?.emitProgress(jobId, 'completed');
        logger.info({ jobId }, 'Dry run completed');
        return;
      }

      // Step 3: Write files to disk + create git branch
      currentStep = 'writing_files';
      await this.updateStatus(jobId, currentStep);
      this.notifier?.emitProgress(jobId, currentStep);
      const writtenPaths = await writeGeneratedFiles(projectRoot, result.files);
      const { branch } = await createBranchAndCommit(projectRoot, jobId, prompt, writtenPaths);
      logger.info({ jobId, branch, fileCount: writtenPaths.length }, 'Files written and committed');

      // Step 4: Validate (lint + typecheck + test)
      currentStep = 'validating';
      await this.updateStatus(jobId, currentStep);
      this.notifier?.emitProgress(jobId, currentStep);
      let currentFiles = result.files;
      let validation = await validateProject(projectRoot);

      if (!validation.passed) {
        // Self-repair: one retry
        logger.warn({ jobId }, 'Validation failed, attempting self-repair');
        const errorSummary = formatValidationErrors(validation);
        const repairResult = await repairCode(currentFiles, errorSummary, projectRoot, apiKey);

        if (repairResult.violations.length > 0) {
          throw new AppError(
            400,
            'REPAIR_SCOPE_VIOLATION',
            `Repair scope violations: ${repairResult.violations.map((v) => `${v.file}: ${v.reason}`).join('; ')}`
          );
        }

        // Rewrite repaired files
        await writeGeneratedFiles(projectRoot, repairResult.files);
        currentFiles = repairResult.files;

        // Re-validate after repair
        validation = await validateProject(projectRoot);
        if (!validation.passed) {
          const finalErrors = formatValidationErrors(validation);
          throw new AppError(
            400,
            'VALIDATION_FAILED',
            `Validation failed after self-repair: ${finalErrors}`
          );
        }
        logger.info({ jobId }, 'Self-repair succeeded');
      }

      const validationPassed = validation.passed;

      // Step 5: Push branch and create PR
      currentStep = 'creating_pr';
      await this.updateStatus(jobId, currentStep);
      this.notifier?.emitProgress(jobId, currentStep);
      const github = this.getGitHubConfig();
      await pushBranch(projectRoot, branch);
      const pr = await createPullRequest(
        branch,
        prompt,
        currentFiles,
        jobId,
        validationPassed,
        github.token,
        github.owner,
        github.repo
      );
      logger.info({ jobId, prUrl: pr.prUrl, prNumber: pr.prNumber }, 'PR created');

      // Switch back to main after PR creation
      await cleanupBranch(projectRoot, branch);

      await this.updateStatus(jobId, 'completed', {
        result: {
          files: currentFiles,
          prUrl: pr.prUrl,
          prNumber: pr.prNumber,
          branch,
          validationPassed,
        },
      });

      // Emit synthetic deltas so the 3D world shows new buildings immediately
      this.notifier?.emitSyntheticDeltas(jobId, currentFiles);
      this.notifier?.emitProgress(jobId, 'completed');
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      const code = err instanceof AppError ? err.code : 'PIPELINE_ERROR';
      logger.error({ jobId, step: currentStep, error: message }, 'Pipeline failed');
      await this.updateStatus(jobId, 'failed', {
        error: { code, message, step: currentStep },
      });
      this.notifier?.emitProgress(jobId, 'failed');
    }
  }
}
