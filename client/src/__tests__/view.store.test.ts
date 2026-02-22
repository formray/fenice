import { beforeEach, describe, expect, it } from 'vitest';
import { useViewStore } from '../stores/view.store';

describe('useViewStore', () => {
  beforeEach(() => {
    useViewStore.getState().reset();
  });

  it('has dark mode and hidden grid by default', () => {
    const state = useViewStore.getState();
    expect(state.visualMode).toBe('dark');
    expect(state.showGrid).toBe(false);
  });

  it('toggles visual mode', () => {
    useViewStore.getState().toggleVisualMode();
    expect(useViewStore.getState().visualMode).toBe('light');

    useViewStore.getState().toggleVisualMode();
    expect(useViewStore.getState().visualMode).toBe('dark');
  });

  it('toggles grid visibility', () => {
    useViewStore.getState().toggleGrid();
    expect(useViewStore.getState().showGrid).toBe(true);

    useViewStore.getState().toggleGrid();
    expect(useViewStore.getState().showGrid).toBe(false);
  });
});
