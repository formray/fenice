import { create } from 'zustand';
import type { WorldService, WorldEndpoint, WorldEdge, WorldModel } from '../types/world';
import type { WorldDeltaMessage } from '../types/world-ws';
import type { EndpointMetrics, EndpointHealth } from '../types/world-delta';
import { useBuilderStore } from './builder.store';
import { useAgentStore } from './agent.store';
import type {
  SessionState,
  SemanticState,
  AuthGateState,
  MetricsState,
  HealthState,
} from '../types/semantic';
import { DEFAULT_METRICS_CONFIG } from '../types/semantic';
import { resolveEndpoint, resolveAuthGate } from '../services/semantic-resolver';
import { MetricsClassifier } from '../services/metrics-classifier';

const metricsClassifier = new MetricsClassifier(DEFAULT_METRICS_CONFIG);

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
  sessionState: SessionState;
  endpointSemantics: Record<string, SemanticState>;
  authGate: AuthGateState;

  setWorldModel: (model: WorldModel, seq: number, resumeToken: string | null) => void;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSessionState: (state: SessionState) => void;
  applyDelta: (delta: WorldDeltaMessage) => DeltaResult;
  reset: () => void;
}

const isDev = import.meta.env.DEV || import.meta.env.MODE === 'test';

function maybeFreezeOverlays(
  overlays: Record<string, EndpointOverlay>
): Record<string, EndpointOverlay> {
  if (isDev) return Object.freeze(overlays);
  return overlays;
}

function computeAllSemantics(
  endpoints: WorldEndpoint[],
  overlays: Record<string, EndpointOverlay>,
  sessionState: SessionState
): { endpointSemantics: Record<string, SemanticState>; authGate: AuthGateState } {
  const endpointSemantics: Record<string, SemanticState> = {};
  for (const ep of endpoints) {
    const overlay = overlays[ep.id];
    const healthState: HealthState = overlay?.health?.status ?? 'unknown';
    const metricsState: MetricsState = metricsClassifier.classify(ep.id);
    endpointSemantics[ep.id] = resolveEndpoint({
      hasAuth: ep.hasAuth,
      sessionState,
      healthState,
      metricsState,
      policyState: 'allow', // default until real signal
    });
  }
  return { endpointSemantics, authGate: resolveAuthGate(sessionState) };
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
  sessionState: 'none' as SessionState,
  endpointSemantics: {} as Record<string, SemanticState>,
  authGate: resolveAuthGate('none'),
};

export const useWorldStore = create<WorldState>((set, get) => ({
  ...initialState,

  setWorldModel: (model, seq, resumeToken) => {
    // Snapshot replace: clear classifier state to avoid stale metrics on resync.
    metricsClassifier.reset();
    const newOverlays = maybeFreezeOverlays({});
    const { endpointSemantics, authGate } = computeAllSemantics(
      model.endpoints,
      {},
      get().sessionState
    );
    set({
      services: model.services,
      endpoints: model.endpoints,
      edges: model.edges,
      lastSeq: seq,
      resumeToken,
      loading: false,
      error: null,
      endpointOverlays: newOverlays,
      endpointSemantics,
      authGate,
    });
  },

  setConnected: (connected) => set({ connected }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  setSessionState: (sessionState: SessionState) => {
    const state = get();
    const { endpointSemantics, authGate } = computeAllSemantics(
      state.endpoints,
      state.endpointOverlays,
      sessionState
    );
    set({ sessionState, endpointSemantics, authGate });
  },

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
          delete overlays[event.entityId];
          metricsClassifier.remove(event.entityId);
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
          metricsClassifier.push(event.entityId, event.payload);
          break;
        }
        case 'endpoint.health.updated': {
          const existing = overlays[event.entityId];
          overlays[event.entityId] = { ...existing, health: event.payload };
          break;
        }
        case 'builder.progress': {
          useBuilderStore.getState().applyProgress(event.payload);
          break;
        }
        case 'agent.connected': {
          useAgentStore.getState().applyConnected(event.entityId, event.payload);
          break;
        }
        case 'agent.disconnected': {
          useAgentStore.getState().applyDisconnected(event.entityId);
          break;
        }
        case 'agent.activity': {
          useAgentStore.getState().applyActivity(event.entityId, event.payload);
          break;
        }
      }
    }

    const { endpointSemantics, authGate } = computeAllSemantics(
      endpoints,
      overlays,
      state.sessionState
    );

    set({
      services,
      endpoints,
      edges,
      endpointOverlays: maybeFreezeOverlays(overlays),
      endpointSemantics,
      authGate,
      lastSeq: delta.seq,
    });
    return 'applied';
  },

  reset: () => {
    metricsClassifier.reset();
    set(initialState);
  },
}));
