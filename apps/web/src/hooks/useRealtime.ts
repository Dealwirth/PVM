import { useEffect, useRef, useState } from 'react';
import { wsUrl } from '../lib/api.js';

export interface RealtimeMessage<T = unknown> {
  channel: string;
  payload: T;
  timestamp: string;
}

/** Subscribe to the PVM WebSocket hub and receive channel messages. */
export function useRealtime(onMessage: (msg: RealtimeMessage) => void): { connected: boolean } {
  const [connected, setConnected] = useState(false);
  const handlerRef = useRef(onMessage);
  handlerRef.current = onMessage;

  useEffect(() => {
    let socket: WebSocket | undefined;
    let retry: ReturnType<typeof setTimeout> | undefined;
    let closed = false;

    const connect = (): void => {
      socket = new WebSocket(wsUrl());
      socket.onopen = () => setConnected(true);
      socket.onclose = () => {
        setConnected(false);
        if (!closed) retry = setTimeout(connect, 3000);
      };
      socket.onerror = () => socket?.close();
      socket.onmessage = (event) => {
        try {
          handlerRef.current(JSON.parse(event.data as string) as RealtimeMessage);
        } catch {
          // ignore malformed frames
        }
      };
    };
    connect();

    return () => {
      closed = true;
      if (retry) clearTimeout(retry);
      socket?.close();
    };
  }, []);

  return { connected };
}
