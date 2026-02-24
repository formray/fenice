import { beforeEach, describe, expect, it } from 'vitest';
import { useViewStore } from '../stores/view.store';

describe('useViewStore', () => {
  beforeEach(() => {
    useViewStore.getState().reset();
  });

  it('has dark mode, cosmos scene, and hidden grid by default', () => {
    const state = useViewStore.getState();
    expect(state.visualMode).toBe('dark');
    expect(state.routeLayerMode).toBe('city');
    expect(state.sceneMode).toBe('cosmos');
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

  it('sets route layer mode', () => {
    useViewStore.getState().setRouteLayerMode('debug');
    expect(useViewStore.getState().routeLayerMode).toBe('debug');

    useViewStore.getState().setRouteLayerMode('both');
    expect(useViewStore.getState().routeLayerMode).toBe('both');
  });

  it('toggles scene mode between cosmos and tron', () => {
    expect(useViewStore.getState().sceneMode).toBe('cosmos');

    useViewStore.getState().toggleSceneMode();
    expect(useViewStore.getState().sceneMode).toBe('tron');

    useViewStore.getState().toggleSceneMode();
    expect(useViewStore.getState().sceneMode).toBe('cosmos');
  });

  it('sets scene mode directly', () => {
    useViewStore.getState().setSceneMode('tron');
    expect(useViewStore.getState().sceneMode).toBe('tron');

    useViewStore.getState().setSceneMode('cosmos');
    expect(useViewStore.getState().sceneMode).toBe('cosmos');
  });

  describe('focusTarget', () => {
    it('defaults to null', () => {
      expect(useViewStore.getState().focusTarget).toBeNull();
    });

    it('setFocusTarget updates state', () => {
      useViewStore.getState().setFocusTarget([10, 5, 10]);
      expect(useViewStore.getState().focusTarget).toEqual([10, 5, 10]);
    });

    it('setFocusTarget(null) clears target', () => {
      useViewStore.getState().setFocusTarget([10, 5, 10]);
      useViewStore.getState().setFocusTarget(null);
      expect(useViewStore.getState().focusTarget).toBeNull();
    });
  });
});
