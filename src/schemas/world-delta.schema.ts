import { z } from 'zod';
import { WorldServiceSchema, WorldEndpointSchema, WorldEdgeSchema } from './world.schema.js';
import { BuilderJobStatusEnum } from './builder.schema.js';

// ─── Health status (aligned M2B) ─────────────────────────────────────────────

export const HealthStatusSchema = z.enum(['healthy', 'degraded', 'down']);
export type HealthStatus = z.infer<typeof HealthStatusSchema>;

// ─── Metrics & health payloads ───────────────────────────────────────────────

export const EndpointMetricsPayloadSchema = z.object({
  rps: z.number().nonnegative(),
  p50: z.number().nonnegative(),
  p95: z.number().nonnegative(),
  errorRate: z.number().min(0).max(1),
});
export type EndpointMetricsPayload = z.infer<typeof EndpointMetricsPayloadSchema>;

export const EndpointHealthPayloadSchema = z.object({
  status: HealthStatusSchema,
});
export type EndpointHealthPayload = z.infer<typeof EndpointHealthPayloadSchema>;

// ─── Event variants ──────────────────────────────────────────────────────────

export const ServiceUpsertedEventSchema = z.object({
  type: z.literal('service.upserted'),
  entityId: z.string().min(1),
  payload: WorldServiceSchema,
});

export const ServiceRemovedEventSchema = z.object({
  type: z.literal('service.removed'),
  entityId: z.string().min(1),
});

export const EndpointUpsertedEventSchema = z.object({
  type: z.literal('endpoint.upserted'),
  entityId: z.string().min(1),
  payload: WorldEndpointSchema,
});

export const EndpointRemovedEventSchema = z.object({
  type: z.literal('endpoint.removed'),
  entityId: z.string().min(1),
});

export const EdgeUpsertedEventSchema = z.object({
  type: z.literal('edge.upserted'),
  entityId: z.string().min(1),
  payload: WorldEdgeSchema,
});

export const EdgeRemovedEventSchema = z.object({
  type: z.literal('edge.removed'),
  entityId: z.string().min(1),
});

export const EndpointMetricsUpdatedEventSchema = z.object({
  type: z.literal('endpoint.metrics.updated'),
  entityId: z.string().min(1),
  payload: EndpointMetricsPayloadSchema,
});

export const EndpointHealthUpdatedEventSchema = z.object({
  type: z.literal('endpoint.health.updated'),
  entityId: z.string().min(1),
  payload: EndpointHealthPayloadSchema,
});

// ─── Builder progress event ─────────────────────────────────────────────────

export const BuilderProgressEventSchema = z.object({
  type: z.literal('builder.progress'),
  entityId: z.string().min(1), // jobId
  payload: z.object({
    jobId: z.string().min(1),
    status: BuilderJobStatusEnum,
    message: z.string(),
    detail: z.string().optional(),
  }),
});

// ─── Agent presence events (M7) ─────────────────────────────────────────────

export const AgentRoleEnum = z.enum(['generator', 'reviewer', 'tester', 'monitor', 'generic']);
export type AgentRole = z.infer<typeof AgentRoleEnum>;

export const AgentConnectedEventSchema = z.object({
  type: z.literal('agent.connected'),
  entityId: z.string().min(1), // agentId
  payload: z.object({
    agentId: z.string().min(1),
    name: z.string().min(1),
    role: AgentRoleEnum,
  }),
});

export const AgentDisconnectedEventSchema = z.object({
  type: z.literal('agent.disconnected'),
  entityId: z.string().min(1),
});

export const AgentActivityEventSchema = z.object({
  type: z.literal('agent.activity'),
  entityId: z.string().min(1), // agentId
  payload: z.object({
    agentId: z.string().min(1),
    tool: z.string().min(1),
    status: z.enum(['started', 'completed', 'failed']),
    target: z
      .object({
        type: z.enum(['service', 'endpoint']),
        id: z.string().min(1),
      })
      .optional(),
    durationMs: z.number().nonnegative().optional(),
  }),
});

// ─── Discriminated union of all 12 event types ──────────────────────────────

export const WorldDeltaEventSchema = z.discriminatedUnion('type', [
  ServiceUpsertedEventSchema,
  ServiceRemovedEventSchema,
  EndpointUpsertedEventSchema,
  EndpointRemovedEventSchema,
  EdgeUpsertedEventSchema,
  EdgeRemovedEventSchema,
  EndpointMetricsUpdatedEventSchema,
  EndpointHealthUpdatedEventSchema,
  BuilderProgressEventSchema,
  AgentConnectedEventSchema,
  AgentDisconnectedEventSchema,
  AgentActivityEventSchema,
]);

export type WorldDeltaEvent = z.infer<typeof WorldDeltaEventSchema>;
