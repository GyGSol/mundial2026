import { createContext, use, useCallback, useEffect, useMemo, useRef } from 'react';
import { useWebSocket } from '../hooks/useWebSocket.js';

const RealtimeContext = createContext(null);

export function RealtimeProvider({ children }) {
  const listenersRef = useRef(new Set());
  const reconnectListenersRef = useRef(new Set());

  const subscribe = useCallback((listener) => {
    listenersRef.current.add(listener);
    return () => listenersRef.current.delete(listener);
  }, []);

  const subscribeReconnect = useCallback((listener) => {
    reconnectListenersRef.current.add(listener);
    return () => reconnectListenersRef.current.delete(listener);
  }, []);

  const handleMessage = useCallback((message) => {
    if (
      message.type === 'matches:updated' ||
      message.type === 'leaderboard:updated' ||
      message.type === 'sync:complete' ||
      message.type === 'players:updated'
    ) {
      for (const listener of listenersRef.current) {
        listener(message);
      }
    }
  }, []);

  const handleReconnect = useCallback(() => {
    for (const listener of reconnectListenersRef.current) {
      listener();
    }
  }, []);

  useWebSocket(handleMessage, { onReconnect: handleReconnect });

  const value = useMemo(
    () => ({ subscribe, subscribeReconnect }),
    [subscribe, subscribeReconnect]
  );

  return <RealtimeContext value={value}>{children}</RealtimeContext>;
}

export function useRealtimeSubscription(onMessage, onReconnect) {
  const ctx = use(RealtimeContext);
  if (!ctx) {
    throw new Error('useRealtimeSubscription must be used within RealtimeProvider');
  }

  const onMessageRef = useRef(onMessage);
  const onReconnectRef = useRef(onReconnect);
  onMessageRef.current = onMessage;
  onReconnectRef.current = onReconnect;

  useEffect(() => {
    if (!onMessage) return undefined;
    return ctx.subscribe(() => onMessageRef.current?.());
  }, [ctx, onMessage]);

  useEffect(() => {
    if (!onReconnect) return undefined;
    return ctx.subscribeReconnect(() => onReconnectRef.current?.());
  }, [ctx, onReconnect]);
}
