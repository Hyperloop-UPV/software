//! Errors produced while translating bytes into packets and back.

use crate::model::AdjId;

/// An error decoding bytes into a packet.
#[derive(Debug, thiserror::Error)]
pub enum DecodeError {
    /// No packet is declared with this id.
    #[error("unknown packet id {0:?}")]
    UnknownId(AdjId),

    /// Ran out of bytes before a complete value could be decoded.
    #[error("not enough bytes to decode a value")]
    UnexpectedEof,

    /// An I/O error while reading from a stream (TCP only — a UDP
    /// datagram is decoded from an in-memory buffer, never a stream).
    #[error("I/O error reading a frame")]
    Io(#[from] std::io::Error),

    /// A decoded enum value's index doesn't match any of its declared
    /// options.
    #[error("enum value {index} is out of range for {options} option(s)")]
    InvalidEnumValue {
        /// The decoded index.
        index: u32,
        /// How many options the measurement declares.
        options: usize,
    },

    /// A free-text field (`origin`/`message`) had no terminating `0` byte
    /// within its maximum length.
    #[error("string field wasn't terminated within {max} bytes")]
    UnterminatedString {
        /// The field's maximum length.
        max: usize,
    },

    /// A looked-up packet exists, but isn't the kind this function expects
    /// (e.g. `packet::data::decode` found an id that resolves to an
    /// `Order`).
    #[error("packet {id:?} isn't the expected kind")]
    WrongKind {
        /// The packet whose kind didn't match.
        id: AdjId,
    },
}

/// An error encoding a packet into bytes.
#[derive(Debug, thiserror::Error)]
pub enum EncodeError {
    /// No packet is declared with this id.
    #[error("unknown packet id {0:?}")]
    UnknownId(AdjId),

    /// The order didn't provide a value for every field its declaration
    /// expects.
    #[error("order needs {expected} field(s), got {got}")]
    WrongFieldCount {
        /// How many fields the order's `PacketDef` declares.
        expected: usize,
        /// How many fields were actually given.
        got: usize,
    },

    /// A field's [`crate::model::Value`] doesn't match the kind its
    /// [`crate::model::Measurement`] declares (e.g. a `Value::Bool` for a
    /// numeric field).
    #[error("value doesn't match its declared type")]
    TypeMismatch,

    /// A numeric value doesn't fit the wire type's representable range
    /// (or is NaN).
    #[error("value {value} is out of range for this wire type ({min}..={max})")]
    OutOfRange {
        /// The value that didn't fit.
        value: f64,
        /// The wire type's minimum representable value.
        min: f64,
        /// The wire type's maximum representable value.
        max: f64,
    },

    /// A looked-up packet exists, but isn't the kind this function expects
    /// (e.g. `packet::order::encode` found an id that resolves to a
    /// `Data` packet).
    #[error("packet {id:?} isn't the expected kind")]
    WrongKind {
        /// The packet whose kind didn't match.
        id: AdjId,
    },
}
