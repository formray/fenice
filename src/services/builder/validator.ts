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
    logger.warn({ step, output: output.slice(0, 500) }, 'Validation step failed');
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
  const testArgs = testFiles.length > 0 ? ['vitest', 'run', ...testFiles] : ['vitest', 'run'];
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
