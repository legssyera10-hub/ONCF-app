import { useEffect, useRef } from "react";

const DEFAULT_POLL_INTERVAL_MS = 3000;
const MIN_POLL_INTERVAL_MS = 1000;

function getPollingIntervalMs() {
  const configured = Number(import.meta.env.VITE_LIVE_POLL_INTERVAL_MS);
  if (Number.isFinite(configured) && configured >= MIN_POLL_INTERVAL_MS) {
    return configured;
  }
  return DEFAULT_POLL_INTERVAL_MS;
}

export function useLiveAlerts(
  enabled: boolean,
  onMessage: () => void,
  onEvent?: (payload: Record<string, unknown>) => void
) {
  const onMessageRef = useRef(onMessage);
  const onEventRef = useRef(onEvent);

  useEffect(() => {
    onMessageRef.current = onMessage;
    onEventRef.current = onEvent;
  }, [onEvent, onMessage]);

  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (import.meta.env.VITE_DISABLE_WS === "true") {
      const refresh = () => {
        if (document.visibilityState === "hidden") {
          return;
        }
        onMessageRef.current();
      };

      const intervalId = window.setInterval(refresh, getPollingIntervalMs());
      const refreshWhenVisible = () => {
        if (document.visibilityState === "visible") {
          refresh();
        }
      };

      window.addEventListener("focus", refresh);
      document.addEventListener("visibilitychange", refreshWhenVisible);

      return () => {
        window.clearInterval(intervalId);
        window.removeEventListener("focus", refresh);
        document.removeEventListener("visibilitychange", refreshWhenVisible);
      };
    }

    const wsBase = (import.meta.env.VITE_API_URL ?? "http://localhost:8000").replace("http", "ws");
    const socket = new WebSocket(`${wsBase}/ws/alerts`);
    socket.onmessage = (event) => {
      let payload: Record<string, unknown> = {};
      try {
        payload = JSON.parse(event.data);
      } catch {
        payload = {};
      }
      onEventRef.current?.(payload);
      onMessageRef.current();
    };
    socket.onopen = () => socket.send("subscribe");

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [enabled]);
}
