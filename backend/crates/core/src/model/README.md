# Model Module

## Introduction

This module is meant to store and organize all the different structs, enums and other data structures necessary for the backend project.

## 1. `board.rs`
All structs and enums needed for the Pod can be found defined in this file.
### 1.1 `PacketKind`
Enum used to define what kind of packet a `PacketDef` declares. Not every kind carries the same shape, so each variant holds whatever measurement data is actually meaningful for it, instead of every packet being forced through one shared field.

#### `Data(Vec<Measurement>)`
Telemetry sent by a board: one value per measurement, decoded positionally in this order.
#### `Protection(Measurement)`
The single measurement one of a board's declared protections watches. Always exactly one — never a list.
#### `Order(Vec<Measurement>)`
An order sent to a board. Many orders take no parameters at all, so this can be empty.
#### `Message`
A free-text log line. Never carries measurement data.

`PacketKind` also exposes a `measurements()` method that flattens any variant into a `&[Measurement]` slice, for code that just wants every measurement a packet references regardless of its kind.

### 1.2 `PacketDef`
Struct used to define the structure of a packet a board can send or recieve.

#### `id`
ID of a packet, using the AdjId type which is a u16. Structure of ID is defined by the ADJ documentation.
#### `board`
The owning board's `BoardId`. Carried here too (not just reachable through the owning `Board`) so anything holding just a `&PacketDef` — e.g. a lookup table indexed by `AdjId` — knows which board it belongs to without a separate index back to it.
#### `name`
Human-readable String shown to the user to identify packet.
#### `kind`
`PacketKind` enum: both what kind of packet this is, and the measurement shape — if any — specific to that kind.

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

### 4.2 `DataPacket`
Struct for the decoded values of the measurements a board just sent. Values are positional: they are not individually tagged with their measurement ID, but written in the order their `Measurement`s appear in this packet's `PacketKind::Data` list.

#### `id`
Which packet definition this is an instance of (`AdjId`).
#### `values`
Vector list of decoded values (`Vec<Value>`) corresponding positionally to the packet definition's measurements.

### 4.3 `OrderPacket`
An order sent from the backend to a board. Also positional, matching field definitions in order.

#### `id`
Which order definition this is an instance of (`AdjId`).
#### `fields`
Vector list of values (`Vec<Value>`) to set for each field of the order.

### 4.4 `ProtectionPacket`
Sent by a board when one of its declared protections triggers.

#### `measurement`
The measurement this protection watches (`AdjId`).
#### `protection`
Which of that measurement's protections triggered (`AdjId`).
#### `timestamp`
When the protection triggered (`ShortTimestamp`).
#### `value`
The value that triggered the protection (`Value`), decoded with the same wire type as the watched measurement.

### 4.5 `MessageLevel`
Enum indicating how severe a message is (reusing `general_info.json`'s `message_ids`). Distinct from `Severity` because message and protection formats are separate in ADJv3.

#### `Fault`
Stops the vehicle automatically.
#### `Warning`
Flags something unexpected, without stopping the vehicle.
#### `Info`
Informational message, no action implied.
#### `Panic`
An unrecoverable firmware error.

### 4.6 `MessagePacket`
A free-text message sent by a board.

#### `level`
How severe the message is (`MessageLevel`).
#### `timestamp`
When the message was sent (`ShortTimestamp`).
#### `origin`
Source identifier, such as a source file path (`String`).
#### `message`
The text contents of the message (`String`).

### 4.7 `Packet`
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