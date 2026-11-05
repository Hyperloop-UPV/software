# `net` — Real Sockets (feature `net`)

Owns the actual tokio sockets. `protocol` turns bytes into packets and never
touches a socket; `net` owns the socket and calls into `protocol`. Nothing above
`net` (WebSocket, disk, aggregation) is known here.

Two submodules do the I/O, and **this directory's shared part opens nothing**:

```
net/
├── net.rs        # module root: docs and re-exports
├── report.rs     # Event, Notification, ErrorReport, Reporter — what is reported
├── error.rs      # Error — aggregates tcp::Error / udp::Error, nothing else
├── tcp.rs        # the TCP client        (not written yet: error type + contract)
└── udp.rs        # the shared UDP socket (not written yet: error type + contract)
```

## The shared part

### Identity: the board travels with everything

Every notification carries its board, whatever the event:

```rust
Notification { board: BoardId, at: SystemTime, event: Event }
```

It is never a second source of truth, though — it is resolved from what the ADJ
already says, once, inside `net`. A TCP task was spawned for one board and knows
it without asking; `udp` resolves it from the decoded packet's id through `Index`
(every `PacketDef` carries its `board`), which is one `HashMap` lookup per
datagram instead of one per consumer downstream.

And the board is all the identity there is: one connection per board, one shared
socket for UDP, so nothing needs telling apart beyond it.

Addresses are for the operator, not for the domain types: they show up
interpolated in `tcp::Error`/`udp::Error` messages, which is where somebody
actually reads them.

### `Event` and `Notification` — what happened, and when

```rust
enum Event {
    Connected,        // TCP only
    Disconnected,     // TCP only
    Received(model::Packet),
}
```

`Event::Received` leans on the existing `model::Packet` umbrella
(`Data | Order | Protection | Message`) rather than repeating that split with one
variant per packet type. Its `Order` variant is never produced while receiving —
it is there for an eventual "the order really did go out on the wire" report,
which only `net` can make.

`board` and `at` sit in the envelope rather than inside the variants so that
**everything** that travels down the channel carries them, and so a notification
**cannot be built without a timestamp**. `Reporter::notify` is the only thing that
stamps it. That
matters: a queue adds delay under load, so a date taken when the record is
*written* would be wrong by exactly that delay, precisely when the data matters
most. It is also the only full date a record can have — the board clock on
protections and messages (`ShortTimestamp`) is a time of day with no date.

### `Reporter` — the two sinks

```rust
let (reporter, sinks) = Reporter::channels(notifications, errors);

reporter.notify(board, event).await?;      // notification channel
reporter.report(tcp_or_udp_error).await?;  // error channel
```

Cloneable, and meant to be cloned: one copy per TCP connection task, one for the
UDP loop, all feeding the same two channels.

Two channels, not one, because the rules differ. **A notification is never
dropped**: `notify` waits when the channel is full, so the backpressure reaches
the read loop and the kernel's receive buffer becomes the only place anything can
be lost — and whatever is lost there is lost *before* being decoded, so
"everything decoded gets through" stays literally true. An error is rare enough
that it can afford to queue behind telemetry.

`ErrorReport` carries **no board**, unlike a notification: the identity of what
failed lives inside the `Error` variant, which is the only place that always has
it. A datagram that fails to decode resolves to no board at all — its id is not in
the ADJ, so there is no `PacketDef` to ask — and all that can be said about it is
the address it came from, which is what `udp::Error::Decode` holds.

### `Error` — aggregation only

`net::Error` adds no identity and no message of its own; both variants are
`#[error(transparent)]`, so `to_string()` is the submodule's own message with its
identity already interpolated, and `source()` still reaches the original
`io::Error` or `DecodeError`. Each submodule owns its error type and puts the
board or address **inside the variant** — the Go backend lost exactly
that when an error crossed its channel. `is_fatal()`, if needed, belongs to each
submodule's own error: nobody outside knows which of its variants are fatal.

## The contract for the two submodules

