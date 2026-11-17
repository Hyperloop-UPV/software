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
the other possible `kind` shapes are listed below.

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
              "kind": {
                "type": "numeric",
                "wire_type": string
              }
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
              "kind": {
                "type": "numeric",
                "wire_type": string
              },
              "protections": [
                {
                  "id": number, // Compound ID, not the local position (1–7).
                  "kind": {
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
      "kind": {
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
ADJ names, such as `"Range"` and `"NotEqual"`, whereas `kind.type` uses
`"range"` and `"not_equal"`. **Do not index `info` directly with `kind.type`**
when the ADJ uses those names: the current response does not normalize the keys.
For these conventional ADJ names, the correspondence is:

| `kind.type` | ADJ metadata key |
| --- | --- |
| `above` | `Above` |
| `below` | `Below` |
| `equal` | `Equal` |
| `not_equal` | `NotEqual` |
| `range` | `Range` |

Metadata is not synthesized for missing ADJ entries. In its text templates,
`{}` represents protection bounds and `%` the measured value. `text_time` is
omitted when the ADJ does not declare an alternative time-based template.

### Measurement `kind` Variants

Each measurement has exactly one of these objects as its `kind` value:

Numeric:

```jsonc
{
  "type": "numeric",
  "wire_type": string
}
```

`wire_type` is one of `"uint8"`, `"uint16"`, `"uint32"`, `"uint64"`,
`"int8"`, `"int16"`, `"int32"`, `"int64"`, `"float32"`, or `"float64"`.

Boolean:

```jsonc
{
  "type": "boolean"
}
```

Enum:

```jsonc
{
  "type": "enum",
  "options": [string]
}
```

Numeric measurements do not carry separate safe/warning ranges; protection
definitions carry conditions and severity instead. `display_units` remains
present even when it is `""`.

### Protection `kind` Variants

Each protection has exactly one of these objects as its `kind` value:

| Condition | JSON-shaped type template |
| --- | --- |
| Above a limit | `{"type": "above", "limit": number}` |
| Below a limit | `{"type": "below", "limit": number}` |
| Equal to a target | `{"type": "equal", "target": number}` |
| Not equal to a target | `{"type": "not_equal", "target": number}` |
| Outside a range | `{"type": "range", "min": number, "max": number}` |

The protection `range` variant always has both bounds.