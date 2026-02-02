import {
  asyncScheduler,
  BehaviorSubject,
  bufferTime,
  concatMap,
  filter,
  from,
  map,
  Observable,
  ReplaySubject,
  shareReplay,
  switchMap,
  throttleTime,
} from "rxjs";
import { webSocket, WebSocketSubject } from "rxjs/webSocket";
import { logger } from "./logger";
import { minMaxDownsample } from "./minMaxDownsample";
import { type TopicOptions } from "./types";

class SocketService {
  private socketSource$ = new ReplaySubject<WebSocketSubject<any>>(1);
  public status$ = new BehaviorSubject<
    "connected" | "disconnected" | "connecting"
  >("disconnected");

  public messages$: Observable<any> = this.socketSource$.pipe(
    switchMap((socket) => socket),
    shareReplay(1),
  );

  private ws: WebSocketSubject<any> | null = null;

  connect(port: number = 4000) {
    if (this.ws) return;

    logger.core.log("Connecting to WebSocket...");
    this.status$.next("connecting");

    this.ws = webSocket({
      url: `ws://127.0.0.1:${port}/backend`,
      deserializer: (e) => JSON.parse(e.data),
      openObserver: {
        next: () => {
          this.status$.next("connected");
          logger.core.log("WebSocket connected");
        },
      },
    });

    this.ws.subscribe({
      error: (err) => {
        logger.core.error("WebSocket Error:", err);
        this.status$.next("disconnected");
        this.cleanup();
      },
      complete: () => {
        logger.core.log("WebSocket Connection Closed. Cleaning up...");
        this.cleanup();
      },
    });

    this.socketSource$.next(this.ws);
  }

  private cleanup() {
    this.ws = null;
    this.status$.next("disconnected");
  }

  onTopic(topic: string, options: TopicOptions = {}) {
    let pipe$ = this.messages$.pipe(
      filter((msg) => msg.topic === topic),
      map((msg) => msg.payload),
    );

    if (options.downsample == "min-max") {
      pipe$ = pipe$.pipe(
        bufferTime(options.throttle || 100),
        filter((buffer) => buffer.length > 0),
        concatMap((buffer) => {
          if (buffer.length <= 2) return from(buffer);

          const result = minMaxDownsample(buffer);
          logger.core.log(
            `[Downsample] ${topic}: ${buffer.length} in -> ${result.length} out`,
          );
          return from(result);
        }),
      );
    }

    if (options.throttle) {
      pipe$ = pipe$.pipe(throttleTime(options.throttle, asyncScheduler));
    }

    return pipe$;
  }

  post(topic: string, payload: any) {
    if (!this.ws) {
      logger.core.error("Cannot post: Socket not connected.");
      return;
    }
    this.ws.next({ topic, payload });
  }
}

export const socketService = new SocketService();
