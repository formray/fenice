import { create } from 'zustand';

export type VisualMode = 'dark' | 'light';

interface ViewState {
  visualMode: VisualMode;
  showGrid: boolean;
  setVisualMode: (mode: VisualMode) => void;
  toggleVisualMode: () => void;
  setShowGrid: (show: boolean) => void;
  toggleGrid: () => void;
  reset: () => void;
}

const initialViewState = {
  visualMode: 'dark' as VisualMode,
  showGrid: false,
};

export const useViewStore = create<ViewState>((set) => ({
  visualMode: initialViewState.visualMode,
  showGrid: initialViewState.showGrid,
  setVisualMode: (mode) => set({ visualMode: mode }),
  toggleVisualMode: () =>
    set((state) => ({ visualMode: state.visualMode === 'dark' ? 'light' : 'dark' })),
  setShowGrid: (show) => set({ showGrid: show }),
  toggleGrid: () => set((state) => ({ showGrid: !state.showGrid })),
  reset: () => set(initialViewState),
}));
