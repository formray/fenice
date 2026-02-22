# M2A Delta Runtime Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement typed delta event pipeline — schema (W2-T01), monotonic-seq producer (W2-T02), and client reducer with out-of-order guard + resync fallback (W2-T03).

**Architecture:** Zod discriminated union for 8 delta event types, broadcast via `WorldWsManager.broadcastDelta()` with monotonic seq, consumed by Zustand reducer with seq guard and gap-triggered resync. Mock producer at boot generates synthetic metrics/health + OpenAPI diff for CRUD.

**Tech Stack:** TypeScript 5.x, Zod v4, Vitest 4, Zustand 5, Hono WS

**Branch:** `feat/m2a-delta-runtime` (from `main`)

**6 Vincoli:**
1. Health status: `healthy | degraded | down`
2. All 8 event types; hybrid producer (OpenAPI diff for CRUD + synthetic for metrics/health)
3. Producer singleton at boot
4. KPI: `Date.now() - Date.parse(delta.ts)` (no cross-clock perf.now)
5. `Object.freeze()` dev/test only
6. JSON Schema versionato auto-exportato + sync check

---

## Task 1: Create branch

**Step 1: Create feature branch from main**

Run: `git checkout -b feat/m2a-delta-runtime main`

**Step 2: Verify clean state**

Run: `git status`
Expected: clean working tree on `feat/m2a-delta-runtime`

---

## Task 2: W2-T01 — Delta event Zod schemas

**Files:**
- Create: `src/schemas/world-delta.schema.ts`
- Test: `tests/unit/schemas/world-delta.schema.test.ts`

**Step 1: Write the failing test**

Create `tests/unit/schemas/world-delta.schema.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import {
  WorldDeltaEventSchema,
  type WorldDeltaEvent,
} from '../../../src/schemas/world-delta.schema.js';

const VALID_EVENTS: { name: string; event: WorldDeltaEvent }[] = [
  {
    name: 'service.upserted',
    event: {
      type: 'service.upserted',
      entityId: 'service:users',
      payload: { id: 'service:users', tag: 'Users', endpointCount: 3 },
    },
  },
  {
    name: 'service.removed',
    event: { type: 'service.removed', entityId: 'service:users' },
  },
  {
    name: 'endpoint.upserted',
    event: {
      type: 'endpoint.upserted',
      entityId: 'endpoint:get:/users',
      payload: {
        id: 'endpoint:get:/users',
        serviceId: 'service:users',
        path: '/users',
        method: 'get',
        summary: 'List users',
        hasAuth: false,
        parameterCount: 1,
      },
    },
  },
  {
    name: 'endpoint.removed',
    event: { type: 'endpoint.removed', entityId: 'endpoint:get:/users' },
  },
  {
    name: 'edge.upserted',
    event: {
      type: 'edge.upserted',
      entityId: 'edge:a->b',
      payload: { id: 'edge:a->b', sourceId: 'a', targetId: 'b', type: 'same_service' },
    },
  },
  {
    name: 'edge.removed',
    event: { type: 'edge.removed', entityId: 'edge:a->b' },
  },
  {
    name: 'endpoint.metrics.updated',
    event: {
      type: 'endpoint.metrics.updated',
      entityId: 'endpoint:get:/users',
      payload: { rps: 120, p50: 45, p95: 180, errorRate: 0.02 },
    },
  },
  {
    name: 'endpoint.health.updated',
    event: {
      type: 'endpoint.health.updated',
      entityId: 'endpoint:get:/users',
      payload: { status: 'healthy' },
    },
  },
];

describe('WorldDeltaEventSchema', () => {
  for (const { name, event } of VALID_EVENTS) {
    it(`accepts valid ${name}`, () => {
      const result = WorldDeltaEventSchema.safeParse(event);
      expect(result.success).toBe(true);
    });
  }

  it('accepts health status "degraded"', () => {
    const event = {
      type: 'endpoint.health.updated',
      entityId: 'endpoint:get:/users',
      payload: { status: 'degraded' },
    };
    expect(WorldDeltaEventSchema.safeParse(event).success).toBe(true);
  });

  it('accepts health status "down"', () => {
    const event = {
      type: 'endpoint.health.updated',
      entityId: 'endpoint:get:/users',
      payload: { status: 'down' },
    };
    expect(WorldDeltaEventSchema.safeParse(event).success).toBe(true);
  });

  it('rejects health status "unhealthy" (not in enum)', () => {
    const event = {
      type: 'endpoint.health.updated',
      entityId: 'endpoint:get:/users',
      payload: { status: 'unhealthy' },
    };
    expect(WorldDeltaEventSchema.safeParse(event).success).toBe(false);
  });

  it('rejects unknown event type', () => {
    const event = { type: 'unknown.event', entityId: 'x' };
    expect(WorldDeltaEventSchema.safeParse(event).success).toBe(false);
  });

  it('rejects service.upserted without payload', () => {
    const event = { type: 'service.upserted', entityId: 'service:x' };
    expect(WorldDeltaEventSchema.safeParse(event).success).toBe(false);
  });

  it('rejects endpoint.metrics.updated with negative rps', () => {
    const event = {
      type: 'endpoint.metrics.updated',
      entityId: 'endpoint:get:/x',
      payload: { rps: -1, p50: 0, p95: 0, errorRate: 0 },
    };
    expect(WorldDeltaEventSchema.safeParse(event).success).toBe(false);
  });

  it('rejects endpoint.metrics.updated with errorRate > 1', () => {
    const event = {
      type: 'endpoint.metrics.updated',
      entityId: 'endpoint:get:/x',
      payload: { rps: 10, p50: 10, p95: 20, errorRate: 1.5 },
    };
    expect(WorldDeltaEventSchema.safeParse(event).success).toBe(false);
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- tests/unit/schemas/world-delta.schema.test.ts`
Expected: FAIL — cannot resolve `world-delta.schema.js`

