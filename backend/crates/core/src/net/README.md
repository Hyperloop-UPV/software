# `net` — socket transport (feature `net`)

`net` owns Tokio sockets and uses the synchronous, socket-free `protocol` codecs.
TCP is a client with one independently reconnecting connection per configured
board. It receives messages/protections and writes orders, keep-alive and faults.
UDP telemetry is **not implemented yet**; `udp::spawn` is a placeholder that panics.

Application policy, ADJ loading, logging to disk and frontend integration belong
outside this module. Transport errors and received protections never trigger a
fault automatically.

## Public API

| Entry point / type | Purpose |
| --- | --- |
| `tcp::spawn(Config, Arc<Index>, Reporter) -> Handles` | Start configured clients without waiting for connections. Requires a Tokio runtime. |
| `tcp::Config`, `BoardLink`, `Backoff::new(initial_ms, max_ms)` | Supply board addresses, local ports, timeouts, retry intervals and heartbeat period. |
| `Handles::send(OrderPacket)` | Resolve the destination from the ADJ index, validate, encode and queue an order. |
| `Handles::propagate_fault()` | Request a fault write on every currently active board session. |
| `Handles::board(BoardId)`, `BoardHandle::board()` | Read-only lookup of configured boards; presence does not mean connected. |
| `Reporter::channels(notifications, errors)` | Create bounded reporting channels and their receiving ends (`Sinks`). Both capacities must be nonzero. |
| `Notification`, `Event`, `ErrorReport`, `net::Error` | Consume lifecycle events, decoded packets and transport failures. |
| `tcp::SendError`, `Unreachable`, `tcp::Error` | Inspect send, broadcast and TCP failures. |

Connection/session helpers, raw-byte queues, direct board sends and reporter
publication methods are internal. Applications send only through `Handles` so
they cannot accidentally route an order to the wrong board.

## Usage

Load the matching ADJ outside `net`, build `Arc<Index>` from it, and resolve the
desired boards into `Config::boards`. Each `BoardLink` supplies a board ID, remote
IP/`TCP_SERVER` port and local port; local port zero lets the OS choose.
For example, use `Backoff::new(500, 5000)`, a five-second `connect_timeout`, a
two-second `write_timeout` and a one-second `keep_alive` period.

Consume **both** reporting channels concurrently with application operations:

```rust
use software_core::{
    model::OrderPacket,
    net::{tcp, Reporter},
    protocol::Index,
};
use std::sync::Arc;

async fn run(
    config: tcp::Config,
    index: Arc<Index>,
    order: OrderPacket,
) -> Result<(), Box<dyn std::error::Error>> {
    let (reporter, mut sinks) = Reporter::channels(256, 16);
    let handles = tcp::spawn(config, index, reporter);
    let application = async {
        handles.send(order).await?; // Queued, not acknowledged by firmware.
        // Call handles.propagate_fault().await only when application policy requires it.
        tokio::signal::ctrl_c().await?;
        Ok::<_, Box<dyn std::error::Error>>(())
    };
    let reporting = async {
        tokio::join!(
            async {
                while let Some(notification) = sinks.notifications.recv().await {
                    println!("{notification:?}");
                }
            },
            async {
                while let Some(report) = sinks.errors.recv().await {
                    eprintln!("{report:?}");
                }
            },
        );
    };
    let result = tokio::select! {
        result = application => result,
        () = reporting => Err(std::io::Error::other("reporting stopped").into()),
    };
    sinks.notifications.close();
    sinks.errors.close();
    drop(handles);
    result
}
```

`Notification { board, at, event }` identifies the connection's board and carries
`Connected`, `Disconnected` or `Received(Packet)`. `ErrorReport { at, error }`
contains the failure's own identity. Channels apply backpressure, not congestion
drops; there is no ordering guarantee between the two channels or across boards.

## TCP guarantees

### Connections and normal orders

- `spawn` starts one supervisor and one 64-frame order queue per distinct board
  ID. Duplicate IDs keep the first link and warn; an empty config opens nothing.
- Connections retry indefinitely with capped exponential backoff. Every successful
  connection resets the interval. Peer closure and session errors reconnect.
- `send` accepts only declared order IDs and routes through the shared, immutable
  index. `UnknownId`, `NoClient`, `Encode` and `Gone` are returned to the caller,
  not published as transport reports. Encoding validates representation, not
  application safety rules.
- Success means **queued**, not written, received or executed. A full queue waits
  without an admission timeout. Cancelling that wait discards the unqueued frame.
