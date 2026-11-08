import {
  asyncScheduler,
  BehaviorSubject,
  bufferTime,
  catchError,
  concatMap,
  EMPTY,
  filter,
  from,
  map,
  Observable,
  ReplaySubject,
  shareReplay,
  Subject,
  switchMap,
  throttleTime,
} from "rxjs";
import { webSocket, WebSocketSubject } from "rxjs/webSocket";
import { logger } from "./logger";
import { minMaxDownsample } from "./minMaxDownsample";
import { type SocketConfig, type TopicOptions } from "./types";

/**
 * Values used for every field a caller leaves out.
 */
const DEFAULT_CONFIG = {
  host: "127.0.0.1",
  port: 4000,
  path: "/backend",
  secure: false,
  heartbeatIntervalMs: 1000,
} as const;

/**
 * Builds the URL `connect` would use for a given config.
 * @param config - the connection settings. `url` wins over every other field.
 * @returns the resolved WebSocket URL.
 */
export const resolveSocketUrl = (config: SocketConfig = {}): string => {
  if (config.url) return config.url;

  const host = config.host ?? DEFAULT_CONFIG.host;
  const port = config.port ?? DEFAULT_CONFIG.port;
  const path = config.path ?? DEFAULT_CONFIG.path;
  const scheme = (config.secure ?? DEFAULT_CONFIG.secure) ? "wss" : "ws";

  return `${scheme}://${host}:${port}${path}`;
};

/**
 * Normalizes the backward-compatible `connect(port)` form into a config object.
 */
const toConfig = (options: number | SocketConfig = {}): SocketConfig =>
  typeof options === "number" ? { port: options } : options;

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
   * Subject that holds the error of the WebSocket connection.
   *
   * The idea is to emit only one error event for each error.\
   * Without this subject error gets duplicated because of shareReplay operator.
   */
  public error$ = new Subject<Error>();

  /**
   * Observable that emits the messages from the WebSocket server.
   */
  public messages$: Observable<any> = this.socketSource$.pipe(
    switchMap((socket) =>
      socket.pipe(
        catchError((err) => {
          this.error$.next(err);
          return EMPTY;
        }),
      ),
    ),
    shareReplay(1),
  );

  /**
   * Disposable WebSocket connection object. Lives only as long as the connection is open.
   */
  private ws: WebSocketSubject<any> | null = null;

  /**
   * Handle of the interval that emits the liveness heartbeat while connected.
   */
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;

  /**
   * Connection settings applied by the last `configure` or `connect` call.
   */
  private config: SocketConfig = {};

  /**
   * The URL the current or next connection targets.
   */
  get url(): string {
    return resolveSocketUrl(this.config);
  }

  /**
   * Sets the connection defaults, merging with whatever was configured before.
   * Call it once when the app boots, before anything calls `connect`.
   *
   * It does not affect an already open socket: use `reconnect` for that.
   * @param config - the connection settings to merge in.
   */
  configure(config: SocketConfig) {
    this.config = { ...this.config, ...config };
  }

  /**
   * Connects to the WebSocket server by creating a new connection object and pushing it to `socketSource$`.
   * Does nothing when a connection is already open.
   * @param options - the connection settings, or a bare port number. The number
   * form is kept for backward compatibility: `connect(4000)` is exactly
   * `connect({ port: 4000 })`. Whatever is passed is merged into the stored config.
   */
  connect(options: number | SocketConfig = {}) {
    if (this.ws) return;

    this.config = { ...this.config, ...toConfig(options) };
    const url = resolveSocketUrl(this.config);

    logger.core.log(`Connecting to WebSocket at ${url}...`);
    this.status$.next("connecting");

    this.ws = webSocket({
      url,
      deserializer: (e) => JSON.parse(e.data),
      openObserver: {
        next: () => {
          this.status$.next("connected");
          logger.core.log("WebSocket connected");
          this.startHeartbeat();
        },
      },
    });

    this.ws.subscribe({
      error: (err) => {
        logger.core.error("WebSocket Error:", err);
        this.error$.next(err);

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
   * Closes the connection, stops the heartbeat and reports "disconnected".
   * Does nothing when there is no open connection.
   */
  disconnect() {
    if (!this.ws) return;

    logger.core.log("Closing WebSocket...");
    this.ws.complete();
    this.cleanup();
  }

  /**
   * Closes the current connection and opens a new one.
   *
   * `connect` alone cannot do this: it returns early while a socket is open.
   * @param options - the connection settings to use, as in `connect`. Omit them to reuse the stored config.
   */
  reconnect(options?: number | SocketConfig) {
    this.disconnect();
    this.connect(options);
  }

  /**
   * Starts the periodic heartbeat that lets the backend detect a dead or
   * frozen GUI. The backend expects one at least every 3 seconds and treats
   * a missing heartbeat as a disconnection.
   *
   * A `heartbeatIntervalMs` of 0 disables it.
   */
  private startHeartbeat() {
    this.stopHeartbeat();

    const interval =
      this.config.heartbeatIntervalMs ?? DEFAULT_CONFIG.heartbeatIntervalMs;
    if (interval <= 0) return;

    this.heartbeatInterval = setInterval(() => {
      this.ws?.next({ topic: "connection/heartbeat", payload: {} });
    }, interval);
  }

  private stopHeartbeat() {
    if (this.heartbeatInterval !== null) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  /**
   * Cleans up the WebSocket connection by setting the connection object to null and updating the status to "disconnected".
   */
  private cleanup() {
    this.stopHeartbeat();
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

  /**
   * Subscribes to the error subject.
   * @param callback - the callback to call when an error occurs.
   * @returns a subscription to the error subject.
   */
  onError(callback: (err: Error) => void) {
    return this.error$.subscribe(callback);
  }
}

export const socketService = new SocketService();

/**
 * Sets the connection defaults on the shared `socketService`.
 * Convenience wrapper so an app can configure the socket in one line at boot.
 */
export const configureSocket = (config: SocketConfig) =>
  socketService.configure(config);
