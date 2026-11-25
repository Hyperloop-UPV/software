# Protocol Module

This module handles encoding and decoding of packets for communication with hardware boards over TCP and UDP transports. It implements the ADJ protocol for telemetry data, commands, messages, and protection events.

## Architecture

The protocol module follows a layered architecture:

```
┌─────────────────────────────────────────┐
│         Transport Layer                 │
│    (tcp.rs, udp.rs)                     │
├─────────────────────────────────────────┤
│         Packet Layer                    │
│  (packet/data_order.rs,                 │
│   packet/message.rs,                    │
│   packet/protection.rs)                 │
├─────────────────────────────────────────┤
│         Wire Layer                      │
│    (wire.rs)                            │
└─────────────────────────────────────────┘
```

## Directory Structure

```
protocol/
├── index.rs          # Packet definition lookup table
├── error.rs          # Decode and encode error types
├── wire.rs           # Low-level byte ↔ value conversion
├── packet.rs         # Packet-level encoding/decoding module
│   ├── data_order.rs # Data (telemetry) & Order (command) packets
│   ├── message.rs    # Free-text log message packets
│   └── protection.rs # Protection trigger packets
├── tcp.rs            # TCP transport framing
└── udp.rs            # UDP transport framing
```

## Modules

### `index.rs` - Packet Definition Lookup

Provides a fast lookup table from packet IDs (`AdjId`) to their declarations (`PacketDef`). Built once from loaded ADJ configuration data (`PodData`), it owns cloned copies of packet definitions so it can be shared across async tasks via `Arc<Index>`.

A message severity is not a separate lookup bolted onto `Index` — it's just another `PacketDef`. `Index::new(pod_data, message_levels)` takes `message_levels` as `Option<&HashMap<AdjId, MessageLevel>>` (an ADJ's `adj::AdjInfo::message_levels` — `None` for callers with no `AdjInfo` at all, e.g. most tests here) and, for each entry, synthesizes a `PacketDef { packet_type: PacketType::Message(level), board: BoardId(0), .. }` into the very same `AdjId -> PacketDef` table as every board's own packets. `BoardId(0)` (reserved, not validated — see `AdjId`/`BoardId`'s own docs) because a severity isn't owned by any one board. Resolving a message is then `Index::packet(id)` + matching `PacketType::Message(level)`, exactly like `packet::protection` already does for `PacketType::Protection`.

**Key types:**
- `Index` - HashMap-based lookup from `AdjId` to `PacketDef` (synthesized `Message` entries included)

**Key functions:**
- `Index::new(pod_data, message_levels)` - Build an index from a loaded ADJ's `PodData` and, optionally, its `AdjInfo::message_levels`
- `Index::packet(id)` - Look up a packet's declaration by id — `Data`, `Order`, `Protection` or `Message` alike

### `error.rs` - Error Types

Defines errors that can occur during packet encoding and decoding.

**Key types:**
- `DecodeError` - Errors when converting bytes to packets
  - `UnknownId` - No packet declared with this ID
  - `UnexpectedEof` - Ran out of bytes during decode
  - `Io` - I/O error reading from stream (TCP only)
  - `InvalidEnumValue` - Enum index out of range
  - `UnterminatedString` - String field not null-terminated
  - `InvalidUtf8` - String field's bytes weren't valid UTF-8
  - `WrongPacketType` - Packet exists but isn't expected type

- `EncodeError` - Errors when converting packets to bytes
  - `UnknownId` - No packet declared with this ID
  - `WrongFieldCount` - Missing or extra fields in order
  - `TypeMismatch` - Value doesn't match declared type
  - `OutOfRange` - Numeric value doesn't fit wire type
  - `WrongPacketType` - Packet exists but isn't expected type
  - `StringTooLong` - String field + terminator doesn't fit the max length
  - `EmbeddedNulByte` - String field contains a `\0` byte

### `wire.rs` - Low-Level Byte Codec

Handles conversion between raw bytes and `Value` types for individual measurements, based on their declared `MeasurementKind`. All numeric types use little-endian encoding.

**Key functions:**
- `decode_value(bytes, kind)` - Decode a single value from bytes
- `encode_value(value, kind)` - Encode a single value to bytes
- `byte_width(kind)` - Get the wire width in bytes for a measurement kind

**Supported types:**
- **Numeric** (U8, U16, U32, U64, I8, I16, I32, I64, F32, F64) - ✓ Implemented
- **Enum** (single byte index) - ✓ Implemented
- **Boolean** (single byte, zero = `false`, nonzero = `true`) - ✓ Implemented

### `packet/` - Packet-Level Encoding/Decoding

