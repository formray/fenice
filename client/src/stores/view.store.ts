import { create } from 'zustand';

export type VisualMode = 'dark' | 'light';
export type RouteLayerMode = 'city' | 'debug' | 'both';

interface ViewState {
  visualMode: VisualMode;
  routeLayerMode: RouteLayerMode;
  showGrid: boolean;
  setVisualMode: (mode: VisualMode) => void;
  toggleVisualMode: () => void;
  setRouteLayerMode: (mode: RouteLayerMode) => void;
  setShowGrid: (show: boolean) => void;
  toggleGrid: () => void;
  reset: () => void;
}

const initialViewState = {
  visualMode: 'dark' as VisualMode,
  routeLayerMode: 'city' as RouteLayerMode,
  showGrid: false,
};

export const useViewStore = create<ViewState>((set) => ({
  visualMode: initialViewState.visualMode,
  routeLayerMode: initialViewState.routeLayerMode,
  showGrid: initialViewState.showGrid,
  setVisualMode: (mode) => set({ visualMode: mode }),
  toggleVisualMode: () =>
    set((state) => ({ visualMode: state.visualMode === 'dark' ? 'light' : 'dark' })),
  setRouteLayerMode: (mode) => set({ routeLayerMode: mode }),
  setShowGrid: (show) => set({ showGrid: show }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  reset: () => set(initialViewState),
}));
