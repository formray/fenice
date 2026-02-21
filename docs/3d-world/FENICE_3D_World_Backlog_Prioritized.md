# FENICE 3D World
## Backlog Prioritizzato (P0/P1/P2)

Data: 2026-02-21

## P0 (must)
1. World Events Protocol v1 approvato.
2. World Gateway separato da WS chat.
3. OpenAPI -> world model parser stabile.
4. Rendering M1 city statica.
5. Demo 5 minuti eseguibile senza crash.

## P1 (should)
1. Overlay metriche base (rps/p95/error rate) read-only.
2. Resume/reconnect robusto.
3. Contract tests end-to-end protocollo.
4. Security scopes `world:read` / `world:command`.

## P2 (could)
1. Layout city avanzato con clustering.
2. Multiplayer presence.
3. AI Builder con proposal wizard UI.
4. Ottimizzazioni WASM per hot path.

## Regole di prioritizzazione
1. Nessun task P1 parte se impatta negativamente P0.
2. Ogni task mutativo richiede acceptance criteria misurabili.
3. Ogni P0 deve avere owner unico e ETA esplicita.
