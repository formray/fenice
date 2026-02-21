# ADR-002 - World Gateway separato da WS chat

Data: 2026-02-21
Stato: Proposed

## Contesto
Le WS attuali coprono chat/room/ping. Il 3D world richiede fanout, ordering, resume e controllo backpressure specifici.

## Decisione
Introdurre un World Gateway dedicato, separato logicamente dal canale WS chat attuale.

## Conseguenze
Positive:
1. Isolamento failure domain.
2. Migliore scalabilita' e tuning indipendente.
3. Evoluzione protocollo senza impatti su chat.

Negative:
1. Nuovo componente da operare.
2. Maggiore superficie osservabilita' e deploy.

## Alternative considerate
1. Estendere WS chat esistenti (scartata: accoppiamento forte e rischio regressioni).
2. SSE al posto di WS (scartata: meno adatto per bidirezionalita' futura).

## Note implementative
1. Autenticazione JWT short-lived.
2. Topic/room per workspace.
3. Rate limiting dedicato connect/publish.
