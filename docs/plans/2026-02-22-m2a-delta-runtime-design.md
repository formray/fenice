# M2A Delta Runtime Design

Date: 2026-02-22
Status: Approved
Owner: Claude (runtime) + Giuseppe (approval)
Branch: `feat/m2a-delta-runtime`

## Goal

Implement the typed delta event pipeline for the 3D world realtime overlay: typed schemas (W2-T01), monotonic-seq producer (W2-T02), and client reducer with out-of-order guard + resync fallback (W2-T03).

## Decisions

1. **All 8 delta event types** implemented (not just metrics/health).
2. **Health status enum**: `healthy | degraded | down` (aligned with M2B contract).
3. **Hybrid producer**: OpenAPI diff polling for CRUD + synthetic generator for metrics/health.
4. **Producer singleton** initialized once at server boot, not per-subscribe.
5. **KPI measurement**: `Date.now() - Date.parse(delta.ts)` — no cross-clock `performance.now()`.
6. **`Object.freeze()`** on reducer output: dev/test only (`NODE_ENV !== 'production'`).
7. **Contract freeze**: Zod schemas + auto-exported JSON Schema v1 + sync check script.

## W2-T01: Typed Delta Events

### New schema: `src/schemas/world-delta.schema.ts`

Discriminated union on `type` field with 8 variants:

| Event Type | entityId | Payload |
|---|---|---|
| `service.upserted` | `service:<tag>` | Full `WorldService` |
| `service.removed` | `service:<tag>` | (none) |
| `endpoint.upserted` | `endpoint:<method>:<path>` | Full `WorldEndpoint` |
| `endpoint.removed` | `endpoint:<method>:<path>` | (none) |
| `edge.upserted` | `edge:<source>-><target>` | Full `WorldEdge` |
| `edge.removed` | `edge:<source>-><target>` | (none) |
| `endpoint.metrics.updated` | `endpoint:<method>:<path>` | `{ rps, p50, p95, errorRate }` |
| `endpoint.health.updated` | `endpoint:<method>:<path>` | `{ status: 'healthy' \| 'degraded' \| 'down' }` |

### Schema changes

- `world-ws.schema.ts`: replace `events: z.array(z.unknown())` with `events: z.array(WorldDeltaEventSchema)`
- `client/src/types/world-delta.ts`: mirror TypeScript types
- `client/src/types/world-ws.ts`: update `WorldDeltaMessage.events` type

### Contract freeze

- `scripts/export-json-schema.ts`: exports Zod schemas to `docs/3d-world/schemas/world-delta-v1.json`
- `scripts/check-schema-sync.ts`: validates JSON Schema file matches Zod source (run in CI)

## W2-T02: Producer with Monotonic Seq

### `src/services/mock-delta-producer.ts`

Singleton service started at boot (`server.ts`). Two sub-systems:

**Synthetic metrics/health generator:**
- Configurable interval (default 5s, env `DELTA_METRICS_INTERVAL_MS`)
- For each endpoint in current model, generates randomized metrics
- Health distribution: 80% healthy, 15% degraded, 5% down
- Batches all events into single `world.delta` message per tick

**OpenAPI diff poller:**
- Configurable interval (default 30s, env `DELTA_DIFF_INTERVAL_MS`)
- Re-fetches OpenAPI spec, diffs against cached model
- Emits `service.upserted/removed`, `endpoint.upserted/removed`, `edge.upserted/removed` for changes
- Updates cached model in ProjectionService

### `WorldWsManager.broadcastDelta(events)`

New method:
1. `seq = nextSeq()` (monotonic)
2. Build `world.delta` envelope with `schemaVersion: 1`, `seq`, `ts`, `events`
3. `addToBuffer(seq, serialized)`
4. `broadcastToSubscribed(serialized)`

Atomic: seq allocation + buffer + broadcast happen in single synchronous call.

## W2-T03: Client Reducer

### `world.store.ts` — `applyDelta(delta)`

```
if delta.seq <= lastSeq → ignore (out-of-order / duplicate)
if delta.seq > lastSeq + 1 → trigger resync (gap detected)
else → apply events sequentially:
  service.upserted    → upsert by id in services[]
  service.removed     → filter out by entityId
  endpoint.upserted   → upsert by id in endpoints[]
  endpoint.removed    → filter out by entityId
  edge.upserted       → upsert by id in edges[]
  edge.removed        → filter out by entityId
  endpoint.metrics.updated → merge metrics into endpoint map
  endpoint.health.updated  → merge health into endpoint map
```

**Resync fallback**: on gap detection, `useWorldSocket` re-subscribes without resume token, forcing fresh snapshot.

**Freeze**: if `NODE_ENV !== 'production'`, `Object.freeze()` the returned state slice.

### Client model extension

`WorldEndpoint` gains optional fields:
- `metrics?: { rps: number; p50: number; p95: number; errorRate: number }`
- `health?: { status: 'healthy' | 'degraded' | 'down' }`

Stored in a separate `endpointOverlays` map in the store (keyed by entityId) to avoid mutating the base model arrays.

### KPI tracking in `useWorldSocket.ts`

Ring buffer (100 samples) tracking:
- `eventRenderLatency`: `Date.now() - Date.parse(delta.ts)` per delta
- `reconnectRecover`: time from `ws.onclose` to first `world.subscribed` after reconnect

Log p95 to console every 20 deltas. Expose via store for HUD display.

## File Plan

### New files
| File | Purpose |
|---|---|
| `src/schemas/world-delta.schema.ts` | Zod union 8 delta event types |
| `src/services/mock-delta-producer.ts` | Singleton hybrid producer |
| `client/src/types/world-delta.ts` | Client-side delta type mirrors |
| `scripts/export-json-schema.ts` | Zod-to-JSON-Schema export |
| `scripts/check-schema-sync.ts` | CI sync check |
| `docs/3d-world/schemas/world-delta-v1.json` | Exported JSON Schema |
| `tests/unit/schemas/world-delta.schema.test.ts` | Delta schema contract tests |
| `tests/unit/services/mock-delta-producer.test.ts` | Producer unit tests |
| `client/src/__tests__/world-delta-reducer.test.ts` | Reducer unit tests |

### Modified files
| File | Change |
|---|---|
| `src/schemas/world-ws.schema.ts` | `events` typed union |
| `src/ws/world-manager.ts` | `broadcastDelta()` method |
| `src/ws/world-handlers.ts` | Wire producer lifecycle |
| `src/server.ts` | Init producer singleton at boot |
| `client/src/types/world-ws.ts` | Typed delta events |
| `client/src/types/world.ts` | Endpoint overlay fields |
| `client/src/stores/world.store.ts` | `applyDelta()` + overlay map + freeze |
| `client/src/hooks/useWorldSocket.ts` | Delta handling + resync + KPI ring buffer |
| `package.json` | `export-schema` and `check-schema-sync` scripts |

## KPI Targets (exit criteria)

| KPI | Target | Measurement |
|---|---|---|
| event->render p95 | <= 300ms | `Date.now() - Date.parse(delta.ts)` over 100-sample window |
| reconnect recover | <= 2s | `ws.onclose` to `world.subscribed` timestamp |
| multi-tab stability | no crash, no duplicate state | Scenario: 3 tabs open, kill 1, reconnect 1 |
| stale socket | graceful replacement | Scenario: slow network, new tab replaces old |

## Non-scope

- M2B semantic layer (auth gate, zoning, blocked reasons)
- M2C Tron visual skin
- Real OTel data ingestion (replaced by mock producer)
- AI Builder mutations
