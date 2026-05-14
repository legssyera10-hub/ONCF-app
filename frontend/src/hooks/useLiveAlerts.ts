import { useEffect } from "react";

export function useLiveAlerts(
  enabled: boolean,
  onMessage: () => void,
  onEvent?: (payload: Record<string, unknown>) => void
) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    if (import.meta.env.VITE_DISABLE_WS === "true") {
      const intervalId = window.setInterval(onMessage, 30000);
      return () => window.clearInterval(intervalId);
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
      onEvent?.(payload);
      onMessage();
    };
    socket.onopen = () => socket.send("subscribe");

    return () => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.close();
      }
    };
  }, [enabled, onEvent, onMessage]);
}