**Step 3: Write schema implementation**

Create `src/schemas/world-delta.schema.ts`:

```typescript
import { z } from 'zod';
import { WorldServiceSchema, WorldEndpointSchema, WorldEdgeSchema } from './world.schema.js';

// ─── Health status enum (aligned with M2B contract) ─────────────────────────

export const HealthStatusSchema = z.enum(['healthy', 'degraded', 'down']);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

// ─── Metrics payload ────────────────────────────────────────────────────────

export const EndpointMetricsPayloadSchema = z.object({
  rps: z.number().nonnegative(),
  p50: z.number().nonnegative(),
  p95: z.number().nonnegative(),
  errorRate: z.number().min(0).max(1),
});
export type EndpointMetricsPayload = z.infer<typeof EndpointMetricsPayloadSchema>;

// ─── Health payload ─────────────────────────────────────────────────────────

export const EndpointHealthPayloadSchema = z.object({
  status: HealthStatusSchema,
});
export type EndpointHealthPayload = z.infer<typeof EndpointHealthPayloadSchema>;

// ─── Delta event variants ───────────────────────────────────────────────────

const ServiceUpsertedEvent = z.object({
  type: z.literal('service.upserted'),
  entityId: z.string().min(1),
  payload: WorldServiceSchema,
});

const ServiceRemovedEvent = z.object({
  type: z.literal('service.removed'),
  entityId: z.string().min(1),
});

const EndpointUpsertedEvent = z.object({
  type: z.literal('endpoint.upserted'),
  entityId: z.string().min(1),
  payload: WorldEndpointSchema,
});

const EndpointRemovedEvent = z.object({
  type: z.literal('endpoint.removed'),
  entityId: z.string().min(1),
});

const EdgeUpsertedEvent = z.object({
  type: z.literal('edge.upserted'),
  entityId: z.string().min(1),
  payload: WorldEdgeSchema,
});

const EdgeRemovedEvent = z.object({
  type: z.literal('edge.removed'),
  entityId: z.string().min(1),
});

const EndpointMetricsUpdatedEvent = z.object({
  type: z.literal('endpoint.metrics.updated'),
  entityId: z.string().min(1),
  payload: EndpointMetricsPayloadSchema,
});

const EndpointHealthUpdatedEvent = z.object({
  type: z.literal('endpoint.health.updated'),
  entityId: z.string().min(1),
  payload: EndpointHealthPayloadSchema,
});

// ─── Union ──────────────────────────────────────────────────────────────────

export const WorldDeltaEventSchema = z.discriminatedUnion('type', [
  ServiceUpsertedEvent,
  ServiceRemovedEvent,
  EndpointUpsertedEvent,
  EndpointRemovedEvent,
  EdgeUpsertedEvent,
  EdgeRemovedEvent,
  EndpointMetricsUpdatedEvent,
  EndpointHealthUpdatedEvent,
]);

export type WorldDeltaEvent = z.infer<typeof WorldDeltaEventSchema>;

// Re-export individual event schemas for JSON Schema export
export {
  ServiceUpsertedEvent,
  ServiceRemovedEvent,
  EndpointUpsertedEvent,
  EndpointRemovedEvent,
  EdgeUpsertedEvent,
  EdgeRemovedEvent,
  EndpointMetricsUpdatedEvent,
  EndpointHealthUpdatedEvent,
};
```

**Step 4: Run test to verify it passes**

Run: `npm test -- tests/unit/schemas/world-delta.schema.test.ts`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/schemas/world-delta.schema.ts tests/unit/schemas/world-delta.schema.test.ts
git commit -m "feat(world): add typed delta event Zod schemas (W2-T01)

8 event types: service/endpoint/edge upserted/removed,
endpoint.metrics.updated, endpoint.health.updated.
Health status aligned with M2B: healthy | degraded | down.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Wire typed events into WorldDeltaMessage

**Files:**
- Modify: `src/schemas/world-ws.schema.ts` (line 56: `events: z.array(z.unknown())`)
- Test: existing `tests/unit/schemas/world-ws.schema.test.ts` + `tests/unit/ws/world-ws-contract.test.ts`

**Step 1: Write a failing test**

Add to `tests/unit/schemas/world-ws.schema.test.ts` (or to contract test):

```typescript
it('world.delta with typed events validates against schema', () => {
  const delta = {
    type: 'world.delta',
    schemaVersion: 1,
    seq: 100,
    ts: new Date().toISOString(),
    events: [
      {
        type: 'endpoint.metrics.updated',
        entityId: 'endpoint:get:/users',
        payload: { rps: 50, p50: 30, p95: 120, errorRate: 0.01 },
      },
      {
        type: 'endpoint.health.updated',
        entityId: 'endpoint:get:/users',
        payload: { status: 'healthy' },
      },
    ],
  };
  const result = WorldServerMessageSchema.safeParse(delta);
  expect(result.success).toBe(true);
});

it('world.delta rejects events with unknown type', () => {
  const delta = {
    type: 'world.delta',
    schemaVersion: 1,
    seq: 100,
    ts: new Date().toISOString(),
    events: [{ type: 'bogus.event', entityId: 'x' }],
  };
  const result = WorldServerMessageSchema.safeParse(delta);
  expect(result.success).toBe(false);
});
```

**Step 2: Run — first test should pass (z.unknown accepts anything), second should fail**

