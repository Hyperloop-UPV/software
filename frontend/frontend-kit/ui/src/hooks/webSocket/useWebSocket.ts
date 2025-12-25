import { socketService } from "@workspace/core";
import { useEffect, useState } from "react";

export const useWebSocket = () => {
  const [status, setStatus] = useState("disconnected");

  useEffect(() => {
    socketService.connect();

    const statusSub = socketService.status$.subscribe(setStatus);

    return () => {
      statusSub.unsubscribe();
    };
  }, []);

  return {
    isConnected: status === "connected",
    status,
    reconnect: () => socketService.connect(),
  };
};
