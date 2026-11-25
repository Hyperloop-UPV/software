# `packet/` — Per-Packet-Type Codecs

Each file here owns **all** the byte-level parsing for one packet type —
how many bytes a field takes, in what order, what terminates a string,
what the leading id means. That parsing never gets split out into
`tcp.rs`/`udp.rs` (the transport layer) or anywhere else. A transport
module is only ever allowed to do the one thing it structurally has no
choice about — see "The dispatcher's one unavoidable read" below — and
then hands the rest straight to one of these files.

## `data_order.rs`

Self-contained both ways: `encode`/`decode` always read/write the
leading 2-byte id themselves, since there's no dispatch ambiguity to
resolve first — a UDP datagram is unambiguously `Data`, and an order is
only ever something the backend already decided to send. Generic over
`Kind` (`model::PacketTypeTag`), written once for both `Data` and `Order` —
see its own module doc and `model/README.md`'s §4.2 for why.

## `message.rs` / `protection.rs`

These two are different: over TCP, a `Protection` frame and a `Message`
frame share the same leading 16-bit id space, so **something** has to
read that id before it even knows which of the two decoders to call.
That something is `tcp::decode_next`. To keep that reality from leaking
actual decoding logic into `tcp.rs`, both files take their id as
`Option<AdjId>` — the exact same shape:

```rust
// protection.rs
pub fn decode(reader: impl Read, compound_id: Option<AdjId>, index: &Index) -> Result<ProtectionPacket, DecodeError>;
pub fn encode(packet: &ProtectionPacket, index: &Index) -> Result<Vec<u8>, EncodeError>;

// message.rs
pub fn decode(reader: impl Read, id: Option<AdjId>, index: &Index) -> Result<MessagePacket, DecodeError>;
pub fn encode(packet: &MessagePacket, index: &Index) -> Result<Vec<u8>, EncodeError>;
```

- **`Some(known_value)`** — the caller already read it, typically
  because it had to read the leading id anyway to decide which of these
  two functions to call in the first place. In this case `reader` must
  already be positioned *right after* the id (byte 2 onward).
- **`None`** — the caller doesn't know it and isn't going to try. In
  this case `reader` must start at byte 0 of the frame, id included, and
  `decode` reads those 2 bytes itself. Either way, the id is then
  resolved against `index` — `index.packet(id)` + matching
  `PacketType::Protection`/`PacketType::Message` — to confirm it's
  actually the declared type (`UnknownId`/`WrongPacketType` otherwise). A
  message's severity is just another `PacketDef` by the time it gets
  here (see `index.rs`'s own docs) — there's no separate lookup for it.

One real difference between the two: `ProtectionPacket` stores its
`id` *and* the triggering `value` (which needs the watched measurement's
wire type, from `PacketType::Protection(measurement)`, to decode at
all). `MessagePacket` only stores `id` — its severity is metadata
*about* that id, not part of the frame's own byte layout, so `decode`
only uses `PacketType::Message(level)` to confirm the type and discards
`level` immediately; nothing about `timestamp`/`origin`/`message`'s
bytes depends on which severity it is. Look the severity up again via
`index.packet(id)` if it's needed later — it's never stored redundantly
on the decoded instance.

Either way, **every byte of this frame is parsed inside the file that
owns that packet type** — `tcp.rs` never touches a timestamp, a `resv`
byte, a measurement's wire width, or a NUL-terminated string. `encode`
always writes the leading id back out too (from `packet.id`, after
confirming via `index` it resolves to the right type), so its output is
a complete, self-contained frame — feed it straight into
`decode(reader, None, index)` and get the same packet back; that's
exactly what each file's round-trip test does.

### The dispatcher's one unavoidable read

`tcp::decode_next` still has to read the raw 2-byte id itself once, to
decide *which* of `protection::decode`/`message::decode` to call — there
is no way around this for a non-seekable stream: once those bytes are
consumed, there's no handing them to the other function's `None` path
instead. That single mechanical "read a `u16`" is the one piece of
byte-handling that's expected to exist in `tcp.rs` — it calls the exact
same private `read_id` helper `protection.rs`/`message.rs` use for their
own `None` path (defined once in `packet.rs`, `pub(super)` so `tcp.rs`
can reach it too, rather than duplicated a third time). It is not
decoding — nothing is validated or interpreted by it beyond a single
`id.0 >= 8192` comparison (a protection's compound id always has its
high 3 bits set, see `AdjId`'s own docs) — and its result is
immediately handed to the matching function as `Some(id)`, which then
resolves it against `index` itself and does everything else.

## Tests

Every file's test module proves both `Some` and `None` work, plus a
round trip through its own `encode`/`decode` (`protection.rs`,
`message.rs`) or through `encode::<Kind>`/`decode::<Kind>`
(`data_order.rs`). See each file's own tests for the exact byte layouts.
