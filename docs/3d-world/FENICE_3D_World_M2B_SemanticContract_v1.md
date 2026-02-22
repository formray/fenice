# FENICE 3D World
## M2B Semantic Contract v1

Date: 2026-02-22
Status: Proposed (pending product approval)
Owners: Shared (Giuseppe, Claude, Codex)

## 1. Goal
Define deterministic semantic behavior for the 3D world so users can understand:
1. what is reachable now,
2. what is blocked and why,
3. which services are public vs protected,
4. how auth gate changes the topology.

This contract is the source of truth for M2B and a prerequisite for M2C (Tron skin).

## 2. Scope
1. Semantic taxonomy (nodes, edges, zones).
2. Link states (`ok`, `degraded`, `blocked`, `unknown`) and precedence.
3. Reason codes for blocked/degraded links.
4. Deterministic derivation rules from current signals.
5. Acceptance criteria for anon/authenticated/degraded scenarios.

## 3. Non-goals
1. Mutative AI actions.
2. Multiplayer presence.
3. Full auto-discovered service-to-service call graph in v1.

## 4. Input signals (available now)
1. Static model from OpenAPI snapshot:
   - `serviceId`, `path`, `method`, `hasAuth`, `edges`.
2. Realtime deltas (M2A):
   - `endpoint.metrics.updated`
   - `endpoint.health.updated`
3. Client session context:
   - JWT present/absent/expired.
4. Optional policy signal:
   - 403-like deny signal from backend/gateway (if available).

## 5. Semantic taxonomy
### 5.1 Node types
1. `service`:
   - one node per API tag/service.
2. `endpoint`:
   - one node per method+path.
3. `auth-gate`:
   - virtual gate node controlling protected paths.

### 5.2 Edge types
1. `same_service`:
   - existing structural edge inside one service.
2. `auth-gated`:
   - virtual edge used when endpoint requires auth (`hasAuth=true`).
3. `public-access`:
   - virtual edge used when endpoint is public (`hasAuth=false`).
4. `calls` (optional in v1, required later):
   - inferred dependency edge from runtime call signals.

### 5.3 Zones
1. `public-perimeter`:
   - endpoints with `hasAuth=false`.
2. `protected-core`:
   - endpoints with `hasAuth=true`.
3. `auth-hub`:
   - virtual zone containing auth gate node(s).

## 6. Link states
Allowed states:
1. `ok`
2. `degraded`
3. `blocked`
4. `unknown`

Precedence (highest first):
1. `blocked`
2. `degraded`
3. `ok`
4. `unknown`

This precedence prevents ambiguous rendering when multiple signals conflict.

## 7. Reason codes
### 7.1 Blocked reasons
1. `auth_required_no_session`
2. `auth_token_expired`
3. `policy_denied`
4. `dependency_unhealthy_hard`

### 7.2 Degraded reasons
1. `service_unhealthy_soft`
2. `latency_high`
3. `error_rate_high`

### 7.3 Unknown reason
1. `signal_missing`

## 8. Deterministic derivation rules
### 8.1 Inputs per endpoint
1. `hasAuth` from snapshot.
2. `sessionState` from client auth context:
   - `none`, `valid`, `expired`.
3. `healthState` from latest health delta:
   - `healthy`, `degraded`, `down`, `unknown`.
4. `metricsState` from latest metrics delta:
   - `normal`, `latency_high`, `error_rate_high`, `unknown`.
5. `policyState`:
   - `allow`, `deny`, `unknown`.

### 8.2 Rules (ordered)
1. If `hasAuth=true` and `sessionState=none` -> `blocked(auth_required_no_session)`.
2. If `hasAuth=true` and `sessionState=expired` -> `blocked(auth_token_expired)`.
3. If `policyState=deny` -> `blocked(policy_denied)`.
4. If `healthState=down` -> `blocked(dependency_unhealthy_hard)`.
5. If `healthState=degraded` -> `degraded(service_unhealthy_soft)`.
6. If `metricsState=latency_high` -> `degraded(latency_high)`.
7. If `metricsState=error_rate_high` -> `degraded(error_rate_high)`.
8. If core signals are missing -> `unknown(signal_missing)`.
9. Else -> `ok`.

## 9. Visual contract mapping (for M2C compatibility)
M2B defines semantic tokens; M2C maps them to style:
1. `blocked` -> broken edge rendering + hard stop gate.
2. `degraded` -> unstable pulse/warning rendering.
3. `ok` -> stable active link.
4. `unknown` -> neutral dim state.

M2C cannot redefine semantic meaning; it can only skin these tokens.

## 10. Compatibility with current implementation
Current schemas:
1. `src/schemas/world.schema.ts` (snapshot model v1).
2. `src/schemas/world-ws.schema.ts` (`world.delta.events: unknown[]`).

M2B v1 approach:
1. Keep wire protocol unchanged initially (no required breaking change).
2. Compute semantic state in client store from existing snapshot + M2A deltas + session context.
3. Introduce typed semantic events only if needed after M2A stabilization.

## 11. Suggested implementation slices
1. Slice 1:
   - add semantic selectors/reducer in client store.
2. Slice 2:
   - add auth-gate virtual nodes/edges to render graph.
3. Slice 3:
   - add deterministic link-state resolver module with unit tests.
4. Slice 4:
   - add semantic scenario e2e checks (anon/auth/degraded).

## 12. Exit criteria (M2B)
1. Semantic derivation rules implemented and test-covered.
2. Acceptance matrix green on target scenarios.
3. No regression in M2A technical KPIs.
4. Product sign-off on reason codes and zone layout.
