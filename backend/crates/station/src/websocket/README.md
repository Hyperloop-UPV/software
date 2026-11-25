# WebSocket

`broker.rs` provides `Broker` and the clonable `BrokerClient` for state and event topics,
using the types from `crate::websocket::payload`.
See the [payload models README](payload/README.md) for all topic payloads,
JSON templates, and complete message examples. Their serialization helpers
live in [`payload/serialize.rs`](payload/serialize.rs).

| Topic | Publish through `BrokerClient` | Subscribe through `BrokerClient` | Initial state |
| --- | --- | --- | --- |
| `connection/update` | `publish_connection(connection)` | `subscribe_connections()` | `{}` |
| `order/stateOrders` | `publish_state_orders(orders)` | `subscribe_state_orders()` | `{}` |
| `logger/response` | `publish_logger(recording)` | `subscribe_logger()` | `false` |
| `podData/update` | `publish_data(packet)` | `subscribe_data()` | `{}` |
| `message/update` | `publish_message(message)` | `subscribe_messages()` | No initial event |
| `protection/update` | `publish_protection(protection)` | `subscribe_protections()` | No initial event |

- `Broker::new()` creates both objects and the initial topic states.
- `Broker::run()` consumes a bounded `mpsc` channel of typed updates and
  publishes state through `watch` and events through `broadcast`. It stops after all
  `BrokerClient` instances are dropped and pending updates have been processed.
- Publication waits for capacity and returns `Error::BrokerClosed` if the
  broker closed. Connection updates merge one board into the current map;
  order updates replace the entire map, including empty lists or an empty map.
- State subscriptions return a `watch` receiver. Read the initial state with
  `borrow_and_update()`, then await `changed()` and read again. Intermediate
  changes may be coalesced; each value contains the complete current state.
- Each event topic has a separate `broadcast` buffer of 128 events. A
  subscription starts with the next event. If a receiver reports `Lagged`,
  the socket task logs the topic and number of missed events and closes that
  session.

`logger/enable` and `logger/variables` queue `LoggerCommand::Enable(bool)` and
`LoggerCommand::Variables(Vec<String>)` for the logger. Both use the same
bounded `mpsc` queue. Invalid payloads and requests that cannot be queued are
logged, and the WebSocket session stays open. The logger reports its applied
state through `BrokerClient::publish_logger`, which feeds `logger/response`.

`publish_data` accepts a complete, prepared `DataPacketUpdate`. The broker
buffers the latest update per packet id and merges it into the published
telemetry map every 100 ms when changes exist. Unchanged packets remain in
that map; repeated updates for one id within a batch are coalesced. Idle ticks
do not publish, and missed ticks are skipped rather than sent in a burst.
Pending telemetry is flushed when the broker finishes processing its input.
The publisher supplies packet counts, cycle times, measurement values and
averages; the broker preserves them as received.

The station binary currently runs a greeting demo. To expose `/backend/ws`
from a caller, bind a listener and pass it and the sender of a bounded socket
channel to `station::http::serve`. Create the broker and client with
`station::websocket::broker::Broker::new()` and start `broker.run()` as a Tokio task.
Pass the socket receiver, the `BrokerClient`, the command destinations, and a
heartbeat timeout to `station::websocket::run`.
`Commands::default()` leaves the order and logger destinations unset.

Each socket has independent reading and writing futures, coordinated by
`handler.rs`. Either future finishing closes the session.

Connect to `/backend/ws` on the listener's address and port and send this
message to subscribe to `connection/update`.

```json
{"topic":"connection/update","payload":{"subscribe":true}}
```

The same subscription format applies to all topics in the table. The sender
publishes the current state immediately for `watch` topics, then complete
updates. For event topics it sends events published after subscribing.
An empty payload `{}` also subscribes. Set `subscribe` to `false` to stop
receiving a topic. Duplicate requests to subscribe or unsubscribe are
idempotent. The receiver opens each topic subscription and passes it to the
socket writer through a bounded `mpsc` queue. A full queue closes that session.

`receiver.rs` consumes `connection/heartbeat` without publishing a response.
It uses `timeout_at` with the caller's heartbeat timeout. Each valid JSON
application message renews the deadline. WebSocket ping/pong frames do not renew it.
Unknown topics are logged and ignored while their handlers are implemented.

`sender.rs` releases each watch borrow before awaiting socket I/O.

`order/send` checks parameter aliases, types and wire ranges against the ADJ.
It arranges values in ADJ order and queues the resulting `OrderPacket` for
the vehicle module. Rejected requests, including a full or closed order queue,
are logged and the WebSocket session stays open.
