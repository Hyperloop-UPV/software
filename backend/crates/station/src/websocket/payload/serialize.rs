use serde::{Deserialize, Deserializer, Serializer};
use software_core::model::{AdjId, Value};

// Serializes the value of a protection message
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

// Deserializer works the other way around as Serializer
pub(super) fn deserialize_adj_id<'de, D: Deserializer<'de>>(
    deserializer: D,
) -> Result<AdjId, D::Error> {
    u16::deserialize(deserializer).map(AdjId)
}

pub(super) fn serialize_adj_id<S: Serializer>(
    id: &AdjId,
    serializer: S,
) -> Result<S::Ok, S::Error> {
    serializer.serialize_u16(id.0)
}
