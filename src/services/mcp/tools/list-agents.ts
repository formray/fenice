import type { ToolHandler } from '../types.js';

/**
 * `list_agents` — returns active MCP agent sessions.
 *
 * In M7.1 this returns an empty list because the SessionManager isn't wired
 * yet. M7.2 will populate it. Listing the tool now keeps the surface stable
 * for clients building against FENICE.
 *
 * Read-only. Available to any role >= agent.
 */
export const listAgentsTool: ToolHandler = {
  definition: {
    name: 'list_agents',
    description:
      'List currently connected MCP agents — id, name, role, status, last activity. Useful for swarms to discover peers.',
    inputSchema: {
      type: 'object',
      properties: {
        role: {
          type: 'string',
          description: 'Filter by agent role',
          enum: ['generator', 'reviewer', 'tester', 'monitor', 'generic'],
        },
      },
    },
    minRole: 'agent',
    readOnly: true,
  },

  async handle(args, ctx) {
    const { role } = (args ?? {}) as { role?: string };

    let sessions = ctx.listAgentSessions();
    if (role) {
      sessions = sessions.filter((s) => s.role === role);
    }

    return {
      content: [{ type: 'json', data: { count: sessions.length, agents: sessions } }],
      isError: false,
    };
  },
};
