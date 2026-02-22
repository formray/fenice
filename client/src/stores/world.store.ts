import { create } from 'zustand';
import type { WorldService, WorldEndpoint, WorldEdge, WorldModel } from '../types/world';

interface WorldState {
  services: WorldService[];
  endpoints: WorldEndpoint[];
  edges: WorldEdge[];
  lastSeq: number;
  resumeToken: string | null;
  connected: boolean;
  loading: boolean;
  error: string | null;

  setWorldModel: (model: WorldModel, seq: number, resumeToken: string | null) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const initialState = {
  services: [] as WorldService[],
  endpoints: [] as WorldEndpoint[],
  edges: [] as WorldEdge[],
  lastSeq: 0,
  resumeToken: null,
  connected: false,
  loading: true,
  error: null,
};

export const useWorldStore = create<WorldState>((set) => ({
  ...initialState,

  setWorldModel: (model, seq, resumeToken) =>
    set({
      services: model.services,
      endpoints: model.endpoints,
      edges: model.edges,
      lastSeq: seq,
      resumeToken,
      loading: false,
      error: null,
    }),

  setConnected: (connected) => set({ connected }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  reset: () => set(initialState),
}));
