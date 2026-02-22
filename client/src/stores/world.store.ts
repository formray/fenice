import { create } from 'zustand';
import type { WorldService, WorldEndpoint, WorldEdge, WorldModel } from '../types/world';
import type { WorldDeltaMessage } from '../types/world-ws';
import type { EndpointMetrics, EndpointHealth } from '../types/world-delta';

export interface EndpointOverlay {
  metrics?: EndpointMetrics | undefined;
  health?: EndpointHealth | undefined;
}

export type DeltaResult = 'applied' | 'ignored' | 'resync';

interface WorldState {
  services: WorldService[];
  endpoints: WorldEndpoint[];
  edges: WorldEdge[];
  lastSeq: number;
  resumeToken: string | null;
  connected: boolean;
  loading: boolean;
  error: string | null;
  endpointOverlays: Record<string, EndpointOverlay>;

  setWorldModel: (model: WorldModel, seq: number, resumeToken: string | null) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  applyDelta: (delta: WorldDeltaMessage) => DeltaResult;
  reset: () => void;
}

const isDev = typeof process !== 'undefined' ? process.env?.['NODE_ENV'] !== 'production' : true;

function maybeFreezeOverlays(
  overlays: Record<string, EndpointOverlay>
): Record<string, EndpointOverlay> {
  if (isDev) return Object.freeze(overlays);
  return overlays;
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
  endpointOverlays: maybeFreezeOverlays({}) as Record<string, EndpointOverlay>,
};

export const useWorldStore = create<WorldState>((set, get) => ({
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
      endpointOverlays: maybeFreezeOverlays({}),
    }),

  setConnected: (connected) => set({ connected }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  applyDelta: (delta: WorldDeltaMessage): DeltaResult => {
    const state = get();
    if (delta.seq <= state.lastSeq) return 'ignored';
    if (delta.seq > state.lastSeq + 1) return 'resync';

    let services = [...state.services];
    let endpoints = [...state.endpoints];
    let edges = [...state.edges];
    const overlays = { ...state.endpointOverlays };

    for (const event of delta.events) {
      switch (event.type) {
        case 'service.upserted': {
          const idx = services.findIndex((s) => s.id === event.payload.id);
          if (idx >= 0) services[idx] = event.payload;
          else services = [...services, event.payload];
          break;
        }
        case 'service.removed':
          services = services.filter((s) => s.id !== event.entityId);
          break;
        case 'endpoint.upserted': {
          const idx = endpoints.findIndex((e) => e.id === event.payload.id);
          if (idx >= 0) endpoints[idx] = event.payload;
          else endpoints = [...endpoints, event.payload];
          break;
        }
        case 'endpoint.removed':
          endpoints = endpoints.filter((e) => e.id !== event.entityId);
          break;
        case 'edge.upserted': {
          const idx = edges.findIndex((e) => e.id === event.payload.id);
          if (idx >= 0) edges[idx] = event.payload;
          else edges = [...edges, event.payload];
          break;
        }
        case 'edge.removed':
          edges = edges.filter((e) => e.id !== event.entityId);
          break;
        case 'endpoint.metrics.updated': {
          const existing = overlays[event.entityId];
          overlays[event.entityId] = { ...existing, metrics: event.payload };
          break;
        }
        case 'endpoint.health.updated': {
          const existing = overlays[event.entityId];
          overlays[event.entityId] = { ...existing, health: event.payload };
          break;
        }
      }
    }

    set({
      services,
      endpoints,
      edges,
      endpointOverlays: maybeFreezeOverlays(overlays),
      lastSeq: delta.seq,
    });
    return 'applied';
  },

  reset: () => set(initialState),
}));
