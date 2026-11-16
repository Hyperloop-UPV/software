# ADJ HTTP (`adj::http`)

Builds serializable HTTP response bodies from a loaded `Adj`, without modifying
or consuming it. This submodule contains catalog models and builders only;
HTTP routes and server setup belong to the application.

## Catalogs

| Builder | Response | Contents | JSON example |
| --- | --- | --- | --- |
| `data_response(&adj)` | `DataResponse` | Data packets grouped by board, with measurement definitions but no protections. | [data.json](example/data.json) |
| `order_response(&adj)` | `OrderResponse` | Orders grouped by board, including parameters and their protections. | [order.json](example/order.json) |
| `protection_response(&adj)` | `ProtectionResponse` | Flat protection list and display metadata from the ADJ's `protectionTypes`. | [protection.json](example/protection.json) |

These are definitions, not live telemetry, order execution requests, or triggered
protection events. Boards and their packets/orders are sorted by ID; measurement
order is preserved. The flat protection list is sorted by packet ID, then board ID.

## Usage

Enable the `http` feature in the application's dependency:

```bash
cargo add software-core -F http
```

With an already loaded `adj`:

```rust
use software_core::adj::http::{data_response, order_response, protection_response};

let data = data_response(&adj);
let orders = order_response(&adj);
let protections = protection_response(&adj);
```

All three responses implement `serde::Serialize`, so the application can return
them as JSON using its HTTP framework. Serialization details are kept here,
without changing the internal domain model.
