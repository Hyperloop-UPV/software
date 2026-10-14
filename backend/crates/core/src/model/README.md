# Model Module

## Introduction

This module is meant to store and organize all the different structs, enums and other data structures necessary for the backend project.

## 1. `board.rs`
All structs and enums needed for the Pod can be found defined in this file.
### 1.1 `PacketType`
Enum used to define what type of packet a `PacketDef` declares. Not every type carries the same shape, so each variant holds whatever measurement data is actually meaningful for it, instead of every packet being forced through one shared field.

#### `Data(Vec<Measurement>)`
Telemetry sent by a board: one value per measurement, decoded positionally in this order.
#### `Protection(Measurement)`
The single measurement one of a board's declared protections watches. Always exactly one — never a list.
#### `Order(Vec<Measurement>)`
An order sent to a board. Many orders take no parameters at all, so this can be empty.
#### `Message(MessageLevel)`
A free-text log line of this severity. Never carries measurement data — the severity is the only thing that tells one `Message` `PacketDef` apart from another. Lives here, on `PacketType`, rather than as a separate field on `PacketDef`: a message's severity is as much part of "what type of packet is this" as a `Data` packet's measurement list is.

`PacketType` also exposes a `measurements()` method that flattens any variant into a `&[Measurement]` slice, for code that just wants every measurement a packet references regardless of its type.

### 1.2 `PacketDef`
Struct used to define the structure of a packet a board can send or recieve.

#### `id`
ID of a packet, using the AdjId type which is a u16. Structure of ID is defined by the ADJ documentation.
#### `board`
The owning board's `BoardId`. Carried here too (not just reachable through the owning `Board`) so anything holding just a `&PacketDef` — e.g. a lookup table indexed by `AdjId` — knows which board it belongs to without a separate index back to it.
#### `name`
Human-readable String shown to the user to identify packet.
#### `packet_type`
`PacketType` enum: both what type of packet this is, and the measurement shape — if any — specific to that type.

### 1.3 `Board`
Struct used to identify a single board in the vehicle.

#### `id`
Board's unique Id in u16 format.
#### `name`
Boards name. Eg. "BSU".
#### `ip`
Board's IpAddress used to open TCP/UDP connections.
#### `mac`
Board's MAC address
#### `packets`
The packets this board can send or receive, as a `HashMap<AdjId, PacketDef>` keyed by id — the ADJ gives packets no meaningful order, so this is a map, not a list.

### 1.4 `PodData`
Struct used to package all the structs of a vehicle.
#### `boards`
Every board of the vehicle, as a `HashMap<BoardId, Board>` keyed by id — the ADJ doesn't give boards any meaningful order either.


## 2. `id.rs`
Defined as their own types (wrapping a `u16`) instead of using a plain `u16`, so the compiler won't let an `AdjId` be confused with a `BoardId` by mistake, even though both are just numbers underneath
### 2.1 `AdjId`
ID of an ADJ packet in u16. Structure of ID can be found in the ADJ documentation.

For a protection's compound id (the high 3 bits are the protection's position, the low 13 bits the watched measurement's id — see the struct's own docs for the full range table), `AdjId` exposes the split as two methods instead of leaving every caller to redo the shift/mask:
- `protection_position() -> u8`: the high 3 bits (`0` for a normal, non-protection id).
- `measurement_id() -> AdjId`: the id with its high 3 bits zeroed out — the watched measurement's own id.
### 2.2 `BoardId`
Unique identifier of a board, defined by the ADJ documentation.
### 2.3 `MacAddress`
A board's physical MAC address, as 6 raw bytes.


## 3. `measurement.rs`
A `Measurement` describes a single field of a packet, as defined by the ADJ: whether it holds a number, a boolean, or the variant of an enum, and, for numeric measurements, its wire type and its safe and warning ranges. This is a *description*, not a decoded value — see`super::Value` for the value itself, once decoded.

### 3.1 `NumericKind`
Enum used to classify every numerical value type a measurement can use.
- Unsigned 8-bit integer (`U8`)
- Unsigned 16-bit integer (`U16`)
- Unsigned 32-bit integer (`U32`)
- Unsigned 64-bit integer (`U64`)
- Signed 8-bit integer (`I8`)
- Signed 16-bit integer (`I16`)
- Signed 32-bit integer (`I32`)
- Signed 64-bit integer (`I64`)
- 32-bit floating point number (`F32`)
- 64-bit floating point number (`F64`)

### 3.2 `Range`
Struct used to define a maximum and minimum value of any measurement.
#### `min`
#### `max`

### 3.3 `MeasurementKind`
Enum used to classify the kind of measurement.
#### `Numeric`
#### `Boolean`
#### `Enum`

### 3.4 `Measurement`
Struct used to define a measurement.
#### `id`
The measurement's numeric ADJ id.
#### `alias`
The legacy textual identifier, used by code generation
#### `name`
The human-readable string shown to the user.
#### `display_units`
Name of the unit of measurement to display to user. Eg. "ºC".
#### `kind`
Usees MeasurementKind enum to classify what type this measurement holds.
#### `protections`
Vector list of protections. Maximum of 7 per measurement.

