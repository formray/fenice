# FENICE 3D World
## M2 Plan - Realtime Overlay

Data: 2026-02-22
Stato: Proposed
Prerequisito: M1 Week 1 completato

## Obiettivo M2
Aggiungere overlay realtime read-only e un layer semantico navigabile (auth/public/dependency) sopra la city M1, poi applicare skin visuale Tron senza introdurre mutazioni AI.

## Sequenza di esecuzione
1. `M2A`: realtime overlay tecnico.
2. `M2B`: semantic layer (logica dominio e link states).
3. `M2C`: visual skin Tron.

## M2A - Realtime overlay tecnico
### Scope
1. `world.delta` con eventi tipizzati minimi.
2. Projection pipeline con aggregazione temporale.
3. Client apply delta incrementale e visual feedback base.
4. Reconnect/resume robusto con fallback snapshot.
5. KPI tecnici di latenza e stabilita' misurati.

### Exit criteria M2A
1. Event->render p95 <= 300ms.
2. Reconnect recover <= 2s.
3. Nessun crash client con burst delta.

## M2B - Semantic layer
### Scope
1. Definire modello semantico del mondo:
   - Node types: `service`, `endpoint`, `auth-gate`.
   - Edge types: `calls`, `auth-gated`, `public-access`.
2. Definire zone logiche:
   - Servizi pubblici fuori dal perimetro protetto.
   - Servizi protetti dietro auth gate.
3. Definire macchina a stati dei link:
   - `ok`, `degraded`, `blocked`, `unknown`.
4. Definire reason codes per stato `blocked`:
   - `auth_required_no_session`
   - `service_unhealthy`
   - `policy_denied`
5. Renderizzare in client il comportamento semantico:
   - Sessione assente -> gate auth chiuso, link dipendenti spezzati.
   - Sessione valida -> link auth-gated riattivabili se healthy.

### Exit criteria M2B
1. Scenari semantici e2e anonimo/autenticato/degraded verificati.
2. Accuracy mappatura semantica >= 95% su checklist casi target.
3. Nessuna regressione su KPI M2A.

## M2C - Tron visual skin
### Scope
1. Definire visual tokens:
   - Palette neon per stati link (`ok/degraded/blocked`).
   - Materiali emissivi per edge e gate.
   - Motion cues (pulse, flicker controllato) con fallback low-motion.
2. Riposizionare moduli in layout logico:
   - Auth come gate centrale.
   - Public services fuori dal recinto digitale.
   - Dependency clusters leggibili a colpo d'occhio.
3. Preservare leggibilita' operativa:
   - Stato semantico leggibile anche senza effetti.
   - Budget prestazioni stabile.

### Exit criteria M2C
1. FPS stabile (target >= 50 su macchina dev standard).
2. Overlay semantico sempre leggibile con e senza effetti.
3. Demo narrativa "gaming ops" eseguibile end-to-end.

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
2. Visualizzare overlay tecnico:
   - Color shift health
   - Pulse intensity per latency
   - Badge/error indicator
3. Visualizzare overlay semantico:
   - Link state `ok/degraded/blocked`
   - Auth gate lock/unlock
   - Public/private zoning
4. Gestire delta fuori ordine (ignore + fallback resync).

### Stream D - QA/Perf
1. Misurare p95 event->render.
2. Testare reconnect/resume in loop.
3. Testare carico con burst eventi.
4. Testare scenari semantici con sessione assente/presente.
5. Testare regressioni FPS dopo skin Tron.

## KPI M2
1. Event->render p95 <= 300ms (M2A).
2. Reconnect recover <= 2s (M2A).
3. Accuratezza semantic rules >= 95% sui casi target (M2B).
4. FPS >= 50 su scena demo con skin Tron (M2C).

## Deliverable
1. Protocol schema aggiornato + tests.
2. Realtime overlay tecnico (M2A) in demo.
3. Semantic contract document + scenari verificati (M2B).
4. Tron visual tokens + layout logico applicato (M2C).
5. Report KPI tecnico + semantico + rendering.

## Exit criteria
1. Tutti i test backend/client verdi.
2. Acceptance e2e M2A/M2B/M2C verde.
3. Documento decision log aggiornato con eventuali tradeoff.
