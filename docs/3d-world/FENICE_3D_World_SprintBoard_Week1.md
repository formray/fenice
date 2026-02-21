# FENICE 3D World
## Sprint Board - Week 1

Data inizio: 2026-02-22
Data fine: 2026-02-28

## Goal sprint
Consolidare fondazioni M1: protocollo v1 approvato + city statica funzionante da OpenAPI.

## This Week (P0)
| ID | Task | Owner | ETA | Status | Dipendenze |
|---|---|---|---|---|---|
| W1-T01 | Approva ADR-001/002/003 | Shared | 1d | PLANNED | - |
| W1-T02 | Pubblica schema `world-events-v1` | Codex | 1d | PLANNED | W1-T01 |
| W1-T03 | Projection service skeleton | Claude | 2d | PLANNED | W1-T01 |
| W1-T04 | World gateway WS skeleton | Claude | 2d | PLANNED | W1-T01 |
| W1-T05 | Bootstrap client React+R3F | Codex | 1d | PLANNED | - |
| W1-T06 | Parser OpenAPI -> world model | Codex | 2d | PLANNED | W1-T05 |
| W1-T07 | Render city statica (buildings+edges) | Codex | 2d | PLANNED | W1-T06 |

## Next (P1)
| ID | Task | Owner | ETA | Status | Dipendenze |
|---|---|---|---|---|---|
| W1-T08 | Side panel dettagli endpoint | Codex | 1d | PLANNED | W1-T07 |
| W1-T09 | Resume token + seq ordering | Claude | 1d | PLANNED | W1-T04 |
| W1-T10 | Contract tests protocollo producer/consumer | Codex | 1d | PLANNED | W1-T02,W1-T09 |

## Blocked
| ID | Task | Owner | Bloccato da |
|---|---|---|---|
| W1-T11 | Demo dry run end-to-end | Shared | W1-T07,W1-T08 |

## Done
Nessuno (inizio sprint).

## Daily update template
```md
### YYYY-MM-DD
- Task: W1-TXX
- Owner: name
- Stato: IN_PROGRESS / BLOCKED / DONE
- Delta: cosa e' stato completato
- Rischio: eventuale blocker
- Next: prossimo passo
```
