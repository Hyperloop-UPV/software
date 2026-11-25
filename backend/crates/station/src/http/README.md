# HTTP

Station's Axum server exposes the ADJ catalogs and accepts WebSocket upgrades
from the frontend. It does not load the ADJ or handle WebSocket messages.

## Files

| File | Responsibility |
| --- | --- |
| [`../http.rs`](../http.rs) | Server entry point, with an optional WebSocket consumer. |
| [`server.rs`](server.rs) | Router construction and HTTP and WebSocket tests. |
| [`handlers.rs`](handlers.rs) | Shared state, pre-serialized catalog responses, and WebSocket handoff. |

The server builds catalog responses from the given `Adj`. The
[HTTP models README](../../../core/src/model/http/README.md) contains the JSON examples.

## Routes

| Method | Path | Response |
| --- | --- | --- |
| GET | `/backend/adj/DataPackets` | Boards and data packet definitions, without measurement protections. |
| GET | `/backend/adj/OrderPackets` | Boards and order definitions, including parameter protections. |
| GET | `/backend/adj/ProtectionPackets` | Flat protection catalog and protection-type display metadata. |
| GET with WebSocket upgrade headers | `/backend/ws` | Upgrades the connection and hands the socket to the configured channel. |

Catalog responses return `200 OK` with `Content-Type: application/json`.

## Catalog lifecycle

When the router is built, the server:

1. Builds the three response structures from the already-loaded `Adj`.
2. Serializes each response once into `Bytes`.
3. Stores the bytes in shared `Arc<HttpState>` state.

Each request clones the relevant `Bytes` handle and sends the existing JSON
buffer. It does not rebuild the catalog, copy the whole buffer, or serialize
the response again. No application-level mutex is needed for these reads.

The catalogs represent the ADJ loaded at startup. Serialization errors are
returned before requests are served. The router sets `Cache-Control: no-cache`
and uses permissive CORS.

## Starting the server

The caller passes a bound `tokio::net::TcpListener` and an already-loaded
`&Adj` to `station::http::serve`. The listener determines the address and port.
The function runs until the server stops.

Pass `None` to serve the catalogs by themselves.

```rust
station::http::serve(listener, &adj, None).await?;
```

To enable WebSocket upgrades, pass the sender of a bounded `tokio::sync::mpsc`
channel and give its receiver to [`station::websocket::run`](../websocket/README.md).

```rust
station::http::serve(listener, &adj, Some(sender)).await?;
```

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

The WebSocket module consumes the receiver and manages each session.
If the receiver disappears during the handoff, the socket is dropped.

## Tests

Run the HTTP tests from the backend workspace root.

```sh
cargo test -p station --lib --locked http::
```

The tests cover catalog responses, cache headers, CORS, and WebSocket upgrades
over TCP. The end-to-end test checks that a protection event reaches the client
and a validated order reaches the vehicle queue.