Contains per-packet-type encoding and decoding logic, independent of
transport. **Hard rule for this directory: all byte-level parsing for a
packet type lives in its own file here, never in `tcp.rs`/`udp.rs`.**
See **[`packet/README.md`](packet/README.md)** for the full design
rationale (the `Option<AdjId>` pattern below, and exactly what `tcp.rs`
is and isn't allowed to do).

#### `data_order.rs`

Handles the positional Data/Order wire shape shared by both packet types
(see `model::DataOrderPacket`'s phantom `Kind`). `encode`/`decode` are
generic over `Kind`, written once for both:
- **Order packets** (commands sent to boards) - sent over TCP
- **Data packets** (periodic telemetry from boards) - received over UDP

Self-contained both ways: they always read/write the leading 2-byte id
themselves (there's no dispatch ambiguity to resolve first here). The
backend itself only ever calls `encode` with an Order packet (via
`tcp::encode_order`) and `decode::<Data>` (via `udp::decode_datagram`) -
that direction restriction lives at the transport layer, not here.

**Key functions:**
- `encode(packet, index)` - Encode a Data or Order packet into bytes (`Kind` inferred from `packet`'s type)
- `decode::<Kind>(bytes, index)` - Decode bytes into a Data or Order packet

#### `message.rs`

Decodes free-text log messages from boards over TCP (decode only — in
production this only ever travels board → backend). `encode` also
exists, but purely for test symmetry; nothing in the real backend calls
it.

Unlike `data_order.rs`, a TCP dispatcher needs this frame's leading id
*before* it even knows to call this file (to tell a message apart from
a protection) — so, same as `protection.rs`, `id` is `Option<AdjId>`:
`Some` if the caller already read it (and `reader` starts right after
the id), `None` to have `decode` read it itself. Either way, `id` is
resolved against `index` to confirm it's actually a declared
`PacketType::Message` (`UnknownId`/`WrongPacketType` otherwise) — but unlike
`protection.rs`, the severity itself is never stored on the decoded
`MessagePacket`; it's metadata about the id, not about this particular
instance, so look it up again via `index.packet(id)` if it's needed.

**Key functions:**
- `decode(reader, id: Option<AdjId>, index)` - Decode a message frame, resolving its id itself if not given one
- `encode(packet, index)` - Test-only: encode a complete `MessagePacket` frame, id included

#### `protection.rs`

Decodes protection trigger events from boards over TCP (decode only —
in production this only ever travels board → backend). `encode` also
exists, but purely for test symmetry; nothing in the real backend calls
it.

Same `Option` pattern as `message.rs`, for the same reason: a TCP
dispatcher needs the leading id first to tell a protection apart from a
message. `compound_id: Option<AdjId>` - `Some` if the caller already
read it, `None` to have `decode` read it itself off `reader`'s first 2
bytes.

**Key functions:**
- `decode(reader, compound_id: Option<AdjId>, index)` - Decode a protection frame, resolving its id itself if not given one
- `encode(packet, index)` - Test-only: encode a complete `ProtectionPacket` frame, id included

### `tcp.rs` - TCP Transport Framing

Handles the dedicated TCP connection to each board. A TCP connection carries:
- Protection events (board → backend)
- Free-text messages (board → backend)
- Order commands (backend → board)

`decode_next` reads the frame's leading 16-bit id itself (via `packet::read_id`, `pub(super)` so `tcp` — a sibling of `packet`, not a descendant — can reach it), then dispatches purely on the raw id: `id.0 >= 8192` (`1 << 13` — a protection's compound id always has its high 3 bits set, see `AdjId`'s own docs) goes to `packet::protection::decode(reader, Some(id), index)`, anything below that to `packet::message::decode(reader, Some(id), index)`. Neither branch does its own lookup first — each `decode` already resolves `UnknownId`/`WrongPacketType` against `index` itself.

**Key types:**
- `TcpFrame` - Enum of frames that can be received over TCP (Protection, Message)

**Key functions:**
- `decode_next(reader, index)` - ✓ Implemented - Decode the next frame from a TCP stream
- `encode_order(order, index)` - ✓ Implemented - Encode an order for sending

### `udp.rs` - UDP Transport Framing

Handles the shared UDP socket for periodic telemetry. UDP datagrams are complete, already-delimited buffers containing Data packets.

**Key functions:**
- `decode_datagram(bytes, index)` - ✓ Implemented - Decode a UDP datagram into a DataPacket

## Packet Types Summary

| Packet Type | Direction | Transport | Status |
|-------------|-----------|-----------|--------|
| Data (telemetry) | Board → Backend | UDP | ✓ Implemented |
| Order (command) | Backend → Board | TCP | ✓ Implemented |
| Message (log) | Board → Backend | TCP | ✓ Implemented (decode is the only real direction; `encode` is test-only) |
| Protection (event) | Board → Backend | TCP | ✓ Implemented (decode is the only real direction; `encode` is test-only) |

## Implementation Status

- ✅ **Data packets** - Full encode/decode with tests
- ✅ **Order packets** - Full encode/decode with tests
- ✅ **Wire-level numeric types** - All numeric kinds supported with tests
- ✅ **Wire-level enum types** - Full encode/decode with tests
- ✅ **Wire-level boolean types** - Single byte, confirmed with firmware
- ✅ **Message packets** - decode implemented, with tests (encode exists for test symmetry only)
- ✅ **Protection packets** - decode implemented, with tests (encode exists for test symmetry only)
- ✅ **TCP framing** - `decode_next` implemented and tested (dispatches to protection/message by `id.0 >= 8192`)

## Testing

The module includes comprehensive unit tests for:
- Wire-level encoding/decoding for all numeric, boolean and enum types
- Order/Data packet encoding and decoding, including round trips
- Message/Protection packet decoding (timestamps, strings, values) and
  their test-only encoding, including round trips
- Error propagation for unknown IDs, wrong packet types, type mismatches,
  unterminated/invalid strings, and out-of-range values

Run tests with:
```bash
cargo test -p core protocol
```
