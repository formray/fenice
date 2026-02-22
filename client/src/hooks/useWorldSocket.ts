import { useEffect, useRef, useCallback } from 'react';
import { useWorldStore } from '../stores/world.store';
import type { WorldClientMessage, WorldServerMessage } from '../types/world-ws';

const WS_RECONNECT_DELAY_MS = 3_000;
const WS_PING_INTERVAL_MS = 25_000;

function hasMessageType(data: unknown): data is { type: string } {
  return typeof data === 'object' && data !== null && 'type' in data;
}

export function useWorldSocket(token: string): void {
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTokenRef = useRef<string | null>(null);
  const lastSeqRef = useRef<number>(0);
  const disposedRef = useRef(false);

  const setWorldModel = useWorldStore((s) => s.setWorldModel);
  const setConnected = useWorldStore((s) => s.setConnected);
  const setLoading = useWorldStore((s) => s.setLoading);
  const setError = useWorldStore((s) => s.setError);

  const connect = useCallback(() => {
    if (disposedRef.current) return;
    if (!token) {
      setError('Missing VITE_WS_TOKEN');
      setLoading(false);
      return;
    }

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/world-ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (disposedRef.current || wsRef.current !== ws) {
        ws.close();
        return;
      }

      setConnected(true);
      // Only show loading spinner on first connection (no data yet)
      const hasData = useWorldStore.getState().endpoints.length > 0;
      if (!hasData) setLoading(true);

      const msg: WorldClientMessage = resumeTokenRef.current
        ? {
            type: 'world.subscribe',
            resume: {
              lastSeq: lastSeqRef.current,
              resumeToken: resumeTokenRef.current,
            },
          }
        : { type: 'world.subscribe' };

      ws.send(JSON.stringify(msg));

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
      }
      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'world.ping' } satisfies WorldClientMessage));
        }
      }, WS_PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      if (disposedRef.current || wsRef.current !== ws) return;

      let parsed: unknown;
      try {
        parsed = JSON.parse(event.data as string);
      } catch {
        setError('Invalid WebSocket payload');
        return;
      }

      if (!hasMessageType(parsed)) {
        setError('Malformed WebSocket message');
        return;
      }

      const data = parsed as WorldServerMessage;

      switch (data.type) {
        case 'world.subscribed':
          if (data.resumeToken) {
            resumeTokenRef.current = data.resumeToken;
          }
          break;

        case 'world.snapshot':
          lastSeqRef.current = data.seq;
          setWorldModel(data.data, data.seq, resumeTokenRef.current);
          break;

        case 'world.delta':
          lastSeqRef.current = data.seq;
          // Delta handling is M2 scope
          break;

        case 'world.error':
          setError(`[${data.code}] ${data.message}`);
          break;

        case 'world.pong':
          // Keepalive acknowledged
          break;

        default:
          setError('Unsupported WebSocket message');
          break;
      }
    };

    ws.onclose = () => {
      const isCurrentSocket = wsRef.current === ws;
      if (!isCurrentSocket) return;

      wsRef.current = null;
      setConnected(false);
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      if (!disposedRef.current) {
        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectTimeoutRef.current = null;
          connect();
        }, WS_RECONNECT_DELAY_MS);
      }
    };

    ws.onerror = () => {
      if (disposedRef.current || wsRef.current !== ws) return;
      setError('WebSocket connection error');
    };
  }, [token, setWorldModel, setConnected, setLoading, setError]);

  useEffect(() => {
    disposedRef.current = false;
    connect();

    return () => {
      disposedRef.current = true;

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      const socket = wsRef.current;
      wsRef.current = null;
      socket?.close();
    };
  }, [connect]);
}
