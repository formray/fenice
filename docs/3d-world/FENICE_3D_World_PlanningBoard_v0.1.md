# FENICE 3D World
## Planning Board v0.1

Date: 2026-02-22
Status: Active

## Legend
- `PLANNED`: defined, not started
- `IN_PROGRESS`: currently active
- `BLOCKED`: waiting on dependency
- `DONE`: completed and verified

## Team
- `Giuseppe`: product direction, architecture approval, final merge decisions
- `Claude`: backend/runtime implementation
- `Codex`: docs/protocol scaffolding, integration support, QA support

## Milestones
| Milestone | Goal | Owner | ETA | Status | Gate |
|---|---|---|---|---|---|
| M1 | Static 3D city from OpenAPI | Shared | Completed | DONE | City renders all endpoints + acceptance verified |
| M2 | Live telemetry + semantic world overlay | Shared | 1-2 weeks after M1 | IN_PROGRESS | M2A done + semantic contract approved |
| M3 | AI Builder PR-only flow | Shared | 2-3 weeks after M2 | PLANNED | Prompt->validated PR flow |
| M4 | Multi-user collaboration | Shared | post-M3 | PLANNED | Workspace isolation + presence |

## M2 breakdown (agreed)
| Sub-phase | Goal | Owner | ETA | Status | Gate |
|---|---|---|---|---|---|
| M2A | Realtime technical overlay (delta stream + reconnect) | Claude | 1 week | IN_PROGRESS | Event->render p95 <= 300ms |
| M2B | Semantic layer (service graph + auth/public logic) | Shared | 3-5 days after M2A | PLANNED | Link states `ok/degraded/blocked` validated |
| M2C | Tron visual skin and cinematic UX | Shared | 3-5 days after M2B | PLANNED | Tron style applied without semantic regressions |

## Dependency map
| ID | Dependency | Description |
|---|---|---|
| D1 | Event Contract v1 | Snapshot/delta schema approved |
| D2 | World Gateway split | Dedicated WS gateway for 3D events |
| D3 | Redis hot state | Realtime state cache for reconnect |
| D4 | M1 model mapping | OpenAPI -> world model stable |
| D5 | Security scopes | `world:read` and `world:command` policy |
| D6 | Semantic rules contract | Auth/public zoning + blocked reasons |
| D7 | Visual token system | Tron color/motion/material spec with perf budget |

## Work items (active window)
| ID | Stream | Task | Owner | ETA | Status | Depends on | Output |
|---|---|---|---|---|---|---|---|
| W2-T01 | Protocol | Finalizzare delta tipizzati v1 (`metrics`,`health`) | Claude | 2d | IN_PROGRESS | D1 | Schema + contract tests |
| W2-T02 | Backend | Aggregazione + emissione `world.delta` con seq monotono | Claude | 2d | IN_PROGRESS | W2-T01 | Producer stabile |
| W2-T03 | Frontend | Reducer delta + guard out-of-order + resync fallback | Claude | 2d | IN_PROGRESS | W2-T01,W2-T02 | Overlay tecnico robusto |
| W2-T04 | Product/Arch | Definire semantic graph model (nodes/edges/zones) | Shared | 1d | PLANNED | D6 | Documento semantic contract |
| W2-T05 | Product/Arch | Definire auth gate rules + blocked reasons | Giuseppe + Codex | 1d | PLANNED | W2-T04 | Rulebook semantico |
| W2-T06 | Frontend | Render link states (`ok/degraded/blocked`) e gate feedback | Shared | 2d | PLANNED | W2-T05 | M2B visibile in client |
| W2-T07 | UX | Definire Tron visual tokens (palette, glow, motion) | Giuseppe + Codex | 1d | PLANNED | D7 | Style spec M2C |
| W2-T08 | Frontend | Applicare skin Tron a link/district/layout | Shared | 2d | PLANNED | W2-T06,W2-T07 | Esperienza Tron navigabile |
| W2-T09 | QA | E2E semantic scenarios (anon/authenticated/degraded) | Shared | 1d | PLANNED | W2-T06 | Accuracy report semantico |
| W2-T10 | Demo | Script "auth gate + public outside perimeter + neon links" | Shared | 1d | PLANNED | W2-T08,W2-T09 | Demo M2 completa |

## Current sprint proposal (next 7 days)
| Priority | Task IDs | Owner |
|---|---|---|
| P0 | W2-T01,W2-T02,W2-T03 | Claude |
| P1 | W2-T04,W2-T05,W2-T06 | Shared |
| P2 | W2-T07,W2-T08 | Shared |

## Risks
| Risk | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|
| Event flood to client | High | Projection + batching + sampling | Claude | IN_PROGRESS |
| Semantic/visual mismatch | High | Freeze semantic contract before Tron skin | Shared | IN_PROGRESS |
| Visual overload on big APIs | Medium | LOD/clustering + district grouping | Codex | PLANNED |

## Weekly ritual
1. 20 min planning sync (Mon)
2. 15 min async status update daily in board
3. 30 min demo/review (Fri)

## Done criteria for this board version
1. M1 status aligned to DONE.
2. M2A tasks running with daily status updates.
3. M2B semantic contract approved before M2C implementation.
