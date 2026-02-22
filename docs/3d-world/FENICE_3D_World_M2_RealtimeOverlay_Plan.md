# FENICE 3D World
## M2 Plan - Realtime Overlay

Data: 2026-02-22
Stato: Proposed
Prerequisito: M1 Week 1 completato

## Obiettivo M2
Aggiungere overlay realtime read-only (health, latenza, error rate, throughput) sopra la city M1 senza introdurre mutazioni AI.

## Scope
1. `world.delta` con eventi tipizzati minimi.
2. Projection pipeline con aggregazione temporale.
3. Client apply delta incrementale e visual feedback.
4. Reconnect/resume robusto con fallback snapshot.
5. KPI tecnici di latenza e stabilita' misurati.

## Non scope
1. AI Builder mutativo.
2. Multiplayer collaboration.
3. WASM optimization.

## Stream di lavoro

### Stream A - Protocollo
1. Definire `WorldDeltaEvent` v1:
   - `endpoint.metrics.updated`
   - `endpoint.health.updated`
2. Sostituire `events: unknown[]` con union Zod tipizzata.
3. Aggiornare mirror type client.

### Stream B - Backend
1. Aggiungere scheduler di aggregation nel world gateway/projection layer.
2. Emettere `world.delta` con `seq` monotono e `schemaVersion`.
3. Scrivere contract tests producer/consumer per delta tipizzati.
4. Gestire stale socket/multi-tab senza side effect.

### Stream C - Client
1. Applicare delta a store senza invalidare snapshot.
2. Visualizzare overlay:
   - Color shift health
   - Pulse intensity per latency
   - Badge/error indicator
3. Gestire delta fuori ordine (ignore + fallback resync).

### Stream D - QA/Perf
1. Misurare p95 event->render.
2. Testare reconnect/resume in loop.
3. Testare carico con burst eventi.

## KPI M2
1. Event->render p95 <= 300ms.
2. Reconnect recover <= 2s.
3. Nessuna perdita visibile stato su reconnect normale.
4. Nessun crash client con burst delta.

## Deliverable
1. Protocol schema aggiornato + tests.
2. Realtime overlay visibile in demo.
3. Report KPI con scenario test.

## Exit criteria
1. Tutti i test backend/client verdi.
2. Acceptance e2e M2 verde.
3. Documento decision log aggiornato con eventuali tradeoff.