## 4. `packet.rs`
- `Packet` is a single message actually sent or received over the wire, once decoded. This is the *instance* — as opposed to `super::Measurement` and `super::Protection`, which describe what a packet or a protection *can* look like, or `super::PacketDef`, which describes a whole packet.

### 4.1 `ShortTimestamp`
A short timestamp carrying only the time of day: hour, minute, second and a sub-second fraction, each one byte. Used by `ProtectionPacket` and `MessagePacket`. Only records *when today* something happened; the date is assumed to be the day the packet was received.

#### `hour`
Hour of Timestamp of values 0–23.
#### `minute`
Minute of Timestamp of values 0–59.
#### `second`
Second of Timestamp of values 0–59.
#### `subsecond`
The sub-second fraction, as the raw byte on the wire. Its exact unit (e.g. milliseconds, or 1/256ths of a second) hasn't been confirmed yet, so it is kept as a raw `u8` here instead of converted to something like a `Duration` — convert it once the unit is settled.

### 4.2 `DataOrderPacket<Kind>` — a phantom type
`DataPacket` and `OrderPacket` hold the exact same shape (`id: AdjId`, `values: Vec<Value>`, both positional — see below), so they're both built on one generic struct, `DataOrderPacket<Kind>`, instead of being copy-pasted. The two used to just be `type` aliases for the very same concrete struct (`type OrderPacket = DataOrderPacket; type DataPacket = DataOrderPacket;`) — which meant they weren't actually distinct types at all: nothing stopped a `DataPacket` just decoded off the UDP socket from being passed to `protocol::tcp::encode_order` (which wants an *order* to send) by mistake, the compiler had no way to tell them apart.

