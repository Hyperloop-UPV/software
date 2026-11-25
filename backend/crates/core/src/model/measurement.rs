//! Measurement descriptions.
//!
//! A [`Measurement`] describes a single field of a packet, as defined by
//! the ADJ: whether it holds a number, a boolean, or the variant of an
//! enum, and, for numeric measurements, its wire type and its safe and
//! warning ranges. This is a *description*, not a decoded value — see
//! [`super::Value`] for the value itself, once decoded.

use super::protections::Protection;
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
    /// The measurement's numeric ADJ id, e.g. `3000`.
    pub id: AdjId,

    /// The legacy textual identifier, used by code generation.
    pub alias: String,

    /// The human-readable name shown to the user.
    pub name: String,

    /// The name of the unit to display at the frontend, e.g. `"ºC"`.
    pub display_units: String,

    /// What kind of data this measurement holds.
    pub kind: MeasurementKind,

    /// The protections that are checked for this measurement, in ADJ
    /// order. The ADJ limits this list to 7 entries per measurement, but
    /// that limit is enforced by the ADJ validator, not by this type.
    pub protections: Vec<Protection>,
}

#[cfg(test)]
mod tests {
    use super::*;

    fn base(kind: MeasurementKind) -> Measurement {
        Measurement {
            id: AdjId(3000),
            alias: "temperature_1".to_string(),
            name: "Temperature 1".to_string(),
            display_units: "ºC".to_string(),
            kind,
            protections: vec![],
        }
    }

    #[test]
    fn a_numeric_measurement_carries_its_wire_type() {
        let measurement = base(MeasurementKind::Numeric {
            wire_type: NumericKind::F32,
        });

        let MeasurementKind::Numeric { wire_type } = measurement.kind else {
            unreachable!("measurement was just constructed as Numeric above");
        };

        assert_eq!(wire_type, NumericKind::F32);
    }

    #[test]
    fn an_enum_measurement_lists_its_options_in_adj_order() {
        let measurement = base(MeasurementKind::Enum {
            options: vec![
                "Idle".to_string(),
                "Operational".to_string(),
                "Fault".to_string(),
            ],
        });

        let MeasurementKind::Enum { options } = measurement.kind else {
            unreachable!("measurement was just constructed as Enum above");
        };

        assert_eq!(options, vec!["Idle", "Operational", "Fault"]);
    }

    #[test]
    fn two_measurements_with_the_same_data_are_equal() {
        let a = base(MeasurementKind::Boolean);
        let b = a.clone();
        assert_eq!(a, b);
    }

    #[test]
    fn measurements_with_different_protections_are_not_equal() {
        let a = base(MeasurementKind::Boolean);
        let mut b = a.clone();
        b.protections.push(Protection {
            id: AdjId(1),
            kind: crate::model::ProtectionKind::Above { limit: 100.0 },
            severity: crate::model::Severity::Fault,
            time: std::time::Duration::ZERO,
        });

        assert_ne!(a, b);
    }
}
