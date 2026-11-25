use super::serialize::{serialize_adj_id, serialize_value};
use serde::Serialize;
use serde_json::Value as JsonValue;

use software_core::model::{AdjId, ProtectionPacket, ShortTimestamp, Value};

/// Payload of `protection/update`: the triggered id, measured value and time.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ProtectionUpdate {
    /// Compound ID used to look up the protection definition in the ADJ catalog.
    #[serde(serialize_with = "serialize_adj_id")]
    pub id: AdjId,
    /// Value that triggered the protection, serialized as a JSON primitive.
    #[serde(serialize_with = "serialize_value")]
    pub value: Value,
    /// Time of day supplied by the board, with its original subsecond byte.
    #[serde(with = "ShortTimestampJson")]
    pub timestamp: ShortTimestamp,
}

impl From<ProtectionPacket> for ProtectionUpdate {
    fn from(packet: ProtectionPacket) -> Self {
        Self {
            id: packet.id,
            value: packet.value,
            timestamp: packet.timestamp,
        }
    }
}

// Defines the frontend timestamp fields locally via Serde's remote derive.
#[derive(Serialize)]
#[serde(remote = "ShortTimestamp")]
struct ShortTimestampJson {
    hour: u8,
    minute: u8,
    second: u8,
    subsecond: u8,
}

/// Legacy protection details used only by `message/update`.
///
/// Values retain their JSON number or boolean representation. ADJ validation
/// and conversion from domain packets belong to the publisher.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "kind", content = "data", rename_all = "SCREAMING_SNAKE_CASE")]
pub enum ProtectionPayload {
    /// A value dropped below its lower bound.
    LowerBound {
        /// Lower bound.
        bound: JsonValue,
        /// Value that triggered the protection.
        value: JsonValue,
    },
    /// A value exceeded its upper bound.
    UpperBound {
        /// Upper bound.
        bound: JsonValue,
        /// Value that triggered the protection.
        value: JsonValue,
    },
    /// A value left the allowed interval.
    OutOfBounds {
        /// Lower and upper bounds, in that order.
        bounds: [JsonValue; 2],
        /// Value that triggered the protection.
        value: JsonValue,
    },
    /// A value matched the protected value.
    Equals {
        /// Value that triggered the protection.
        value: JsonValue,
    },
    /// A value differed from the expected value.
    NotEquals {
        /// Expected value.
        want: JsonValue,
        /// Value that triggered the protection.
        value: JsonValue,
    },
    /// The legacy time-accumulation protection.
    TimeAccumulation {
        /// Value that triggered the protection.
        value: JsonValue,
        /// Threshold.
        bound: JsonValue,
        /// Time limit in seconds.
        timelimit: f32,
    },
    /// Legacy firmware error text.
    ErrorHandler(String),
    /// Legacy warning text.
    Warning(String),
}
