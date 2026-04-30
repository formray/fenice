import type { ToolHandler } from '../types.js';

interface RunTestsArgs {
  steps?: ('typecheck' | 'lint' | 'test')[];
}

/**
 * `run_tests` — runs the FENICE validator (typecheck/lint/test) and returns
 * the per-step pass/fail breakdown. Admin-only because npm test is heavy
 * and shouldn't be triggered by an arbitrary agent.
 */
export const runTestsTool: ToolHandler = {
  definition: {
    name: 'run_tests',
    description:
      'Run the FENICE validation suite (typecheck, lint, test). Returns per-step results with truncated error output. Admin-only.',
    inputSchema: {
      type: 'object',
      properties: {
        steps: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['typecheck', 'lint', 'test'],
          },
          description: 'Subset of steps to run (default: all three)',
        },
      },
    },
    minRole: 'admin',
    readOnly: false,
  },

  async handle(args, ctx) {
    const { steps } = (args ?? {}) as RunTestsArgs;

    if (!ctx.runValidator) {
      return {
        content: [{ type: 'text', text: 'Validator is not available in this environment' }],
        isError: true,
      };
    }

    try {
      const result = await ctx.runValidator(steps);
      return {
        content: [
          {
            type: 'json',
            data: {
              passed: result.passed,
              durationMs: result.durationMs,
              steps: result.steps.map((s) => ({
                step: s.step,
                passed: s.passed,
                output: s.output.slice(0, 4_000),
              })),
            },
          },
        ],
        isError: !result.passed,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Validator error';
      return {
        content: [{ type: 'text', text: message }],
        isError: true,
      };
    }
  },
};
