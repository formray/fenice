import Anthropic from '@anthropic-ai/sdk';
import { writeFile, mkdir, unlink, symlink, rm } from 'node:fs/promises';
import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import type { BuilderGeneratedFile, BuilderPlan } from '../../schemas/builder.schema.js';
import { BuilderPlanSchema } from '../../schemas/builder.schema.js';
import {
  BUILDER_SYSTEM_PROMPT,
  BUILDER_PLAN_PROMPT,
  BUILDER_TOOLS,
  buildPlanConstraint,
  buildPlanPrompt,
  buildSystemPrompt,
} from './prompt-templates.js';
import {
  formatContextForPrompt,
  formatContextForGeneration,
  type ContextBundle,
} from './context-reader.js';
import {
  validateFilePath,
  validateReadPath,
  scanContentForDangerousPatterns,
  checkCodePatterns,
  type ScopePolicyViolation,
} from './scope-policy.js';
import { AppError } from '../../utils/errors.js';
import { createLogger } from '../../utils/logger.js';

const logger = createLogger('fenice', process.env['LOG_LEVEL'] ?? 'info');

const MAX_TURNS = 15;
const MAX_VALIDATION_ROUNDS = 2;

export type ToolActivityCallback = (tool: string, path: string) => void;

export interface GenerationResult {
  files: BuilderGeneratedFile[];
  violations: ScopePolicyViolation[];
  tokenUsage: { inputTokens: number; outputTokens: number };
  /** Whether the in-loop validation passed (undefined if no validator was provided) */
  validationPassed?: boolean | undefined;
}

