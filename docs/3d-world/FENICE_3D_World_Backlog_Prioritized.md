# FENICE 3D World
## Backlog Prioritizzato (P0/P1/P2)

Data: 2026-02-22

## P0 (must)
1. M2A: `world.delta` tipizzato e stabile end-to-end.
2. M2A: reconnect/resume robusto con fallback snapshot.
3. M2A: KPI realtime (latency/recover) misurati e rispettati.
4. M2B: semantic contract approvato (nodes/edges/zones/link states).
5. M2B: scenario auth gate vs public services verificato in e2e.

## P1 (should)
1. M2C: Tron visual tokens (palette, glow, motion) definiti.
2. M2C: layout logico city (auth gate centrale + public outside perimeter).
3. M2C: visual cues coerenti con link states (`ok/degraded/blocked`).
4. Security scopes `world:read` / `world:command`.

## P2 (could)
1. Layout city avanzato con clustering/LOD.
2. Multiplayer presence.
3. AI Builder con proposal wizard UI.
4. Ottimizzazioni WASM per hot path.

## Regole di prioritizzazione
1. Nessun task P1 parte se impatta negativamente P0.
2. Ogni task mutativo richiede acceptance criteria misurabili.
3. Ogni P0 deve avere owner unico e ETA esplicita.