Run: `npm test -- tests/unit/schemas/world-ws.schema.test.ts`

**Step 3: Update world-ws.schema.ts**

In `src/schemas/world-ws.schema.ts`, replace:
```typescript
events: z.array(z.unknown()),
```
with:
```typescript
events: z.array(WorldDeltaEventSchema),
```

Add import:
```typescript
import { WorldDeltaEventSchema } from './world-delta.schema.js';
```

**Step 4: Run tests**

Run: `npm test -- tests/unit/schemas/world-ws.schema.test.ts tests/unit/ws/world-ws-contract.test.ts`
Expected: all PASS (the contract test that pre-fills buffer with `{ type: 'world.delta', seq: 2 }` may need updating since it lacks `events` — fix if needed by adding `events: []`)

**Step 5: Commit**

```bash
git add src/schemas/world-ws.schema.ts tests/unit/schemas/world-ws.schema.test.ts tests/unit/ws/world-ws-contract.test.ts
git commit -m "feat(world): wire typed delta events into WorldDeltaMessage (W2-T01)

Replace events: z.unknown() with discriminated union of 8 event types.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Client-side delta type mirrors

**Files:**
- Create: `client/src/types/world-delta.ts`
- Modify: `client/src/types/world-ws.ts` (line 43: `events: unknown[]`)
- Modify: `client/src/types/world.ts` (add metrics/health optional fields)

**Step 1: Create client delta types**

Create `client/src/types/world-delta.ts`:

```typescript
/**
 * Client-side delta event types.
 * Mirrors backend Zod schemas in src/schemas/world-delta.schema.ts.
 */

import type { WorldService, WorldEndpoint, WorldEdge } from './world';

export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface EndpointMetrics {
  rps: number;
  p50: number;
  p95: number;
  errorRate: number;
}

export interface EndpointHealth {
  status: HealthStatus;
}

export type WorldDeltaEvent =
  | { type: 'service.upserted'; entityId: string; payload: WorldService }
  | { type: 'service.removed'; entityId: string }
  | { type: 'endpoint.upserted'; entityId: string; payload: WorldEndpoint }
  | { type: 'endpoint.removed'; entityId: string }
  | { type: 'edge.upserted'; entityId: string; payload: WorldEdge }
  | { type: 'edge.removed'; entityId: string }
  | { type: 'endpoint.metrics.updated'; entityId: string; payload: EndpointMetrics }
  | { type: 'endpoint.health.updated'; entityId: string; payload: EndpointHealth };
```

**Step 2: Update `client/src/types/world-ws.ts`**

Replace line 43:
```typescript
events: unknown[];
```
with:
```typescript
events: WorldDeltaEvent[];
```

Add import:
```typescript
import type { WorldDeltaEvent } from './world-delta';
```

**Step 3: Run client typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: PASS

**Step 4: Commit**

```bash
git add client/src/types/world-delta.ts client/src/types/world-ws.ts
git commit -m "feat(world-client): add typed delta event mirrors (W2-T01)

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 5: W2-T02 — broadcastDelta on WorldWsManager

**Files:**
- Modify: `src/ws/world-manager.ts`
- Test: `tests/unit/ws/world-manager.test.ts`

**Step 1: Write failing test**

Add to `tests/unit/ws/world-manager.test.ts`:

```typescript
describe('broadcastDelta', () => {
  it('allocates monotonic seq and broadcasts to subscribed', () => {
    const ws1 = createMockWs();
    const ws2 = createMockWs();
    manager.addConnection('u1', ws1);
    manager.addConnection('u2', ws2);
    manager.markSubscribed('u1');
    // u2 not subscribed

    const events = [
      { type: 'endpoint.health.updated' as const, entityId: 'ep:1', payload: { status: 'healthy' as const } },
    ];
    const result = manager.broadcastDelta(events);

    expect(result.seq).toBe(1);
    expect(ws1.send).toHaveBeenCalledTimes(1);
    expect(ws2.send).not.toHaveBeenCalled();

    const sent = JSON.parse(ws1.send.mock.calls[0]![0] as string);
    expect(sent.type).toBe('world.delta');
    expect(sent.schemaVersion).toBe(1);
    expect(sent.seq).toBe(1);
    expect(sent.events).toHaveLength(1);
    expect(typeof sent.ts).toBe('string');
  });

  it('adds delta to ring buffer', () => {
    const ws = createMockWs();
    manager.addConnection('u1', ws);
    manager.markSubscribed('u1');

    manager.broadcastDelta([]);
    const buffered = manager.getBufferedMessagesFrom(1);
    expect(buffered).not.toBeNull();
    expect(buffered).toHaveLength(1);
  });

  it('seq increments across multiple deltas', () => {
    const ws = createMockWs();
    manager.addConnection('u1', ws);
    manager.markSubscribed('u1');

    const r1 = manager.broadcastDelta([]);
    const r2 = manager.broadcastDelta([]);
    const r3 = manager.broadcastDelta([]);

    expect(r1.seq).toBe(1);
    expect(r2.seq).toBe(2);
    expect(r3.seq).toBe(3);
  });
});
```

**Step 2: Run to verify failure**

Run: `npm test -- tests/unit/ws/world-manager.test.ts`
Expected: FAIL — `broadcastDelta` is not a function

**Step 3: Implement broadcastDelta**

Add to `src/ws/world-manager.ts`, import the delta type at top:

```typescript
import type { WorldDeltaEvent } from '../schemas/world-delta.schema.js';
```

Add method to `WorldWsManager`:

