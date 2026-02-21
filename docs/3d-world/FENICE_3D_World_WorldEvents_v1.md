# FENICE 3D World
## World Events Protocol v1 (Draft)

Data: 2026-02-21
Stato: Draft operativo

## 1. Obiettivo
Definire un protocollo stabile per sincronizzare stato del mondo 3D tra backend e client.

## 2. Principi
1. Snapshot + Delta, non stream raw OTel.
2. Eventi ordinabili con sequenza monotona.
3. Client idempotente.
4. Reconnect con resume token.
5. Versioning esplicito.

## 3. Envelope comune
```json
{
  "schemaVersion": 1,
  "workspaceId": "ws_123",
  "worldVersion": 1024,
  "ts": "2026-02-21T17:00:00.000Z"
}
```

Campi:
1. `schemaVersion`: versione contratto protocollo.
2. `workspaceId`: isolamento contesto.
3. `worldVersion`: versione logica stato mondo.
4. `ts`: timestamp UTC ISO-8601.

## 4. Snapshot
Payload inviato al bootstrap o fallback reconnect.

```json
{
  "type": "world.snapshot",
  "schemaVersion": 1,
  "workspaceId": "ws_123",
  "worldVersion": 1024,
  "seq": 5000,
  "ts": "2026-02-21T17:00:00.000Z",
  "data": {
    "services": [],
    "endpoints": [],
    "edges": [],
    "metrics": {}
  }
}
```

Regole:
1. `seq` snapshot = ultima sequenza inclusa.
2. `data` e' lo stato completo consistente.

## 5. Delta events
Tipi minimi v1:
1. `service.upserted`
2. `service.removed`
3. `endpoint.upserted`
4. `endpoint.removed`
5. `edge.upserted`
6. `edge.removed`
7. `endpoint.metrics.updated`
8. `endpoint.health.updated`

Esempio:
```json
{
  "type": "endpoint.metrics.updated",
  "schemaVersion": 1,
  "workspaceId": "ws_123",
  "worldVersion": 1025,
  "seq": 5001,
  "ts": "2026-02-21T17:00:00.120Z",
  "entityId": "endpoint:user_list",
  "payload": {
    "rps": 120,
    "p50": 80,
    "p95": 180,
    "errorRate": 0.01
  }
}
```

## 6. Ordering, idempotenza, delivery
1. `seq` monotono crescente per `workspaceId`.
2. Delivery at-least-once lato gateway.
3. Client ignora eventi con `seq <= lastAppliedSeq`.
4. Su gap di sequenza, client richiede resync.

## 7. Handshake WS
Flusso minimo:
1. Client -> `world.subscribe` con JWT e `lastSeq` opzionale.
2. Server risponde:
   - delta stream se resume possibile;
   - snapshot + delta catch-up se resume non possibile.

Richiesta:
```json
{
  "type": "world.subscribe",
  "workspaceId": "ws_123",
  "resume": {
    "lastSeq": 4988,
    "resumeToken": "rt_abc"
  }
}
```

Ack:
```json
{
  "type": "world.subscribed",
  "workspaceId": "ws_123",
  "mode": "resume",
  "fromSeq": 4989
}
```

## 8. Errori protocollo
Formato:
```json
{
  "type": "world.error",
  "code": "RESUME_NOT_AVAILABLE",
  "message": "Snapshot required",
  "retryable": true
}
```

Codici minimi:
1. `UNAUTHORIZED`
2. `WORKSPACE_FORBIDDEN`
3. `INVALID_MESSAGE`
4. `RESUME_NOT_AVAILABLE`
5. `INTERNAL_ERROR`

## 9. Security
1. JWT short-lived obbligatorio.
2. Scope minimo `world:read` per subscribe.
3. Scope `world:command` per comandi mutativi futuri.
4. Rate limit su subscribe/reconnect.

## 10. Compatibilita'
1. Aggiunte backward-compatible: nuovi campi opzionali.
2. Breaking change: incremento `schemaVersion`.
3. Server supporta almeno 2 versioni vicine durante rollout.

## 11. Contract tests richiesti
1. Snapshot schema validation.
2. Delta ordering e gap detection.
3. Resume success/fallback.
4. Idempotenza client su replay duplicati.
5. Backward compatibility con vecchia versione.
