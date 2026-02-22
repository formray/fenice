import type { WsConnection } from './manager.js';
import type { WorldModel } from '../schemas/world.schema.js';
import type { WorldDeltaEvent } from '../schemas/world-delta.schema.js';

const WS_OPEN = 1;

export interface BufferedMessage {
  seq: number;
  data: string;
}

interface WorldWsConnection {
  ws: WsConnection;
  subscribed: boolean;
}

interface ResumeTokenData {
  userId: string;
  lastSeq: number;
  ts: number;
}

// ─── Resume token helpers ───────────────────────────────────────────────────

export function encodeResumeToken(data: ResumeTokenData): string {
  return Buffer.from(JSON.stringify(data)).toString('base64');
}

export function decodeResumeToken(token: string | null | undefined): ResumeTokenData | null {
  if (!token) return null;
  try {
    const json = Buffer.from(token, 'base64').toString('utf-8');
    const parsed: unknown = JSON.parse(json);
    if (
      typeof parsed === 'object' &&
      parsed !== null &&
      'userId' in parsed &&
      'lastSeq' in parsed &&
      'ts' in parsed &&
      typeof (parsed as ResumeTokenData).userId === 'string' &&
      typeof (parsed as ResumeTokenData).lastSeq === 'number' &&
      typeof (parsed as ResumeTokenData).ts === 'number'
    ) {
      return {
        userId: (parsed as ResumeTokenData).userId,
        lastSeq: (parsed as ResumeTokenData).lastSeq,
        ts: (parsed as ResumeTokenData).ts,
      };
    }
    return null;
  } catch {
    return null;
  }
}

// ─── WorldWsManager ─────────────────────────────────────────────────────────

export class WorldWsManager {
  private readonly connections = new Map<string, WorldWsConnection>();
  private readonly buffer: BufferedMessage[] = [];
  private seq = 0;
  private currentModel: WorldModel | null = null;

  constructor(
    private readonly bufferSize: number,
    private readonly resumeTtlMs: number
  ) {}

  // ── Connections ──

  addConnection(userId: string, ws: WsConnection): void {
    // Keep one active world connection per user; close stale socket if replaced.
    const existing = this.connections.get(userId);
    if (existing && existing.ws !== ws && existing.ws.readyState === WS_OPEN) {
      existing.ws.close();
    }
    this.connections.set(userId, { ws, subscribed: false });
  }

  removeConnection(userId: string, expectedWs?: WsConnection): void {
    const conn = this.connections.get(userId);
    if (!conn) return;

    // Ignore stale close/error callbacks from an old socket.
    if (expectedWs && conn.ws !== expectedWs) {
      return;
    }

    this.connections.delete(userId);
  }

  isConnected(userId: string): boolean {
    return this.connections.has(userId);
  }

  getConnection(userId: string): WsConnection | undefined {
    return this.connections.get(userId)?.ws;
  }

  isCurrentConnection(userId: string, ws: WsConnection): boolean {
    return this.connections.get(userId)?.ws === ws;
  }

  markSubscribed(userId: string, expectedWs?: WsConnection): void {
    const conn = this.connections.get(userId);
    if (!conn) return;
    if (expectedWs && conn.ws !== expectedWs) return;
    conn.subscribed = true;
  }

  // ── World model ──

  setWorldModel(model: WorldModel): void {
    this.currentModel = model;
  }

  getWorldModel(): WorldModel | null {
    return this.currentModel;
  }

  // ── Seq ──

  nextSeq(): number {
    this.seq += 1;
    return this.seq;
  }

  getCurrentSeq(): number {
    return this.seq;
  }

  // ── Ring buffer ──

  addToBuffer(seq: number, data: string): void {
    this.buffer.push({ seq, data });
    while (this.buffer.length > this.bufferSize) {
      this.buffer.shift();
    }
  }

  /**
   * Returns buffered messages from `fromSeq` (inclusive), or null if
   * the requested seq has been evicted from the buffer.
   */
  getBufferedMessagesFrom(fromSeq: number): BufferedMessage[] | null {
    if (this.buffer.length === 0) return null;

    const oldest = this.buffer[0];
    if (!oldest || fromSeq < oldest.seq) return null;

    return this.buffer.filter((m) => m.seq >= fromSeq);
  }

  /**
   * Returns the resume TTL in ms (for token validation).
   */
  getResumeTtlMs(): number {
    return this.resumeTtlMs;
  }

  // ── Messaging ──

  sendTo(userId: string, data: string): void {
    const conn = this.connections.get(userId);
    if (conn?.ws.readyState === WS_OPEN) {
      conn.ws.send(data);
    }
  }

  broadcastToSubscribed(data: string): void {
    for (const conn of this.connections.values()) {
      if (conn.subscribed && conn.ws.readyState === WS_OPEN) {
        conn.ws.send(data);
      }
    }
  }

  broadcastDelta(events: WorldDeltaEvent[]): { seq: number; ts: string } {
    const seq = this.nextSeq();
    const ts = new Date().toISOString();
    const msg = JSON.stringify({
      type: 'world.delta',
      schemaVersion: 1,
      seq,
      ts,
      events,
    });
    this.addToBuffer(seq, msg);
    this.broadcastToSubscribed(msg);
    return { seq, ts };
  }
}
