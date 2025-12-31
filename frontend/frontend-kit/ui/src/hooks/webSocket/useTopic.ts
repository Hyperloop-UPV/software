import { socketService } from "@workspace/core";
import { useEffect, useRef } from "react";
import { useWebSocket } from "./useWebSocket";

export function useTopic<T>(topic: string, callback: (data: T) => void) {
  const { isConnected } = useWebSocket();

  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isConnected) return;

    console.log(`[useTopic] Subscribing to: ${topic}`);
    socketService.post(topic, { subscribe: true });

    const sub = socketService.onTopic(topic).subscribe((data: T) => {
      callbackRef.current(data);
    });

    return () => {
      console.log(`[useTopic] Unsubscribing from: ${topic}`);
      socketService.post(topic, { subscribe: false });
      sub.unsubscribe();
    };
  }, [topic, isConnected]);

  return;
}
