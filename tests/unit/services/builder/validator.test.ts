import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockExecFile = vi.fn();

vi.mock('node:util', () => ({
  promisify: () => mockExecFile,
}));

const { validateProject, formatValidationErrors } =
  await import('../../../../src/services/builder/validator.js');

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
