# ADR-003 - AI Builder Safety Model

Data: 2026-02-21
Stato: Proposed

## Contesto
L'AI Builder puo' accelerare sviluppo ma introduce rischio su qualita', sicurezza e governance.

## Decisione
Applicare modello PR-only con hard quality gates:
1. Generazione patch reviewabile.
2. Esecuzione automatica lint/typecheck/test.
3. Nessun merge automatico su main.
4. Audit log completo delle azioni.

## Conseguenze
Positive:
1. Riduzione rischio regressioni.
2. Tracciabilita' completa.
3. Adozione piu' sicura in team.

Negative:
1. Meno velocita' rispetto a mutazioni dirette.
2. Maggior overhead di review.

## Alternative considerate
1. Direct-write in repo (scartata: rischio elevato).
2. Human-in-the-loop solo per cambi critici (scartata in MVP: policy complessa da applicare).

## Note implementative
1. Policy engine su scope dei comandi.
2. Template PR con risk checklist.
3. Rollback playbook per merge difettosi.
