import type { ToolHandler } from '../types.js';

interface QueryLogsArgs {
  pattern?: string;
  level?: string;
  limit?: number;
}

/**
 * `query_logs` — search the in-memory ring buffer of recent log records.
 *
 * The buffer holds at most MCP_LOG_BUFFER_SIZE records (default 200), populated
 * by the request logger middleware. Useful for agents to inspect recent
 * activity without needing access to centralized log storage.
 *
 * Read-only. Available to any role >= agent.
 */
export const queryLogsTool: ToolHandler = {
  definition: {
    name: 'query_logs',
    description:
      'Search recent in-memory FENICE logs by pattern and/or level. Returns matching records with timestamp, level, message, and structured fields.',
    inputSchema: {
      type: 'object',
      properties: {
        pattern: {
          type: 'string',
          description: 'Case-insensitive substring filter on message + fields',
        },
        level: {
          type: 'string',
          enum: ['trace', 'debug', 'info', 'warn', 'error', 'fatal'],
          description: 'Filter by log level',
        },
        limit: {
          type: 'number',
          minimum: 1,
          maximum: 200,
          default: 50,
          description: 'Maximum records to return',
        },
      },
    },
    minRole: 'agent',
    readOnly: true,
  },

  async handle(args, ctx) {
    const { pattern, level, limit = 50 } = (args ?? {}) as QueryLogsArgs;

    const queryOpts: { pattern?: string; level?: string; limit: number } = { limit };
    if (pattern !== undefined) queryOpts.pattern = pattern;
    if (level !== undefined) queryOpts.level = level;
    const records = ctx.logBuffer.query(queryOpts);

    return {
      content: [
        {
          type: 'json',
          data: {
            count: records.length,
            bufferSize: ctx.logBuffer.size(),
            records,
          },
        },
      ],
      isError: false,
    };
  },
};