export interface PlanResult {
  plan: BuilderPlan;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

/**
 * Callback that writes files to disk, runs tsc + eslint, and returns errors.
 * Returns null if validation passed, or a string with errors if it failed.
 */
type ValidateCallback = (
  files: BuilderGeneratedFile[]
) => Promise<{ passed: boolean; errors: string }>;

interface ToolLoopConfig {
  client: Anthropic;
  systemPrompt: string;
  userMessage: string;
  projectRoot: string;
  onToolActivity?: ToolActivityCallback | undefined;
  allowedPlanPaths?: Set<string> | undefined;
  /** If provided, runs validation when Claude finishes and feeds errors back */
  onValidate?: ValidateCallback | undefined;
}

/**
 * Returns the latest version of each file (last write wins).
 */
function deduplicateFiles(files: BuilderGeneratedFile[]): BuilderGeneratedFile[] {
  const map = new Map<string, BuilderGeneratedFile>();
  for (const file of files) {
    map.set(file.path, file);
  }
  return [...map.values()];
}

async function runToolLoop(config: ToolLoopConfig): Promise<GenerationResult> {
  const {
    client,
    systemPrompt,
    userMessage,
    projectRoot,
    onToolActivity,
    allowedPlanPaths,
    onValidate,
  } = config;

  const files: BuilderGeneratedFile[] = [];
  const violations: ScopePolicyViolation[] = [];
  const createdPaths = new Set<string>();
  const warnedPaths = new Set<string>();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let validationRounds = 0;
  let validationPassed: boolean | undefined;

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: userMessage }];

  // Cache the system prompt — it's identical across all tool-use rounds.
  // After the first round, cached tokens cost 1/10th the normal rate.
  const cachedSystem: Anthropic.MessageCreateParams['system'] = [
    { type: 'text', text: systemPrompt, cache_control: { type: 'ephemeral' } },
  ];

  const toolDefs = BUILDER_TOOLS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.input_schema as Anthropic.Tool['input_schema'],
  }));

  for (let turn = 0; turn < MAX_TURNS; turn++) {
    let response: Anthropic.Message;
    try {
      response = await client.messages.create({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 8192,
        system: cachedSystem,
        tools: toolDefs,
        messages,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Unknown Anthropic API error';
      logger.error({ error: message, turn }, 'Anthropic API call failed');
      throw new AppError(502, 'LLM_API_ERROR', `Claude API error: ${message}`);
    }

    totalInputTokens += response.usage.input_tokens;
    totalOutputTokens += response.usage.output_tokens;

    // Log cache performance for cost tracking
    const usageRecord = response.usage as unknown as Record<string, number>;
    const cacheRead = usageRecord['cache_read_input_tokens'] ?? 0;
    const cacheCreation = usageRecord['cache_creation_input_tokens'] ?? 0;
    if (cacheRead > 0 || cacheCreation > 0) {
      logger.info(
        { turn, cacheRead, cacheCreation, input: response.usage.input_tokens },
        'Prompt cache stats'
      );
    }

    if (response.stop_reason === 'end_turn') {
      // Compiler-in-the-loop: validate before exiting
      if (onValidate && files.length > 0 && validationRounds < MAX_VALIDATION_ROUNDS) {
        const dedupedFiles = deduplicateFiles(files);
        const result = await onValidate(dedupedFiles);
        validationRounds++;

        if (!result.passed) {
          logger.warn(
            { round: validationRounds, turn },
            'In-loop validation failed, feeding errors back to Claude'
          );

          // Inject assistant end_turn + validation errors as user message
          messages.push({ role: 'assistant', content: response.content });
          messages.push({
            role: 'user',
            content: `Your generated code was written to disk and validated. Validation FAILED.\n\n${result.errors}\n\nFix ALL errors by rewriting the affected files with the write_file or modify_file tools. Do not explain — just fix the code.`,
          });
          // Continue the loop — Claude will fix the errors
          continue;
        }

        logger.info({ round: validationRounds, turn }, 'In-loop validation passed');
        validationPassed = true;
      }
      break;
    }

    if (response.stop_reason === 'tool_use') {
      const toolResults: Anthropic.ToolResultBlockParam[] = [];

      for (const block of response.content) {
        if (block.type !== 'tool_use') continue;

        const input = block.input as Record<string, string>;
        const toolName = block.name;

        logger.info({ tool: toolName, path: input['path'] }, 'Builder tool call');
        onToolActivity?.(toolName, input['path'] ?? '');

        if (toolName === 'write_file') {
          const path = input['path'] ?? '';
          const rawContent = input['content'] ?? '';
          const content = rawContent.endsWith('\n') ? rawContent : rawContent + '\n';

          if (allowedPlanPaths && !allowedPlanPaths.has(path)) {
            violations.push({ file: path, reason: 'Path not in approved plan' });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `ERROR: Path not in approved plan: ${path}`,
              is_error: true,
            });
            continue;
          }

          const pathError = validateFilePath(path, 'created', allowedPlanPaths);
          if (pathError) {
            violations.push({ file: path, reason: pathError });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `ERROR: ${pathError}`,
              is_error: true,
            });
            continue;
          }

          const contentViolations = scanContentForDangerousPatterns(content);
          if (contentViolations.length > 0) {
            for (const reason of contentViolations) {
              violations.push({ file: path, reason });
            }
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `ERROR: Content policy violation: ${contentViolations.join('; ')}`,
              is_error: true,
            });
            continue;
          }

          files.push({ path, content, action: 'created' });
          createdPaths.add(path);

          // Show pattern hints only on first write per file — avoids correction loops
          let warning = '';
          if (!warnedPaths.has(path)) {
            const codeIssues = checkCodePatterns(path, content);
            if (codeIssues.length > 0) {
              warning = `\nNote: ${codeIssues.map((i) => `- ${i}`).join('\n')}`;
              warnedPaths.add(path);
            }
          }
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `File created: ${path}${warning}`,
          });
        } else if (toolName === 'modify_file') {
          const path = input['path'] ?? '';
          const rawContent = input['content'] ?? '';
          const content = rawContent.endsWith('\n') ? rawContent : rawContent + '\n';

          if (allowedPlanPaths && !allowedPlanPaths.has(path)) {
            violations.push({ file: path, reason: 'Path not in approved plan' });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `ERROR: Path not in approved plan: ${path}`,
              is_error: true,
            });
            continue;
          }

          // Allow modify on files created in this same generation session
          const effectiveAction = createdPaths.has(path) ? 'created' : 'modified';
          const pathError = validateFilePath(path, effectiveAction, allowedPlanPaths);
          if (pathError) {
            violations.push({ file: path, reason: pathError });
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `ERROR: ${pathError}`,
              is_error: true,
            });
            continue;
          }

          const contentViolations = scanContentForDangerousPatterns(content);
          if (contentViolations.length > 0) {
            for (const reason of contentViolations) {
              violations.push({ file: path, reason });
            }
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `ERROR: Content policy violation: ${contentViolations.join('; ')}`,
              is_error: true,
            });
            continue;
          }

          files.push({ path, content, action: 'modified' });

          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `File modified: ${path}`,
          });
        } else if (toolName === 'read_file') {
          const path = input['path'] ?? '';
          const readError = validateReadPath(path);
          if (readError) {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `ERROR: ${readError}`,
              is_error: true,
            });
            continue;
          }
          try {
            const fullPath = join(projectRoot, path);
            const content = await readFile(fullPath, 'utf-8');
            const trimmed =
              content.length > 10_000 ? content.slice(0, 10_000) + '\n... [truncated]' : content;
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: trimmed,
            });
          } catch {
            toolResults.push({
              type: 'tool_result',
              tool_use_id: block.id,
              content: `ERROR: File not found: ${path}`,
              is_error: true,
            });
          }
        } else {
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `ERROR: Unknown tool: ${toolName}`,
            is_error: true,
          });
        }
      }

      messages.push({ role: 'assistant', content: response.content });
      messages.push({ role: 'user', content: toolResults });
    }
  }

  if (files.length === 0 && violations.length === 0) {
    logger.warn('Tool loop completed without producing any files');
  }

  // If validator was provided but never ran (e.g., 0 files), mark as undefined
  if (validationPassed === undefined && validationRounds > 0) {
    validationPassed = false;
  }

  return {
    files: deduplicateFiles(files),
    violations,
    tokenUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
    validationPassed,
  };
}

