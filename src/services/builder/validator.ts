import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { createLogger } from '../../utils/logger.js';

const execFileAsync = promisify(execFile);

const logger = createLogger('fenice', process.env['LOG_LEVEL'] ?? 'info');

export interface ValidationResult {
  passed: boolean;
  errors: ValidationStepResult[];
}

export interface ValidationStepResult {
  step: 'typecheck' | 'lint' | 'test';
  passed: boolean;
  output: string;
}

const VALIDATION_TIMEOUT_MS = 60_000;

async function runStep(
  step: 'typecheck' | 'lint' | 'test',
  command: string,
  args: string[],
  projectRoot: string
): Promise<ValidationStepResult> {
  try {
    const { stdout, stderr } = await execFileAsync(command, args, {
      cwd: projectRoot,
      timeout: VALIDATION_TIMEOUT_MS,
      env: { ...process.env, NODE_ENV: 'test' },
    });
    const output = (stdout + stderr).trim();
    logger.info({ step }, 'Validation step passed');
    return { step, passed: true, output: output.slice(0, 2000) };
  } catch (err: unknown) {
    const error = err as { stdout?: string; stderr?: string; message?: string };
    const output = ((error.stdout ?? '') + (error.stderr ?? '') + (error.message ?? '')).trim();
    logger.warn({ step, output: output.slice(0, 2000) }, 'Validation step failed');
    return { step, passed: false, output: output.slice(0, 2000) };
  }
}

export async function validateProject(
  projectRoot: string,
  generatedFiles?: string[]
): Promise<ValidationResult> {
  const npx = process.platform === 'win32' ? 'npx.cmd' : 'npx';

  const steps: ValidationStepResult[] = [];

  // Run typecheck
  const typecheck = await runStep('typecheck', npx, ['tsc', '--noEmit'], projectRoot);
  steps.push(typecheck);

  // Run lint
  const lint = await runStep('lint', npx, ['eslint', 'src', 'tests'], projectRoot);
  steps.push(lint);

  // Run only generated test files (not the entire suite — pre-existing integration
  // tests may hardcode counts that break when new routes are added)
  const testFiles = (generatedFiles ?? []).filter((f) => f.startsWith('tests/'));
  const testArgs =
    testFiles.length > 0
      ? ['vitest', 'run', '--reporter=verbose', ...testFiles]
      : ['vitest', 'run', '--reporter=verbose'];
  const test = await runStep('test', npx, testArgs, projectRoot);
  steps.push(test);

  const passed = steps.every((s) => s.passed);

  logger.info(
    { passed, results: steps.map((s) => ({ step: s.step, passed: s.passed })) },
    'Validation complete'
  );

  return { passed, errors: steps };
}

export function formatValidationErrors(result: ValidationResult): string {
  const failedSteps = result.errors.filter((s) => !s.passed);
  if (failedSteps.length === 0) return 'All validation steps passed.';

  const parts: string[] = ['Validation failed on the following steps:\n'];

  for (const step of failedSteps) {
    parts.push(`### ${step.step}\n\`\`\`\n${step.output}\n\`\`\`\n`);
  }

  return parts.join('\n');
}

// ---------------------------------------------------------------------------
// M5: Strategy-based error categorization for multi-retry recovery
// ---------------------------------------------------------------------------

export type RepairStrategy = 'typecheck' | 'lint' | 'test' | 'all';

export interface CategorizedErrors {
  typeErrors: string;
  lintErrors: string;
  testErrors: string;
}

/**
 * Categorizes validation errors by step type for targeted repair.
 * Each category contains only the errors from that step.
 */
export function categorizeErrors(result: ValidationResult): CategorizedErrors {
  const failed = result.errors.filter((s) => !s.passed);
  return {
    typeErrors: formatStepErrors(failed, 'typecheck'),
    lintErrors: formatStepErrors(failed, 'lint'),
    testErrors: formatStepErrors(failed, 'test'),
  };
}

function formatStepErrors(
  steps: ValidationStepResult[],
  step: 'typecheck' | 'lint' | 'test'
): string {
  const match = steps.find((s) => s.step === step);
  if (!match) return '';
  return `### ${step}\n\`\`\`\n${match.output}\n\`\`\``;
}

/**
 * Determines the next repair strategy based on what failed.
 * Priority: typecheck → lint → test → all.
 * Returns null if the given strategy has already been tried and there's nothing left.
 */
export function pickRepairStrategy(
  categorized: CategorizedErrors,
  attemptedStrategies: Set<RepairStrategy>
): RepairStrategy | null {
  const strategies: RepairStrategy[] = ['typecheck', 'lint', 'test'];

  for (const strategy of strategies) {
    if (attemptedStrategies.has(strategy)) continue;
    const hasErrors =
      (strategy === 'typecheck' && categorized.typeErrors.length > 0) ||
      (strategy === 'lint' && categorized.lintErrors.length > 0) ||
      (strategy === 'test' && categorized.testErrors.length > 0);
    if (hasErrors) return strategy;
  }

  // If we haven't tried 'all' yet and there are still errors, try fixing everything
  if (!attemptedStrategies.has('all')) return 'all';
  return null;
}

/**
 * Formats errors for a specific repair strategy.
 * For targeted strategies, only includes errors from that category.
 * For 'all', includes everything.
 */
export function formatStrategyErrors(
  categorized: CategorizedErrors,
  strategy: RepairStrategy
): string {
  switch (strategy) {
    case 'typecheck':
      return `Fix ONLY the TypeScript type errors below. Do not change anything else.\n\n${categorized.typeErrors}`;
    case 'lint':
      return `Fix ONLY the ESLint errors below. Do not change anything else.\n\n${categorized.lintErrors}`;
    case 'test':
      return `Fix ONLY the test failures below. Do not change anything else.\n\n${categorized.testErrors}`;
    case 'all':
      return formatAllErrors(categorized);
  }
}

function formatAllErrors(categorized: CategorizedErrors): string {
  const parts: string[] = ['Fix ALL the following errors:\n'];
  if (categorized.typeErrors) parts.push(categorized.typeErrors);
  if (categorized.lintErrors) parts.push(categorized.lintErrors);
  if (categorized.testErrors) parts.push(categorized.testErrors);
  return parts.join('\n\n');
}
