import { Hono } from 'hono';
import type { UpgradeWebSocket, WSContext, WSMessageReceive } from 'hono/ws';
import type { WebSocket } from 'ws';
import { verifyWsToken } from '../ws/auth.js';
import { WorldWsManager } from '../ws/world-manager.js';
import type { WsConnection } from '../ws/manager.js';
import { ProjectionService } from '../services/projection.service.js';
import { handleWorldMessage } from '../ws/world-handlers.js';
import type { WorldModel } from '../schemas/world.schema.js';
import { loadEnv } from '../config/env.js';

// Lazy-init singletons — avoid running loadEnv() at import time (breaks tests)
let worldManager: WorldWsManager | null = null;
let projectionService: ProjectionService | null = null;
let jwtSecret: string | null = null;

function getJwtSecret(): string {
  if (!jwtSecret) {
    const env = loadEnv();
    jwtSecret = env.JWT_SECRET;
  }
  return jwtSecret;
}

function getWorldWsManager(): WorldWsManager {
  if (!worldManager) {
    const env = loadEnv();
    worldManager = new WorldWsManager(env.WORLD_WS_BUFFER_SIZE, env.WORLD_WS_RESUME_TTL_MS);
  }
  return worldManager;
}

function getProjectionService(): ProjectionService {
  projectionService ??= new ProjectionService();
  return projectionService;
}

/** Adapt Hono WSContext to the WsConnection interface expected by WorldWsManager. */
function toWsConnection(ws: WSContext<WebSocket>): WsConnection {
  return {
    send(data: string): void {
      ws.send(data);
    },
    close(): void {
      ws.close();
    },
    get readyState(): number {
      return ws.readyState;
    },
  };
}

/** Extract raw string from WSMessageReceive data. */
function extractRawMessage(data: WSMessageReceive): string {
  if (typeof data === 'string') {
    return data;
  }
  // For Blob and ArrayBuffer, return empty — text protocol only
  return '';
}

export function createWorldWsRouter(
  upgradeWebSocket: UpgradeWebSocket<WebSocket, { onError: (err: unknown) => void }>,
  appRef: { request: (path: string) => Response | Promise<Response> }
): Hono {
  const router = new Hono();

  router.get(
    '/world-ws',
    upgradeWebSocket((c) => {
      const token = c.req.query('token');
      if (!token) {
        return {
          onOpen(_evt: Event, ws: WSContext<WebSocket>): void {
            ws.send(
              JSON.stringify({
                type: 'world.error',
                code: 'MISSING_TOKEN',
                message: 'Missing token',
                retryable: false,
              })
            );
            ws.close(4001, 'Missing token');
          },
        };
      }

      const payload = verifyWsToken(token, getJwtSecret());
      if (!payload) {
        return {
          onOpen(_evt: Event, ws: WSContext<WebSocket>): void {
            ws.send(
              JSON.stringify({
                type: 'world.error',
                code: 'INVALID_TOKEN',
                message: 'Invalid token',
                retryable: false,
              })
            );
            ws.close(4002, 'Invalid token');
          },
        };
      }

      const userId = payload.userId;
      const mgr = getWorldWsManager();
      const projection = getProjectionService();
      let connection: WsConnection | null = null;

      const fetchSpec = async (): Promise<WorldModel> => {
        const res = await appRef.request('/openapi');
        const spec: unknown = await res.json();
        return projection.buildWorldModel(spec);
      };

      return {
        onOpen(_evt: Event, ws: WSContext<WebSocket>): void {
          connection = toWsConnection(ws);
          mgr.addConnection(userId, connection);
        },
        onMessage(evt: MessageEvent<WSMessageReceive>): void {
          if (!connection || !mgr.isCurrentConnection(userId, connection)) {
            return;
          }

          const raw = extractRawMessage(evt.data);
          if (raw) {
            void handleWorldMessage(mgr, projection, userId, raw, fetchSpec);
          }
        },
        onClose(): void {
          mgr.removeConnection(userId, connection ?? undefined);
        },
        onError(): void {
          mgr.removeConnection(userId, connection ?? undefined);
        },
      };
    })
  );

  return router;
}
