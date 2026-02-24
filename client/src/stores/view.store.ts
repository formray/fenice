import { create } from 'zustand';

export type VisualMode = 'dark' | 'light';
export type RouteLayerMode = 'city' | 'debug' | 'both';
export type SceneMode = 'cosmos' | 'tron';

interface ViewState {
  visualMode: VisualMode;
  routeLayerMode: RouteLayerMode;
  sceneMode: SceneMode;
  showGrid: boolean;
  focusTarget: [number, number, number] | null;
  setVisualMode: (mode: VisualMode) => void;
  toggleVisualMode: () => void;
  setRouteLayerMode: (mode: RouteLayerMode) => void;
  setSceneMode: (mode: SceneMode) => void;
  toggleSceneMode: () => void;
  setShowGrid: (show: boolean) => void;
  toggleGrid: () => void;
  setFocusTarget: (target: [number, number, number] | null) => void;
  reset: () => void;
}

const initialViewState = {
  visualMode: 'dark' as VisualMode,
  routeLayerMode: 'city' as RouteLayerMode,
  sceneMode: 'cosmos' as SceneMode,
  showGrid: false,
  focusTarget: null as [number, number, number] | null,
};

export const useViewStore = create<ViewState>((set) => ({
  visualMode: initialViewState.visualMode,
  routeLayerMode: initialViewState.routeLayerMode,
  sceneMode: initialViewState.sceneMode,
  showGrid: initialViewState.showGrid,
  focusTarget: initialViewState.focusTarget,
  setVisualMode: (mode) => set({ visualMode: mode }),
  toggleVisualMode: () =>
    set((state) => ({ visualMode: state.visualMode === 'dark' ? 'light' : 'dark' })),
  setRouteLayerMode: (mode) => set({ routeLayerMode: mode }),
  setSceneMode: (mode) => set({ sceneMode: mode }),
  toggleSceneMode: () =>
    set((state) => ({ sceneMode: state.sceneMode === 'cosmos' ? 'tron' : 'cosmos' })),
  setShowGrid: (show) => set({ showGrid: show }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  setFocusTarget: (target) => set({ focusTarget: target }),
  reset: () => set(initialViewState),
}));
