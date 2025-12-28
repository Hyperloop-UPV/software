import { socketService } from "@workspace/core";
import { useCallback, useEffect } from "react";
import { useWebSocket } from "./useWebSocket";

export function useTopic<T>(topic: string, callback: (data: T) => void) {
  const { isConnected } = useWebSocket();
  const memoizedCallback = useCallback(callback, [callback]);

  useEffect(() => {
    if (!isConnected) return;

    socketService.post(topic, { subscribe: true });

    const sub = socketService.onTopic(topic).subscribe(memoizedCallback);

    return () => {
      socketService.post(topic, { subscribe: false });
      sub.unsubscribe();
    };
  }, [topic, isConnected]);

  return;
}
