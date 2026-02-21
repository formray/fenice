import { Hono } from 'hono';
import type { UpgradeWebSocket, WSContext, WSMessageReceive } from 'hono/ws';
import type { WebSocket } from 'ws';
import { verifyWsToken } from '../ws/auth.js';
import { WsManager } from '../ws/manager.js';
import type { WsConnection } from '../ws/manager.js';
import { handleMessage } from '../ws/handlers.js';
import { loadEnv } from '../config/env.js';

export const manager = new WsManager();

// Lazy-init pattern: avoid running loadEnv() at import time (breaks tests)
let jwtSecret: string | null = null;

function getJwtSecret(): string {
  if (!jwtSecret) {
    const env = loadEnv();
    jwtSecret = env.JWT_SECRET;
  }
  return jwtSecret;
}

/** Adapt Hono WSContext to the WsConnection interface expected by WsManager. */
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

export function createWsRouter(
  upgradeWebSocket: UpgradeWebSocket<WebSocket, { onError: (err: unknown) => void }>
): Hono {
  const router = new Hono();

  router.get(
    '/ws',
    upgradeWebSocket((c) => {
      const token = c.req.query('token');
      if (!token) {
        return {
          onOpen(_evt: Event, ws: WSContext<WebSocket>): void {
            ws.send(JSON.stringify({ type: 'error', message: 'Missing token' }));
            ws.close(4001, 'Missing token');
          },
        };
      }

      const payload = verifyWsToken(token, getJwtSecret());
      if (!payload) {
        return {
          onOpen(_evt: Event, ws: WSContext<WebSocket>): void {
            ws.send(JSON.stringify({ type: 'error', message: 'Invalid token' }));
            ws.close(4002, 'Invalid token');
          },
        };
      }

      const userId = payload.userId;

      return {
        onOpen(_evt: Event, ws: WSContext<WebSocket>): void {
          manager.addConnection(userId, toWsConnection(ws));
          ws.send(JSON.stringify({ type: 'connected', userId }));
        },
        onMessage(evt: MessageEvent<WSMessageReceive>): void {
          const raw = extractRawMessage(evt.data);
          if (raw) {
            handleMessage(manager, userId, raw);
          }
        },
        onClose(): void {
          manager.removeConnection(userId);
        },
        onError(): void {
          manager.removeConnection(userId);
        },
      };
    })
  );

  return router;
}
