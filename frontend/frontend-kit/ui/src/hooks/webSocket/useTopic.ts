import { socketService } from "@workspace/core";
import { useEffect, useState } from "react";
import { useWebSocket } from "./useWebSocket";

export function useTopic<T>(topic: string) {
  const [data, setData] = useState<T | null>(null);
  const { isConnected } = useWebSocket();

  useEffect(() => {
    if (!isConnected) return;

    socketService.post(topic, { subscribe: true });

    const sub = socketService.onTopic(topic).subscribe(setData);

    return () => {
      socketService.post(topic, { subscribe: false });
      sub.unsubscribe();
    };
  }, [topic, isConnected]);

  return data;
}
