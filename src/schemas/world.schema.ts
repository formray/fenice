import { z } from 'zod';

// --- World Service ---
export const WorldServiceSchema = z.object({
  id: z.string().min(1),
  tag: z.string().min(1),
  endpointCount: z.number().int().nonnegative(),
});

export type WorldService = z.infer<typeof WorldServiceSchema>;

// --- World Endpoint ---
const HttpMethod = z.enum(['get', 'post', 'put', 'patch', 'delete', 'options', 'head', 'trace']);

export const WorldEndpointSchema = z.object({
  id: z.string().min(1),
  serviceId: z.string().min(1),
  path: z.string().min(1),
  method: HttpMethod,
  summary: z.string(),
  hasAuth: z.boolean(),
  parameterCount: z.number().int().nonnegative(),
});

export type WorldEndpoint = z.infer<typeof WorldEndpointSchema>;

// --- World Edge ---
const EdgeType = z.enum(['same_service']);

export const WorldEdgeSchema = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  targetId: z.string().min(1),
  type: EdgeType,
});

export type WorldEdge = z.infer<typeof WorldEdgeSchema>;

// --- World Model ---
export const WorldModelSchema = z.object({
  schemaVersion: z.literal(1),
  generatedAt: z.iso.datetime(),
  services: z.array(WorldServiceSchema),
  endpoints: z.array(WorldEndpointSchema),
  edges: z.array(WorldEdgeSchema),
});

export type WorldModel = z.infer<typeof WorldModelSchema>;
