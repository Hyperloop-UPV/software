# `net::tcp` — reconnecting TCP clients (feature `net`)

TCP is a client with one independently reconnecting connection per configured board. It receives messages/protections and writes orders, keep-alive and faults.
It connects to each board's `TCP_SERVER` port and never listens.

Application policy, ADJ loading, logging to disk and frontend integration belong outside this module. Transport errors and received protections never trigger a fault automatically. See the [parent module](../README.md) for shared reporting types, channel semantics and the status of other transports.

For a step-by-step explanation, open [trace.html](trace.html) directly in a browser. The standalone interactive walkthrough covers send/receive paths, byte layouts, reporting, partial frames, admission failures and cancellation. It uses illustrative data and no sockets or hardware.

## Public API

| Entry point / type                                                | Purpose                                                                              |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `tcp::spawn(TcpConfig, Arc<Index>, Reporter) -> BoardClients`     | Start configured clients without waiting for connections. Requires a Tokio runtime.  |
| `tcp::TcpConfig`, `BoardLink`, `Backoff::new(initial_ms, max_ms)` | Supply board addresses, local ports, timeouts, retry intervals and heartbeat period. |
| `BoardClients::send(OrderPacket)`                                 | Resolve the destination, validate, encode and write an order to its current session.     |
| `BoardClients::broadcast_fault()`                                 | Request a fault write on every currently active board session.                       |
| `BoardClients::board(BoardId)`, `BoardHandle::board()`            | Read-only lookup of configured boards; presence does not mean connected.             |
| `tcp::SendError`, `Unreachable`, `tcp::TcpError`                     | Inspect send, broadcast and TCP failures.                                            |

Connection/session helpers, writer coordination, direct board sends and reporter publication methods are internal. Applications send only through `BoardClients` so they cannot accidentally route an order to the wrong board.

## Usage

Load the matching ADJ outside `net`, build `Arc<Index>` from it, and resolve the desired boards into `TcpConfig::boards`. Each `BoardLink` supplies a board ID, remote IP/`TCP_SERVER` port and local port; local port zero lets the OS choose. For example, use `Backoff::new(500, 5000)`, a five-second `connect_timeout`, a two-second `write_timeout` and a one-second `keep_alive` period.

`Reporter` is the cloneable handle TCP uses to publish notifications and transport errors; it does not write logs or decide how the application responds. `Reporter::channels(notifications, errors)` returns both the `Reporter` passed to `tcp::spawn` and a `Sinks` value kept by the application:

- `sinks.notifications` receives board lifecycle events and decoded packets (`Notification`).
- `sinks.errors` receives transport failures (`ErrorReport`). TCP failures are wrapped as `net::Error::Tcp(tcp::TcpError::...)`; `SendError` remains the direct result of an order send.

The two arguments set the bounded channel capacities. Consume **both** reporting channels concurrently with application operations so a full channel does not block transport reporting:

