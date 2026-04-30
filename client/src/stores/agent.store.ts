import { create } from 'zustand';
import type { AgentConnectedPayload, AgentActivityPayload } from '../types/world-delta';
import type { AgentEntity, ActivityFeedEntry, ActiveBeam } from '../types/agent';
import { ACTIVITY_FEED_MAX, BEAM_TTL_MS } from '../types/agent';

interface AgentState {
  agents: Record<string, AgentEntity>;
  feed: ActivityFeedEntry[];
  beams: ActiveBeam[];

  applyConnected: (entityId: string, payload: AgentConnectedPayload) => void;
  applyDisconnected: (entityId: string) => void;
  applyActivity: (entityId: string, payload: AgentActivityPayload) => void;

  /** Drop expired beams (older than BEAM_TTL_MS). Called from a render loop. */
  pruneBeams: (now: number) => void;

  /** Test-only. */
  reset: () => void;
}

const initialState = {
  agents: {} as Record<string, AgentEntity>,
  feed: [] as ActivityFeedEntry[],
  beams: [] as ActiveBeam[],
};

export const useAgentStore = create<AgentState>((set) => ({
  ...initialState,

  applyConnected: (entityId, payload) => {
    set((state) => ({
      agents: {
        ...state.agents,
        [entityId]: {
          id: entityId,
          name: payload.name,
          role: payload.role,
          status: 'connected',
          connectedAt: new Date().toISOString(),
        },
      },
    }));
  },

  applyDisconnected: (entityId) => {
    set((state) => {
      const next = { ...state.agents };
      delete next[entityId];
      return {
        agents: next,
        // Drop any beams owned by this agent immediately
        beams: state.beams.filter((b) => b.agentId !== entityId),
      };
    });
  },

  applyActivity: (entityId, payload) => {
    set((state) => {
      const agent = state.agents[entityId];
      if (!agent) return state;

      // Update agent runtime state
      const updatedAgent: AgentEntity = {
        ...agent,
        status: payload.status === 'started' ? 'busy' : 'connected',
      };
      if (payload.status === 'started') {
        updatedAgent.currentTool = payload.tool;
      } else {
        delete updatedAgent.currentTool;
      }

      // Append to feed (newest first, capped)
      const now = Date.now();
      const feedEntry: ActivityFeedEntry = {
        id: `${entityId}:${now}:${payload.tool}:${payload.status}`,
        agentId: entityId,
        agentName: agent.name,
        agentRole: agent.role,
        tool: payload.tool,
        status: payload.status,
        ts: now,
      };
      if (payload.target) feedEntry.target = payload.target;
      if (typeof payload.durationMs === 'number') {
        feedEntry.durationMs = payload.durationMs;
      }
      const feed = [feedEntry, ...state.feed].slice(0, ACTIVITY_FEED_MAX);

      // Spawn a beam if there's a target and it's a started event
      let beams = state.beams;
      if (payload.status === 'started' && payload.target) {
        beams = [
          ...state.beams,
          {
            id: feedEntry.id,
            agentId: entityId,
            target: payload.target,
            startedAt: now,
          },
        ];
      }

      return {
        agents: { ...state.agents, [entityId]: updatedAgent },
        feed,
        beams,
      };
    });
  },

  pruneBeams: (now) => {
    set((state) => {
      const cutoff = now - BEAM_TTL_MS;
      const live = state.beams.filter((b) => b.startedAt >= cutoff);
      if (live.length === state.beams.length) return state;
      return { beams: live };
    });
  },

  reset: () => set(initialState),
}));
