//! Basic domain types: identifiers, packets, values, measurements and
//! units. No I/O and no networking here, just data and the operations
//! performed on it.
//!
//! # Upcoming modules (not written yet)
//!
//! - `value`   — [`Value`] and unit conversion (pod ⇄ display).
//! - `measurement` — the description of a measurement (its type, its ranges).
//! - `packet`  — [`Packet`] and its variants: data, order, state order, protection.
//! - `board`   — `PodData`, `Board`: a whole board with its packets.
//!
//! Add each one here with `mod name;` + `pub use name::...;` as you write
//! them, the same way it's done below with `id`.

mod id;
mod measurement;
mod value;

pub use id::{AdjId, BoardId};
pub use measurement::{Measurement, MeasurementKind, NumericKind, Range};
pub use value::Value;
