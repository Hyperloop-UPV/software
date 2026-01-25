import { logger, socketService, TopicOptions } from "@workspace/core";
import { useEffect, useRef } from "react";
import { useWebSocket } from "./useWebSocket";

export function useTopic<T>(
  topic: string,
  callback: (data: T) => void,
  options: TopicOptions = {},
) {
  const { isConnected } = useWebSocket();

  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!isConnected) return;

    logger.testingView.log(`[useTopic] Subscribing to: ${topic}`);
    socketService.post(topic, { subscribe: true });

    const sub = socketService.onTopic(topic, options).subscribe((data: T) => {
      callbackRef.current(data);
    });

    return () => {
      logger.testingView.log(`[useTopic] Unsubscribing from: ${topic}`);
      socketService.post(topic, { subscribe: false });
      sub.unsubscribe();
    };
  }, [topic, isConnected, JSON.stringify(options)]);

  return;
}
