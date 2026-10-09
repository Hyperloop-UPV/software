# Model Module

## Introduction

This module is meant to store and organize all the different structs, enums and other data structures necessary for the backend project.

## 1. `board.rs`
All structs and enums needed for the Pod can be found defined in this file.
### 1.1 `PacketKind`
Enum used to define the three different types of packets.

#### `Data`
Measurement sent by a board.
#### `Protection`
Measurement with a protection.
#### `Order`
An order sent to a board.

### 1.2 `PacketDef`
Struct used to define the structure of a packet a board can send or recieve.

#### `id`
ID of a packet, using the AdjId type which is a u16. Structure of ID is defined by the ADJ documentation.
#### `name`
Human-readable String shown to the user to identify packet.
#### `kind`
PacketKind Enum used to classify each packet.
#### `measurements`
Vector list of measurements attached to a packet.

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
The Vector list of packets this board can send or receive.

### 1.4 `PodData`
Struct used to package all the structs of a vehicle.
#### `boards`
Vector list of boards in the Pod


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
`Packet` is a single message actually sent or received over the wire, once decoded. This is the *instance* — as opposed to`super::Measurement` and `super::Protection`, which describe what a packet or a protection *can* look like, or `super::PacketDef`, which describes a whole packet.

### 4.1 `ShortTimestamp`
A short timestamp carrying only the time of day: hour, minute, second and a sub-second fraction, each one byte.

#### `hour`
Hour of Timestamp of values 0-23.
#### `minute`
Minute of Timestamp of values 0-60.
#### `second`
Second of Timestamp of values 0-60.
#### `subsecond`
The sub-second fraction, as the raw byte on the wire.Its exact unit (e.g. milliseconds, or 1/256ths of a second) hasn't been confirmed yet, so it is kept as a raw `u8` here instead of converted to something like a `Duration` — convert it once the unit is settled.

### 4.2 `DataPacket`
Struct for the decoded values of the measurements a board just sent.

#### `id`
AdjId of packet.