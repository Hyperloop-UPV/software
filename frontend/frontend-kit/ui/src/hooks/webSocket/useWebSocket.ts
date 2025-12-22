import { logger, socketService } from "@workspace/core";
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

  useEffect(() => {
    socketService.post("podData/update", { subscribe: true });
    let dataSub: any;

    if (status === "connected") {
      // Tell the backend we want data updates
      socketService.post("podData/update", { subscribe: true });

      dataSub = socketService
        .onTopic("podData/update")
        .subscribe((data) => logger.ui.log("Processing podData/update", data));
    }
    return () => {
      if (dataSub) dataSub.unsubscribe();
    };
  }, [status]);

  return {
    isConnected: status === "connected",
    status,
    reconnect: () => socketService.connect(),
  };
};
