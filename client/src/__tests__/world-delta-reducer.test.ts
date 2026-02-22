import { describe, it, expect, beforeEach } from 'vitest';
import { useWorldStore } from '../stores/world.store';
import type { WorldDeltaMessage } from '../types/world-ws';

function makeDelta(seq: number, events: WorldDeltaMessage['events']): WorldDeltaMessage {
  return {
    type: 'world.delta',
    schemaVersion: 1,
    seq,
    ts: new Date().toISOString(),
    events,
  };
}

describe('world.store applyDelta', () => {
  beforeEach(() => {
    useWorldStore.getState().reset();
    useWorldStore.getState().setWorldModel(
      {
        services: [{ id: 'service:users', tag: 'Users', endpointCount: 1 }],
        endpoints: [
          {
            id: 'endpoint:get:/users',
            serviceId: 'service:users',
            path: '/users',
            method: 'get',
            summary: 'List users',
            hasAuth: false,
            parameterCount: 0,
          },
        ],
        edges: [],
      },
      10,
      null
    );
  });

  // ── Seq guard ──

  it('ignores delta with seq <= lastSeq (duplicate)', () => {
    const result = useWorldStore.getState().applyDelta(makeDelta(10, []));
    expect(result).toBe('ignored');
    expect(useWorldStore.getState().lastSeq).toBe(10);
  });

  it('ignores delta with seq < lastSeq (out-of-order)', () => {
    const result = useWorldStore.getState().applyDelta(makeDelta(5, []));
    expect(result).toBe('ignored');
  });

  it('returns "resync" on gap (seq > lastSeq + 1)', () => {
    const result = useWorldStore.getState().applyDelta(makeDelta(15, []));
    expect(result).toBe('resync');
  });

  it('applies delta with seq = lastSeq + 1', () => {
    const result = useWorldStore.getState().applyDelta(
      makeDelta(11, [
        {
          type: 'endpoint.metrics.updated',
          entityId: 'endpoint:get:/users',
          payload: { rps: 100, p50: 30, p95: 150, errorRate: 0.01 },
        },
      ])
    );
    expect(result).toBe('applied');
    expect(useWorldStore.getState().lastSeq).toBe(11);
  });

  // ── Metrics overlay ──

  it('stores endpoint metrics in overlay map', () => {
    useWorldStore.getState().applyDelta(
      makeDelta(11, [
        {
          type: 'endpoint.metrics.updated',
          entityId: 'endpoint:get:/users',
          payload: { rps: 200, p50: 50, p95: 180, errorRate: 0.02 },
        },
      ])
    );
    const overlay = useWorldStore.getState().endpointOverlays['endpoint:get:/users'];
    expect(overlay?.metrics).toEqual({ rps: 200, p50: 50, p95: 180, errorRate: 0.02 });
  });

  // ── Health overlay ──

  it('stores endpoint health in overlay map', () => {
    useWorldStore.getState().applyDelta(
      makeDelta(11, [
        {
          type: 'endpoint.health.updated',
          entityId: 'endpoint:get:/users',
          payload: { status: 'degraded' },
        },
      ])
    );
    const overlay = useWorldStore.getState().endpointOverlays['endpoint:get:/users'];
    expect(overlay?.health).toEqual({ status: 'degraded' });
  });

  // ── CRUD: service ──

  it('upserts a new service', () => {
    useWorldStore.getState().applyDelta(
      makeDelta(11, [
        {
          type: 'service.upserted',
          entityId: 'service:health',
          payload: { id: 'service:health', tag: 'Health', endpointCount: 1 },
        },
      ])
    );
    expect(useWorldStore.getState().services).toHaveLength(2);
  });

  it('updates existing service on upsert', () => {
    useWorldStore.getState().applyDelta(
      makeDelta(11, [
        {
          type: 'service.upserted',
          entityId: 'service:users',
          payload: { id: 'service:users', tag: 'Users', endpointCount: 5 },
        },
      ])
    );
    const svc = useWorldStore.getState().services.find((s) => s.id === 'service:users');
    expect(svc?.endpointCount).toBe(5);
  });

  it('removes a service', () => {
    useWorldStore
      .getState()
      .applyDelta(makeDelta(11, [{ type: 'service.removed', entityId: 'service:users' }]));
    expect(useWorldStore.getState().services).toHaveLength(0);
  });

  // ── CRUD: endpoint ──

  it('upserts a new endpoint', () => {
    useWorldStore.getState().applyDelta(
      makeDelta(11, [
        {
          type: 'endpoint.upserted',
          entityId: 'endpoint:post:/users',
          payload: {
            id: 'endpoint:post:/users',
            serviceId: 'service:users',
            path: '/users',
            method: 'post',
            summary: 'Create user',
            hasAuth: true,
            parameterCount: 1,
          },
        },
      ])
    );
    expect(useWorldStore.getState().endpoints).toHaveLength(2);
  });

  it('removes an endpoint', () => {
    useWorldStore
      .getState()
      .applyDelta(makeDelta(11, [{ type: 'endpoint.removed', entityId: 'endpoint:get:/users' }]));
    expect(useWorldStore.getState().endpoints).toHaveLength(0);
  });

  // ── CRUD: edge ──

  it('upserts and removes an edge', () => {
    useWorldStore.getState().applyDelta(
      makeDelta(11, [
        {
          type: 'edge.upserted',
          entityId: 'edge:a->b',
          payload: {
            id: 'edge:a->b',
            sourceId: 'a',
            targetId: 'b',
            type: 'same_service' as const,
          },
        },
      ])
    );
    expect(useWorldStore.getState().edges).toHaveLength(1);

    useWorldStore
      .getState()
      .applyDelta(makeDelta(12, [{ type: 'edge.removed', entityId: 'edge:a->b' }]));
    expect(useWorldStore.getState().edges).toHaveLength(0);
  });

  // ── Freeze guard ──

  it('freezes endpointOverlays in non-production', () => {
    useWorldStore.getState().applyDelta(
      makeDelta(11, [
        {
          type: 'endpoint.health.updated',
          entityId: 'endpoint:get:/users',
          payload: { status: 'healthy' },
        },
      ])
    );
    const overlays = useWorldStore.getState().endpointOverlays;
    expect(Object.isFrozen(overlays)).toBe(true);
  });
});
