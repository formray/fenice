import type { ToolHandler } from '../types.js';

/**
 * `check_health` — proxies to the same logic as GET /api/v1/health/detailed.
 *
 * Read-only. Available to any role >= agent.
 */
export const checkHealthTool: ToolHandler = {
  definition: {
    name: 'check_health',
    description:
      'Check FENICE platform health. Returns overall status, MongoDB connection state, uptime in seconds, and timestamp.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
    minRole: 'agent',
    readOnly: true,
  },

  async handle(_args, ctx) {
    const summary = await ctx.getHealthSummary();
    return {
      content: [{ type: 'json', data: summary }],
      isError: summary.status === 'down',
    };
  },
};
