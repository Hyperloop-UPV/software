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

/**
 * Service for connecting to the WebSocket server and subscribing to topics
 */
class SocketService {
  /**
   * Singleton instance that holds the WebSocket subject
   */
  private socketSource$ = new ReplaySubject<WebSocketSubject<any>>(1);

  /**
   * Subject that holds the status of the WebSocket connection.
   */
  public status$ = new BehaviorSubject<
    "connected" | "disconnected" | "connecting"
  >("disconnected");

  /**
   * Observable that emits the messages from the WebSocket server.
   */
  public messages$: Observable<any> = this.socketSource$.pipe(
    switchMap((socket) => socket),
    shareReplay(1),
  );

  /**
   * Disposable WebSocket connection object. Lives only as long as the connection is open.
   */
  private ws: WebSocketSubject<any> | null = null;

  /**
   * Connects to the WebSocket server by creating a new connection object and pushing it to `socketSource$`.
   * @param port - the port to connect to. Defaults to 4000.
   */
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

  /**
   * Cleans up the WebSocket connection by setting the connection object to null and updating the status to "disconnected".
   */
  private cleanup() {
    this.ws = null;
    this.status$.next("disconnected");
  }

  /**
   * Creates an observable that emits the messages from the WebSocket server for a given topic.
   * @param topic - the topic to subscribe to.
   * @param options - options for the observable.

   * Downsampling and throttling are supported.
   * In case of downsampling, throttling option is used as the buffering time and defaults to 100ms.
   * @returns an observable that emits the messages from the WebSocket server for a given topic.
   */
  onTopic(topic: string, options: TopicOptions = {}) {
    let pipe$ = this.messages$.pipe(
      filter((msg) => msg.topic === topic),
      map((msg) => msg.payload),
    );

    // Apply downsampling if requested
    if (options.downsample == "min-max") {
      pipe$ = pipe$.pipe(
        // Apply buffering
        bufferTime(options.throttle ?? 100),
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

    // Apply throttling if requested
    if (options.throttle) {
      pipe$ = pipe$.pipe(throttleTime(options.throttle, asyncScheduler));
    }

    return pipe$;
  }

  /**
   * Posts a message to the WebSocket server. If the connection is not established, an error is logged and the message is not sent.
   * @param topic - the topic to post to.
   * @param payload - the payload to post.
   * // TODO: reference payloads definition file
   */
  post(topic: string, payload: any) {
    if (!this.ws) {
      logger.core.error("Cannot post: Socket not connected.");
      return;
    }
    this.ws.next({ topic, payload });
  }
}

export const socketService = new SocketService();
