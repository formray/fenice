# ADR-001 - Event Model Realtime

Data: 2026-02-21
Stato: Proposed

## Contesto
Il client 3D necessita aggiornamenti realtime consistenti, ordinabili e recuperabili dopo reconnect.

## Decisione
Adottare protocollo con:
1. Snapshot iniziale versionato.
2. Delta event con sequenza monotona (`seq`).
3. Resume token per reconnect.
4. Schema versioning esplicito (`schemaVersion`).

## Conseguenze
Positive:
1. Recovery affidabile.
2. Debug piu' semplice.
3. Compatibilita' evolutiva.

Negative:
1. Maggiore complessita' nel gateway.
2. Necessita' di idempotenza lato client.

## Alternative considerate
1. Streaming raw OTel al client (scartata: troppo rumorosa e instabile).
2. Polling periodico snapshot (scartata: latenza elevata e UX peggiore).

## Note implementative
1. Definire JSON Schema condiviso.
2. Aggiungere contract tests producer/consumer.
