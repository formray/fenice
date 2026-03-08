import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecFile = vi.fn();

vi.mock('node:util', () => ({
  promisify: () => mockExecFile,
}));

const {
  validateProject,
  formatValidationErrors,
  categorizeErrors,
  pickRepairStrategy,
  formatStrategyErrors,
} = await import('../../../../src/services/builder/validator.js');

describe('validateProject', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return passed when all steps succeed', async () => {
    mockExecFile.mockResolvedValue({ stdout: 'ok', stderr: '' });

    const result = await validateProject('/project');

    expect(result.passed).toBe(true);
    expect(result.errors).toHaveLength(3);
    expect(result.errors[0]?.step).toBe('typecheck');
    expect(result.errors[0]?.passed).toBe(true);
    expect(result.errors[1]?.step).toBe('lint');
    expect(result.errors[1]?.passed).toBe(true);
    expect(result.errors[2]?.step).toBe('test');
    expect(result.errors[2]?.passed).toBe(true);
  });

  it('should return failed when typecheck fails', async () => {
    mockExecFile
      .mockRejectedValueOnce({ stdout: 'error TS2345', stderr: '', message: '' })
      .mockResolvedValueOnce({ stdout: 'ok', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'ok', stderr: '' });

    const result = await validateProject('/project');

    expect(result.passed).toBe(false);
    expect(result.errors[0]?.step).toBe('typecheck');
    expect(result.errors[0]?.passed).toBe(false);
    expect(result.errors[0]?.output).toContain('TS2345');
  });

  it('should return failed when lint fails', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: 'ok', stderr: '' })
      .mockRejectedValueOnce({ stdout: '3 errors', stderr: '', message: '' })
      .mockResolvedValueOnce({ stdout: 'ok', stderr: '' });

    const result = await validateProject('/project');

    expect(result.passed).toBe(false);
    expect(result.errors[1]?.step).toBe('lint');
    expect(result.errors[1]?.passed).toBe(false);
  });

  it('should return failed when tests fail', async () => {
    mockExecFile
      .mockResolvedValueOnce({ stdout: 'ok', stderr: '' })
      .mockResolvedValueOnce({ stdout: 'ok', stderr: '' })
      .mockRejectedValueOnce({ stdout: '2 failed', stderr: '', message: '' });

    const result = await validateProject('/project');

    expect(result.passed).toBe(false);
    expect(result.errors[2]?.step).toBe('test');
    expect(result.errors[2]?.passed).toBe(false);
  });

  it('should report multiple failures', async () => {
    mockExecFile
      .mockRejectedValueOnce({ stdout: 'type error', stderr: '', message: '' })
      .mockRejectedValueOnce({ stdout: 'lint error', stderr: '', message: '' })
      .mockRejectedValueOnce({ stdout: 'test error', stderr: '', message: '' });

    const result = await validateProject('/project');

    expect(result.passed).toBe(false);
    const failed = result.errors.filter((e) => !e.passed);
    expect(failed).toHaveLength(3);
  });

  it('should truncate long output', async () => {
    mockExecFile.mockRejectedValueOnce({
      stdout: 'x'.repeat(5000),
      stderr: '',
      message: '',
    });
    mockExecFile.mockResolvedValue({ stdout: 'ok', stderr: '' });

    const result = await validateProject('/project');

    const failedStep = result.errors.find((e) => !e.passed);
    expect(failedStep?.output.length).toBeLessThanOrEqual(2000);
  });

  it('should call npx with correct arguments', async () => {
    mockExecFile.mockResolvedValue({ stdout: 'ok', stderr: '' });

    await validateProject('/project');

    expect(mockExecFile).toHaveBeenCalledTimes(3);

    const calls = mockExecFile.mock.calls as unknown[][];
    expect(calls[0]?.[1]).toEqual(['tsc', '--noEmit']);
    expect(calls[1]?.[1]).toEqual(['eslint', 'src', 'tests']);
    expect(calls[2]?.[1]).toEqual(['vitest', 'run', '--reporter=verbose']);
  });
});

describe('formatValidationErrors', () => {
  it('should return success message when all passed', () => {
    const result = formatValidationErrors({
      passed: true,
      errors: [
        { step: 'typecheck', passed: true, output: 'ok' },
        { step: 'lint', passed: true, output: 'ok' },
        { step: 'test', passed: true, output: 'ok' },
      ],
    });

    expect(result).toBe('All validation steps passed.');
  });

  it('should format failed steps with output', () => {
    const result = formatValidationErrors({
      passed: false,
      errors: [
        { step: 'typecheck', passed: false, output: 'error TS2345: ...' },
        { step: 'lint', passed: true, output: 'ok' },
        { step: 'test', passed: true, output: 'ok' },
      ],
    });

    expect(result).toContain('typecheck');
    expect(result).toContain('TS2345');
    expect(result).not.toContain('lint');
  });

  it('should format multiple failed steps', () => {
    const result = formatValidationErrors({
      passed: false,
      errors: [
        { step: 'typecheck', passed: false, output: 'type error' },
        { step: 'lint', passed: false, output: 'lint error' },
        { step: 'test', passed: true, output: 'ok' },
      ],
    });

    expect(result).toContain('typecheck');
    expect(result).toContain('lint');
    expect(result).not.toContain('### test');
  });
});

