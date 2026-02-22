/**
 * Client-side WS protocol message types.
 * Mirrors backend Zod schemas in src/schemas/world-ws.schema.ts.
 */

import type { WorldModel } from './world';

// ─── Client → Server messages ───────────────────────────────────────────────

export type WorldClientMessage =
  | {
      type: 'world.subscribe';
      resume?: { lastSeq: number; resumeToken: string } | undefined;
    }
  | { type: 'world.ping' };

// ─── Server → Client messages ───────────────────────────────────────────────

export type WorldSubscribedMessage = {
  type: 'world.subscribed';
  schemaVersion: number;
  seq: number;
  ts: string;
  mode: 'snapshot' | 'resume';
  resumeToken?: string | undefined;
  fromSeq?: number | undefined;
};

export type WorldSnapshotMessage = {
  type: 'world.snapshot';
  schemaVersion: number;
  seq: number;
  ts: string;
  data: WorldModel;
};

export type WorldDeltaMessage = {
  type: 'world.delta';
  schemaVersion: number;
  seq: number;
  ts: string;
  events: unknown[];
};

export type WorldErrorMessage = {
  type: 'world.error';
  code: string;
  message: string;
  retryable: boolean;
};

export type WorldPongMessage = {
  type: 'world.pong';
  ts: string;
};

export type WorldServerMessage =
  | WorldSubscribedMessage
  | WorldSnapshotMessage
  | WorldDeltaMessage
  | WorldErrorMessage
  | WorldPongMessage;