```rust
use software_core::{
    net::{tcp, Reporter},
    protocol::Index,
};
use std::sync::Arc;

async fn run(
    config: tcp::TcpConfig,
    index: Arc<Index>,
) -> Result<(), Box<dyn std::error::Error>> {
    let (reporter, mut sinks) = Reporter::channels(256, 16);
    let handles = tcp::spawn(config, index, reporter);
    let application = async {
        // For each fresh application command, call:
        // handles.send(order).await?; // Complete socket write; no firmware ACK.
        // Call handles.broadcast_fault().await only when application policy requires it.
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

`spawn` returns before connecting. Wait for the destination's `Connected` event before attempting an order. The example keeps transport/reporting alive; invoke `handles.send(order).await` when the application receives a fresh command. An immediate call after `spawn` can return `SendError::Disconnected`. A `Connected` event is an observation, not a reservation: the connection can end before a subsequent send. Handle every send result. Do not automatically retry a hardware order after a write failure or timeout: firmware may already have received some or all of it.

TCP publishes `Connected`, `Disconnected` and `Received(Packet)` through the [shared reporting channels](../README.md#reporting). Keep both consumers active to avoid blocking transport tasks on backpressure.

## Guarantees

### Connections and normal orders

- `spawn` starts one supervisor per distinct board ID. Duplicate IDs keep the first link and warn; an empty config opens nothing.
- Startup and recovery use `connection::connect()`, which retries indefinitely with capped exponential backoff. Startup attempts immediately; after session loss the supervisor waits one interval. A successful connection resets the backoff.
- `send` accepts only declared order IDs and routes through the immutable index. Encoding validates wire representation, not application safety rules.
- After encoding, a send snapshots the current session. Offline boards fail with `Disconnected`; sends never wait for a connection or move to a newer session.
- Orders, heartbeats and faults all wait for one asynchronous socket mutex. There are no priority reservations, control channels or `Busy` rejections. Tokio's mutex serves lock waiters in the order they enter its queue; concurrent API invocations are not themselves an ordering guarantee.
- `write_timeout` covers both waiting for that mutex and the complete `write_all`. Encoding and error publication are outside this budget. A zero budget sends nothing.
- Expiry or cancellation before writing starts leaves the session and any active frame untouched. Once writing starts, an error, timeout or cancellation closes the session before another frame can write. Some or all bytes may already have reached firmware; the order is never replayed.
- Waiting orders remain in their callers' futures. There is no background order queue or detached task per send. Waiting does not retain an order across reconnection; retained references to the old writer become disconnected.
- **Success means `write_all` completed**, so the local socket accepted the frame. It does not confirm firmware receipt or execution. There is no order ACK or separate successful-send event.
- Heartbeat is reserved frame `01 00`. Zero `keep_alive` disables it. Otherwise the first write waits one period, and the next period starts after the preceding attempt ends; there are no catch-up bursts. A heartbeat whose writer wait expires is skipped. A heartbeat that fails after writing begins closes the session. There is no production read timeout.

### Send results and error reporting

| Result | Meaning | Reporting |
| --- | --- | --- |
| `Ok(())` | Complete local socket write; no firmware ACK. | No sent event. |
| `UnknownId(id)` | ID absent or declared as a different packet type. | Returned only. |
| `NoClient(board)` | Destination absent from the configured boards. | Returned only. |
| `Encode { board, source }` | Invalid parameters or unrepresentable value. | Returned only. |
| `Disconnected(board)` | No current session, or the captured session ended. | `TcpError::Send`, source kind `NotConnected`. |
| `Timeout(board)` | Writer wait or frame write exceeded the shared deadline. Only expiry during writing closes the session. | `TcpError::Send`, source kind `TimedOut`. |
| `Write { board, source }` | Socket write failure; session closed. | `TcpError::Send`, original shared I/O source. |

Each transport failure is returned and published once as `TcpError::Send { board, order, source }`. The order ID is not a unique request ID. A failed normal write does not also produce a duplicate supervisor `TcpError::Write`. An unfinished write cancelled by its caller instead produces `TcpError::Write` with `Interrupted`, because there is no caller left to receive its result. Heartbeat/fault failures during writing are also reported by the supervisor.

Consume both Reporter channels concurrently. Error publication can wait for capacity after the transport attempt ends, outside `write_timeout`. A full error channel cannot cause a failed order to be sent later. There is no cross-channel ordering guarantee between errors and lifecycle notifications.

### Explicit fault broadcast

`broadcast_fault()` writes reserved bytes `00 00`, independently of the ADJ. It snapshots the configured boards' current writers and polls all attempts concurrently under one absolute `write_timeout` deadline, including each wait for its mutex. Faults use the same write path as orders and heartbeats, without priority or a separate request queue. They never interrupt an existing frame.

Disconnected boards fail immediately. Expired or cancelled waits send nothing and cannot reappear on a later session. Cancelling a fault that has started writing closes that session, just like cancelling an order. There is no detached fault write.

`Unreachable(Vec<BoardId>)` identifies unconfirmed boards sorted by ID. A failure can still mean partial or complete delivery. An empty configuration succeeds. Fault does not install a persistent order lock; automatic triggers, a fault latch and recovery policy belong to the application.

### Reporting, framing and cancellation

TCP accumulates partial input and extracts complete ADJ-dependent frames. An undecodable suffix waits for more bytes until it exceeds the 374-byte framing limit; then `TcpError::Decode` is reported and the connection is reopened. EOF in a partial frame is `TcpError::Read`. Only decode failures are classified as fatal by `is_fatal()`; the application decides the response.

Closing either Reporter consumer cancels supervisors even during idle I/O or offline retries. Dropping `BoardClients` alone does not stop them. Cancellation may omit a final `Disconnected` event and discard buffered input or an unpublished packet; queued notifications remain drainable.

Sockets use zero linger (abortive close), not a lossless-delivery guarantee. Teardown signals the writer's closure so both active and waiting operations can stop. Idle sockets drop immediately; an active write drops its socket when polled or cancelled. No operation transfers to a new connection.

### Implementation structure

| File | Responsibility |
| --- | --- |
| `tcp.rs` | Configuration and one supervisor per board. |
| `board_clients.rs` | ADJ routing and concurrent explicit fault broadcasts. |
| `board_handle.rs` | Encode, snapshot a session, send and report transport errors. |
| `connection.rs`, `supervisor.rs` | Connection attempts, backoff, reconnects and lifecycle reports. |
| `session.rs` | Register a writer and drive reading/heartbeat until the session ends. |
| `endpoint.rs` | Publish the current writer and invalidate it when its registration is dropped. |
| `writer.rs` | Shared mutex, complete-frame writes, deadlines and cancellation safety. |
| `keep_alive.rs` | Periodic heartbeat using the writer's control method. |
| `reader.rs`, `framing.rs` | Incoming message/protection decoding and publication. |

The send path is `encode → current_writer → write_order → result/report`. Each connection owns a fresh `Arc<SessionWriter<OwnedWriteHalf>>`; `Endpoint` holds only the current writer. The registration guard closes and removes it on every session exit, including cancellation while publishing `Connected`. `Endpoint::request_fault` snapshots its writer before its returned future is polled, so delayed polling cannot retarget a reconnect.

`write_order` and `write_control` share `write_frame`, which has three phases: `acquire_socket`, `FrameGuard::write_all` and `FrameGuard::finish`. Waiting owns no frame guard, so cancelling a waiter leaves the active write untouched. After acquisition, the guard closes an unfinished write before releasing the socket mutex. `finish` handles success or failure and disarms cancellation cleanup. One absolute deadline covers both waiting and writing.

`FailureReporter` selects the reporting owner: orders report through their caller, while heartbeats and faults report through the session supervisor. The writer retains the first terminal `WriteFailure`; `take_unreported_failure` returns only a failure the supervisor still needs to publish. `keep_alive` uses writer methods to observe closure and send heartbeats; it does not access the socket directly. The writer's generic `W` defaults to the real TCP write half; tests substitute deterministic partial writers.

## Tests

From `backend/`:

```sh
cargo test -p software-core --features net
```

Automated tests live in an inline `#[cfg(test)] mod tests` beside the implementation they exercise:

