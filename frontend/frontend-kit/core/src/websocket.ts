import { webSocket } from "rxjs/webSocket";
import { filter, map, tap } from "rxjs/operators";
import { logger } from "./logger";

const BACKEND_URL = "ws://127.0.0.1:4000/backend";

logger.core.log("Connecting to WebSocket...");
logger.core.log("WebSocket URL:", BACKEND_URL);

const ws$ = webSocket({
  url: BACKEND_URL,
  deserializer: (e) => JSON.parse(e.data),
});

logger.core.log("WebSocket connected");

// Filter by topic
export const onTopic = (topic: string) =>
  ws$.pipe(
    filter((msg: any) => msg.topic === topic),
    map((msg: any) => msg.payload),
    tap((msg: any) => logger.core.log(msg)),
  );

// Send message
export const post = (topic: string, payload: any) => {
  ws$.next({ topic, payload });
};

export { ws$ };