- Pending orders survive reconnection in FIFO order **without expiry**. Once
  dequeued, a failed or cancelled write is never automatically replayed: some
  bytes may already have reached the peer. Applications must account for stale orders.
- One writer serializes complete frames. `write_timeout` bounds each ordinary
  frame write; progress does not reset it. There is no production read timeout.
- Heartbeat is the reserved frame `01 00`. Zero `keep_alive` disables it; otherwise
  the first send waits one period and the next period starts after completion.
  Normal orders do not reset the timer; delayed heartbeats do not accumulate.

### Explicit fault broadcast

- `propagate_fault()` writes reserved bytes `00 00`, independently of the ADJ,
  through the existing session writers. All configured boards are attempted
  concurrently; offline boards fail without waiting for reconnection.
- Priority is **fault, due heartbeat, normal order**, only between complete frames.
  A separate bounded control queue avoids waiting behind normal queue admission,
  but cannot interrupt an already-started frame.
- One absolute `write_timeout` budget covers admission, waiting for a frame
  boundary and the fault write. Requests are session-scoped: expired/cancelled
  pending requests are skipped and never move to a reconnect.
- Success confirms **`write_all` completion, not firmware receipt or execution**.
  `Unreachable(Vec<BoardId>)` lists unconfirmed boards sorted by ID. Failure does
  not prove that no bytes reached firmware. An empty configuration succeeds.
- Cancelling a broadcast does not interrupt a started frame; it finishes or hits
  its original deadline. Session teardown can interrupt it and drops that connection.
- Faults do not clear normal orders or block later sends. Automatic triggers,
  once-per-incident guarding and post-fault order policy belong to the application.

### Reporting, framing and cancellation

TCP accumulates partial input and extracts complete ADJ-dependent frames. An
undecodable suffix waits for more bytes until it exceeds the 374-byte framing
limit; then `Error::Decode` is reported and the connection is reopened. EOF in a
partial frame is `Error::Read`. Only decode failures are classified as fatal by
`is_fatal()`; the application decides the response, not the transport.

Closing either Reporter consumer cancels supervisors even during idle I/O or
offline retries. Dropping `Handles` alone does **not** guarantee immediate stop
while offline. Cancellation may omit a final `Disconnected` event and discard
buffered input or an unpublished packet; queued notifications remain drainable.
Sockets use zero linger (abortive close), not a lossless-delivery guarantee.

## Tests

From `backend/`:

```sh
cargo test -p software-core --features net
```

Manual probes stay ignored in `tcp.rs`. For these three, `ADJ_DIR` and `TCP_BOARD`
are required; `TCP_LOCAL_PORT` defaults to 0 and `TCP_KEEP_ALIVE_MS` to 1000 (zero
disables heartbeat). The board IP and `TCP_SERVER` port come from the ADJ.

```sh
# Observe connections, messages and protections; no normal orders or faults.
ADJ_DIR=/path/to/adj TCP_BOARD=TEST \
cargo test -p software-core --features net manual_tcp_spawn -- --ignored --nocapture

# WARNING: sends a REAL fault once after the first Connected event.
ADJ_DIR=/path/to/adj TCP_BOARD=TEST \
cargo test -p software-core --features net manual_tcp_fault -- --ignored --nocapture

# WARNING: sends order 1001 once; inspect the test's parameter before using hardware.
ADJ_DIR=/path/to/adj TCP_BOARD=TEST \
cargo test -p software-core --features net manual_tcp_supervisor -- --ignored --nocapture
```

Use a safe test setup. These probes print both channels until Ctrl+C. The fault
probe fails on an unconfirmed write and never repeats its request on reconnect.
Verify firmware's actual fault state separately.

For a simulator, use a **private ADJ copy** with the selected board IP set to
`127.0.0.1`. If `TCP_SERVER` is 50500, start this before the probe:

```sh
nc -l 50500 | od -An -tx1 -v -w2
```

The fault probe produces `00 00` once, then heartbeats `01 00`. Restarting `nc`
should reconnect without another fault. The separate `manual_tcp_receive` test
uses the bundled fixture and loopback; its scripted peer command is in `tcp.rs`.

## Limitations

No hash exchange/handshake, explicit shutdown/join API, execution ACKs or normal
order write notifications are implemented. Physical-link loss is noticed only
when TCP detects failure; heartbeat writes are not application-level ACKs.
Implementation details and focused test contracts live in the corresponding
Rust modules, rather than defining additional public entry points here.
