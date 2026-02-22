import { z } from 'zod';
import { WorldServiceSchema, WorldEndpointSchema, WorldEdgeSchema } from './world.schema.js';
import { WorldDeltaEventSchema } from './world-delta.schema.js';

// ─── Client → Server messages ───────────────────────────────────────────────

const WorldSubscribeMessage = z.object({
  type: z.literal('world.subscribe'),
  resume: z
    .object({
      lastSeq: z.number().int().nonnegative(),
      resumeToken: z.string().min(1),
    })
    .optional(),
});

const WorldPingMessage = z.object({
  type: z.literal('world.ping'),
});

export const WorldClientMessageSchema = z.discriminatedUnion('type', [
  WorldSubscribeMessage,
  WorldPingMessage,
]);

export type WorldClientMessage = z.infer<typeof WorldClientMessageSchema>;

// ─── Server → Client messages ───────────────────────────────────────────────

const WorldSubscribedMessage = z.object({
  type: z.literal('world.subscribed'),
  schemaVersion: z.number().int(),
  seq: z.number().int().nonnegative(),
  ts: z.string(),
  mode: z.enum(['snapshot', 'resume']),
  resumeToken: z.string().optional(),
  fromSeq: z.number().int().nonnegative().optional(),
});

const WorldSnapshotMessage = z.object({
  type: z.literal('world.snapshot'),
  schemaVersion: z.number().int(),
  seq: z.number().int().nonnegative(),
  ts: z.string(),
  data: z.object({
    services: z.array(WorldServiceSchema),
    endpoints: z.array(WorldEndpointSchema),
    edges: z.array(WorldEdgeSchema),
  }),
});

const WorldDeltaMessage = z.object({
  type: z.literal('world.delta'),
  schemaVersion: z.number().int(),
  seq: z.number().int().nonnegative(),
  ts: z.string(),
  events: z.array(WorldDeltaEventSchema),
});

const WorldErrorMessage = z.object({
  type: z.literal('world.error'),
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
});

const WorldPongMessage = z.object({
  type: z.literal('world.pong'),
  ts: z.string(),
});

export const WorldServerMessageSchema = z.discriminatedUnion('type', [
  WorldSubscribedMessage,
  WorldSnapshotMessage,
  WorldDeltaMessage,
  WorldErrorMessage,
  WorldPongMessage,
]);

export type WorldServerMessage = z.infer<typeof WorldServerMessageSchema>;
