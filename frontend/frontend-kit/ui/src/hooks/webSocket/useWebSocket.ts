import { logger, onTopic, post } from "@workspace/core";
import { useCallback, useEffect, useState } from "react";

export const useWebSocket = () => {
  const [backendConnected, setBackendConnected] = useState(false);

  const setupSubscriptions = useCallback(() => {
    post("podData/update", { subscribe: true });

    const subscription = onTopic("podData/update").subscribe((data) =>
      logger.ui.log("Processing podData/update", data),
    );

    setBackendConnected(true);

    return subscription;
  }, []);

  useEffect(() => {
    const subscription = setupSubscriptions();
    return () => {
      subscription.unsubscribe();
    };
  }, [setupSubscriptions]);

  return { backendConnected };
};
