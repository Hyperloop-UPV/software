# WebSocket Message Models (`model::websocket`)

JSON models for telemetry, connections, orders, messages, protection events
and logger control. The `websocket` feature enables the types in
`model/websocket.rs` and `model/websocket/`.

The Rust types describe the payload of each topic. Messages sent over the
WebSocket wrap that payload in `{topic, payload}`, as shown in the templates
and example files below. Connections, subscriptions, channels and the broker
belong to the application (`station`).

## Topics

| Topic | Payload type | Direction | JSON example |
| --- | --- | --- | --- |
| `podData/update` | `DataUpdate` | Backend → frontend | [data.json](example/data.json) |
| `connection/update` | `ConnectionUpdate` | Backend → frontend | [connection.json](example/connection.json) |
| `order/send` | `OrderSend` | Frontend → backend | [order.json](example/order.json) |
| `order/stateOrders` | `StateOrdersUpdate` | Backend → frontend | [state_orders.json](example/state_orders.json) |
| `message/update` | `MessageUpdate` | Backend → frontend | [message.json](example/message.json) |
| `protection/update` | `ProtectionUpdate` | Backend → frontend | [protection.json](example/protection.json) |
| `logger/enable` | `LoggerEnable` | Frontend → backend | [logger_enable.json](example/logger_enable.json) |
| `logger/response` | `LoggerResponse` | Backend → frontend | [logger_response.json](example/logger_response.json) |
| `logger/variables` | `LoggerVariables` | Frontend → backend | [logger_variables.json](example/logger_variables.json) |

Directions describe the topic's data flow. A subscription request is handled
separately by the broker. Each example is an illustrative complete message,
independent of the bundled ADJ fixture and HTTP catalog examples.

## Usage

Enable the feature in the application's dependency:

```bash
cargo add software-core -F websocket
```

With a decoded `packet: ProtectionPacket`:

```rust
use software_core::model::websocket::{OrderSend, ProtectionUpdate};

let request: OrderSend = serde_json::from_str(r#"{"id":1002,"fields":{}}"#)?;
let protection = ProtectionUpdate::from(packet);
let payload_json = serde_json::to_string(&protection)?;
```

Published structures implement `serde::Serialize`; `OrderSend` and `OrderField`
implement `serde::Deserialize`. The logger aliases use the primitive types'
Serde implementations. All payload types are re-exported from
`model::websocket`.

Deserializing an order checks its JSON structure. Parameter types, ranges and
their correspondence with the ADJ must be validated by the application before
converting it to an `OrderPacket`.

## JSON Structure Templates

These templates keep the JSON object and array structure, replacing values
with their types: `number`, `string`, or `boolean`. Quoted topic names and
discriminators are literals; keys in angle brackets represent map entries.
Comments describe alternative values and constraints. These are documentation
templates, not valid JSON messages; the linked `.json` files contain concrete
values.

Maps and arrays show representative entries and may be empty. Numeric IDs
are unsigned 16-bit integers. When an ID is an object key, JSON represents
it as a string.

### Telemetry (`DataUpdate`)

```jsonc
{
  "topic": "podData/update",
  "payload": {
    "<packet id>": {
      "id": number,
      "hexValue": string,
      "count": number,
      "cycleTime": number,
      "measurementUpdates": {
        "<numeric measurement alias>": {
          "last": number,
          "average": number
        },
        "<boolean measurement alias>": boolean,
        "<enum measurement alias>": string
      }
    }
  }
}
```

The outer key matches the packet's `id`. `count` is the received packet count;
`cycleTime` is the averaged interval between packet receptions. The publisher
supplies these statistics and the hexadecimal packet representation.

`MeasurementUpdate` has three JSON forms: `{last, average}` for a number,
a boolean, or an enum variant string. There is no additional discriminator
around a measurement value.

### Connections (`ConnectionUpdate`)

```jsonc
{
  "topic": "connection/update",
  "payload": {
    "<board name>": {
      "name": string,
      "isConnected": boolean
    }
  }
}
```

The map key matches `name`. The state describes the connection between the
backend and the board.

### Send Order (`OrderSend`)

