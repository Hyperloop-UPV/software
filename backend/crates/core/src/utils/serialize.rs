use crate::model::{
    AdjId, BoardId, NumericKind, ProtectionKind, Severity, http::data::DataMeasurementKind,
};
use serde::{Serialize, Serializer};

// EXPLANATION OF THE OBJECT SERIALIZER
// When using the macro #[serde(serialize_with = "")] you specify a function
// which takes to arguments:
// - 1st with the type of the atribute you apply the object
// - 2nd with the type `Serializer`
// The second one is just for setting the specified value obtained in the function
// when the serialization occurs. Very simple.
//
// Serialize delegates the value's representation to a generic Serializer.

// Serialize domain types locally without changing the internal model.
pub(crate) fn serialize_board_id<S: Serializer>(
    id: &BoardId,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    serializer.serialize_u16(id.0)
}

pub(crate) fn serialize_adj_id<S: Serializer>(
    id: &AdjId,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    serializer.serialize_u16(id.0)
}

// Serialize numeric kind to match ADJv3 types.
pub(crate) fn get_numeric_kind(kind: &NumericKind) -> &str {
    match kind {
        NumericKind::U8 => "uint8",
        NumericKind::U16 => "uint16",
        NumericKind::U32 => "uint32",
        NumericKind::U64 => "uint64",
        NumericKind::I8 => "int8",
        NumericKind::I16 => "int16",
        NumericKind::I32 => "int32",
        NumericKind::I64 => "int64",
        NumericKind::F32 => "float32",
        NumericKind::F64 => "float64",
    }
}

// A remote derive keeps the JSON representation here, without changing model.
#[derive(Serialize)]
// Mirroring the struct `ProtectionKind`, we our rules for serialization.
#[serde(remote = "ProtectionKind", tag = "type", rename_all = "snake_case")]
enum ProtectionKindDef {
    Above { limit: f64 },
    Below { limit: f64 },
    Equal { target: f64 },
    NotEqual { target: f64 },
    Range { min: f64, max: f64 },
}

pub(crate) fn serialize_protection_kind<S: Serializer>(
    kind: &ProtectionKind,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    // We apply the serialization to this specific enum, with rules setted in the definition
    ProtectionKindDef::serialize(kind, serializer)
}

pub(crate) fn serialize_severity<S: Serializer>(
    severity: &Severity,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    serializer.serialize_str(match severity {
        Severity::Fault => "fault",
        Severity::Warning => "warning",
    })
}

// Little helper for serialize the data measurement type
#[derive(Serialize)]
struct EnumKind {
    #[serde(rename = "type")]
    type_kind: String,
    options: Vec<String>,
}

// Serializes the type of the data of the measurement, depends on each kind of measurement
pub(crate) fn serialize_data_measurement_type<S: Serializer>(
    kind: &DataMeasurementKind,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    match kind {
        // for example: NumericKind::F32 -> "type": "float32"
        DataMeasurementKind::Numeric { wire_type } => {
            serializer.serialize_str(get_numeric_kind(wire_type))
        }
        // "type": "boolean"
        DataMeasurementKind::Boolean => serializer.serialize_str("boolean"),
        // Enum types become an object containing "type": "enum" and the declared options.
        DataMeasurementKind::Enum { options } => {
            let options = options.clone();

            let enum_kind = EnumKind {
                type_kind: "enum".to_string(),
                options,
            };

            EnumKind::serialize(&enum_kind, serializer)
        }
    }
}