```typescript
broadcastDelta(events: WorldDeltaEvent[]): { seq: number; ts: string } {
  const seq = this.nextSeq();
  const ts = new Date().toISOString();
  const msg = JSON.stringify({
    type: 'world.delta',
    schemaVersion: 1,
    seq,
    ts,
    events,
  });
  this.addToBuffer(seq, msg);
  this.broadcastToSubscribed(msg);
  return { seq, ts };
}
```

**Step 4: Run tests**

Run: `npm test -- tests/unit/ws/world-manager.test.ts`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/ws/world-manager.ts tests/unit/ws/world-manager.test.ts
git commit -m "feat(world): add broadcastDelta with monotonic seq (W2-T02)

Atomic: seq allocation + buffer + broadcast in single synchronous call.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 6: W2-T02 — Env vars for producer intervals

**Files:**
- Modify: `src/config/env.ts`

**Step 1: Add delta producer env vars**

Add to `EnvSchema` in `src/config/env.ts` after the World WS block:

```typescript
// Delta Producer
DELTA_METRICS_INTERVAL_MS: z.coerce.number().default(5_000),
DELTA_DIFF_INTERVAL_MS: z.coerce.number().default(30_000),
```

**Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: PASS

**Step 3: Commit**

```bash
git add src/config/env.ts
git commit -m "feat(world): add delta producer interval env vars (W2-T02)

DELTA_METRICS_INTERVAL_MS (default 5s), DELTA_DIFF_INTERVAL_MS (default 30s).

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 7: W2-T02 — Mock delta producer

**Files:**
- Create: `src/services/mock-delta-producer.ts`
- Test: `tests/unit/services/mock-delta-producer.test.ts`

**Step 1: Write failing test**

Create `tests/unit/services/mock-delta-producer.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MockDeltaProducer } from '../../../src/services/mock-delta-producer.js';
import { WorldWsManager } from '../../../src/ws/world-manager.js';
import { ProjectionService } from '../../../src/services/projection.service.js';
import { WorldDeltaEventSchema } from '../../../src/schemas/world-delta.schema.js';

const OPENAPI_FIXTURE = {
  paths: {
    '/users': {
      get: { tags: ['Users'], summary: 'List users', parameters: [] },
      post: {
        tags: ['Users'],
        summary: 'Create user',
        security: [{ bearer: [] }],
        requestBody: { content: {} },
      },
    },
    '/health': {
      get: { tags: ['Health'], summary: 'Health check' },
    },
  },
};

describe('MockDeltaProducer', () => {
  let manager: WorldWsManager;
  let projection: ProjectionService;
  let producer: MockDeltaProducer;

  beforeEach(() => {
    vi.useFakeTimers();
    manager = new WorldWsManager(100, 300_000);
    projection = new ProjectionService();
    projection.buildWorldModel(OPENAPI_FIXTURE);
    producer = new MockDeltaProducer(manager, projection, {
      metricsIntervalMs: 1_000,
      diffIntervalMs: 5_000,
    });
  });

  afterEach(() => {
    producer.stop();
    vi.useRealTimers();
  });

  it('is not running before start', () => {
    expect(producer.isRunning()).toBe(false);
  });

  it('starts and stops cleanly', () => {
    producer.start();
    expect(producer.isRunning()).toBe(true);
    producer.stop();
    expect(producer.isRunning()).toBe(false);
  });

  it('does not start twice (singleton guard)', () => {
    producer.start();
    producer.start(); // should be no-op
    expect(producer.isRunning()).toBe(true);
  });

  it('emits metrics delta events on tick', () => {
    const ws = { send: vi.fn(), close: vi.fn(), readyState: 1 };
    manager.addConnection('u1', ws);
    manager.markSubscribed('u1');

    producer.start();
    vi.advanceTimersByTime(1_000);

    expect(ws.send).toHaveBeenCalled();
    const msg = JSON.parse(ws.send.mock.calls[0]![0] as string);
    expect(msg.type).toBe('world.delta');
    expect(msg.events.length).toBeGreaterThan(0);

    // Every event must validate
    for (const event of msg.events) {
      expect(WorldDeltaEventSchema.safeParse(event).success).toBe(true);
    }
  });

  it('emits only metrics/health events on metrics tick (no CRUD)', () => {
    const ws = { send: vi.fn(), close: vi.fn(), readyState: 1 };
    manager.addConnection('u1', ws);
    manager.markSubscribed('u1');

    producer.start();
    vi.advanceTimersByTime(1_000);

    const msg = JSON.parse(ws.send.mock.calls[0]![0] as string);
    for (const event of msg.events) {
      expect(['endpoint.metrics.updated', 'endpoint.health.updated']).toContain(event.type);
    }
  });

  it('health status is one of healthy/degraded/down', () => {
    const ws = { send: vi.fn(), close: vi.fn(), readyState: 1 };
    manager.addConnection('u1', ws);
    manager.markSubscribed('u1');

    producer.start();
    // Run several ticks to get varied results
    vi.advanceTimersByTime(10_000);

    for (const call of ws.send.mock.calls) {
      const msg = JSON.parse(call[0] as string);
      for (const event of msg.events) {
        if (event.type === 'endpoint.health.updated') {
          expect(['healthy', 'degraded', 'down']).toContain(event.payload.status);
        }
      }
    }
  });

  it('does not broadcast when no subscribers', () => {
    const ws = { send: vi.fn(), close: vi.fn(), readyState: 1 };
    manager.addConnection('u1', ws);
    // NOT subscribed

    producer.start();
    vi.advanceTimersByTime(1_000);

    expect(ws.send).not.toHaveBeenCalled();
  });
});
```

**Step 2: Run to verify failure**

Run: `npm test -- tests/unit/services/mock-delta-producer.test.ts`
Expected: FAIL — cannot resolve `mock-delta-producer.js`

**Step 3: Implement MockDeltaProducer**

Create `src/services/mock-delta-producer.ts`:

```typescript
import type { WorldDeltaEvent } from '../schemas/world-delta.schema.js';
import type { WorldWsManager } from '../ws/world-manager.js';
import type { ProjectionService } from './projection.service.js';
import type { WorldModel } from '../schemas/world.schema.js';