// ---------------------------------------------------------------------------
// In-loop validation: writes files to disk, runs tsc + eslint, returns errors
// ---------------------------------------------------------------------------

async function writeFilesToDisk(
  projectRoot: string,
  files: BuilderGeneratedFile[]
): Promise<string[]> {
  const paths: string[] = [];
  for (const file of files) {
    const fullPath = join(projectRoot, file.path);
    await mkdir(dirname(fullPath), { recursive: true });
    await writeFile(fullPath, file.content, 'utf-8');
    paths.push(file.path);
  }
  return paths;
}

async function cleanupFiles(projectRoot: string, paths: string[]): Promise<void> {
  for (const p of paths) {
    try {
      await unlink(join(projectRoot, p));
    } catch {
      // Ignore — file may not exist
    }
  }
}

async function runValidationSteps(
  projectRoot: string,
  generatedPaths: Set<string>
): Promise<{ passed: boolean; errors: string }> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';
  const timeout = 60_000;

  const errorParts: string[] = [];

  // Typecheck — run full tsc but filter errors to generated files only
  try {
    await execFileAsync(npx, ['tsc', '--noEmit'], {
      cwd: projectRoot,
      timeout,
      env: { ...process.env, NODE_ENV: 'test' },
    });
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string };
    const output = ((error.stdout ?? '') + (error.stderr ?? '')).trim();
    // Filter errors to only show lines about generated files
    const relevantLines = output
      .split('\n')
      .filter((line) => [...generatedPaths].some((p) => line.includes(p)));
    if (relevantLines.length > 0) {
      errorParts.push(`### TypeScript errors\n\`\`\`\n${relevantLines.join('\n')}\n\`\`\``);
    }
  }

  // ESLint — only lint generated files
  const srcFiles = [...generatedPaths].filter(
    (p) => p.startsWith('src/') || p.startsWith('tests/')
  );
  if (srcFiles.length > 0) {
    try {
      await execFileAsync(npx, ['eslint', ...srcFiles], {
        cwd: projectRoot,
        timeout,
        env: { ...process.env, NODE_ENV: 'test' },
      });
    } catch (err: unknown) {
      const error = err as { stdout?: string; stderr?: string };
      const output = ((error.stdout ?? '') + (error.stderr ?? '')).trim();
      if (output.length > 0) {
        errorParts.push(`### ESLint errors\n\`\`\`\n${output.slice(0, 2000)}\n\`\`\``);
      }
    }
  }

  if (errorParts.length === 0) {
    return { passed: true, errors: '' };
  }

  return { passed: false, errors: errorParts.join('\n\n') };
}

/**
 * Creates a detached worktree for validation with node_modules symlinked.
 * This prevents in-loop validation from writing to the main checkout
 * (which would trigger tsx watch restart).
 */
async function createValidationWorktree(projectRoot: string): Promise<string> {
  const { execFile } = await import('node:child_process');
  const { promisify } = await import('node:util');
  const execFileAsync = promisify(execFile);
  const { mkdtemp } = await import('node:fs/promises');

  const wtPath = await mkdtemp(join(tmpdir(), 'fenice-validate-'));
  await execFileAsync('git', ['worktree', 'add', '--detach', wtPath, 'HEAD'], {
    cwd: projectRoot,
    timeout: 15_000,
  });

  // Symlink node_modules so tsc/eslint can resolve dependencies
  await symlink(join(projectRoot, 'node_modules'), join(wtPath, 'node_modules'));

  logger.info({ worktreePath: wtPath }, 'Created validation worktree');
  return wtPath;
}

async function removeValidationWorktree(projectRoot: string, wtPath: string): Promise<void> {
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    const execFileAsync = promisify(execFile);

    await execFileAsync('git', ['worktree', 'remove', wtPath, '--force'], {
      cwd: projectRoot,
      timeout: 10_000,
    });
  } catch {
    // Fallback: rm the directory and prune
    try {
      await rm(wtPath, { recursive: true, force: true });
    } catch {
      logger.warn({ worktreePath: wtPath }, 'Failed to clean up validation worktree');
    }
  }
}

