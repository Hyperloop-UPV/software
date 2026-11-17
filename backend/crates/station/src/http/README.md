# HTTP

Station's Axum server exposes the ADJ catalogs and accepts WebSocket upgrades
from the frontend. It does not load the ADJ or handle WebSocket messages.

## Files

| File | Responsibility |
| --- | --- |
| [`../http.rs`](../http.rs) | Module entry points, with or without a WebSocket consumer. |
| [`configure.rs`](configure.rs) | Provisional HTTP configuration, validation, server preparation, and configuration tests. |
| [`server.rs`](server.rs) | Router construction, server execution, and route/WebSocket tests. |
| [`handlers.rs`](handlers.rs) | Shared state, pre-serialized catalog responses, and WebSocket handoff. |

The response models and transformations from `Adj` belong to
[`software_core::adj`](../../../core/src/adj.rs). Their JSON examples are in
[`core/src/adj/http/example`](../../../core/src/adj/http/example).

## Routes

| Method | Path | Response |
| --- | --- | --- |
| GET | `/backend/adj/DataPackets` | Boards and data packet definitions, without measurement protections. |
| GET | `/backend/adj/OrderPackets` | Boards and order definitions, including parameter protections. |
| GET | `/backend/adj/ProtectionPackets` | Flat protection catalog and protection-type display metadata. |
| GET with WebSocket upgrade headers | `/backend` | Upgrades the connection and hands the socket to the configured channel. |

Catalog responses return `200 OK` with `Content-Type: application/json`.

## Catalog lifecycle

When the router is built, the server:

1. Builds the three response structures from the already-loaded `Adj`.
2. Serializes each response once into `Bytes`.
3. Stores the bytes in shared `Arc<HttpState>` state.

Each request clones the relevant `Bytes` handle and sends the existing JSON
buffer. It does not rebuild the catalog, copy the whole buffer, or serialize
the response again. No application-level mutex is needed for these reads.

The catalogs are a snapshot of the ADJ at startup; they are not refreshed
automatically. Serialization errors are propagated before requests are served.
This in-memory reuse is separate from browser caching. `configure_server`
applies the configured `Cache-Control` policy to the catalog routes. The older
listener-based entry points do not set an explicit cache policy.

## Starting the server

The caller supplies a bound `tokio::net::TcpListener` and an already-loaded
`&Adj`. The listener determines the address and port. Both entry points are
async and run until the server stops.

Without a WebSocket consumer:

```rust
http::serve(listener, &adj).await?;
```

With a bounded `tokio::sync::mpsc::Sender<axum::extract::ws::WebSocket>` whose
receiver belongs to the future WebSocket module:

```rust
http::serve_with_websocket(listener, &adj, Some(sender)).await?;
```

Passing `None` to `serve_with_websocket` has the same behavior as `serve`.

## WebSocket handoff

The HTTP handler only performs the handshake and transfers ownership of the
socket. It does not read messages, manage clients, implement subscriptions,
broadcast telemetry, or execute orders.

Before approving an upgrade, it reserves a slot in the bounded channel:

- With an available slot, it completes the handshake (`101 Switching Protocols`
  for HTTP/1.1) and places the socket in the channel.
- Without a configured channel, with a closed receiver, or with no available
  capacity, it returns `503 Service Unavailable` instead of upgrading.
- Invalid upgrade requests are rejected by Axum's `WebSocketUpgrade` extractor.

The future WebSocket module must consume the receiver and manage each socket's
lifetime, messages, and closure. Keeping a receiver alive without reading it
does not provide a functioning WebSocket service; the queue will eventually
fill. If the receiver disappears during the handoff, the socket is dropped.

## Configuration

`HttpConfig` is defined provisionally in `configure.rs` and reexported by `http`.
It does not depend on the future application configuration module or read files
and environment variables.

| Field | Purpose |
| --- | --- |
| `bind_addr` | Explicit IP address and port to bind; port zero requests an available port. |
| `allowed_origins` | Exact HTTP(S) origins allowed by CORS; an empty list allows none. |
| `cache_policy` | Catalog policy: `NoStore`, `NoCache`, or `Unspecified`. |

`HttpConfig::new(bind_addr)` uses no allowed CORS origins and defaults to
`CachePolicy::NoStore` (`Cache-Control: no-store`). `NoCache` allows storage
but requires revalidation before reuse; `Unspecified` sets no Cache-Control
header. These policies do not affect the server's reusable JSON buffers and
are not applied to WebSocket upgrades.

The configuration path prepares the server without starting it:

```rust
let mut config = http::HttpConfig::new("127.0.0.1:8080".parse()?);
config.allowed_origins = vec!["http://localhost:9000".into()];

let (listener, router) = http::configure_server(&config, &adj, None).await?;
axum::serve(listener, router).await?;
```

`configure_server` validates origins and serializes the catalogs before binding
the listener. Invalid settings and binding errors are returned to the caller;
there is no fallback to another address or port. To enable socket handoff,
replace `None` with `Some(sender)` as described above.

CORS permits GET and HEAD from explicitly listed origins, handles preflight
requests, and does not enable credentials. Wildcards and origin URLs with
embedded credentials, paths (including a trailing slash), queries, fragments,
or invalid ports are rejected. The opaque origin `null` can be explicitly
listed for local-file clients, but it is not exclusive to Electron: other
opaque origins share it too.

CORS controls browser access to responses; it is not HTTP authentication.
WebSocket Origin validation is still not implemented and is independent of
CORS. The existing `serve` and `serve_with_websocket` entry points remain
available for the current test startup and do not apply `HttpConfig` policies.

## Manual checks

From the backend workspace root, the current `main.rs` test startup can be run
with:

```sh
cargo run -p station --locked
```

It currently loads the ADJ fixture and listens on `127.0.0.1:8080`. These are
temporary test settings, not configuration defaults. It uses `http::serve`, so
valid WebSocket upgrade requests receive `503` until a consumer is integrated.

In another terminal:

```sh
curl -i http://127.0.0.1:8080/backend/adj/DataPackets
curl -i http://127.0.0.1:8080/backend/adj/OrderPackets
curl -i http://127.0.0.1:8080/backend/adj/ProtectionPackets
```

## Tests

From the backend workspace root:

```sh
cargo test -p station http:: --locked
```

The tests cover catalog contents and repeated responses, empty catalogs,
configuration validation, binding errors, cache headers, CORS and preflight
handling, WebSocket upgrade and socket delivery over a real TCP connection,
unavailable channels (missing, closed, or full), and requests without upgrade
headers.