export interface MockDeltaProducerOptions {
  metricsIntervalMs: number;
  diffIntervalMs: number;
}

type HealthStatus = 'healthy' | 'degraded' | 'down';

function randomMetrics(): { rps: number; p50: number; p95: number; errorRate: number } {
  const rps = Math.round(Math.random() * 500);
  const p50 = Math.round(Math.random() * 100);
  const p95 = p50 + Math.round(Math.random() * 200);
  const errorRate = Math.round(Math.random() * 10) / 100; // 0.00 - 0.10
  return { rps, p50, p95, errorRate };
}

function randomHealth(): HealthStatus {
  const roll = Math.random();
  if (roll < 0.8) return 'healthy';
  if (roll < 0.95) return 'degraded';
  return 'down';
}

export class MockDeltaProducer {
  private metricsTimer: ReturnType<typeof setInterval> | null = null;
  private diffTimer: ReturnType<typeof setInterval> | null = null;
  private previousModel: WorldModel | null = null;
  private fetchSpec: (() => Promise<WorldModel>) | null = null;

  constructor(
    private readonly manager: WorldWsManager,
    private readonly projection: ProjectionService,
    private readonly options: MockDeltaProducerOptions
  ) {}

  isRunning(): boolean {
    return this.metricsTimer !== null;
  }

  start(fetchSpec?: () => Promise<WorldModel>): void {
    if (this.metricsTimer) return; // singleton guard

    this.fetchSpec = fetchSpec ?? null;
    this.previousModel = this.projection.getCachedModel();

    // Metrics/health synthetic generator
    this.metricsTimer = setInterval(() => {
      this.emitMetricsTick();
    }, this.options.metricsIntervalMs);

    // OpenAPI diff poller for CRUD events
    this.diffTimer = setInterval(() => {
      void this.emitDiffTick();
    }, this.options.diffIntervalMs);
  }

  stop(): void {
    if (this.metricsTimer) {
      clearInterval(this.metricsTimer);
      this.metricsTimer = null;
    }
    if (this.diffTimer) {
      clearInterval(this.diffTimer);
      this.diffTimer = null;
    }
  }

  private emitMetricsTick(): void {
    const model = this.projection.getCachedModel();
    if (!model) return;

    const events: WorldDeltaEvent[] = [];

    for (const ep of model.endpoints) {
      events.push({
        type: 'endpoint.metrics.updated',
        entityId: ep.id,
        payload: randomMetrics(),
      });
      events.push({
        type: 'endpoint.health.updated',
        entityId: ep.id,
        payload: { status: randomHealth() },
      });
    }

    if (events.length > 0) {
      this.manager.broadcastDelta(events);
    }
  }

  private async emitDiffTick(): Promise<void> {
    if (!this.fetchSpec) return;

    let newModel: WorldModel;
    try {
      newModel = await this.fetchSpec();
    } catch {
      return; // silently skip on fetch failure
    }

    const prev = this.previousModel;
    if (!prev) {
      this.previousModel = newModel;
      return;
    }

    const events: WorldDeltaEvent[] = [];

    // Diff services
    const prevServiceIds = new Set(prev.services.map((s) => s.id));
    const newServiceIds = new Set(newModel.services.map((s) => s.id));

    for (const svc of newModel.services) {
      if (!prevServiceIds.has(svc.id)) {
        events.push({ type: 'service.upserted', entityId: svc.id, payload: svc });
      }
    }
    for (const svc of prev.services) {
      if (!newServiceIds.has(svc.id)) {
        events.push({ type: 'service.removed', entityId: svc.id });
      }
    }

    // Diff endpoints
    const prevEndpointIds = new Set(prev.endpoints.map((e) => e.id));
    const newEndpointIds = new Set(newModel.endpoints.map((e) => e.id));

    for (const ep of newModel.endpoints) {
      if (!prevEndpointIds.has(ep.id)) {
        events.push({ type: 'endpoint.upserted', entityId: ep.id, payload: ep });
      }
    }
    for (const ep of prev.endpoints) {
      if (!newEndpointIds.has(ep.id)) {
        events.push({ type: 'endpoint.removed', entityId: ep.id });
      }
    }

    // Diff edges
    const prevEdgeIds = new Set(prev.edges.map((e) => e.id));
    const newEdgeIds = new Set(newModel.edges.map((e) => e.id));

    for (const edge of newModel.edges) {
      if (!prevEdgeIds.has(edge.id)) {
        events.push({ type: 'edge.upserted', entityId: edge.id, payload: edge });
      }
    }
    for (const edge of prev.edges) {
      if (!newEdgeIds.has(edge.id)) {
        events.push({ type: 'edge.removed', entityId: edge.id });
      }
    }

    if (events.length > 0) {
      this.manager.broadcastDelta(events);
    }

    this.previousModel = newModel;
  }
}
```

**Step 4: Run tests**

Run: `npm test -- tests/unit/services/mock-delta-producer.test.ts`
Expected: all PASS

**Step 5: Commit**

```bash
git add src/services/mock-delta-producer.ts tests/unit/services/mock-delta-producer.test.ts
git commit -m "feat(world): add MockDeltaProducer with hybrid generation (W2-T02)

