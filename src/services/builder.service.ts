import { resolve } from 'node:path';
import { BuilderJobModel, type BuilderJobDocument } from '../models/builder-job.model.js';
import type { BuilderOptions, BuilderJobStatus, BuilderPlan } from '../schemas/builder.schema.js';
import type { PaginatedResponse } from '../schemas/common.schema.js';
import { NotFoundError, AppError } from '../utils/errors.js';
import { decodeCursor, encodeCursor } from '../utils/pagination.js';
import {
  buildContextBundle,
  buildDynamicContext,
  formatDynamicContext,
} from './builder/context-reader.js';
import { generateCode, repairCode, generatePlan } from './builder/code-generator.js';
import { buildFileIndex, formatFileIndex } from './builder/file-indexer.js';
import { validateGeneratedFiles } from './builder/scope-policy.js';
import { writeGeneratedFiles } from './builder/file-writer.js';
import {
  amendCommitWithFiles,
  detectGitHubRemote,
  detectGitHubToken,
  createWorktree,
  createDraftWorktree,
  commitInWorktree,
  commitToMain,
  pushFromWorktree,
  removeWorktree,
  revertCommit,
} from './builder/git-ops.js';
import { createPullRequest } from './builder/github-pr.js';
import { validateProject, formatValidationErrors } from './builder/validator.js';
import { computeDiffs, computePlanCoverage, findImpactedFiles } from './builder/dry-run.js';
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
    promise.then(resolve, reject).finally(() => {
      clearTimeout(timer);
    });
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

  async rollback(jobId: string): Promise<void> {
    const job = await BuilderJobModel.findById(jobId);
    if (!job) throw new NotFoundError('Builder job not found');
    if (job.status !== 'completed') {
      throw new AppError(
        400,
        'INVALID_STATE',
        `Job is in '${job.status}' state, expected 'completed'`
      );
    }

    const result = job.result as Record<string, unknown> | undefined;
    const commitHash = result?.['commitHash'] as string | undefined;
    if (!commitHash) {
      throw new AppError(
        400,
        'NOT_DIRECT_MODE',
        'Cannot rollback PR-mode jobs. Close the PR instead.'
      );
    }

    const projectRoot = this.getProjectRoot();
    await revertCommit(projectRoot, commitHash);
    await this.updateStatus(jobId, 'rolled_back');
    this.notifier?.emitProgress(jobId, 'rolled_back');
    logger.info({ jobId, commitHash }, 'Job rolled back');
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

  private async getGitHubConfig(): Promise<{ token: string; owner: string; repo: string }> {
    // Token: env var → gh CLI
    const token = await detectGitHubToken();
    if (!token) {
      throw new AppError(
        500,
        'CONFIG_ERROR',
        'GitHub token not found. Set GITHUB_TOKEN in .env or run `gh auth login`.'
      );
    }

    // Owner/repo: env vars → auto-detect from git remote
    const envOwner = process.env['GITHUB_OWNER'];
    const envRepo = process.env['GITHUB_REPO'];
    if (envOwner && envRepo) {
      return { token, owner: envOwner, repo: envRepo };
    }

    const remote = await detectGitHubRemote(this.getProjectRoot());
    if (remote) {
      logger.info(
        { owner: remote.owner, repo: remote.repo },
        'Auto-detected GitHub owner/repo from origin remote'
      );
      return { token, owner: remote.owner, repo: remote.repo };
    }

    throw new AppError(
      500,
      'CONFIG_ERROR',
      'Could not detect GitHub owner/repo. Set GITHUB_OWNER and GITHUB_REPO in .env, or ensure origin remote points to GitHub.'
    );
  }

  private async executePlanning(jobId: string, prompt: string): Promise<void> {
    try {
      await this.updateStatus(jobId, 'planning');
      this.notifier?.emitProgress(jobId, 'planning');

      const projectRoot = this.getProjectRoot();
      const context = await buildContextBundle(projectRoot);
      const apiKey = this.getApiKey();

      const fileIndex = await buildFileIndex(projectRoot);
      const formattedIndex = formatFileIndex(fileIndex);

      const { plan } = await withTimeout(
        generatePlan(prompt, context, apiKey, formattedIndex),
        PIPELINE_TIMEOUT_MS,
        'Planning'
      );

      // Auto-include src/index.ts when plan has ANY route file (create or modify).
      // Without this, new routes are dead code — they must be mounted in the Hono app.
      const hasRoute = plan.files.some((f) => f.type === 'route');
      const alreadyIncludesIndex = plan.files.some((f) => f.path === 'src/index.ts');
      if (hasRoute && !alreadyIncludesIndex) {
        plan.files.push({
          path: 'src/index.ts',
          type: 'config',
          action: 'modify',
          description: 'Mount new route in the Hono app via app.route()',
        });
        logger.info({ jobId }, 'Auto-added src/index.ts to plan (new route detected)');
      }

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
    const isDirectMode = options?.integrationMode === 'direct';
    let currentStep: BuilderJobStatus = 'reading_context';

    try {
      // Step 1: Read context (status already set to reading_context by approve())
      const projectRoot = this.getProjectRoot();
      const context = await buildContextBundle(projectRoot);

      // Always use dynamic context — it merges reference CRUD files + plan contextFiles + src/index.ts.
      // The old static fallback missed src/index.ts and didn't label reference files.
      const planContextFiles = plan.contextFiles ?? [];
      const dynamicBundle = await buildDynamicContext(projectRoot, planContextFiles);
      const preformattedContext = formatDynamicContext(dynamicBundle);
      logger.info(
        { jobId, contextFileCount: dynamicBundle.contextFiles.length },
        'Dynamic context built (reference files + plan contextFiles)'
      );

      // Step 2: Generate code via Claude API
      currentStep = 'generating';
      await this.updateStatus(jobId, currentStep);
      this.notifier?.emitProgress(jobId, currentStep);
      const apiKey = this.getApiKey();
      const totalTokens = { input: 0, output: 0 };
      const notifier = this.notifier;
      const onToolActivity = notifier
        ? (tool: string, path: string): void => {
            notifier.emitToolActivity(jobId, tool, path);
          }
        : undefined;
      const result = await withTimeout(
        generateCode(
          prompt,
          context,
          projectRoot,
          apiKey,
          onToolActivity,
          plan,
          preformattedContext
        ),
        PIPELINE_TIMEOUT_MS,
        'Code generation'
      );
      totalTokens.input += result.tokenUsage.inputTokens;
      totalTokens.output += result.tokenUsage.outputTokens;
      logger.info(
        { jobId, fileCount: result.files.length, violations: result.violations.length },
        'Code generation complete'
      );

      // Log tool-level scope violations (already handled — violated files were not written)
      if (result.violations.length > 0) {
        logger.warn(
          { jobId, violations: result.violations.map((v) => `${v.file}: ${v.reason}`) },
          'Tool-level scope violations detected (files excluded from result)'
        );
      }

      // Final scope policy check on all files
      // Pass plan-approved paths — the plan approval is the security gate.
      // If the user approved a plan that includes src/middleware/foo.ts, allow it.
      const planApprovedPaths = new Set(plan.files.map((f) => f.path));
      const policyViolations = validateGeneratedFiles(result.files, planApprovedPaths);
      if (policyViolations.length > 0) {
        throw new AppError(
          400,
          'SCOPE_VIOLATION',
          `Scope policy violations: ${policyViolations.map((v) => `${v.file}: ${v.reason}`).join('; ')}`
        );
      }

      if (isDryRun) {
        const diffs = await computeDiffs(projectRoot, result.files);
        const planCoverage = computePlanCoverage(plan.files, result.files);
        const impactedFiles = await findImpactedFiles(projectRoot, result.files);

        await this.updateStatus(jobId, 'completed', {
          result: {
            files: result.files,
            validationPassed: true,
            tokenUsage: { inputTokens: totalTokens.input, outputTokens: totalTokens.output },
            diffs,
            planCoverage,
            impactedFiles: impactedFiles.length > 0 ? impactedFiles : undefined,
          },
        });
        this.notifier?.emitSyntheticDeltas(jobId, result.files);
        this.notifier?.emitProgress(jobId, 'completed');
        logger.info(
          { jobId, diffs: diffs.length, missing: planCoverage.missing.length },
          'Dry run completed with enrichment'
        );
        return;
      }

      // Guard: if generation produced 0 files, fail early instead of empty commit
      if (result.files.length === 0) {
        await this.updateStatus(jobId, 'failed', {
          error: 'Generation produced 0 files — Claude could not generate any valid code.',
        });
        this.notifier?.emitProgress(jobId, 'failed');
        logger.error({ jobId }, 'Generation produced 0 files');
        return;
      }

      // Step 3: Create worktree + write files
      // Uses a git worktree so all file/git ops happen in an isolated directory.
      // This prevents tsx watch from restarting when the builder modifies files.
      currentStep = 'writing_files';
      await this.updateStatus(jobId, currentStep);
      this.notifier?.emitProgress(jobId, currentStep);
      const worktree = await createWorktree(projectRoot, jobId, prompt);
      const wtPath = worktree.worktreePath;
      const branch = worktree.branch;

      try {
        const writtenPaths = await writeGeneratedFiles(wtPath, result.files);
        await commitInWorktree(wtPath, jobId, prompt, writtenPaths);
        logger.info(
          { jobId, branch, fileCount: writtenPaths.length },
          'Files written and committed in worktree'
        );

        // Step 4: Validate (lint + typecheck + test) in the worktree
        currentStep = 'validating';
        await this.updateStatus(jobId, currentStep);
        this.notifier?.emitProgress(jobId, currentStep);
        let currentFiles = result.files;
        const generatedPaths = currentFiles.map((f) => f.path);
        let validation = await validateProject(wtPath, generatedPaths);

        // Level 1: Repair (1 attempt — second repair never converges, just burns tokens)
        const MAX_REPAIR_ATTEMPTS = 1;
        for (let attempt = 1; attempt <= MAX_REPAIR_ATTEMPTS && !validation.passed; attempt++) {
          logger.warn({ jobId, attempt }, 'Validation failed, attempting repair');
          const errorSummary = formatValidationErrors(validation);
          const repairResult = await withTimeout(
            repairCode(currentFiles, errorSummary, wtPath, apiKey, planApprovedPaths),
            PIPELINE_TIMEOUT_MS,
            'Repair'
          );

          if (repairResult.violations.length > 0) {
            logger.error(
              { jobId, violations: repairResult.violations },
              'Repair had scope violations'
            );
            break;
          }

          await writeGeneratedFiles(wtPath, repairResult.files);
          const repairedPaths = repairResult.files.map((f) => f.path);
          await amendCommitWithFiles(wtPath, repairedPaths);

          // Merge repair files into originals instead of replacing
          const repairedMap = new Map(repairResult.files.map((f) => [f.path, f]));
          currentFiles = currentFiles.map((f) => repairedMap.get(f.path) ?? f);
          for (const f of repairResult.files) {
            if (!currentFiles.some((cf) => cf.path === f.path)) {
              currentFiles.push(f);
            }
          }
          totalTokens.input += repairResult.tokenUsage.inputTokens;
          totalTokens.output += repairResult.tokenUsage.outputTokens;

          validation = await validateProject(
            wtPath,
            currentFiles.map((f) => f.path)
          );
          if (validation.passed) {
            logger.info({ jobId, attempt }, 'Repair succeeded');
          }
        }

        if (!validation.passed) {
          // Level 2: Draft PR (still useful code, needs manual fixes)
          logger.warn({ jobId }, 'Repair exhausted, creating draft PR');

          // Remove the builder worktree and create a draft one
          await removeWorktree(projectRoot, wtPath, branch);
          const draftWt = await createDraftWorktree(projectRoot, jobId, prompt);

          try {
            const draftPaths = await writeGeneratedFiles(draftWt.worktreePath, currentFiles);
            await commitInWorktree(draftWt.worktreePath, jobId, prompt, draftPaths, true);
            const github = await this.getGitHubConfig();
            await pushFromWorktree(draftWt.worktreePath, draftWt.branch);

            const pr = await createPullRequest(
              draftWt.branch,
              prompt,
              currentFiles,
              jobId,
              false,
              github.token,
              github.owner,
              github.repo
            );

            await this.updateStatus(jobId, 'completed_draft', {
              result: {
                files: currentFiles,
                prUrl: pr.prUrl,
                prNumber: pr.prNumber,
                branch: draftWt.branch,
                validationPassed: false,
                validationErrors: validation.errors
                  .filter((e) => !e.passed)
                  .map((e) => `${e.step}: ${e.output.slice(0, 500)}`),
                tokenUsage: { inputTokens: totalTokens.input, outputTokens: totalTokens.output },
              },
            });
            this.notifier?.emitSyntheticDeltas(jobId, currentFiles);
            this.notifier?.emitProgress(jobId, 'completed_draft');
          } finally {
            await removeWorktree(projectRoot, draftWt.worktreePath, draftWt.branch);
          }
          return;
        }

        if (isDirectMode) {
          // Direct mode: write files to projectRoot and commit on main
          currentStep = 'committing';
          await this.updateStatus(jobId, currentStep);
          this.notifier?.emitProgress(jobId, currentStep);

          // Write files to the real project root (triggers tsx watch reload)
          await writeGeneratedFiles(projectRoot, currentFiles);
          const commitHash = await commitToMain(
            projectRoot,
            jobId,
            prompt,
            currentFiles.map((f) => f.path)
          );
          logger.info({ jobId, commitHash }, 'Direct mode: committed to main');

          await this.updateStatus(jobId, 'completed', {
            result: {
              files: currentFiles,
              commitHash,
              validationPassed: true,
              tokenUsage: { inputTokens: totalTokens.input, outputTokens: totalTokens.output },
            },
          });

          this.notifier?.emitSyntheticDeltas(jobId, currentFiles);
          this.notifier?.emitProgress(jobId, 'completed');
        } else {
          // PR mode (existing behavior)
          currentStep = 'creating_pr';
          await this.updateStatus(jobId, currentStep);
          this.notifier?.emitProgress(jobId, currentStep);
          const github = await this.getGitHubConfig();
          await pushFromWorktree(wtPath, branch);
          const pr = await createPullRequest(
            branch,
            prompt,
            currentFiles,
            jobId,
            true,
            github.token,
            github.owner,
            github.repo
          );
          logger.info({ jobId, prUrl: pr.prUrl, prNumber: pr.prNumber }, 'PR created');

          await this.updateStatus(jobId, 'completed', {
            result: {
              files: currentFiles,
              prUrl: pr.prUrl,
              prNumber: pr.prNumber,
              branch,
              validationPassed: true,
              tokenUsage: { inputTokens: totalTokens.input, outputTokens: totalTokens.output },
            },
          });

          this.notifier?.emitSyntheticDeltas(jobId, currentFiles);
          this.notifier?.emitProgress(jobId, 'completed');
        }
      } finally {
        // Always clean up the worktree — main checkout is never touched
        await removeWorktree(projectRoot, wtPath, branch);
      }
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
