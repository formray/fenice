# FENICE 3D World
## M2B Acceptance Matrix

Date: 2026-02-22
Status: Proposed
Depends on: `FENICE_3D_World_M2B_SemanticContract_v1.md`

## 1. Target
Validate semantic behavior for core user journeys before M2C skin rollout.

## 2. Scenarios
| ID | Session state | Endpoint auth | Health | Metrics | Policy | Expected zone | Expected link state | Expected reason |
|---|---|---|---|---|---|---|---|---|
| S01 | none | false | healthy | normal | allow | public-perimeter | ok | - |
| S02 | none | true | healthy | normal | allow | protected-core | blocked | auth_required_no_session |
| S03 | valid | true | healthy | normal | allow | protected-core | ok | - |
| S04 | expired | true | healthy | normal | allow | protected-core | blocked | auth_token_expired |
| S05 | valid | true | down | normal | allow | protected-core | blocked | dependency_unhealthy_hard |
| S06 | valid | true | degraded | normal | allow | protected-core | degraded | service_unhealthy_soft |
| S07 | valid | false | healthy | latency_high | allow | public-perimeter | degraded | latency_high |
| S08 | valid | false | healthy | error_rate_high | allow | public-perimeter | degraded | error_rate_high |
| S09 | valid | true | healthy | normal | deny | protected-core | blocked | policy_denied |
| S10 | valid | true | unknown | unknown | unknown | protected-core | unknown | signal_missing |

## 3. Gate behavior checks
1. Without session, auth gate is closed and all auth-gated links are blocked.
2. With valid session, auth gate can open but only if health/policy allow.
3. Public endpoints remain visible outside protected perimeter regardless of session.

## 4. Automation hints
1. Add deterministic resolver unit tests for all scenario rows (`S01..S10`).
2. Add e2e smoke flow:
   - boot snapshot,
   - apply synthetic deltas,
   - verify rendered state tokens.
3. Fail fast when expected reason code does not match actual state.

## 5. Exit condition
1. All scenario rows pass.
2. No flaky failures across 3 repeated runs.
3. Results logged in sprint board under W2-T09.
