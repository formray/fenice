/**
 * Client-side delta event types.
 * Mirrors backend Zod schemas in src/schemas/world-delta.schema.ts.
 */

import type { WorldService, WorldEndpoint, WorldEdge } from './world';
import type { BuilderProgressPayload } from './builder';

export type HealthStatus = 'healthy' | 'degraded' | 'down';

export interface EndpointMetrics {
  rps: number;
  p50: number;
  p95: number;
  errorRate: number;
}

export interface EndpointHealth {
  status: HealthStatus;
}

// ─── Agent presence (M7) ────────────────────────────────────────────────────

export type AgentRole = 'generator' | 'reviewer' | 'tester' | 'monitor' | 'generic';

export type AgentActivityStatus = 'started' | 'completed' | 'failed';

export interface AgentConnectedPayload {
  agentId: string;
  name: string;
  role: AgentRole;
}

export interface AgentActivityPayload {
  agentId: string;
  tool: string;
  status: AgentActivityStatus;
  target?: { type: 'service' | 'endpoint'; id: string };
  durationMs?: number;
}

export type WorldDeltaEvent =
  | { type: 'service.upserted'; entityId: string; payload: WorldService }
  | { type: 'service.removed'; entityId: string }
  | { type: 'endpoint.upserted'; entityId: string; payload: WorldEndpoint }
  | { type: 'endpoint.removed'; entityId: string }
  | { type: 'edge.upserted'; entityId: string; payload: WorldEdge }
  | { type: 'edge.removed'; entityId: string }
  | { type: 'endpoint.metrics.updated'; entityId: string; payload: EndpointMetrics }
  | { type: 'endpoint.health.updated'; entityId: string; payload: EndpointHealth }
  | { type: 'builder.progress'; entityId: string; payload: BuilderProgressPayload }
  | { type: 'agent.connected'; entityId: string; payload: AgentConnectedPayload }
  | { type: 'agent.disconnected'; entityId: string }
  | { type: 'agent.activity'; entityId: string; payload: AgentActivityPayload };