Synthetic metrics/health on configurable interval +
OpenAPI diff polling for CRUD events.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 8: W2-T02 — Wire producer singleton at boot

**Files:**
- Modify: `src/routes/world-ws.routes.ts`
- Modify: `src/server.ts`

**Step 1: Expose manager and projection from world-ws.routes.ts**

Add exports to `src/routes/world-ws.routes.ts` for the lazy singletons:

```typescript
export { getWorldWsManager, getProjectionService };
```

**Step 2: Start producer in server.ts**

In `src/server.ts`, after `injectWebSocket(server)`:

```typescript
import { MockDeltaProducer } from './services/mock-delta-producer.js';
import { getWorldWsManager, getProjectionService } from './routes/world-ws.routes.js';

// ... inside start(), after injectWebSocket:
const worldMgr = getWorldWsManager();
const projectionSvc = getProjectionService();
const deltaProducer = new MockDeltaProducer(worldMgr, projectionSvc, {
  metricsIntervalMs: env.DELTA_METRICS_INTERVAL_MS,
  diffIntervalMs: env.DELTA_DIFF_INTERVAL_MS,
});

const fetchSpec = async () => {
  const res = await app.request('/openapi');
  const spec: unknown = await res.json();
  return projectionSvc.buildWorldModel(spec);
};

deltaProducer.start(fetchSpec);
logger.info('Delta producer started');
```

Add `deltaProducer.stop()` in the shutdown handler.

**Step 3: Run typecheck + existing tests**

Run: `npm run typecheck && npm test`
Expected: all PASS

**Step 4: Commit**

```bash
git add src/server.ts src/routes/world-ws.routes.ts
git commit -m "feat(world): wire producer singleton at server boot (W2-T02)

Single instance, started once after WS injection.
Stopped cleanly on SIGTERM/SIGINT.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 9: W2-T03 — Client store overlay map + applyDelta

**Files:**
- Modify: `client/src/stores/world.store.ts`
- Test: `client/src/__tests__/world-delta-reducer.test.ts` (create)

**Step 1: Write failing test**

Create `client/src/__tests__/world-delta-reducer.test.ts`:

```typescript
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
    // Seed initial state
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

  // ── CRUD: service upserted ──

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

  // ── CRUD: service removed ──

  it('removes a service', () => {
    useWorldStore.getState().applyDelta(
      makeDelta(11, [{ type: 'service.removed', entityId: 'service:users' }])
    );
    expect(useWorldStore.getState().services).toHaveLength(0);
  });

  // ── CRUD: endpoint upserted ──

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

  // ── CRUD: endpoint removed ──

  it('removes an endpoint', () => {
    useWorldStore.getState().applyDelta(
      makeDelta(11, [{ type: 'endpoint.removed', entityId: 'endpoint:get:/users' }])
    );
    expect(useWorldStore.getState().endpoints).toHaveLength(0);
  });

  // ── CRUD: edge upserted/removed ──

  it('upserts and removes an edge', () => {
    useWorldStore.getState().applyDelta(
      makeDelta(11, [
        {
          type: 'edge.upserted',
          entityId: 'edge:a->b',
          payload: { id: 'edge:a->b', sourceId: 'a', targetId: 'b', type: 'same_service' as const },
        },
      ])
    );
    expect(useWorldStore.getState().edges).toHaveLength(1);

    useWorldStore.getState().applyDelta(
      makeDelta(12, [{ type: 'edge.removed', entityId: 'edge:a->b' }])
    );
    expect(useWorldStore.getState().edges).toHaveLength(0);
  });

  // ── Freeze guard (dev only) ──

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
```

**Step 2: Run to verify failure**

Run: `cd client && npx vitest run src/__tests__/world-delta-reducer.test.ts`
Expected: FAIL — `applyDelta` is not a function

**Step 3: Implement applyDelta in world.store.ts**

Replace `client/src/stores/world.store.ts` content with updated version that adds:
- `endpointOverlays` map in state
- `applyDelta()` method with seq guard + event reducer + freeze

```typescript
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
  endpointOverlays: Record<string, EndpointOverlay>;
  lastSeq: number;
  resumeToken: string | null;
  connected: boolean;
  loading: boolean;
  error: string | null;

  setWorldModel: (model: WorldModel, seq: number, resumeToken: string | null) => void;
  applyDelta: (delta: WorldDeltaMessage) => DeltaResult;
  setConnected: (connected: boolean) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  reset: () => void;
}

const isDev = typeof process !== 'undefined'
  ? process.env?.['NODE_ENV'] !== 'production'
  : true;

function maybeFreezeOverlays(overlays: Record<string, EndpointOverlay>): Record<string, EndpointOverlay> {
  if (isDev) {
    return Object.freeze(overlays);
  }
  return overlays;
}

const initialState = {
  services: [] as WorldService[],
  endpoints: [] as WorldEndpoint[],
  edges: [] as WorldEdge[],
  endpointOverlays: {} as Record<string, EndpointOverlay>,
  lastSeq: 0,
  resumeToken: null as string | null,
  connected: false,
  loading: true,
  error: null as string | null,
};

