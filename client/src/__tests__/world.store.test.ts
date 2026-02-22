import { describe, it, expect, beforeEach } from 'vitest';
import { useWorldStore } from '../stores/world.store';
import type { WorldModel } from '../types/world';

const mockModel: WorldModel = {
  services: [{ id: 's1', tag: 'Health', endpointCount: 1 }],
  endpoints: [
    {
      id: 'e1',
      serviceId: 's1',
      path: '/health',
      method: 'get',
      summary: 'Health check',
      hasAuth: false,
      parameterCount: 0,
    },
  ],
  edges: [{ id: 'edge1', sourceId: 'e1', targetId: 'e2', type: 'same_service' }],
};

describe('useWorldStore', () => {
  beforeEach(() => {
    useWorldStore.getState().reset();
  });

  it('has correct initial state', () => {
    const state = useWorldStore.getState();
    expect(state.services).toHaveLength(0);
    expect(state.endpoints).toHaveLength(0);
    expect(state.edges).toHaveLength(0);
    expect(state.lastSeq).toBe(0);
    expect(state.resumeToken).toBeNull();
    expect(state.connected).toBe(false);
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('setWorldModel populates services, endpoints, edges', () => {
    useWorldStore.getState().setWorldModel(mockModel, 42, 'token123');
    const state = useWorldStore.getState();

    expect(state.services).toEqual(mockModel.services);
    expect(state.endpoints).toEqual(mockModel.endpoints);
    expect(state.edges).toEqual(mockModel.edges);
    expect(state.lastSeq).toBe(42);
    expect(state.resumeToken).toBe('token123');
    expect(state.loading).toBe(false);
    expect(state.error).toBeNull();
  });

  it('setConnected updates connected flag', () => {
    useWorldStore.getState().setConnected(true);
    expect(useWorldStore.getState().connected).toBe(true);

    useWorldStore.getState().setConnected(false);
    expect(useWorldStore.getState().connected).toBe(false);
  });

  it('setLoading updates loading flag', () => {
    useWorldStore.getState().setLoading(false);
    expect(useWorldStore.getState().loading).toBe(false);

    useWorldStore.getState().setLoading(true);
    expect(useWorldStore.getState().loading).toBe(true);
  });

  it('setError sets error and clears loading', () => {
    useWorldStore.getState().setLoading(true);
    useWorldStore.getState().setError('Connection failed');

    const state = useWorldStore.getState();
    expect(state.error).toBe('Connection failed');
    expect(state.loading).toBe(false);
  });

  it('setError with null clears the error', () => {
    useWorldStore.getState().setError('Some error');
    useWorldStore.getState().setError(null);
    expect(useWorldStore.getState().error).toBeNull();
  });

  it('reset returns to initial state', () => {
    // Populate the store
    useWorldStore.getState().setWorldModel(mockModel, 42, 'token123');
    useWorldStore.getState().setConnected(true);

    // Reset
    useWorldStore.getState().reset();
    const state = useWorldStore.getState();

    expect(state.services).toHaveLength(0);
    expect(state.endpoints).toHaveLength(0);
    expect(state.edges).toHaveLength(0);
    expect(state.lastSeq).toBe(0);
    expect(state.resumeToken).toBeNull();
    expect(state.connected).toBe(false);
    expect(state.loading).toBe(true);
    expect(state.error).toBeNull();
  });

  it('setWorldModel with null resumeToken', () => {
    useWorldStore.getState().setWorldModel(mockModel, 1, null);
    expect(useWorldStore.getState().resumeToken).toBeNull();
  });
});
