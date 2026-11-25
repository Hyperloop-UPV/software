# `event`: how station's modules talk to each other

> `net::tcp` is not wired in yet: `main` starts `event` without a TCP client,
> so orders fail with "TCP not available" and the fault is only traced.

Every module of the backend runs in **its own task**. A task is tokio's
lightweight thread: it runs on its own, at its own pace, and tokio spreads all
the tasks over a handful of OS threads (about one per CPU core). For this
document, think of each task as a thread.

Modules **never call each other's functions** while running. They only talk
through **queues**: one module puts a message in, another takes it out.

**`event` is that communication.** It is not "the UDP module" or "the orders
module": it is the switchboard every module goes through. It does two things:

1. **It prepares every queue between modules**, in one place
   ([`event::channels`](#who-creates-the-queues)), and `main` hands each end to
   the module that uses it.
2. **It routes what goes through them**, in both directions:
   - **towards the front**: what the boards send, and every error, goes to
     `logging` (disk) and `pipeline` (front), in a fixed order of priority:
     **errors, then TCP, then UDP**;
   - **towards the boards**: orders from the front, and the fault, go to TCP.

It does no work on the data. The real work (decoding, writing to disk, building
the front's JSON, writing to a socket) happens in the other tasks.

## Overview

`event` is three tasks: the **routing loop**, which handles everything going
towards the front, and two **workers**, which handle everything going towards
the boards.

**Towards the front:**

```text
  ┌─ task ─────┐ ─① errors──────► ┌─ task ───────────────────┐ ─⑤─► ┌─ task ───┐
  │ net::udp   │ ─④ UDP notif.──► │ event: routing loop      │      │ logging  │ → disk
  └────────────┘                  │                          │      └──────────┘
  ┌─ task ─────┐ ─① errors──────► │ reads in this order:     │
  │ net::tcp   │ ─③ TCP notif.──► │   1. ① ② errors          │ ─⑥─► ┌─ task ───┐
  └────────────┘                  │   2. ③ TCP notifications │      │ pipeline │ → websocket → front
  any station   ─② problems─────► │   3. ④ UDP notifications │      └──────────┘
  module                          └────────────┬─────────────┘
                                               │ ⑧ (fatal error, board fault)
                                               ▼
                                         fault worker
```

**Towards the boards:**

```text
  front → websocket ─⑦ orders─► ┌─ task ──────────┐ ──► TCP: write to that board
                                │ orders worker   │ ─⑤─► logging   (sent)
                                │ one at a time   │ ─⑥─► pipeline  (failed)
                                └───────┬─────────┘
                                        │ ⑧ (order id 0 = fault)
                                        ▼
  routing loop ─⑧─────────────► ┌─ task ──────────┐ ──► TCP: fault to every board
                                │ fault worker    │ ─⑥─► pipeline  (boards not reached)
                                │ "only once"     │
                                └─────────────────┘

  main: calls event::channels(), spawns every task with its ends,
        waits for event's Stop, then shuts everything down in order
```

The circled numbers are the queues in [The queues](#the-queues).

Why it is built like this:

- **A slow module does not hold up the others.** Each one works at its own
  pace. The only time one waits for another is when a queue is full, and that
  is on purpose (see "wait, don't drop" below).
- **The two directions never get in each other's way.** An order is never
  stuck behind thousands of telemetry packets, and a slow board never holds up
  the telemetry: orders and the fault have their own tasks.
- **Each module can be tested alone**: fill its input queue by hand and look at
  what comes out of its output queue. No sockets, no other modules.
- **The boundaries are explicit.** What one module can tell another is exactly
  the type of the queue between them, and nothing else.
- **All the decisions are in one module.** What to do about an error, when to
  send the fault and when to stop live in `event`, not scattered across modules.
  `net`, in particular, leaves all of that out on purpose.

## Words used here

- **Queue** (`tokio::sync::mpsc`): a line with a fixed number of slots between
  two tasks. One puts messages in at one end (`Sender`), the other takes them
  out at the other end (`Receiver`). Each queue has a single reader; it can
  have several writers (the `Sender` is cloned).
- **`Reporter` and `Sinks`**: how `net` delivers what happens: the `Reporter` is
  the putting end, held by the UDP or TCP task; the `Sinks` are the taking end,
  held by `event`. They carry **notifications** (`Notification`: "this packet
  arrived", "this board connected") and **errors** (`ErrorReport`). See
  [`net/report.rs`](../../../core/src/net/report.rs).
- **Worker**: a task owned by `event` that does one slow thing (writing an order
  to TCP, sending the fault), so that the routing loop never waits on a socket.
- **Batch**: several notifications taken out at once (`recv_many`) instead of
  one at a time.
- **Wait, don't drop**: when a queue is full, whoever is putting into it waits
  until there is a free slot. That wait travels back up to the socket, so the
  only thing that can be lost is what the operating system has not handed over
  yet, which has not been decoded yet. `net` works the same way.
- **Shared copy** (`Arc`): one piece of data in memory that several readers use
  without copying it. It is freed when the last one lets go of it.
- **`select!` in fixed order** (`biased`): `select!` waits on several queues at
  once. With `biased`, when more than one has something, the first one in the
  list always wins. That is how priorities are done.

## Files

```
event.rs             # module root: channels, spawn, the routing loop, Stop
event/
├── policy.rs        # what to do with each error
├── orders.rs        # the orders worker
├── fault.rs         # the fault worker
├── tests.rs         # the routing loop and the workers, with a fake TCP client
├── manual_tests.rs  # throughput probe, ignored by default
└── README.md
```

## The queues

| # | Queue | From → to | Carries |
|---|---|---|---|
| ① | net errors (one queue per transport) | `net::udp`, `net::tcp` → routing loop | `ErrorReport` |
| ② | problems | any station module → routing loop | `Problem` |
| ③ | TCP notifications | `net::tcp` → routing loop | `Notification` (protections, messages, connected/disconnected) |
| ④ | UDP notifications | `net::udp` → routing loop | `Notification` (data) |
| ⑤ | to logging | routing loop, orders worker → `logging` | `ToLogging` |
| ⑥ | to pipeline | routing loop, both workers → `pipeline` | `ToPipeline` |
| ⑦ | orders | `websocket` → orders worker | `OrderPacket` (id 0 = fault) |
| ⑧ | fault requests | routing loop, orders worker → fault worker | `FaultRequest` |

**The routing loop reads ① to ④ in that order: errors, then TCP, then UDP.**

- **Errors first**: an error is never stuck behind telemetry.
- **TCP before UDP**: a protection or a board's message is never stuck behind
  thousands of telemetry packets. TCP carries little traffic, so reading it
  first does not starve UDP.
- The order between a TCP and a UDP notification is not kept across the two
  queues; each one carries the instant it was received (`at`), so anyone who
  needs the real order can recover it.
- The order of priority applies **only towards the front**. Orders (⑦) go the
  other way and are not read by the routing loop at all: the orders worker
  reads them itself.

## Who creates the queues

**`event` does, all of them, in one call.** `main` calls it once before
spawning anything and hands each end to whoever uses it:

```rust
let channels = event::channels(&config);

spawn_udp(udp_config, index.clone(), channels.udp)?;             // ① ④
// the TCP client takes channels.tcp                                ① ③
let boards = Boards::from_pod_data(&adj.pod_data);
let event = event::spawn(config, channels.event, boards, tcp);  // tcp: Option<Arc<dyn TcpLink>>
logging::spawn(channels.logging, ...);                           // ⑤
pipeline::spawn(channels.pipeline, broker_client, ...);          // ⑥
OrderForwarder::new(index, channels.orders);                     // ⑦ (websocket)
// channels.problems is cloned for every station module that reports errors  ②
```

Why one place, instead of each module creating its own input queue:

- There are **circles**: `event` sends to `logging`, and `logging` reports its
  own failures back to `event` (②); `event` asks TCP to write, and TCP reports
  back to `event` (① ③). If every module created its own queue, someone would
  need the other's end before it existed. Creating everything first, in one
  call, removes the problem.
- **`event` defines the types of all its queues**, including the ones going to
  `logging` and `pipeline`. So it can be written and tested alone, and
  `logging`/`pipeline` depend on `event`, never the other way round.
- The fault requests queue (⑧) is created inside `event::spawn`: nobody outside
  `event` ever sees it.
- `net`'s queues are built with `net`'s own `Reporter::channels` (`core`
  cannot depend on `station`), called **once per transport**: `net::udp` and
  `net::tcp` each get their own `Reporter`, with its own notification queue
  (so that TCP can be read first) and its own error queue. `net` needs no
  change for it.

## Towards the front

| What arrives | `logging` | `pipeline` | fault worker |
|---|---|---|---|
| Batch of TCP notifications (③) | yes | yes | — |
| Batch of UDP notifications (④) | yes | yes | — |
| Problem to show (②, or a non-fatal error from ①) | no (trace only) | yes | — |
| Fatal error | no (trace only) | yes, before stopping | yes |
| Fault from a board (packet id 0, ①) | no (trace only) | yes, the first one from each board | yes, if forwarding is on |

**How notifications travel.** The routing loop takes up to 512 at once from a
queue, puts them in **one shared copy** (`Arc<[Notification]>`) and sends that
same copy to both `logging` and `pipeline`. Nothing is duplicated in memory,
and each consumer takes what it needs (`logging` its selected measurements,
`pipeline` its counts and averages). `event` never looks inside. Each
`Notification` travels whole, so both times reach the consumers: when it was
received (`at`) and, for protections and messages, the board's own clock
(`ShortTimestamp`).

**When ⑤ or ⑥ is full, `event` waits; it does not drop.** Everything decoded
reaches the disk, the same rule `net` follows. While the routing loop waits for
a free slot it does not handle errors either; this is accepted because the disk
is expected to keep up with the incoming rate (about 15–25 Mbit/s).

## Towards the boards

- **Orders.** `websocket` validates each order against the ADJ and puts it on
  ⑦. The orders worker takes them **one at a time**: it writes the order and
  waits for TCP to say it went out (or why not) before taking the next one.
  - **"Sent" means written, not queued.** A sent order goes to `logging` (⑤)
    only once TCP confirms the write.
  - **A failed order goes to `pipeline`** (⑥), with the reason. An order for a
    board that is not connected fails right away instead of waiting in a queue.
- **The fault.** The fault worker sends the fault (order id 0) to every board.
  It gets requests on ⑧ from three places: the routing loop on a fatal error,
  the routing loop on the first fault from each board (if forwarding is on), and the
  orders worker when the front asks for one (an order with id 0).
  - **Only once per session.** The fault worker sends it on the first request
    and only acknowledges the later ones. It is the one place that keeps that
    flag, whoever asks.
  - **Boards it did not reach** go to `pipeline` (⑥): a fault that only half
    landed is exactly what the operator has to know.
- **Without TCP** (no TCP client running), every order fails with "TCP not
  available", shown on the front, and the fault is only traced.

Neither worker is ever waited on by the routing loop, except when stopping on a
fatal error (see [Stopping](#stopping)): writing to a socket can take time (a
board that stops reading, a timeout), and the telemetry must not wait for it.

## Errors

**`event`** decides what an error means, not `net`: it looks at the error
itself and does not use `is_fatal()`. The decision lives in a function that
keeps no state between calls (`policy.rs`), so it can be tested on its own.

There are three procedures, and every one of them ends up in the trace:

1. **Not fatal, not shown**: trace only. Usually traced where it happens,
   without reaching `event` (e.g. a failed reconnection with backoff); a
   problem that does reach `event` this way is a `ProblemKind::Silent`, and
   `event` only traces it.
2. **Not fatal, shown on the front**: e.g. an order to a board that is not
   connected.
3. **Fatal, shown on the front**: send the fault, close TCP, shut the backend
   down safely.

| Error | What it means | Procedure |
|---|---|---|
| `UdpError::Decode` (any variant) | a datagram that cannot be decoded: the loaded ADJ does not match what the boards send | **3, fatal** |
| `UdpError::Recv` | the socket can no longer be read: telemetry from every board is gone | **3, fatal** |
| `UdpError::Fault { from }` | a board detected an error and says so (packet id 0) | **board fault**: shown, forwarded to the other boards; the backend **keeps running** |
| `UdpError::Bind` | the port could not be opened | never arrives: a startup failure, returned by `spawn_udp` |
| TCP frame that cannot be decoded | same as UDP | **3, fatal** |
| TCP fault (packet id 0 over TCP) | same as UDP | **board fault** |
| TCP connect or read failure | a board not up yet, or a connection that dropped | **1**, trace only; the `Disconnected` notification already tells the front |
| TCP keep-alive write failure | the keep-alive could not be written | **2, shown** |
| An order that could not be written | reported by the orders worker, not by `net` | **2, shown** |
| `Problem` from a station module (②) | whatever that module reports | what the module says: **1** (`Silent`), **2** (`Shown`) or **3** (`Fatal`) |
| `logging` or `pipeline` stops (⑤ or ⑥ closed) | nothing is recorded, or nothing is shown | **3, fatal** |

Every decode error is fatal, not only an unknown id: a truncated datagram or an
enum value out of range also say the ADJ does not match the firmware, and
nothing corrupts a packet in flight. A dead `logging` means the run is not
recorded; a dead `pipeline` means the operator sees nothing.

**Which board.** UDP errors carry the address the datagram came from (`from`),
not the board. At startup `event` gets an IP → `BoardId` map built from the ADJ
(every `Board` has its `ip`, see [`model/board.rs`](../../../core/src/model/board.rs)),
so the front says "HVSCU" rather than "127.0.0.7". An IP that belongs to no
board stays without a board, and the text carries the address.

**Board faults on the front.** The first fault from each board is shown, as a
`Shown` problem whose text names the board; repeats are not, since `net` already traces them (at most one line a second,
with how many were skipped). Forwarding a board's fault to the others is
configurable and on by default.

**Traces.** Every error ends up in the trace (`tracing`), but never twice: the
module where it happens traces it, and `event` only traces what it decides
itself ("fatal, stopping", "fault sent to every board", "first fault from
HVSCU") and the `Silent` problems it is sent.

## Stopping

**On a fatal error**, the routing loop:

1. Sends the `Problem` to `pipeline`, so the operator sees it.
2. Empties whatever was already in ③ and ④ (at most their capacity) and passes
   it on. Errors are read first, so the fatal error has overtaken the data that
   arrived just before it, and that data is exactly what you want to understand
   what happened.
3. Asks the fault worker to send the fault and waits for it to finish, with a
   time limit (if it was already sent, the answer is immediate).
4. Ends by returning `Stop::Fatal(problem)`.

If what stopped is `logging` or `pipeline`, step 2 is skipped. If it is
`logging`, `event` still tells `pipeline`.

**On Ctrl+C:** `main` handles it, not `event`. `main` stops the UDP task
(`JoinHandle::abort`, see "Stopping" in [`net/udp.rs`](../../../core/src/net/udp.rs))
and closes TCP. When those tasks end their `Reporter`s go with them, `net`'s
queues close, and the routing loop passes on whatever was left and ends with
`Stop::NetGone`.

**Then `main` always does the same:**

1. Stops UDP and closes TCP, if not done already.
2. When `event` ends, ⑤ and ⑥ close: `logging` and `pipeline` finish what they
   have queued and end on their own (`logging` flushes its files to disk).
3. Waits for them, with a time limit of a few seconds.
4. Exits with code **1** after a fatal error and **0** after Ctrl+C. A
   `Stop::NetGone` without Ctrl+C means `net` ended on its own, so that is 1
   as well.

## Types

```rust
/// A batch of notifications, shared by logging and pipeline without copying.
pub type Batch = Arc<[Notification]>;

/// Creates every queue between modules. `main` calls it once, before spawning
/// anything, and hands each end to whoever uses it.
pub fn channels(config: &Config) -> Channels;

pub struct Channels {
    /// For net::udp: reports on ① and ④.
    pub udp: Reporter,
    /// For net::tcp: reports on ① and ③. Dropped if TCP is not started.
    pub tcp: Reporter,
    /// event's own ends (the reading side of ① ② ③ ④ ⑦, the writing side of
    /// ⑤ ⑥), for `spawn`. Opaque.
    pub event: EventEnds,
    /// ⑦, for websocket's OrderForwarder.
    pub orders: mpsc::Sender<OrderPacket>,
    /// ②, cloned for every station module that reports problems.
    pub problems: mpsc::Sender<Problem>,
    /// ⑤, for logging.
    pub logging: mpsc::Receiver<ToLogging>,
    /// ⑥, for pipeline.
    pub pipeline: mpsc::Receiver<ToPipeline>,
}

/// Starts the routing loop and the two workers. Without a TCP client (`None`),
/// every order fails with "TCP not available" and the fault is only traced.
/// The task ends with the reason it stopped, once the workers have stopped
/// too, so that ⑤ and ⑥ close behind it.
pub fn spawn(
    config: Config,
    ends: EventEnds,
    boards: Boards,
    tcp: Option<Arc<dyn TcpLink>>,
) -> JoinHandle<Stop>;

/// What event needs from the TCP client.
pub trait TcpLink: Send + Sync {
    /// Writes the order to its board; returns that board once written, or why
    /// not (right away if the board is not connected).
    fn send(&self, order: OrderPacket) -> BoxFuture<'_, Result<BoardId, String>>;
    /// Sends the fault to every board; fails with the boards it did not reach.
    fn send_fault(&self) -> BoxFuture<'_, Result<(), Vec<BoardId>>>;
}

/// Who an IP belongs to and what each board is called, built from the ADJ.
pub struct Boards { /* ... */ }
impl Boards {
    pub fn from_pod_data(pod_data: &PodData) -> Self;
    pub fn by_ip(&self, ip: IpAddr) -> Option<BoardId>;
    pub fn name(&self, board: BoardId) -> String;
}

pub enum ToLogging {
    Received(Batch),
    /// An order TCP confirmed it wrote.
    OrderSent { at: SystemTime, board: BoardId, order: OrderPacket },
}

pub enum ToPipeline {
    Received(Batch),
    Problem(Problem),
    /// An order that did not go out, and why.
    OrderFailed { at: SystemTime, order: OrderPacket, reason: String },
}

/// Something the operator has to see. `Problem::now(kind, board, text)`
/// builds one stamped with the current time.
pub struct Problem {
    pub at: SystemTime,
    /// The board, if known.
    pub board: Option<BoardId>,
    pub kind: ProblemKind,
    /// The message with all its causes: "could not X: because Y: because Z"
    /// (`event::full_message` builds it from any error).
    pub text: String,
}

pub enum ProblemKind {
    /// Procedure 2: shown, the backend keeps running.
    Shown,
    /// Procedure 3: shown, the fault is sent and the backend stops.
    Fatal,
    /// Procedure 1: only traced, not shown; the backend keeps running.
    Silent,
}

/// Why event ended. `main` reads it and shuts down in order.
pub enum Stop {
    Fatal(Problem),
    /// `net`'s queues closed: UDP and TCP were stopped.
    NetGone,
}

/// `Config::default()` gives the sizes in brackets. Every size is clamped to
/// at least 1.
pub struct Config {
    pub batch: usize,                 // most notifications per batch (512)
    pub errors_queue: usize,          // each of net's two error queues, ① (16)
    pub problems_queue: usize,        // ② (16)
    pub tcp_queue: usize,             // ③ (1,024)
    pub udp_queue: usize,             // ④ (8,192)
    pub logging_queue: usize,         // ⑤, in batches (64)
    pub pipeline_queue: usize,        // ⑥, in batches (64)
    pub orders_queue: usize,          // ⑦ (32)
    pub forward_board_faults: bool,   // (true)
    pub fault_timeout: Duration,      // how long a fatal stop waits for the fault (2 s)
}
```

`TcpLink` is a trait rather than `net::tcp`'s own type so that the workers can
be tested against a fake, and so that `event` depends on the TCP client for
these two calls only. `FaultRequest` (⑧) is private to `event`.

## The routing loop

```text
loop, select! in fixed order (closed queues are no longer watched):
  1. ① UDP errors, ① TCP errors, then ② problems -> policy:
       fatal       -> stop (see "Stopping")
       board fault -> first from that board? Problem to ⑥
                      forwarding on? request to ⑧
       shown       -> Problem to ⑥
       silent      -> trace only
  2. ③ TCP notifications.recv_many(batch, config.batch) -> forward
  3. ④ UDP notifications.recv_many(batch, config.batch) -> forward
  all four of net's queues (① ① ③ ④) closed -> return Stop::NetGone

forward:
  shared = batch.drain(..).collect::<Arc<[_]>>()
  ⑤.send(Received(shared.clone())).await   // on failure: fatal
  ⑥.send(Received(shared)).await           // on failure: fatal
```

`batch.drain(..).collect()` allocates once per batch, and the `batch` `Vec`
keeps its capacity for the next one.

## Performance

The requirement is **25 Mbit/s in 76-byte packets, about 41,000 a second**:
under 24 µs per notification, everything included. On loopback, UDP alone loses
nothing, but a reader with one timer per message already loses 0.7 %. **The
bottleneck is whoever reads `net`'s queues, that is, the routing loop.** Hence:

- notifications in batches, one memory allocation per batch, not per
  notification;
- no timer per notification;
- the routing loop does not look inside notifications: the expensive work
  (picking measurements, computing averages, building JSON) is done by
  `logging` and `pipeline`, each in its own task;
- anything that can wait on a socket is done by a worker, never by the routing
  loop.

## Contract with the other modules

- **`net`** needs no change: each transport reports through the `Reporter` it
  is given, and `event::channels` hands out one per transport.
- **`net::udp`** reports data on ④, errors on ①, and a fault (packet id 0) as
  `UdpError::Fault` on ①, recognised before decoding.
- **`net::tcp`** reports protections, messages and connected/disconnected on ③,
  errors on ①, and on top of that:
  - recognises packet id 0 as a fault before decoding, like `net::udp`;
  - does not report reconnection failures (procedure 1: it traces them);
  - `send` fails right away if the board is not connected, and returns only
    once the order is written;
  - can send the fault to every board and say which ones it did not reach;
  - has an explicit stop, for the safe shutdown;
  - is handed to `event` as a `TcpLink`, directly or through a thin adapter.
- **`websocket`** validates each order against the ADJ and puts it on ⑦
  (`OrderForwarder` takes `channels.orders`). The front's logger requests
  (`logger/enable`, variable selection) go straight to `logging`, not through
  `event`.
- **`logging`** reads ⑤, picks which measurements to store following its own
  selection, and reports its own failures (e.g. the disk) on ②.
- **`pipeline`** reads ⑥ and turns it into what the front shows: a batch into
  per-packet updates (counts, cycle time, averages) or protection and message
  updates, a `Problem` or a failed order into a message. It waits instead of
  dropping and does not decide anything about errors.

## Implementation notes

- **`main` keeps no copy of a `Reporter`**: each one is moved into its task,
  and `channels.tcp` is dropped if TCP is not started. A `Reporter` left alive
  keeps its queues open, and the routing loop never ends.
- **A closed queue is no longer watched** in the `select!`. A closed queue
  answers "closed" instantly, every time, so in fixed order it would win every
  round and the queues below it would never be reached. Each branch has a
  condition (`if open.udp_errors`, and so on). This does happen: at shutdown ① closes once both
  `Reporter`s are gone while ④ may still have items in it, and without TCP ③
  is closed from the start.

## Tests

- `policy.rs`: the decision table, one test per row.
- `tests.rs`: the routing loop and the workers, with real queues and a fake
  `TcpLink`, no sockets. Covers the order of priority, the shared batch, the
  fatal stop (and that what was queued before the error still gets through),
  board faults shown once per board and the fault sent once, orders with and
  without TCP, order id 0, a consumer that stops, `net` closing, and a fault
  that never finishes sending. Every wait is bounded, so a broken expectation
  fails instead of hanging.
- `manual_tests.rs`: `manual_event_throughput`, ignored by default. It pushes
  a million notifications through a `Reporter` into `event` and two readers
  that only count. On a development machine, in release: about 4.9 million a
  second, over 100 times the requirement.

  ```sh
  cargo test -p station --release manual_event -- --ignored --nocapture
  ```

## Open questions

- **Fault from the front.** `websocket` validates orders against the ADJ, and id
  0 is not in it, so today a fault asked for from the front is rejected before
  reaching ⑦.
- **Order echo.** Whether a sent order is also shown on the front, not only
  logged.
