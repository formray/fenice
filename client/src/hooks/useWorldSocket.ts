import { useEffect, useRef, useCallback } from 'react';
import { useWorldStore } from '../stores/world.store';
import type { WorldClientMessage, WorldServerMessage } from '../types/world-ws';

const WS_RECONNECT_DELAY_MS = 3_000;
const WS_PING_INTERVAL_MS = 25_000;

export function useWorldSocket(token: string): void {
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const resumeTokenRef = useRef<string | null>(null);
  const lastSeqRef = useRef<number>(0);

  const setWorldModel = useWorldStore((s) => s.setWorldModel);
  const setConnected = useWorldStore((s) => s.setConnected);
  const setLoading = useWorldStore((s) => s.setLoading);
  const setError = useWorldStore((s) => s.setError);

  const connect = useCallback(() => {
    if (!token) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}/api/v1/world-ws?token=${encodeURIComponent(token)}`;
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      setLoading(true);

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

      pingIntervalRef.current = setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'world.ping' } satisfies WorldClientMessage));
        }
      }, WS_PING_INTERVAL_MS);
    };

    ws.onmessage = (event) => {
      const data = JSON.parse(event.data as string) as WorldServerMessage;

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
      }
    };

    ws.onclose = () => {
      setConnected(false);
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      reconnectTimeoutRef.current = setTimeout(connect, WS_RECONNECT_DELAY_MS);
    };

    ws.onerror = () => {
      setError('WebSocket connection error');
    };
  }, [token, setWorldModel, setConnected, setLoading, setError]);

  useEffect(() => {
    connect();
    return () => {
      wsRef.current?.close();
      if (pingIntervalRef.current) clearInterval(pingIntervalRef.current);
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    };
  }, [connect]);
}
