# FENICE 3D World
## Mini Handoff Brief - M2 Week 2

Date: 2026-02-22
Owner: Shared (Giuseppe, Claude, Codex)
Status: Active

## Context snapshot
1. M1 is DONE and validated.
2. M2 is now split into `M2A -> M2B -> M2C`.
3. Hard rule: no M2C implementation before M2B semantic contract is approved.

## Week goal
Ship M2A technical reliability, lock M2B semantic behavior, and prepare M2C style tokens without introducing runtime regressions.

## Task split
### Claude (backend/runtime + live client path)
1. W2-T01: finalize typed delta events (`metrics`, `health`).
2. W2-T02: stable `world.delta` producer with monotonic `seq`.
3. W2-T03: client delta reducer + out-of-order guard + resync fallback.
4. Keep reconnect/resume robust under multi-tab and stale socket conditions.

### Codex (semantic design + QA harness + docs)
1. W2-T04: define semantic graph contract (node/edge/zone taxonomy).
2. W2-T05: define auth gate rules and blocked reason codes.
3. W2-T09 support: semantic e2e scenarios and acceptance checklist.
4. Keep planning docs, decision log, and backlog aligned with real status.

### Giuseppe (product decisions + final approvals)
1. Approve semantic rules for anon/authenticated/degraded flows.
2. Approve zoning model (public outside perimeter, protected behind auth gate).
3. Approve Tron visual direction and narrative priorities for M2C.
4. Final go/no-go on M2B completion before M2C rollout.

## Handshake points (Claude <-> Codex)
1. Delta payload contract freeze before reducer finalization.
2. Semantic rules freeze before Tron skin implementation.
3. Shared acceptance matrix for:
   - anonymous user (auth gate closed)
   - authenticated user (auth gate open when healthy)
   - degraded service path (link marked degraded/blocked)

## Done definition for this handoff window
1. M2A KPIs pass: event->render p95 <= 300ms, reconnect <= 2s.
2. M2B semantic checklist passes with >=95% scenario accuracy.
3. No regression in backend/client validation suite.
4. M2C starts only after explicit semantic sign-off in decision log.

## Operating rhythm
1. Daily async status in board using W2 task IDs.
2. Immediate escalation on contract mismatch (protocol or semantic rules).
3. Friday demo script includes auth gate behavior and link state narrative.
