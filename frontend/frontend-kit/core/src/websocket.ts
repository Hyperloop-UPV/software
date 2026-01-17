import {
  asyncScheduler,
  BehaviorSubject,
  filter,
  map,
  Observable,
  ReplaySubject,
  shareReplay,
  switchMap,
  throttleTime,
} from "rxjs";
import { webSocket, WebSocketSubject } from "rxjs/webSocket";
import { logger } from "./logger";

const BACKEND_URL = "ws://127.0.0.1:4000/backend";

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

  connect() {
    if (this.ws) return;

    logger.core.log("Connecting to WebSocket...");
    this.status$.next("connecting");

    this.ws = webSocket({
      url: BACKEND_URL,
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

  onTopic(topic: string) {
    return this.messages$.pipe(
      filter((msg) => msg.topic === topic),
      map((msg) => msg.payload),
      throttleTime(80, asyncScheduler),
    );
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
