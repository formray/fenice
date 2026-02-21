# FENICE 3D World
## Master Pack v1 (Consolidato)

Data: 2026-02-21
Stato: Baseline operativa condivisa

## 1. Direzione
FENICE 3D World e' la rappresentazione operativa del backend come citta' interattiva: topologia API, segnali runtime, decisioni evolutive guidate da AI in modalita' sicura (PR-first).

## 2. Architettura raccomandata
1. Frontend: React + TypeScript + React Three Fiber.
2. Runtime pipeline: OpenTelemetry -> Projection Service -> World Gateway WS -> Client 3D.
3. Stato realtime: Redis come hot state store.
4. AI Builder: orchestrazione patch + test + PR (no write diretto su main).

## 3. Decisioni architetturali bloccanti
1. Protocollo eventi con Snapshot/Delta versionati.
2. World Gateway separato da WS chat gia' esistenti.
3. Safety model AI Builder: PR-only + quality gates obbligatori.

## 4. Milestone
1. M1: Static city da OpenAPI.
2. M2: Live telemetry overlay read-only.
3. M3: AI Builder PR-only.
4. M4: collaborazione multiutente.
5. M5: ottimizzazioni avanzate (eventuale WASM, solo se necessario).

## 5. KPI minimi
1. Event -> render p95 <= 300ms (M2).
2. Reconnect + recover p95 <= 2s.
3. FPS desktop p95 >= 50.
4. Time-to-understand architettura API < 2 minuti.

## 6. Rischi principali
1. Flood eventi e saturazione client.
2. Drift tra stato reale backend e mondo 3D.
3. Scope creep prima di chiudere M1.

Mitigazioni:
1. Projection + sampling + batching.
2. Snapshot periodici + reconciliation.
3. Hard gate su non-obiettivi M1.

## 7. Piano esecuzione immediato
1. Approvare ADR-001/002/003.
2. Pubblicare JSON schema protocollo world events.
3. Implementare parser OpenAPI -> world model.
4. Render city M1 + pannello dettagli endpoint.
5. Preparare demo narrativa 5 minuti.

## 8. Ruoli operativi
1. Giuseppe: product scope, decisioni finali, merge policy.
2. Claude: backend projection/gateway/security.
3. Codex: documentazione tecnica, protocol scaffolding, supporto integrazione/QA.

## 9. Definition of Done (fase corrente)
1. M1 demo pronta e stabile.
2. Protocol v1 approvato e testato con contract tests.
3. Sprint board in avanzamento con task P0 attivi.