function buildValidateCallback(validationRoot: string): ValidateCallback {
  return async (files: BuilderGeneratedFile[]) => {
    // Write files to the validation worktree (NOT the main checkout)
    const paths = await writeFilesToDisk(validationRoot, files);
    logger.info(
      { fileCount: paths.length },
      'In-loop validation: files written to worktree, running tsc + eslint'
    );

    const generatedPaths = new Set(paths);
    const result = await runValidationSteps(validationRoot, generatedPaths);

    if (result.passed) {
      logger.info('In-loop validation passed');
    } else {
      logger.warn({ errorLength: result.errors.length }, 'In-loop validation failed');
      // Clean up generated files from the worktree so next round starts clean
      await cleanupFiles(validationRoot, paths);
    }

    return result;
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function generatePlan(
  prompt: string,
  context: ContextBundle,
  apiKey: string,
  fileIndex?: string
): Promise<PlanResult> {
  const client = new Anthropic({ apiKey });

  const contextText = formatContextForPrompt(context);
  const planPrompt = fileIndex ? buildPlanPrompt(fileIndex) : BUILDER_PLAN_PROMPT;
  const userMessage = `${contextText}\n\n## User Request\n\n${prompt}`;

  let response: Anthropic.Message;
  try {
    response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: [{ type: 'text', text: planPrompt, cache_control: { type: 'ephemeral' } }],
      messages: [{ role: 'user', content: userMessage }],
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : 'Unknown Anthropic API error';
    logger.error({ error: message }, 'Anthropic API call failed during planning');
    throw new AppError(502, 'LLM_API_ERROR', `Claude API error during planning: ${message}`);
  }

  const textBlock = response.content.find((b) => b.type === 'text');
  let raw = textBlock?.type === 'text' ? textBlock.text : '';

  // Strip markdown code fences if present
  const fenceMatch = /```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/.exec(raw);
  if (fenceMatch?.[1]) {
    raw = fenceMatch[1];
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    logger.error({ raw: raw.slice(0, 200) }, 'Plan response is not valid JSON');
    throw new AppError(502, 'PLAN_PARSE_ERROR', 'Claude returned invalid JSON for the plan');
  }

  const validation = BuilderPlanSchema.safeParse(parsed);
  if (!validation.success) {
    logger.error({ issues: validation.error.issues }, 'Plan response failed schema validation');
    throw new AppError(
      502,
      'PLAN_PARSE_ERROR',
      'Claude returned a plan that does not match the expected schema'
    );
  }

  return {
    plan: validation.data,
    tokenUsage: {
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
    },
  };
}

export async function generateCode(
  prompt: string,
  context: ContextBundle,
  projectRoot: string,
  apiKey: string,
  onToolActivity?: ToolActivityCallback,
  plan?: BuilderPlan,
  preformattedContext?: string
): Promise<GenerationResult> {
  const client = new Anthropic({ apiKey });

  const contextText =
    preformattedContext ??
    (plan ? formatContextForGeneration(context) : formatContextForPrompt(context));
  const planConstraint = plan ? buildPlanConstraint(plan) : '';
  const userMessage = `${contextText}\n\n${planConstraint}## User Request\n\n${prompt}\n\nGenerate all necessary files using the tools provided. Create complete, production-ready code following the project conventions shown above.`;

  const systemPrompt = plan?.taskType ? buildSystemPrompt(plan.taskType) : BUILDER_SYSTEM_PROMPT;
  const allowedPlanPaths = plan ? new Set(plan.files.map((f) => f.path)) : undefined;

  // Create a validation worktree so in-loop tsc/eslint writes don't touch the main checkout.
  // Without this, writing generated files to src/ triggers tsx watch and kills the pipeline.
  const validationWt = await createValidationWorktree(projectRoot);

  try {
    return await runToolLoop({
      client,
      systemPrompt,
      userMessage,
      projectRoot,
      onToolActivity,
      allowedPlanPaths,
      onValidate: buildValidateCallback(validationWt),
    });
  } finally {
    await removeValidationWorktree(projectRoot, validationWt);
  }
}

export async function repairCode(
  originalFiles: BuilderGeneratedFile[],
  validationErrors: string,
  projectRoot: string,
  apiKey: string,
  planPaths?: Set<string>
): Promise<GenerationResult> {
  const client = new Anthropic({ apiKey });

  // Allow repair to touch originally generated files + all plan-approved paths
  const allowedPlanPaths = new Set([...originalFiles.map((f) => f.path), ...(planPaths ?? [])]);

  const filesListing = originalFiles
    .map((f) => `### ${f.path}\n\`\`\`typescript\n${f.content}\n\`\`\``)
    .join('\n\n');

  const userMessage = `The following files were generated but failed validation. Please fix them.

## Validation Errors

${validationErrors}

## Generated Files

${filesListing}

Fix the issues and rewrite ALL files using the tools. Follow the same project conventions. Only fix what's broken — do not restructure or rename unless necessary.`;

  return runToolLoop({
    client,
    systemPrompt: BUILDER_SYSTEM_PROMPT,
    userMessage,
    projectRoot,
    allowedPlanPaths,
  });
}