|  | `tcp` | `udp` |
|---|---|---|
| Entry point | `spawn(Config, Arc<Index>, Reporter) -> Handles` | `spawn(Config, Arc<Index>, Reporter) -> Result<JoinHandle<()>, Error>` (binds first) |
| Inputs | its `Config` (boards, timeouts, backoff, keep-alive) | its `Config` (bind address, `SO_RCVBUF`) |
| Role | client only; one connection per board, one task each | one shared socket, receive-only, one task |
| Framing | buffer + `&mut Cursor` + advance by `cursor.position()`; bail out past 374 bytes | none — `recv_from` delivers a whole datagram into a reused 64 KiB buffer |
| Writing | yes (orders, keep-alive); a single writer task per connection | no |
| On a decode error | report it; **fatal**, and close/reopen the connection (the stream cannot be resynchronised) | report it; **fatal**, and keep receiving |
| `Connected`/`Disconnected` | per board | never |
| Fault | writes it: `Handles::propagate_fault()`, id 0 to every board | cannot write; only reports |

Both take the same two things besides their own `Config`: an `Arc<Index>` — the
only part of the ADJ `net` needs, owned by `station` and read-only here — and a
`Reporter`. Neither reads a config file, and neither reads the ADJ itself: the
addresses `tcp` connects to are resolved by `station` and arrive in `Config`,
which is also what lets a test point it at a fake peer.

`net` never decides to fault the pod, but `tcp` is what can write one: `station`
reads `is_fatal()` and calls `Handles::propagate_fault()`, which puts the order
with id 0 into every board's writer channel (the Go backend's `SendFault`). A
*received* packet with id 0 is the same action requested by a board, and
`station` answers it the same way.

Three rules both follow:

1. The timestamp comes from `Reporter`, never by hand.
2. Decode and report, nothing else — no disk, no WebSocket, no aggregation.
3. What to do about an error is decided locally; only the report goes up.

### What "fatal" means

`tcp::Error::is_fatal`/`udp::Error::is_fatal` are about the **pod**, not about
this process: it means the pod has to be sent to fault, and the backend
**stays up** — still reading, still serving the frontend, still recording — so the
operator can see why. Nothing in `net` ever calls `std::process::exit`.

Only a decode failure is fatal, on either transport, and this is a deliberate
departure from Go. Nothing corrupts a frame or a datagram in flight (both
transports checksum, TCP retransmits, and the pod's network does not fragment), so
something that will not decode means the loaded ADJ does not describe what the
firmware is sending — which reconnecting cannot fix. A failed connect or write is
*not* fatal: that is what the backoff is for.

`net` never raises the fault itself — neither transport does. It logs, it reports,
and `is_fatal()` is the classification whoever consumes the error channel acts on.
That is deliberate: a mismatched ADJ fails on every frame that follows, thousands
a second, so the fault has to be broadcast **once**, and the guard for that lives
in one place instead of one per transport.

## Why TCP needs a buffer and UDP does not

TCP is a byte stream and preserves no write boundaries, so one read can deliver
half a frame or two frames glued together — both are normal, and the glued case is
the frequent one. Our frames carry no length prefix: a protection's length is
fixed but derivable only from the ADJ (`2 + 4 + 2 + the watched measurement's wire
width`), and a message ends at the second NUL byte of its two variable-length
strings. So a frame's end is never known in advance, only deduced by parsing it —
which is why the loop tries, and retries with more bytes when it fails.

The Go backend never faced this because it read straight off the connection, where
a blocking read simply waits mid-frame. That state has to live somewhere: in Go it
lived in the blocked goroutine's stack, and here it lives in an explicit buffer —
which is also what lets `protocol` stay synchronous and socket-free, reusable by a
sniffer against a capture.

UDP has none of it: the kernel hands over a whole datagram or nothing.

## Open questions

- Who raises the fault on `is_fatal()`, and where its "only once" guard lives.
  Not in `net`: both transports only report.
- Whether an order's write is reported back as
  `Event::Received(Packet::Order(..))`, or `station` just assumes it went out.
