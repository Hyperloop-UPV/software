# HTTP Response Models (`model::http`)

Serializable models for the data, order, and protection catalogs of a loaded
ADJ. These are definitions, not live telemetry, order execution requests, or
triggered protection events.

The `http` feature enables both sides of the conversion:

- `model/http.rs` and `model/http/`: response types and their JSON representation.
- `adj/http.rs`: methods on `Adj` that build those response types without
  consuming or modifying the ADJ.

Routes, middleware, and server execution belong to the application (`station`),
not to either of these core modules. Shared custom serializers are implemented
in `utils/serialize.rs`, leaving the internal domain representation unchanged.

## Catalogs

| `Adj` method | Public response type | Station GET route | JSON example |
| --- | --- | --- | --- |
| `adj.data_response()` | `model::http::DataResponse` | `/backend/adj/DataPackets` | [data.json](example/data.json) |
| `adj.order_response()` | `model::http::OrderResponse` | `/backend/adj/OrderPackets` | [order.json](example/order.json) |
| `adj.protection_response()` | `model::http::ProtectionResponse` | `/backend/adj/ProtectionPackets` | [protection.json](example/protection.json) |

Each example is a standalone illustrative catalog, not a snapshot of the
bundled test ADJ or part of a shared vehicle fixture.

## Usage

Enable the `http` feature in the application's dependency:

```bash
cargo add software-core -F http
```

With an already loaded `adj: Adj`:

```rust
use software_core::model::http::{DataResponse, OrderResponse, ProtectionResponse};

let data: DataResponse = adj.data_response();
let orders: OrderResponse = adj.order_response();
let protections: ProtectionResponse = adj.protection_response();
```

All three responses implement `serde::Serialize`, so the application can return
them as JSON using its HTTP framework. Only these three root types are publicly
re-exported; the nested Rust response types are in crate-visible submodules.

## JSON Structure Templates

These templates keep the JSON object and array structure, replacing values
with their types: `number`, `string`, or `boolean`. Quoted values such as
`"data"` are literals. Comments explain constraints and optional properties.
These are documentation templates, not valid JSON payloads; see the linked
`.json` files for concrete values.

Each array shows one representative item but can contain zero or more items.
IDs are unsigned 16-bit integers, not strings or wrapper objects.
The catalog templates show numeric measurements and range protections;
the other possible `type` values are listed below.

### Data Catalog (`DataResponse`)

```jsonc
{
  "boards": [
    {
      "id": number,
      "name": string,
      "packets": [
        {
          "id": number,
          "name": string,
          "type": "data",
          "measurements": [
            {
              "id": number,
              "alias": string,
              "name": string,
              "display_units": string,
              "type": string // A numeric wire type, such as "float32", or "boolean"; see enum form below.
            }
          ]
        }
      ]
    }
  ]
}
```

Data measurements deliberately have no `protections` property, even if their
internal ADJ definitions declare protections.

### Order Catalog (`OrderResponse`)

```jsonc
{
  "boards": [
    {
      "id": number,
      "name": string,
      "orders": [
        {
          "id": number,
          "name": string,
          "type": "order",
          "measurements": [
            {
              "id": number,
              "alias": string,
              "name": string,
              "display_units": string,
              "type": string, // A numeric wire type, such as "float32", or "boolean"; see enum form below.
              "protections": [
                {
                  "id": number, // Compound ID, not the local position (1–7).
                  "type": {
                    "type": "range",
                    "min": number,
                    "max": number
                  },
                  "severity": string, // "fault" or "warning".
                  "time": string // Optional: omitted for a zero duration.
                }
              ]
            }
          ]
        }
      ]
    }
  ]
}
```

Only protections attached to an order's parameter measurements are included,
not every protection on its board. A parameterless order has `measurements: []`;
a parameter with no declared protections has `protections: []`.

### Protection Catalog (`ProtectionResponse`)

```jsonc
{
  "protections": [
    {
      "id": number, // Compound ID.
      "name": string,
      "board_id": number,
      "measurement_id": number,
      "type": {
        "type": "range",
        "min": number,
        "max": number
      },
      "severity": string, // "fault" or "warning".
      "time": string // Optional: omitted for a zero duration.
    }
  ],
  "info": {
    "<ADJ protection type name>": {
      "range": boolean,
      "text": string,
      "text_time": string // Optional: only included when declared in the ADJ.
    }
  }
}
```

