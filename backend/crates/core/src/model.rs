//! Basic domain types: identifiers, packets, values, measurements,
//! protections and boards. No I/O and no networking here, just data and
//! the operations performed on it.
//!
//! - `id`          — `AdjId`, `BoardId`, `MacAddress`.
//! - `value`       — `Value`, the result of decoding a measurement.
//! - `measurement` — `Measurement`: what a field of a packet looks like.
//! - `protections` — `Protection`: bounds declared for a measurement.
//! - `packet`      — `Packet` and its variants: data, order,
//!   protection packet, message.
//! - `board`       — `PodData`, `Board`, `PacketDef`: the whole vehicle.

mod board;
mod id;
mod measurement;
mod packet;
mod protections;
mod value;

pub use board::{Board, PacketDef, PacketKind, PodData};
pub use id::{AdjId, BoardId, MacAddress};
pub use measurement::{Measurement, MeasurementKind, NumericKind, Range};
pub use packet::{
    DataPacket, MessageLevel, MessagePacket, OrderPacket, Packet, ProtectionPacket, ShortTimestamp,
};
pub use protections::{Protection, ProtectionKind, Severity};
pub use value::Value;
