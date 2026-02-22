# FENICE 3D World
## Decision Log

## 2026-02-21
1. Decisione: MVP senza WASM.
   - Razionale: ridurre complessita' e accelerare rilascio M1.
   - Impatto: WASM valutato dopo KPI reali.

2. Decisione: protocollo Snapshot/Delta versionato.
   - Razionale: ordering, reconnect, compatibilita'.
   - Impatto: necessita' schema e contract tests.

3. Decisione: World Gateway separato dal WS chat channel.
   - Razionale: isolamento failure domain e scalabilita'.
   - Impatto: nuovo componente runtime.

4. Decisione: AI Builder in modalita' PR-only.
   - Razionale: sicurezza e governance del codice.
   - Impatto: nessun write diretto su main.

5. Decisione: Approvazione ADR-001, ADR-002, ADR-003.
   - Razionale: tutti e tre solidi, nessuna modifica richiesta.
   - Impatto: sblocca task W1-T01 e tutte le dipendenze M1.
   - Owner: Giuseppe

## 2026-02-22
1. Decisione: M1 dichiarata completata.
   - Razionale: sprint Week 1 chiuso 11/11 con acceptance criteria verificati.
   - Impatto: apertura ufficiale della milestone M2.
   - Owner: Giuseppe

2. Decisione: M2 divisa in tre sotto-fasi sequenziali (`M2A -> M2B -> M2C`).
   - Razionale: ridurre rischio scope creep separando tecnica, semantica e visual.
   - Impatto: planning board e piano M2 riallineati su fasi esplicite.
   - Owner: Shared

3. Decisione: semantic layer prima della skin Tron.
   - Razionale: la leggibilita' operativa deve dipendere dalle regole di dominio, non dall'estetica.
   - Impatto: M2C puo' partire solo dopo approvazione semantic contract M2B.
   - Owner: Giuseppe

4. Decisione: pubblicare draft operativo M2B semantic contract + acceptance matrix.
   - Razionale: sbloccare implementazione Claude con regole deterministiche condivise.
   - Impatto: task W2-T04/W2-T05/W2-T09 passano in IN_PROGRESS in attesa approvazione prodotto.
   - Owner: Shared

5. Decisione: soglie metriche M2B.
   - Valori default: p95 > 500ms = latency_high, errorRate > 0.05 (5%) = error_rate_high.
   - Configurabili via MetricsClassifierConfig.
   - Metriche producono solo stato `degraded`, mai `blocked`.
   - Owner: Giuseppe (approvato)

6. Decisione: anti-flap metriche.
   - Ring buffer 3 campioni per endpoint.
   - Ingresso e uscita dallo stato richiedono 3 campioni consecutivi sopra/sotto soglia.
   - Precedenza: error_rate_high > latency_high.
   - Owner: Giuseppe (approvato)

7. Decisione: policyState default `allow`.
   - Nessun segnale deny reale disponibile in M2B.
   - Sara' integrato quando gateway fornisce 403/deny signals.
   - Owner: Shared

## Template nuova decisione
```md
## YYYY-MM-DD
1. Decisione: ...
   - Razionale: ...
   - Impatto: ...
   - Owner: ...
   - Revisione prevista: ...
```
