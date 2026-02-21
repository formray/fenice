# FENICE 3D World
## M1 - Static City da OpenAPI (Execution Checklist)

Data: 2026-02-21
Stato: Ready for execution

## 1. Obiettivo M1
Renderizzare una citta' 3D statica coerente con OpenAPI corrente, senza realtime.

## 2. Scope incluso
1. Parsing OpenAPI `GET /openapi`.
2. Mapping endpoint -> building.
3. Mapping path relations -> edges/roads.
4. Colori base per method/tag.
5. Pannello selezione entita' con metadata endpoint.

## 3. Scope escluso
1. Telemetria live.
2. AI Builder mutativo.
3. Multiplayer/presence.
4. Ottimizzazioni WASM.

## 4. Deliverable
1. App frontend 3D minimale (React + R3F).
2. Modulo `openapi-to-world-model`.
3. Layout deterministico ripetibile.
4. Documento mapping rules v1.
5. Demo video/gif breve.

## 5. Mapping rules v1
1. Service/group = district.
2. Endpoint = building.
3. HTTP method = colore building.
4. Numero parametri = altezza base normalizzata.
5. Relazioni stesse tag = edge semplificato.

## 6. Backlog tecnico
1. Bootstrap frontend scaffolding.
2. Fetch OpenAPI con caching.
3. Parser robusto path/method/schema.
4. Generatore world model typed.
5. Renderer scene + camera controls.
6. Picking/select building.
7. Side panel metadata.
8. Test unit mapping.
9. Smoke test e2e rendering.

## 7. Acceptance criteria
1. 100% endpoint OpenAPI mappati in building visibili.
2. Nessun crash con OpenAPI valida.
3. Tempo load iniziale <= 2s su progetto medio locale.
4. Camera/navigation usabile con mouse e trackpad.
5. Click building mostra path, method, summary, auth requirement.

## 8. KPI M1
1. Build generation success rate >= 99% su input OpenAPI validi.
2. p95 render init <= 1200ms su hardware target.
3. Errori runtime bloccanti = 0 in demo checklist.

## 9. Rischi M1
1. OpenAPI incompleta/irregolare.
2. Layout illeggibile su API grandi.
3. Overdraw/GPU cost su dataset estesi.

Mitigazioni:
1. Fallback defaults robusti parser.
2. LOD e clustering visivo base.
3. Limiti iniziali su numero entita' con paginazione visuale.

## 10. Done definition M1
1. Demo live funzionante end-to-end.
2. Checklist acceptance completata.
3. Decisione go/no-go per M2 (realtime overlay).