| Owner | Test responsibility |
| --- | --- |
| `tcp.rs`, `error.rs` | Backoff arithmetic/reset and error classification/identity. |
| `connection.rs` | Socket options, connect failures, retry timing, cancellation and error-channel backpressure. |
| `framing.rs`, `reader.rs` | Partial/coalesced frames, variable field widths, framing limits, EOF/reset and notification backpressure. |
| `board_clients.rs` | ADJ routing/validation and multi-board explicit fault delivery. |
| `board_handle.rs` | Send-result reporting, concurrent sends/faults and failed-order reporting across reconnection. |
| `session.rs`, `supervisor.rs` | Registration cancellation, session invalidation, reconnect/no-replay and consumer shutdown. |
| `endpoint.rs` | Shared order/fault registration, captured sessions, teardown and no redirection across reconnects. |
| `writer.rs` | Serialized complete/partial writes, waiting deadlines, errors and cancellation. |
| `keep_alive.rs` | Heartbeat timing, serialized writes, skipped waits and failures. |

Shared ADJ/socket/event fixtures and the controlled `AsyncWrite` fixture live in test-only [test_support.rs](test_support.rs). Scripted writer helpers are grouped in its inline `writes` module. All fixtures are compiled only for tests. The `send` and `broadcast_fault` entry points are unchanged; `SendError::Busy` has been removed because sends now wait for writer availability. Files are split at responsibility boundaries, with line count a review signal rather than a hard limit. Manual probes stay ignored in [manual_tests.rs](manual_tests.rs).

Run a focused group with a Cargo name filter, for example:

```sh
cargo test -p software-core --features net net::tcp::writer::tests
cargo test -p software-core --features net net::tcp::connection::tests
cargo test -p software-core --features net net::tcp::board_clients::tests
```

For these three, `ADJ_DIR` and `TCP_BOARD` are required; `TCP_LOCAL_PORT` defaults to 0 and `TCP_KEEP_ALIVE_MS` to 1000 (zero disables heartbeat). The board IP and `TCP_SERVER` port come from the ADJ.

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

Use a safe test setup. These probes print both channels until Ctrl+C. The fault probe fails on an unconfirmed write and never repeats its request on reconnect. Verify firmware's actual fault state separately.

For a simulator, use a **private ADJ copy** with the selected board IP set to `127.0.0.1`. If `TCP_SERVER` is 50500, start this before the probe:

```sh
nc -l 50500 | od -An -tx1 -v -w2
```

The receive-only probe also uses connection retries and consumes both report channels; its 30-second overall deadline includes connection/backoff and reading. The fault probe produces `00 00` once, then heartbeats `01 00`. Restarting `nc` should reconnect without another fault. The separate `manual_tcp_receive` test uses the bundled fixture and loopback; its scripted peer command is in [manual_tests.rs](manual_tests.rs).

## Limitations

No hash exchange/handshake, explicit shutdown/join API, order ACKs or successful-order write notifications are implemented. The send result itself confirms the normal write. Physical-link loss is noticed only when TCP detects failure; heartbeat writes are not application-level ACKs.

Implementation details and focused test contracts live in the corresponding Rust modules, rather than defining additional public entry points here.
