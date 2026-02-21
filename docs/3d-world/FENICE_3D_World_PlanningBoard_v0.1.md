# FENICE 3D World
## Planning Board v0.1

Date: 2026-02-21
Status: Working draft

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
| M1 | Static 3D city from OpenAPI | Shared | 1-2 weeks | PLANNED | City renders all endpoints |
| M2 | Live telemetry overlay | Claude | 1-2 weeks after M1 | PLANNED | Event->render p95 <= 300ms |
| M3 | AI Builder PR-only flow | Shared | 2-3 weeks after M2 | PLANNED | Prompt->validated PR flow |
| M4 | Multi-user collaboration | Shared | post-M3 | PLANNED | Workspace isolation + presence |

## Dependency map
| ID | Dependency | Description |
|---|---|---|
| D1 | Event Contract v1 | Snapshot/delta schema approved |
| D2 | World Gateway split | Dedicated WS gateway for 3D events |
| D3 | Redis hot state | Realtime state cache for reconnect |
| D4 | M1 model mapping | OpenAPI -> world model stable |
| D5 | Security scopes | `world:read` and `world:command` policy |

## Work items
| ID | Stream | Task | Owner | ETA | Status | Depends on | Output |
|---|---|---|---|---|---|---|---|
| T01 | Product | Lock M1 scope and non-goals | Giuseppe | 2d | IN_PROGRESS | - | Approved scope note |
| T02 | Architecture | Approve ADR-001/002/003 | Shared | 2d | PLANNED | - | ADR decisions |
| T03 | Protocol | Publish World Events v1 JSON schema | Codex | 2d | PLANNED | D1 | `world-events-v1` schema |
| T04 | Backend | Build Projection Service skeleton | Claude | 3d | PLANNED | D1 | Service scaffold + tests |
| T05 | Backend | Build World Gateway WS skeleton | Claude | 2d | PLANNED | D2 | Auth WS endpoint + subscribe |
| T06 | Backend | Add resume token + seq ordering | Claude | 2d | PLANNED | T05 | Resume/catch-up flow |
| T07 | Frontend | Bootstrap React + R3F app | Codex | 2d | PLANNED | - | Running client app |
| T08 | Frontend | Implement OpenAPI -> world model parser | Codex | 3d | PLANNED | D4 | Typed parser module |
| T09 | Frontend | Render static city (buildings/edges) | Codex | 3d | PLANNED | T07,T08 | Navigable city |
| T10 | Frontend | Building details side panel | Codex | 1d | PLANNED | T09 | Endpoint metadata panel |
| T11 | Backend | Emit aggregated metrics deltas | Claude | 3d | PLANNED | T04,T06 | `endpoint.metrics.updated` |
| T12 | Integration | Client consume snapshot + delta | Shared | 2d | PLANNED | T06,T09,T11 | Live overlay |
| T13 | Security | JWT scopes + rate limits world channel | Claude | 2d | PLANNED | D5,T05 | Secure gateway policies |
| T14 | QA | Contract tests producer/consumer | Codex | 2d | PLANNED | T03,T06 | CI contract suite |
| T15 | Demo | 5-minute demo script + dry run | Shared | 1d | PLANNED | T10,T12 | Demo-ready flow |

## Current sprint proposal (next 7 days)
| Priority | Task IDs | Owner |
|---|---|---|
| P0 | T01,T02,T03 | Shared |
| P1 | T07,T08,T09 | Codex |
| P1 | T04,T05 | Claude |
| P2 | T10,T14 | Codex |

## Risks
| Risk | Impact | Mitigation | Owner | Status |
|---|---|---|---|---|
| Event flood to client | High | Projection + batching + sampling | Claude | PLANNED |
| Visual overload on big APIs | Medium | LOD/clustering in M1.5 | Codex | PLANNED |
| Scope creep before M1 demo | High | Hard gate on M1 non-goals | Giuseppe | IN_PROGRESS |

## Weekly ritual
1. 20 min planning sync (Mon)
2. 15 min async status update daily in board
3. 30 min demo/review (Fri)

## Done criteria for this board version
1. Owners accepted
2. First sprint tasks started
3. Status field updated daily