```jsonc
{
  "topic": "order/send",
  "payload": {
    "id": number,
    "fields": {
      "<parameter alias>": {
        "value": number, // A boolean or enum string is also possible.
        "isEnabled": boolean,
        "type": string
      }
    }
  }
}
```

An order without parameters has `fields: {}`. Parameter names are aliases;
the application uses the ADJ to place their values in wire order. The `value`
field remains raw JSON until validation, preserving integer precision.

Numeric `type` names are `"uint8"`, `"uint16"`, `"uint32"`, `"uint64"`,
`"int8"`, `"int16"`, `"int32"`, `"int64"`, `"float32"` and `"float64"`.
Boolean and enum parameters use `"bool"` and `"enum"`, respectively.

### Enabled Orders (`StateOrdersUpdate`)

```jsonc
{
  "topic": "order/stateOrders",
  "payload": {
    "<board name>": [number]
  }
}
```

Each array contains the IDs of the board's currently enabled orders. A board
with no enabled orders is represented by an empty array.

### Messages (`MessageUpdate`)

```jsonc
{
  "topic": "message/update",
  "payload": {
    "kind": string, // "info", "warning", "fault", "ok" or "panic".
    "payload": string, // Alternatively, the detailed object shown below.
    "board": string,
    "name": string,
    "timestamp": {
      "counter": number,
      "second": number,
      "minute": number,
      "hour": number,
      "day": number,
      "month": number,
      "year": number
    }
  }
}
```

`MessagePayload::Text` is a JSON string. `MessagePayload::Protection` is an
object with its own `kind` and `data`. The outer `kind` always describes
severity; the inner `kind` describes the condition:

```jsonc
{
  "kind": "UPPER_BOUND",
  "data": {
    "bound": number,
    "value": number
  }
}
```

The detailed forms are:

| Inner `kind` | `data` template |
| --- | --- |
| `LOWER_BOUND` | `{"bound": number, "value": number}` |
| `UPPER_BOUND` | `{"bound": number, "value": number}` |
| `OUT_OF_BOUNDS` | `{"bounds": [number, number], "value": number}` |
| `EQUALS` | `{"value": number}` |
| `NOT_EQUALS` | `{"want": number, "value": number}` |
| `TIME_ACCUMULATION` | `{"value": number, "bound": number, "timelimit": number}` |
| `ERROR_HANDLER` | `string` |
| `WARNING` | `string` |

Measured values and thresholds can also be booleans when appropriate for
the condition. `bounds` contains exactly two elements, lower then upper;
`timelimit` is expressed in seconds. The application validates the detailed
values against the ADJ.

### Protection Events (`ProtectionUpdate`)

```jsonc
{
  "topic": "protection/update",
  "payload": {
    "id": number,
    "value": number, // A boolean or enum string is also possible.
    "timestamp": {
      "hour": number,
      "minute": number,
      "second": number,
      "subsecond": number
    }
  }
}
```

The payload contains only the compound protection ID, the value that triggered
it and the board's timestamp. The ADJ catalog supplies the protection's name,
condition and severity. `ProtectionUpdate::from(packet)` builds this payload
directly from a domain `ProtectionPacket`.

### Logger Control (`LoggerEnable`, `LoggerResponse`, `LoggerVariables`)

Request the desired recording state:

```jsonc
{
  "topic": "logger/enable",
  "payload": boolean
}
```

Report the actual recording state:

```jsonc
{
  "topic": "logger/response",
  "payload": boolean
}
```

Select the measurement names to record:

```jsonc
{
  "topic": "logger/variables",
  "payload": [string]
}
```

## IDs, Ordering, and Timestamps

- Protection IDs are composed as `(position << 13) | measurement_id`.
  The high 3 bits hold the one-based protection position (`1–7`); the low
  13 bits identify the watched measurement.
- Map keys have no guaranteed order. An empty map is `{}` and an empty
  list is `[]`. Declared structure fields remain present.
- `message/update` uses `MessageTimestamp`, with RTC counter and calendar
  fields. These values are represented without timezone conversion.
- `protection/update` uses `ShortTimestamp`, containing the time of day and
  a raw `subsecond` byte. That byte's unit is unresolved and is not converted
  to milliseconds. It carries no calendar date.
- Constructing a `MessageTimestamp` from a `ShortTimestamp` requires receive
  context for the date and an explicit policy for the counter.