`info` comes from `general_info.json`'s `protectionTypes`. Its keys preserve the
ADJ names exactly, whereas the inner protection discriminator uses snake_case.
For example, a protection has `protection.type.type === "range"`, but the
metadata key may be `"Range"` or `"range"`, depending on the ADJ.
Direct access such as `response.info[protection.type.type]` only works when
those keys match: the builder does not normalize them. For the conventional
capitalized ADJ names, the correspondence is:

| `protection.type.type` | Capitalized ADJ metadata key |
| --- | --- |
| `above` | `Above` |
| `below` | `Below` |
| `equal` | `Equal` |
| `not_equal` | `NotEqual` |
| `range` | `Range` |

Metadata is not synthesized for missing ADJ entries. In its text templates,
`{}` represents protection bounds and `%` the measured value. `text_time` is
omitted when the ADJ does not declare an alternative time-based template.

### Measurement `type` Values

The Rust field is called `kind`, but is serialized as the JSON property `type`
in both data and order measurements. Its value is a string for numeric and
boolean measurements, or an object for enums. There is no separate `wire_type`
property in the JSON.

Numeric measurement (field excerpt):

```jsonc
{
  "type": string // One of the numeric wire types listed below, e.g. "float32".
}
```

Numeric `type` is one of `"uint8"`, `"uint16"`, `"uint32"`, `"uint64"`,
`"int8"`, `"int16"`, `"int32"`, `"int64"`, `"float32"`, or `"float64"`.

Boolean measurement (field excerpt):

```jsonc
{
  "type": "boolean"
}
```

Enum measurement (field excerpt):

```jsonc
{
  "type": {
    "type": "enum",
    "options": [string]
  }
}
```

Numeric measurements do not carry separate safe/warning ranges; protection
definitions carry conditions and severity instead. `display_units` remains
present even when it is `""`.

### Protection `type` Values

The Rust protection field is also called `kind`, but is serialized as `type`.
Unlike numeric and boolean measurement types, its JSON value is always an
object, with its own `type` discriminator and the condition's bound(s).
The following are field excerpts from a protection object:

| Condition | JSON-shaped type template |
| --- | --- |
| Above a limit | `{"type": {"type": "above", "limit": number}}` |
| Below a limit | `{"type": {"type": "below", "limit": number}}` |
| Equal to a target | `{"type": {"type": "equal", "target": number}}` |
| Not equal to a target | `{"type": {"type": "not_equal", "target": number}}` |
| Outside a range | `{"type": {"type": "range", "min": number, "max": number}}` |

The protection `range` variant always has both bounds.

## IDs, Ordering, and Optional Fields

- Protection IDs in both order and protection responses are composed as
  `(position << 13) | measurement_id`: the high 3 bits hold the one-based
  position (`1–7`), and the low 13 bits hold the measurement ID. For measurement
  `3001`, the first two protections are `11193` and `19385`. The internal
  `Protection::id` still stores only the local position.
- Boards are sorted by ID; their data packets or orders are sorted by ID.
  Boards without matching packets/orders are retained with an empty array.
- Measurement order, enum option order, and order-parameter protection order
  follow the ADJ. The flat protection catalog is sorted by compound packet ID,
  then board ID; the keys of `info` have no guaranteed order.
- Catalog arrays remain present even when empty. An empty ADJ yields
  `{"boards": []}` for data and orders, and
  `{"protections": [], "info": {}}` for protections.

### Protection Duration (`time`)

`time` is a duration string, not a timestamp. It is omitted for
`Duration::ZERO`, not serialized as `null` or `"0ns"`.

For positive durations, the formatter chooses an exact integer representation:

1. Milliseconds (`ms`) when the nanosecond count is divisible by `1_000_000`.
2. Otherwise microseconds (`us`) when it is divisible by `1_000`.
3. Otherwise nanoseconds (`ns`).

No precision is discarded during this formatting step. For example:

| Duration | Serialized `time` |
| --- | --- |
| Zero | Property omitted |
| 1 second | `"1000ms"` |
| 1500 microseconds | `"1500us"` |
| 1500 nanoseconds | `"1500ns"` |

This rule applies to protection `time`, not to the metadata template string
`text_time`, which is copied from the ADJ and omitted when absent.
