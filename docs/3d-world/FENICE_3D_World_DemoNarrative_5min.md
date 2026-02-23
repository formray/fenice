# FENICE 3D World
## Demo Narrative - 5 minuti (M2 Final)

Data: 2026-02-23
Target: stakeholder tecnici/prodotto
Status: Deterministic, reproducible end-to-end

## Pre-conditions

- Server running with OpenAPI loaded (at least 2 services: 1 protected, 1 public)
- Auth gate state controllable (open/closed toggle or mock)
- At least one endpoint with simulated degraded state

## 1. City Overview (30s)

1. Open wide city view (default camera).
2. "This city is your live API. Each district is a service, each building an endpoint."
3. Point out the two rings: inner ring (protected services), outer ring (public services).
4. Note the auth gate at the center (glowing octahedron).

## 2. Visual Language (45s)

1. Reference the HUD legend (top-left panel):
   - **Building colors** = HTTP method (GET blue, POST green, PUT amber, PATCH teal, DELETE red).
   - **Base ring glow** = endpoint link state (ok/degraded/blocked/unknown).
   - **Building height** = parameter complexity.
2. Toggle theme (dark/light) to show both render modes.
3. "Everything you see encodes real API metadata. No decoration, only signal."

## 3. Corridors and Auth Gate (75s)

1. Zoom toward center gate.
2. "These radial roads are corridors. They connect protected services to the auth gate."
3. Show the corridor elements:
   - **Road surface** = path from district to gate distributor ring.
   - **Center marking** = colored by worst link state of service endpoints.
   - **Flow markers** = animated spheres representing data flowing through auth.
   - **Halo glow** = at segment joints and on flow markers for depth.
4. "The gate pulses when open. All traffic to protected endpoints flows through here."
5. **Toggle gate to closed state:**
   - Corridors turn red (blocked).
   - Flow markers stop.
   - Gate dims, pulse slows.
   - "When auth is down, the city shows it instantly. Every corridor blocked."
6. **Re-open gate:**
   - Corridors restore to service link state colors.
   - Flow resumes.

## 4. Degraded Path Scenario (60s)

1. Point to a protected service with degraded endpoints.
2. "This service has high latency. The corridor marking is yellow (degraded)."
3. Show the flow markers moving slower on degraded corridors vs ok corridors.
4. Zoom to district close-up: base rings on individual buildings confirm the state.
5. "You can read system health at three scales: city-wide corridors, district markings, building rings."

## 5. Route Layers (30s)

1. Toggle route layer in HUD:
   - **City Corridors** (default): aggregated service-level view.
   - **Endpoint Debug**: per-endpoint edges for detailed inspection.
   - **Both**: overlay mode.
2. "City view for operations. Debug view for engineering. Same data, different lenses."

## 6. Forward Vision + Close (40s)

1. "M2 gives you a living, semantic city. Next:"
   - **M3 AI Builder**: describe a change in natural language, get a PR with code, tests, and audit trail.
   - The city becomes the control surface for AI-assisted development.
2. Recap:
   - System comprehension at a glance.
   - Architectural decisions informed by live state.
   - Natural bridge to AI-native development.
3. "Technology, thoughtfully."

## Checklist pre-demo

1. Client build ready (`npm run build` or `npm run dev` running).
2. OpenAPI loaded with at least 2 services (1 protected, 1 public).
3. Auth gate mock: ability to toggle open/closed.
4. At least 1 degraded endpoint simulated.
5. Camera controls tested (orbit, zoom, pan).
6. No blocking console warnings.
7. Fallback: recorded video available.
8. HUD legend visible and readable.
