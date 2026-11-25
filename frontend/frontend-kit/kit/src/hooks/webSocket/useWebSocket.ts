import { socketService, type SocketConfig } from "../../core";
import { useEffect, useState } from "react";

/**
 * Opens the shared WebSocket connection and tracks its status.
 * @param config - connection settings. Omit them to use whatever was set with
 * `configureSocket`, which falls back to ws://127.0.0.1:4000/backend.
 */
export const useWebSocket = (config?: SocketConfig) => {
  const [status, setStatus] = useState("disconnected");

  useEffect(() => {
    socketService.connect(config);

    const statusSub = socketService.status$.subscribe(setStatus);

    return () => {
      statusSub.unsubscribe();
    };
  }, [JSON.stringify(config)]);

  return {
    isConnected: status === "connected",
    status,
    url: socketService.url,
    reconnect: () => socketService.reconnect(config),
  };
};
