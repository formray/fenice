import { describe, it, expect, beforeEach } from 'vitest';
import { useWorldStore } from '../stores/world.store';
import type { WorldDeltaMessage } from '../types/world-ws';

function makeDelta(seq: number, events: WorldDeltaMessage['events']): WorldDeltaMessage {
  return { type: 'world.delta', schemaVersion: 1, seq, ts: new Date().toISOString(), events };
}

describe('world.store — semantic integration', () => {
  beforeEach(() => {
    useWorldStore.getState().reset();
    useWorldStore.getState().setWorldModel(
      {
        services: [{ id: 'service:users', tag: 'Users', endpointCount: 2 }],
        endpoints: [
          {
            id: 'ep:public',
            serviceId: 'service:users',
            path: '/public',
            method: 'get',
            summary: '',
            hasAuth: false,
            parameterCount: 0,
          },
          {
            id: 'ep:protected',
            serviceId: 'service:users',
            path: '/protected',
            method: 'get',
            summary: '',
            hasAuth: true,
            parameterCount: 0,
          },
        ],
        edges: [],
      },
      10,
      null
    );
  });

  it('has initial session state none', () => {
    expect(useWorldStore.getState().sessionState).toBe('none');
  });

  it('computes semantics for public endpoint as unknown when core signals are missing', () => {
    const semantics = useWorldStore.getState().endpointSemantics['ep:public'];
    expect(semantics?.linkState).toBe('unknown');
    expect(semantics?.reason).toBe('signal_missing');
    expect(semantics?.zone).toBe('public-perimeter');
  });

  it('computes semantics for protected endpoint as blocked with session=none', () => {
    const semantics = useWorldStore.getState().endpointSemantics['ep:protected'];
    expect(semantics?.linkState).toBe('blocked');
    expect(semantics?.reason).toBe('auth_required_no_session');
    expect(semantics?.zone).toBe('protected-core');
  });

  it('setSessionState changes session and recomputes semantics', () => {
    useWorldStore.getState().setSessionState('valid');
    const semantics = useWorldStore.getState().endpointSemantics['ep:protected'];
    expect(semantics?.linkState).toBe('unknown');
    expect(semantics?.reason).toBe('signal_missing');
    expect(semantics?.zone).toBe('protected-core');
  });

  it('health delta updates semantics', () => {
    useWorldStore.getState().setSessionState('valid');

    useWorldStore.getState().applyDelta(
      makeDelta(11, [
        {
          type: 'endpoint.health.updated',
          entityId: 'ep:protected',
          payload: { status: 'down' },
        },
      ])
    );
    const semantics = useWorldStore.getState().endpointSemantics['ep:protected'];
    expect(semantics?.linkState).toBe('blocked');
    expect(semantics?.reason).toBe('dependency_unhealthy_hard');
  });

  it('auth gate reflects session state', () => {
    const gate = useWorldStore.getState().authGate;
    expect(gate.open).toBe(false);
    expect(gate.linkState).toBe('blocked');

    useWorldStore.getState().setSessionState('valid');
    const gate2 = useWorldStore.getState().authGate;
    expect(gate2.open).toBe(true);
    expect(gate2.linkState).toBe('ok');
  });

  it('reset clears semantics and session', () => {
    useWorldStore.getState().setSessionState('valid');
    useWorldStore.getState().reset();
    expect(useWorldStore.getState().sessionState).toBe('none');
    expect(Object.keys(useWorldStore.getState().endpointSemantics)).toHaveLength(0);
  });

  it('setWorldModel resets stale metrics classifier state', () => {
    useWorldStore.getState().setSessionState('valid');

    useWorldStore.getState().applyDelta(
      makeDelta(11, [
        {
          type: 'endpoint.metrics.updated',
          entityId: 'ep:public',
          payload: { rps: 10, p50: 30, p95: 700, errorRate: 0.01 },
        },
      ])
    );
    useWorldStore.getState().applyDelta(
      makeDelta(12, [
        {
          type: 'endpoint.metrics.updated',
          entityId: 'ep:public',
          payload: { rps: 12, p50: 40, p95: 650, errorRate: 0.02 },
        },
      ])
    );
    useWorldStore.getState().applyDelta(
      makeDelta(13, [
        {
          type: 'endpoint.metrics.updated',
          entityId: 'ep:public',
          payload: { rps: 11, p50: 35, p95: 600, errorRate: 0.01 },
        },
      ])
    );
    expect(useWorldStore.getState().endpointSemantics['ep:public']?.linkState).toBe('degraded');

    useWorldStore.getState().setWorldModel(
      {
        services: [{ id: 'service:users', tag: 'Users', endpointCount: 1 }],
        endpoints: [
          {
            id: 'ep:public',
            serviceId: 'service:users',
            path: '/public',
            method: 'get',
            summary: '',
            hasAuth: false,
            parameterCount: 0,
          },
        ],
        edges: [],
      },
      20,
      null
    );

    const semantics = useWorldStore.getState().endpointSemantics['ep:public'];
    expect(semantics?.linkState).toBe('unknown');
    expect(semantics?.reason).toBe('signal_missing');
  });

  it('endpoint.removed clears stale overlay/classifier for id reuse', () => {
    useWorldStore.getState().setSessionState('valid');

    useWorldStore.getState().applyDelta(
      makeDelta(11, [
        {
          type: 'endpoint.metrics.updated',
          entityId: 'ep:public',
          payload: { rps: 10, p50: 30, p95: 700, errorRate: 0.01 },
        },
      ])
    );
    useWorldStore.getState().applyDelta(
      makeDelta(12, [
        {
          type: 'endpoint.metrics.updated',
          entityId: 'ep:public',
          payload: { rps: 12, p50: 40, p95: 650, errorRate: 0.02 },
        },
      ])
    );
    useWorldStore.getState().applyDelta(
      makeDelta(13, [
        {
          type: 'endpoint.metrics.updated',
          entityId: 'ep:public',
          payload: { rps: 11, p50: 35, p95: 600, errorRate: 0.01 },
        },
      ])
    );
    expect(useWorldStore.getState().endpointSemantics['ep:public']?.linkState).toBe('degraded');

    useWorldStore
      .getState()
      .applyDelta(makeDelta(14, [{ type: 'endpoint.removed', entityId: 'ep:public' }]));
    useWorldStore.getState().applyDelta(
      makeDelta(15, [
        {
          type: 'endpoint.upserted',
          entityId: 'ep:public',
          payload: {
            id: 'ep:public',
            serviceId: 'service:users',
            path: '/public',
            method: 'get',
            summary: '',
            hasAuth: false,
            parameterCount: 0,
          },
        },
      ])
    );

    const semantics = useWorldStore.getState().endpointSemantics['ep:public'];
    expect(semantics?.linkState).toBe('unknown');
    expect(semantics?.reason).toBe('signal_missing');
  });
});
