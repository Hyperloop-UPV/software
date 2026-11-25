use serde::{Deserialize, Deserializer, Serializer};
use software_core::model::{AdjId, Value};

/// Emits a scalar JSON value for a protection event. Enums use the variant name.
pub(super) fn serialize_value<S: Serializer>(
    value: &Value,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    match value {
        Value::Number(value) => serializer.serialize_f64(*value),
        Value::Bool(value) => serializer.serialize_bool(*value),
        Value::Enum(value) => serializer.serialize_str(value),
    }
}

/// Reads an ADJ ID from an unsigned 16-bit JSON integer.
pub(super) fn deserialize_adj_id<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<AdjId, D::Error> {
    u16::deserialize(deserializer).map(AdjId)
}

/// Writes an ADJ ID as a JSON integer.
pub(super) fn serialize_adj_id<S: Serializer>(
    id: &AdjId,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    serializer.serialize_u16(id.0)
}
