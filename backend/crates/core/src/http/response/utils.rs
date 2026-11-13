use crate::model::{AdjId, BoardId, NumericKind, ProtectionKind, Severity};
use serde::{Serialize, Serializer};

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
pub(crate) fn serialize_numeric_kind<S: Serializer>(
    kind: &NumericKind,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    let name = match kind {
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
    };
    serializer.serialize_str(name)
}

// A remote derive keeps the JSON representation here, without changing model.
#[derive(Serialize)]
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
    ProtectionKindDef::serialize(kind, serializer)
}

// This endpoint indexes general_info.json's protectionTypes by the original
// ADJ names. Keep the order response's existing snake_case format unchanged.
#[derive(Serialize)]
#[serde(remote = "ProtectionKind", tag = "type")]
enum AdjProtectionKindDef {
    Above { limit: f64 },
    Below { limit: f64 },
    Equal { target: f64 },
    NotEqual { target: f64 },
    Range { min: f64, max: f64 },
}

pub(crate) fn serialize_adj_protection_kind<S: Serializer>(
    kind: &ProtectionKind,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    AdjProtectionKindDef::serialize(kind, serializer)
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