export const useWorldStore = create<WorldState>((set, get) => ({
  ...initialState,

  setWorldModel: (model, seq, resumeToken) =>
    set({
      services: model.services,
      endpoints: model.endpoints,
      edges: model.edges,
      endpointOverlays: maybeFreezeOverlays({}),
      lastSeq: seq,
      resumeToken,
      loading: false,
      error: null,
    }),

  applyDelta: (delta: WorldDeltaMessage): DeltaResult => {
    const state = get();

    // Out-of-order / duplicate guard
    if (delta.seq <= state.lastSeq) {
      return 'ignored';
    }

    // Gap detection -> resync
    if (delta.seq > state.lastSeq + 1) {
      return 'resync';
    }

    // Apply events
    let services = [...state.services];
    let endpoints = [...state.endpoints];
    let edges = [...state.edges];
    const overlays = { ...state.endpointOverlays };

    for (const event of delta.events) {
      switch (event.type) {
        case 'service.upserted': {
          const idx = services.findIndex((s) => s.id === event.payload.id);
          if (idx >= 0) {
            services[idx] = event.payload;
          } else {
            services = [...services, event.payload];
          }
          break;
        }
        case 'service.removed':
          services = services.filter((s) => s.id !== event.entityId);
          break;
        case 'endpoint.upserted': {
          const idx = endpoints.findIndex((e) => e.id === event.payload.id);
          if (idx >= 0) {
            endpoints[idx] = event.payload;
          } else {
            endpoints = [...endpoints, event.payload];
          }
          break;
        }
        case 'endpoint.removed':
          endpoints = endpoints.filter((e) => e.id !== event.entityId);
          break;
        case 'edge.upserted': {
          const idx = edges.findIndex((e) => e.id === event.payload.id);
          if (idx >= 0) {
            edges[idx] = event.payload;
          } else {
            edges = [...edges, event.payload];
          }
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

  setConnected: (connected) => set({ connected }),

  setLoading: (loading) => set({ loading }),

  setError: (error) => set({ error, loading: false }),

  reset: () => set(initialState),
}));
```

**Step 4: Run tests**

Run: `cd client && npx vitest run`
Expected: all PASS (including existing world.store tests and new delta-reducer tests)

**Step 5: Commit**

```bash
git add client/src/stores/world.store.ts client/src/__tests__/world-delta-reducer.test.ts
git commit -m "feat(world-client): add delta reducer with seq guard + overlay map (W2-T03)

Out-of-order ignore, gap-triggered resync, CRUD + overlay apply.
Object.freeze on overlays in dev/test only.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 10: W2-T03 — Wire delta handling + resync in useWorldSocket

**Files:**
- Modify: `client/src/hooks/useWorldSocket.ts`

**Step 1: Update world.delta case in useWorldSocket.ts**

Replace lines 101-104:
```typescript
case 'world.delta':
  lastSeqRef.current = data.seq;
  // Delta handling is M2 scope
  break;
```

With:
```typescript
case 'world.delta': {
  const applyDelta = useWorldStore.getState().applyDelta;
  const result = applyDelta(data);

  if (result === 'applied') {
    lastSeqRef.current = data.seq;

    // KPI: event->render latency
    const serverTs = Date.parse(data.ts);
    if (!Number.isNaN(serverTs)) {
      const latencyMs = Date.now() - serverTs;
      kpiSamples.current.push(latencyMs);
      if (kpiSamples.current.length > KPI_RING_SIZE) {
        kpiSamples.current.shift();
      }
      kpiCounter.current += 1;
      if (kpiCounter.current % KPI_LOG_INTERVAL === 0) {
        logKpiP95();
      }
    }
  } else if (result === 'resync') {
    // Gap detected: force full snapshot by re-subscribing without resume
    resumeTokenRef.current = null;
    lastSeqRef.current = 0;
    if (ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ type: 'world.subscribe' } satisfies WorldClientMessage));
    }
  }
  // 'ignored' — no action needed
  break;
}
```

Add KPI tracking refs and helper at top of the hook:
```typescript
const KPI_RING_SIZE = 100;
const KPI_LOG_INTERVAL = 20;
// ...inside useWorldSocket:
const kpiSamples = useRef<number[]>([]);
const kpiCounter = useRef(0);
const reconnectStartRef = useRef<number | null>(null);

function logKpiP95() {
  const sorted = [...kpiSamples.current].sort((a, b) => a - b);
  const idx = Math.floor(sorted.length * 0.95);
  const p95 = sorted[idx] ?? 0;
  console.log(`[KPI] event->render p95: ${p95}ms (${sorted.length} samples)`);
}
```

Add reconnect KPI tracking:
- In `ws.onclose`: `reconnectStartRef.current = Date.now();`
- In `world.subscribed` case: if `reconnectStartRef.current`, log `Date.now() - reconnectStartRef.current` and reset

**Step 2: Run client typecheck**

Run: `cd client && npx tsc --noEmit`
Expected: PASS

**Step 3: Commit**

```bash
git add client/src/hooks/useWorldSocket.ts
git commit -m "feat(world-client): wire delta reducer + resync + KPI tracking (W2-T03)

Delta apply with seq guard, gap-triggered resync via re-subscribe,
event->render p95 ring buffer, reconnect recovery timer.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 11: JSON Schema export + sync check

**Files:**
- Create: `scripts/export-json-schema.ts`
- Create: `scripts/check-schema-sync.ts`
- Create: `docs/3d-world/schemas/world-delta-v1.json`
- Modify: `package.json` (add scripts)

**Step 1: Install zod-to-json-schema**

Run: `npm install --save-dev zod-to-json-schema`

**Step 2: Create export script**

Create `scripts/export-json-schema.ts`:

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';
import { WorldDeltaEventSchema } from '../src/schemas/world-delta.schema.js';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const outPath = resolve(__dirname, '../docs/3d-world/schemas/world-delta-v1.json');

mkdirSync(dirname(outPath), { recursive: true });

const jsonSchema = zodToJsonSchema(WorldDeltaEventSchema, {
  name: 'WorldDeltaEvent',
  $refStrategy: 'none',
});

writeFileSync(outPath, JSON.stringify(jsonSchema, null, 2) + '\n');
console.log(`Exported JSON Schema to ${outPath}`);
```

**Step 3: Create sync check script**

Create `scripts/check-schema-sync.ts`:

```typescript
import { zodToJsonSchema } from 'zod-to-json-schema';
import { WorldDeltaEventSchema } from '../src/schemas/world-delta.schema.js';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const filePath = resolve(__dirname, '../docs/3d-world/schemas/world-delta-v1.json');

const current = zodToJsonSchema(WorldDeltaEventSchema, {
  name: 'WorldDeltaEvent',
  $refStrategy: 'none',
});

let existing: unknown;
try {
  existing = JSON.parse(readFileSync(filePath, 'utf-8'));
} catch {
  console.error(`ERROR: ${filePath} not found. Run "npm run export-schema" first.`);
  process.exit(1);
}

if (JSON.stringify(current) !== JSON.stringify(existing)) {
  console.error('ERROR: JSON Schema out of sync with Zod source.');
  console.error('Run "npm run export-schema" to regenerate.');
  process.exit(1);
}

console.log('JSON Schema is in sync with Zod source.');
```

**Step 4: Add scripts to package.json**

Add to `scripts` in `package.json`:

```json
"export-schema": "tsx scripts/export-json-schema.ts",
"check-schema-sync": "tsx scripts/check-schema-sync.ts"
```

**Step 5: Run export and verify sync check**

Run: `npm run export-schema && npm run check-schema-sync`
Expected: both succeed, `docs/3d-world/schemas/world-delta-v1.json` created

**Step 6: Commit**

```bash
git add scripts/export-json-schema.ts scripts/check-schema-sync.ts docs/3d-world/schemas/world-delta-v1.json package.json package-lock.json
git commit -m "feat(world): add JSON Schema export + sync check (vincolo 6)

Auto-export from Zod via zod-to-json-schema.
npm run export-schema / check-schema-sync for CI.

Co-Authored-By: Claude Opus 4.6 <noreply@anthropic.com>"
```

---

## Task 12: Full validation pass

**Step 1: Backend lint + typecheck + test**

Run: `npm run lint && npm run typecheck && npm test`
Expected: all PASS

**Step 2: Client lint + typecheck + test**

Run: `cd client && npm run lint && npm run typecheck && npm test`
Expected: all PASS

**Step 3: Backend build**

Run: `npm run build`
Expected: PASS

**Step 4: Client build**

Run: `cd client && npm run build`
Expected: PASS

**Step 5: Schema sync check**

Run: `npm run check-schema-sync`
Expected: PASS

**Step 6: Commit any lint fixes if needed, then push**

```bash
git push -u origin feat/m2a-delta-runtime
```

---

## Task 13: Open PR

Create PR with:
- Title: `feat(world): M2A delta runtime — typed events, producer, reducer (W2-T01/T02/T03)`
- Body includes:
  - File list (touched/created)
  - Output of test/lint/typecheck/build (backend + client)
  - Confirmation of all 6 vincoli
  - KPI notes (event->render p95, reconnect recover)

```bash
gh pr create --base main --title "feat(world): M2A delta runtime (W2-T01/T02/T03)" --body "$(cat <<'EOF'
## Summary
- **W2-T01**: Typed delta events — 8-type Zod discriminated union replacing `z.unknown()`
- **W2-T02**: `broadcastDelta()` with monotonic seq + MockDeltaProducer singleton (hybrid: synthetic metrics/health + OpenAPI diff CRUD)
- **W2-T03**: Client reducer with out-of-order guard, gap-triggered resync fallback, endpoint overlay map

## Vincoli confermati
1. Health status: `healthy | degraded | down` (aligned M2B)
2. All 8 event types implemented; hybrid producer (CRUD + metrics/health)
3. Producer singleton at server boot (not per-subscribe)
4. KPI: `Date.now() - Date.parse(delta.ts)` (no cross-clock performance.now)
5. `Object.freeze()` dev/test only (`NODE_ENV !== 'production'`)
6. JSON Schema v1 auto-exported + sync check script

## Files touched

### New
- `src/schemas/world-delta.schema.ts`
- `src/services/mock-delta-producer.ts`
- `client/src/types/world-delta.ts`
- `scripts/export-json-schema.ts`
- `scripts/check-schema-sync.ts`
- `docs/3d-world/schemas/world-delta-v1.json`
- `tests/unit/schemas/world-delta.schema.test.ts`
- `tests/unit/services/mock-delta-producer.test.ts`
- `client/src/__tests__/world-delta-reducer.test.ts`

### Modified
- `src/schemas/world-ws.schema.ts`
- `src/ws/world-manager.ts`
- `src/config/env.ts`
- `src/server.ts`
- `src/routes/world-ws.routes.ts`
- `client/src/types/world-ws.ts`
- `client/src/stores/world.store.ts`
- `client/src/hooks/useWorldSocket.ts`
- `package.json`

## Test / Lint / Typecheck / Build output
[paste output here]

## KPI notes
- **event->render p95**: tracked via ring buffer (100 samples), logged every 20 deltas
- **reconnect recover**: measured from ws.onclose to world.subscribed
- Target: p95 <= 300ms, reconnect <= 2s

## Test plan
- [ ] Backend: `npm run validate` passes
- [ ] Client: `npm run lint && npm run typecheck && npm test` passes
- [ ] JSON Schema sync: `npm run check-schema-sync` passes
- [ ] Manual: start dev server, open client, verify delta messages in WS

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---
