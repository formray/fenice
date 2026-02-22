/**
 * Client-side WorldModel types.
 * Mirrors backend Zod schemas in src/schemas/world.schema.ts.
 */

export type HttpMethod = 'get' | 'post' | 'put' | 'patch' | 'delete' | 'options' | 'head' | 'trace';

export interface WorldService {
  id: string;
  tag: string;
  endpointCount: number;
}

export interface WorldEndpoint {
  id: string;
  serviceId: string;
  path: string;
  method: HttpMethod;
  summary: string;
  hasAuth: boolean;
  parameterCount: number;
}

export type EdgeType = 'same_service';

export interface WorldEdge {
  id: string;
  sourceId: string;
  targetId: string;
  type: EdgeType;
}

export interface WorldModel {
  services: WorldService[];
  endpoints: WorldEndpoint[];
  edges: WorldEdge[];
}