// ---------------------------------------------------------------------------
// M5: Strategy-based error categorization tests
// ---------------------------------------------------------------------------

describe('categorizeErrors', () => {
  it('should separate errors by step type', () => {
    const result = categorizeErrors({
      passed: false,
      errors: [
        { step: 'typecheck', passed: false, output: 'error TS2345' },
        { step: 'lint', passed: false, output: 'no-unused-vars' },
        { step: 'test', passed: true, output: 'ok' },
      ],
    });

    expect(result.typeErrors).toContain('TS2345');
    expect(result.lintErrors).toContain('no-unused-vars');
    expect(result.testErrors).toBe('');
  });

  it('should return empty strings for passing steps', () => {
    const result = categorizeErrors({
      passed: true,
      errors: [
        { step: 'typecheck', passed: true, output: 'ok' },
        { step: 'lint', passed: true, output: 'ok' },
        { step: 'test', passed: true, output: 'ok' },
      ],
    });

    expect(result.typeErrors).toBe('');
    expect(result.lintErrors).toBe('');
    expect(result.testErrors).toBe('');
  });

  it('should handle all steps failing', () => {
    const result = categorizeErrors({
      passed: false,
      errors: [
        { step: 'typecheck', passed: false, output: 'type error' },
        { step: 'lint', passed: false, output: 'lint error' },
        { step: 'test', passed: false, output: 'test error' },
      ],
    });

    expect(result.typeErrors).toContain('type error');
    expect(result.lintErrors).toContain('lint error');
    expect(result.testErrors).toContain('test error');
  });
});

describe('pickRepairStrategy', () => {
  it('should pick typecheck first when it has errors', () => {
    const categorized = {
      typeErrors: 'error TS2345',
      lintErrors: 'no-unused-vars',
      testErrors: '',
    };
    const strategy = pickRepairStrategy(categorized, new Set());
    expect(strategy).toBe('typecheck');
  });

  it('should skip to lint if typecheck was already attempted', () => {
    const categorized = {
      typeErrors: 'error TS2345',
      lintErrors: 'no-unused-vars',
      testErrors: '',
    };
    const strategy = pickRepairStrategy(categorized, new Set(['typecheck']));
    expect(strategy).toBe('lint');
  });

  it('should pick test if typecheck and lint were attempted', () => {
    const categorized = {
      typeErrors: '',
      lintErrors: '',
      testErrors: 'assertion failed',
    };
    const strategy = pickRepairStrategy(categorized, new Set(['typecheck', 'lint']));
    expect(strategy).toBe('test');
  });

  it('should fall back to all if targeted strategies exhausted', () => {
    const categorized = {
      typeErrors: 'error',
      lintErrors: 'error',
      testErrors: 'error',
    };
    const strategy = pickRepairStrategy(categorized, new Set(['typecheck', 'lint', 'test']));
    expect(strategy).toBe('all');
  });

  it('should return null if all strategies exhausted', () => {
    const categorized = {
      typeErrors: 'error',
      lintErrors: '',
      testErrors: '',
    };
    const strategy = pickRepairStrategy(categorized, new Set(['typecheck', 'lint', 'test', 'all']));
    expect(strategy).toBeNull();
  });

  it('should skip strategies with no errors', () => {
    const categorized = {
      typeErrors: '',
      lintErrors: 'lint error',
      testErrors: '',
    };
    const strategy = pickRepairStrategy(categorized, new Set());
    expect(strategy).toBe('lint');
  });
});

describe('formatStrategyErrors', () => {
  const categorized = {
    typeErrors: 'error TS2345: foo',
    lintErrors: 'no-unused-vars: bar',
    testErrors: 'assertion failed: baz',
  };

  it('should format typecheck strategy with targeted instruction', () => {
    const result = formatStrategyErrors(categorized, 'typecheck');
    expect(result).toContain('Fix ONLY the TypeScript type errors');
    expect(result).toContain('TS2345');
    expect(result).not.toContain('no-unused-vars');
  });

  it('should format lint strategy with targeted instruction', () => {
    const result = formatStrategyErrors(categorized, 'lint');
    expect(result).toContain('Fix ONLY the ESLint errors');
    expect(result).toContain('no-unused-vars');
    expect(result).not.toContain('TS2345');
  });

  it('should format test strategy with targeted instruction', () => {
    const result = formatStrategyErrors(categorized, 'test');
    expect(result).toContain('Fix ONLY the test failures');
    expect(result).toContain('assertion failed');
  });

  it('should format all strategy with all errors', () => {
    const result = formatStrategyErrors(categorized, 'all');
    expect(result).toContain('Fix ALL');
    expect(result).toContain('TS2345');
    expect(result).toContain('no-unused-vars');
    expect(result).toContain('assertion failed');
  });
});