`Kind` fixes that. It's a *phantom* type parameter — `DataOrderPacket` doesn't actually store a `Kind` value (there's nothing to store, see `Data`/`Order` below), it only exists so the compiler tracks which one a given packet was built as:
```rust
pub struct DataOrderPacket<Kind> {
    pub id: AdjId,
    pub values: Vec<Value>,
    _marker: PhantomData<Kind>,
}
```
`_marker` is private, so a `DataOrderPacket` can't be built with struct-literal syntax from outside `packet.rs` — use `DataOrderPacket::new(id, values)` (or, through the aliases below, `DataPacket::new(...)`/`OrderPacket::new(...)`) instead.

#### `Data` / `Order`
Two empty marker structs — the only two types `Kind` is ever instantiated with. Neither is ever actually constructed; they only ever appear as a type argument. That's what makes the whole thing *phantom*: the type parameter has no representation in the compiled struct, it's erased after type-checking, the same way `id.rs` (§2) uses distinct `AdjId`/`BoardId` types so the compiler won't confuse two different kinds of `u16`.

#### `PacketTypeTag`
The compiler erases `Kind` after type-checking, so nothing at runtime can look at a `DataOrderPacket<Kind>` and ask "is this actually a `Data` one?" — `PacketTypeTag` is how code that's generic over `Kind` answers that anyway, by asking the question of the *type* instead of the *value*:
```rust
pub trait PacketTypeTag {
    fn matches(packet_type: &PacketType) -> bool;
}
```
`Data`/`Order` each implement it by checking which `PacketType` (§1.1) variant they stand for (`matches!(packet_type, PacketType::Data(_))` / `PacketType::Order(_)`). This is the only thing `PacketTypeTag` decides — once a `PacketDef`'s type is confirmed to match, the actual measurement list still comes from the existing `PacketType::measurements()` (§1.1), not from `PacketTypeTag` itself.

`protocol::packet::data_order`'s `encode`/`decode` use this to be generic over `Kind`: written once, they work for both `DataPacket` and `OrderPacket` instead of needing a near-duplicate pair of functions per type.

#### `DataPacket` / `OrderPacket`
```rust
pub type DataPacket = DataOrderPacket<Data>;
pub type OrderPacket = DataOrderPacket<Order>;
```
Now genuinely different types: a function that takes an `OrderPacket` cannot be called with a `DataPacket`, even though both just wrap the same `(AdjId, Vec<Value>)` underneath — the mix-up is a compile error instead of a bug waiting to happen. `DataOrderPacket`'s own doc comment has a `compile_fail` doctest proving exactly that (run by `cargo test`, like any other doctest).

`DataPacket` holds the decoded values of the measurements a board just sent — positional, not individually tagged with their measurement ID, just written in the order their `Measurement`s appear in this packet's `PacketType::Data` list.

`OrderPacket` holds an order sent from the backend to a board — positional the same way, matching `PacketType::Order`'s measurement list.

#### `id`
Which packet/order definition this is an instance of (`AdjId`).
#### `values`
Vector list of decoded values (`Vec<Value>`) corresponding positionally to the packet definition's measurements.

### 4.3 `ProtectionPacket`
Sent by a board when one of its declared protections triggers.

#### `id`
The compound wire id this protection triggered under (`AdjId`). Use `id.measurement_id()` for the measurement it watches and `id.protection_position()` for which of that measurement's protections this is (see `Protection::id`). Kept as a single field rather than storing both halves separately — they're never independent of each other, so a second field would only add a second place for them to disagree.
#### `timestamp`
When the protection triggered (`ShortTimestamp`).
#### `value`
The value that triggered the protection (`Value`), decoded with the same wire type as the watched measurement.

### 4.4 `MessageLevel`
Enum indicating how severe a message is (reusing `general_info.json`'s `message_ids`). Distinct from `Severity` because message and protection formats are separate in ADJv3.

#### `Fault`
Stops the vehicle automatically.
#### `Warning`
Flags something unexpected, without stopping the vehicle.
#### `Info`
Informational message, no action implied.
#### `Panic`
An unrecoverable firmware error.

`MessageLevel` also exposes:
- `ALL: [MessageLevel; 4]` — every severity, for code that needs to go through each one (e.g. building a lookup from a loaded ADJ's `message_ids`).
- `name(self) -> &'static str` — this severity's key in `general_info.json`'s `message_ids` (`"fault"`, `"warning"`, `"info"`, `"panic"`).
- `from_name(name: &str) -> Option<MessageLevel>` — the inverse of `name()`; `None` if `name` isn't one of the four.

This is deliberately where the name↔severity association lives — in `model`, not `adj` or `protocol` — since it's domain knowledge about the severity itself. `adj::AdjInfo::message_levels` (see `adj/README.md`) calls into `name()`/`ALL` to build its id→severity lookup rather than hardcoding `"fault"`/`"warning"`/`"info"`/`"panic"` itself.

### 4.5 `MessagePacket`
A free-text message sent by a board.

#### `id`
The wire id this message was sent under — one of the severities declared in `general_info.json`'s `message_ids`. Not a `MessageLevel` directly, the same way `ProtectionPacket::id` isn't a `Protection`: resolving it to a severity means looking it up (`PacketType::Message`/`protocol::Index`), not storing a second, redundant copy of it here.
#### `timestamp`
When the message was sent (`ShortTimestamp`).
#### `origin`
Source identifier, such as a source file path (`String`).
#### `message`
The text contents of the message (`String`).

### 4.6 `Packet`
Enum representing any packet actually sent or received over the wire, once decoded.

#### `Data`
Wraps a `DataPacket` (measurement data sent by a board).
#### `Order`
Wraps an `OrderPacket` (command sent to a board).
#### `Protection`
Wraps a `ProtectionPacket` (triggered protection event).
#### `Message`
Wraps a `MessagePacket` (free-text log/diagnostic message).

## 5. `protection.rs`
A `Protection` is a bound checked against a measurement's decoded value, as declared in the ADJ (`<PLACA>_measurements.json`). This defines the *declaration* (what to watch for, thresholds, and severity) rather than the runtime wire packet emitted when triggered (`ProtectionPacket` in `packet.rs`). In ADJv3, protections and messages are distinct formats with separate lifecycles.

### 5.1 `ProtectionKind`
Enum defining the condition a protection evaluates and the associated threshold bound(s). Modeled as data-carrying variants to ensure compile-time validity instead of untyped lists.

#### `Above`
Triggers when the value exceeds `limit` (`f64`).
#### `Below`
Triggers when the value drops below `limit` (`f64`).
#### `Equal`
Triggers when the value equals forbidden `target` (`f64`).
#### `NotEqual`
Triggers when the value deviates from expected `target` (`f64`).
#### `Range`
Triggers when the value leaves the closed `[min, max]` interval (`min: f64`, `max: f64`). Both bounds are strictly required.

### 5.2 `Severity`
Enum indicating the operational severity level of a triggered protection.

#### `Fault`
Critical error that stops the vehicle automatically.
#### `Warning`
Flags the condition as anomalous without halting vehicle operation.

### 5.3 `Protection`
Struct defining a single protection rule attached to a measurement.

#### `id`
The protection's relative slot index within its parent measurement's protection list, stored as an `AdjId` in the `1–7` range. This is a local index rather than a global ID; it forms the upper 3 bits of the compound wire identifier alongside the 13-bit measurement ID.
#### `kind`
The evaluation rule and threshold bounds (`ProtectionKind`).
#### `severity`
The operational impact level when triggered (`Severity`).
#### `time`
Duration the measured value must remain out of bounds before the protection trips (`Duration`). A value of `Duration::ZERO` indicates an instantaneous trigger.

## 6. `value.rs`
Defines how the backend represents a piece of data once decoded, regardless of its original wire representation. While the ADJ supports various integer and floating-point types on the wire (captured during decoding by `NumericKind`), all numeric values normalize to `f64` once inside the backend.

### 6.1 `Value`
Enum representing a single decoded measurement or field value.

#### `Number(f64)`
A numeric measurement, regardless of its original wire type (`u8`, `i32`, `f32`, etc.).
#### `Bool(bool)`
A boolean measurement (`true` or `false`).
#### `Enum(String)`
The selected variant name of an enumerated measurement (e.g. `"Operational"`).