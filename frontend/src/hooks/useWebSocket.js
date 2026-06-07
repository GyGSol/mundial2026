import { useCallback, useEffect, useRef } from 'react';

function getWsUrl() {
  if (import.meta.env.DEV) {
    return 'ws://localhost:5000/ws';
  }
  const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${protocol}//${window.location.host}/ws`;
}

export function useWebSocket(onMessage) {
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    let ws;
    let reconnectTimer;

    function connect() {
      ws = new WebSocket(getWsUrl());

      ws.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data);
          handlerRef.current?.(payload);
        } catch {
          // ignore malformed messages
        }
      };

      ws.onclose = () => {
        reconnectTimer = window.setTimeout(connect, 3000);
      };
    }

    connect();

    return () => {
      window.clearTimeout(reconnectTimer);
      ws?.close();
    };
  }, []);
}

export function useRealtimeRefresh(refresh) {
  const refreshRef = useRef(refresh);
  refreshRef.current = refresh;

  const handleMessage = useCallback((message) => {
    if (
      message.type === 'matches:updated' ||
      message.type === 'leaderboard:updated' ||
      message.type === 'sync:complete' ||
      message.type === 'players:updated'
    ) {
      refreshRef.current?.();
    }
  }, []);

  useWebSocket(handleMessage);
}
