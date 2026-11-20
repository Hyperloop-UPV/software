# `net` — socket transport (feature `net`)

`net` owns Tokio sockets and uses the synchronous, socket-free `protocol` codecs.
The parent module opens no sockets itself: it exposes transports and defines
their shared reporting types and errors.

Application policy, ADJ loading, logging to disk and frontend integration belong
outside this module. Transport errors and received protections never trigger a
fault automatically; the application decides how to respond.

## Transports

| Module | Status / purpose |
| --- | --- |
| [TCP](tcp/README.md) | A client with one independently reconnecting connection per configured board. Receives messages/protections and writes orders, keep-alive and faults. |
| UDP | Telemetry reception is **not implemented yet**; `udp::spawn` is a placeholder that panics. |

TCP configuration, API usage, guarantees, limitations and manual probes are
documented in [tcp/README.md](tcp/README.md).

## Shared API

| Type / entry point | Purpose |
| --- | --- |
| `Reporter::channels(notifications, errors)` | Create bounded reporting channels and their receiving ends (`Sinks`). Both capacities must be nonzero. |
| `Reporter` | Cloneable reporting handle supplied to transports; publication methods are internal. |
| `Sinks` | Application-owned receivers for notifications and errors. |
| `Notification`, `Event` | Identify a board, timestamp and lifecycle event or decoded packet. |
| `ErrorReport`, `net::Error` | Timestamp transport failures and preserve their transport-specific identity. |

## Reporting

`Notification { board, at, event }` always carries the board's identity alongside
its timestamp. `Event` is `Connected`, `Disconnected` or `Received(Packet)`;
connection lifecycle events are TCP-only. `ErrorReport { at, error }` contains
the failure's own identity through the corresponding `net::Error` variant.
The transport's `Reporter` stamps events when publishing them.

Consume **both** channels concurrently with application operations. Both apply
backpressure rather than dropping on congestion, so leaving either consumer
idle can block publication. There is no ordering guarantee between the two
channels or across independent boards. Cancellation can discard a publication
waiting for capacity; already queued reports remain available to drain.

Closing a consumer is also a transport cancellation signal. The exact shutdown
behavior is transport-specific; see [TCP cancellation](tcp/README.md#reporting-framing-and-cancellation).

## Tests

From `backend/`:

```sh
cargo test -p software-core --features net
```

See [TCP tests and manual probes](tcp/README.md#tests) for hardware requirements,
simulator setup and safety warnings.
