import { WorldClientMessageSchema } from '../schemas/world-ws.schema.js';
import type { WorldModel } from '../schemas/world.schema.js';
import type { ProjectionService } from '../services/projection.service.js';
import type { WorldWsManager } from './world-manager.js';
import { decodeResumeToken, encodeResumeToken } from './world-manager.js';

function sendJson(manager: WorldWsManager, userId: string, msg: Record<string, unknown>): void {
  manager.sendTo(userId, JSON.stringify(msg));
}

function sendError(
  manager: WorldWsManager,
  userId: string,
  code: string,
  message: string,
  retryable: boolean
): void {
  sendJson(manager, userId, { type: 'world.error', code, message, retryable });
}

async function sendSnapshot(
  manager: WorldWsManager,
  projection: ProjectionService,
  userId: string,
  fetchSpec: () => Promise<WorldModel>
): Promise<void> {
  let model = projection.getCachedModel();

  if (!model) {
    try {
      model = await fetchSpec();
    } catch {
      sendError(manager, userId, 'FETCH_SPEC_FAILED', 'Failed to fetch OpenAPI spec', true);
      return;
    }
  }

  const seq = manager.nextSeq();
  const ts = new Date().toISOString();
  const resumeToken = encodeResumeToken({ userId, lastSeq: seq, ts: Date.now() });

  sendJson(manager, userId, {
    type: 'world.subscribed',
    schemaVersion: 1,
    seq,
    ts,
    mode: 'snapshot',
    resumeToken,
  });

  const snapshotSeq = manager.nextSeq();
  const snapshotMsg = {
    type: 'world.snapshot',
    schemaVersion: 1,
    seq: snapshotSeq,
    ts: new Date().toISOString(),
    data: {
      services: model.services,
      endpoints: model.endpoints,
      edges: model.edges,
    },
  };
  const snapshotData = JSON.stringify(snapshotMsg);
  manager.sendTo(userId, snapshotData);
  manager.addToBuffer(snapshotSeq, snapshotData);
  manager.markSubscribed(userId);
}

async function handleSubscribe(
  manager: WorldWsManager,
  projection: ProjectionService,
  userId: string,
  resume: { lastSeq: number; resumeToken: string } | undefined,
  fetchSpec: () => Promise<WorldModel>
): Promise<void> {
  // Try resume flow
  if (resume) {
    const tokenData = decodeResumeToken(resume.resumeToken);
    const ageMs = tokenData ? Date.now() - tokenData.ts : Number.POSITIVE_INFINITY;

    // Validate: userId match, non-future timestamp, TTL check
    if (tokenData?.userId === userId && ageMs >= 0 && ageMs <= manager.getResumeTtlMs()) {
      const buffered = manager.getBufferedMessagesFrom(resume.lastSeq + 1);
      if (buffered !== null) {
        // Resume success
        const seq = manager.nextSeq();
        const ts = new Date().toISOString();
        const newToken = encodeResumeToken({ userId, lastSeq: seq, ts: Date.now() });

        sendJson(manager, userId, {
          type: 'world.subscribed',
          schemaVersion: 1,
          seq,
          ts,
          mode: 'resume',
          resumeToken: newToken,
          fromSeq: resume.lastSeq + 1,
        });

        // Replay buffered messages
        for (const msg of buffered) {
          manager.sendTo(userId, msg.data);
        }

        manager.markSubscribed(userId);
        return;
      }
    }
    // Fall through to full snapshot
  }

  await sendSnapshot(manager, projection, userId, fetchSpec);
}

export async function handleWorldMessage(
  manager: WorldWsManager,
  projection: ProjectionService,
  userId: string,
  raw: string,
  fetchSpec: () => Promise<WorldModel>
): Promise<void> {
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    sendError(manager, userId, 'INVALID_JSON', 'Invalid JSON', false);
    return;
  }

  const result = WorldClientMessageSchema.safeParse(data);
  if (!result.success) {
    sendError(manager, userId, 'INVALID_MESSAGE', 'Invalid message format', false);
    return;
  }

  const msg = result.data;

  switch (msg.type) {
    case 'world.subscribe':
      await handleSubscribe(manager, projection, userId, msg.resume, fetchSpec);
      break;
    case 'world.ping':
      sendJson(manager, userId, { type: 'world.pong', ts: new Date().toISOString() });
      break;
  }
}
