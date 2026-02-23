# FENICE 3D World
## Roadmap v0.2 (Execution)

Date: 2026-02-23
Owner: Shared (Giuseppe + Claude + Codex)
Status: **M2 CLOSED**

## 1) Current state

1. `M1`: DONE
   - Static city from OpenAPI shipped and validated.
2. `M2A`: DONE
   - Typed deltas + producer + reducer + resync guard integrated.
3. `M2B`: DONE
   - Semantic contract implemented (`ok/degraded/blocked/unknown`, zoning, auth gate rules).
4. `M2C`: DONE
   - Tron visual language: radial corridors, auth gate pulse/haze, HUD legend aligned to semantic contract.
5. `M2D`: DONE
   - Visual clarity hardened: radial routing algorithm (no center pile-up), halo glow, marking improvements, 8 docking guides, route layer separation.

## 2) M2 closure summary

All items resolved:

1. Stable visual language for corridors/links/gate — radial fan-out algorithm with distributor ring.
2. Central-node noise eliminated — corridors radiate outward, no overdraw at gate.
3. Route layers explicit and usable — City Corridors default, Endpoint Debug secondary, Both overlay.
4. KPI gates passed — 137/137 tests, typecheck clean, lint clean, test suite < 600ms.
5. Demo narrative shipped — deterministic 5-minute walkthrough (auth open/closed + degraded path).

## 3) Execution log

### P0 — All closed

1. `M2D-T01` Corridor rendering cleanup — **DONE**
   - Owner: Claude
   - Radial corridor algorithm replacing naive L-shaped routing. PR #73 merged.
2. `M2D-T02` Route layer separation and defaults — **DONE**
   - Owner: Claude
   - City Corridors default, toggle in HUD, clear routing text per mode.
3. `M2D-T03` KPI safety pass — **DONE**
   - Owner: Claude
   - 137/137 tests pass, typecheck clean, lint clean. No M2A/M2B regressions.

### P1 — All closed

1. `M2C-T04` Gate presentation polish — **DONE**
   - Owner: Claude
   - Pulse animation (useFrame), 8 accent/docking lines, atmospheric haze sphere.
2. `M2C-T05` Semantic legend + side panel coherence — **DONE**
   - Owner: Claude
   - HUD Corridors section, Building Guide updated, routing descriptions per mode.
3. `M2C-T06` Demo script finalization — **DONE**
   - Owner: Giuseppe + Claude
   - 5-minute walkthrough: city overview, visual language, corridors + auth gate, degraded path, route layers, forward vision.

### P2 — Next

1. `M3-T00` AI Builder pre-work
   - Owner: Shared
   - Output: prompt-to-PR boundaries and safety gates baseline

## 4) Role split (working mode)

1. Giuseppe
   - Product/creative direction, final visual acceptance, merge decision.
2. Claude
   - Three.js/R3F implementation and iteration on rendering/perf tradeoffs.
3. Codex
   - Roadmap/docs alignment, QA gates, acceptance tracking, regression control.

## 5) M2 done definition (hard gate) — ALL PASSED

1. M2A and M2B behavior unchanged and test-green. — **137/137 tests pass.**
2. M2C/M2D visual pass approved by product on canonical views. — **Radial corridors, gate polish, HUD legend shipped.**
3. Route semantics are understandable without verbal explanation. — **HUD legend self-explanatory.**
4. KPI and perf guardrails pass. — **typecheck + lint + test clean, suite < 600ms.**
5. Demo narrative reproducible end-to-end. — **DemoNarrative_5min.md updated.**

## 6) Next milestones after M2

1. `M3` AI Builder PR-only
   - Entry gate: M2 closed + stable semantic/visual contract. **ENTRY GATE MET.**
2. `M4` Multi-user collaboration
   - Entry gate: M3 prompt->PR loop reliable and auditable.
