//! Measurement descriptions.
//!
//! A [`Measurement`] describes a single field of a packet, as defined by
//! the ADJ: whether it holds a number, a boolean, or the variant of an
//! enum, and, for numeric measurements, its wire type and its safe and
//! warning ranges. This is a *description*, not a decoded value — see
//! [`super::Value`] for the value itself, once decoded.

use crate::model::AdjId;

/// The wire type of a numeric measurement: how many bytes it takes on the
/// wire and whether it is signed.
///
/// This only matters while decoding. Once a number is decoded it is always
/// stored as a [`super::Value::Number`], regardless of its original wire
/// type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum NumericKind {
    /// Unsigned 8-bit integer.
    U8,
    /// Unsigned 16-bit integer.
    U16,
    /// Unsigned 32-bit integer.
    U32,
    /// Unsigned 64-bit integer.
    U64,
    /// Signed 8-bit integer.
    I8,
    /// Signed 16-bit integer.
    I16,
    /// Signed 32-bit integer.
    I32,
    /// Signed 64-bit integer.
    I64,
    /// 32-bit floating point number.
    F32,
    /// 64-bit floating point number.
    F64,
}

/// An inclusive range with an optional lower and upper bound.
///
/// Either bound can be missing, meaning that side of the range is
/// unconstrained. For example, `Range { min: Some(0.0), max: None }` means
/// "any value of 0.0 or above".
#[derive(Debug, Clone, Copy, PartialEq, Default)]
pub struct Range {
    /// The lower bound, if any.
    pub min: Option<f64>,
    /// The upper bound, if any.
    pub max: Option<f64>,
}

/// What kind of data a measurement holds, and the details specific to that
/// kind.
#[derive(Debug, Clone, PartialEq)]
pub enum MeasurementKind {
    /// A numeric measurement.
    Numeric {
        /// How the value is encoded on the wire.
        wire_type: NumericKind,
    },
    /// A boolean measurement.
    Boolean,
    /// A measurement whose value is one of a fixed set of named variants.
    Enum {
        /// The variants this measurement can take, in ADJ order.
        options: Vec<String>,
    },
}

/// The description of a single field of a packet, as defined by the ADJ.
#[derive(Debug, Clone, PartialEq)]
pub struct Measurement {
    /// The measurement's ADJid, e.g. `3000`.
    pub id: AdjId,
    /// The alias used to identify it
    pub alias: String,
    /// The human-readable name shown to the user.
    pub name: String,

    /// The units of the measurement to be shown at tefronend
    pub display_units: String,

    /// What kind of data this measurement holds.
    pub kind: MeasurementKind,

    /// The protectionst that are checked for this messurement.
    pub protections: Protections,
}
