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
    pub displa_units: String,

    /// What kind of data this measurement holds.
    pub kind: MeasurementKind,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn a_default_range_has_no_bounds() {
        let range = Range::default();
        assert_eq!(range.min, None);
        assert_eq!(range.max, None);
    }

    #[test]
    fn two_measurements_with_the_same_data_are_equal() {
        let a = Measurement {
            alias: "arming".to_string(),
            name: "Arming".to_string(),
            kind: MeasurementKind::Boolean,
        };
        let b = a.clone();
        assert_eq!(a, b);
    }

    #[test]
    fn numeric_measurements_carry_their_wire_type_and_ranges() {
        let measurement = Measurement {
            alias: "voltage".to_string(),
            name: "Voltage".to_string(),
            kind: MeasurementKind::Numeric {
                wire_type: NumericKind::F32,
                safe_range: Range {
                    min: Some(0.0),
                    max: Some(48.0),
                },
                warning_range: Range {
                    min: Some(-5.0),
                    max: Some(53.0),
                },
            },
        };

        let MeasurementKind::Numeric {
            wire_type,
            safe_range,
            ..
        } = measurement.kind
        else {
            unreachable!("measurement was just constructed as Numeric above");
        };

        assert_eq!(wire_type, NumericKind::F32);
        assert_eq!(safe_range.max, Some(48.0));
    }

    #[test]
    fn enum_measurements_list_their_options_in_adj_order() {
        let measurement = Measurement {
            id: "state".to_string(),
            name: "State".to_string(),
            kind: MeasurementKind::Enum {
                options: vec![
                    "Idle".to_string(),
                    "Operational".to_string(),
                    "Fault".to_string(),
                ],
            },
        };

        let MeasurementKind::Enum { options } = measurement.kind else {
            unreachable!("measurement was just constructed as Enum above");
        };

        assert_eq!(options, vec!["Idle", "Operational", "Fault"]);
    }
}
