import Anthropic from '@anthropic-ai/sdk';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
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

export type ToolActivityCallback = (tool: string, path: string) => void;

export interface GenerationResult {
  files: BuilderGeneratedFile[];
  violations: ScopePolicyViolation[];
  tokenUsage: { inputTokens: number; outputTokens: number };
}

export interface PlanResult {
  plan: BuilderPlan;
  tokenUsage: { inputTokens: number; outputTokens: number };
}

interface ToolLoopConfig {
  client: Anthropic;
  systemPrompt: string;
  userMessage: string;
  projectRoot: string;
  onToolActivity?: ToolActivityCallback | undefined;
  allowedPlanPaths?: Set<string> | undefined;
}

async function runToolLoop(config: ToolLoopConfig): Promise<GenerationResult> {
  const { client, systemPrompt, userMessage, projectRoot, onToolActivity, allowedPlanPaths } =
    config;

  const files: BuilderGeneratedFile[] = [];
  const violations: ScopePolicyViolation[] = [];
  const createdPaths = new Set<string>();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

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
          const content = input['content'] ?? '';

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

          const pathError = validateFilePath(path, 'created');
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

          const codeIssues = checkCodePatterns(path, content);
          const warning =
            codeIssues.length > 0
              ? `\nWARNING — fix these with modify_file:\n${codeIssues.map((i) => `- ${i}`).join('\n')}`
              : '';
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `File created: ${path}${warning}`,
          });
        } else if (toolName === 'modify_file') {
          const path = input['path'] ?? '';
          const content = input['content'] ?? '';

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
          const pathError = validateFilePath(path, effectiveAction);
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

          const modifyCodeIssues = checkCodePatterns(path, content);
          const modifyWarning =
            modifyCodeIssues.length > 0
              ? `\nWARNING — fix these with modify_file:\n${modifyCodeIssues.map((i) => `- ${i}`).join('\n')}`
              : '';
          toolResults.push({
            type: 'tool_result',
            tool_use_id: block.id,
            content: `File modified: ${path}${modifyWarning}`,
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

  return {
    files,
    violations,
    tokenUsage: { inputTokens: totalInputTokens, outputTokens: totalOutputTokens },
  };
}

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

  return runToolLoop({
    client,
    systemPrompt,
    userMessage,
    projectRoot,
    onToolActivity,
    allowedPlanPaths,
  });
}

export async function repairCode(
  originalFiles: BuilderGeneratedFile[],
  validationErrors: string,
  projectRoot: string,
  apiKey: string
): Promise<GenerationResult> {
  const client = new Anthropic({ apiKey });

  // Restrict repair to only files that were originally generated
  const allowedPlanPaths = new Set(originalFiles.map((f) => f.path));

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
