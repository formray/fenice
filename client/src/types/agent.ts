import type { AgentRole, AgentActivityStatus } from './world-delta';

export type { AgentRole, AgentActivityStatus };

export type AgentStatus = 'connected' | 'idle' | 'busy';

/** Visual / runtime state of a connected MCP agent in the cosmos. */
export interface AgentEntity {
  id: string;
  name: string;
  role: AgentRole;
  status: AgentStatus;
  /** Last tool started (cleared on completion). */
  currentTool?: string;
  /** Connection time as ISO string for display. */
  connectedAt: string;
}

/** Activity event kept in the rolling feed (max 20). */
export interface ActivityFeedEntry {
  id: string; // synthetic — `${agentId}:${ts}:${tool}`
  agentId: string;
  agentName: string;
  agentRole: AgentRole;
  tool: string;
  status: AgentActivityStatus;
  target?: { type: 'service' | 'endpoint'; id: string };
  durationMs?: number;
  ts: number;
}

/** Active beam — fades after BEAM_TTL_MS. */
export interface ActiveBeam {
  id: string;
  agentId: string;
  target: { type: 'service' | 'endpoint'; id: string };
  startedAt: number;
}

export const ROLE_COLORS: Record<AgentRole, string> = {
  generator: '#00f5ff',
  reviewer: '#ff00aa',
  tester: '#ff8800',
  monitor: '#aa55ff',
  generic: '#e0f0ff',
};

export const BEAM_TTL_MS = 2500;
export const ACTIVITY_FEED_MAX = 20;
