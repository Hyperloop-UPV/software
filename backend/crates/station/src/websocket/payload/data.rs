use super::serialize::serialize_adj_id;
use serde::Serialize;
use software_core::model::AdjId;
use std::collections::HashMap;

/// Latest telemetry per packet for `podData/update`. Packet IDs are JSON object keys.
pub type DataUpdate = HashMap<u16, DataPacketUpdate>;

/// Current telemetry and statistics for one packet.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DataPacketUpdate {
    /// ADJ packet id, serialized as a number.
    #[serde(serialize_with = "serialize_adj_id")]
    pub id: AdjId,
    /// Hexadecimal representation of the received packet.
    pub hex_value: String,
    /// Number of packets received under this id.
    pub count: u64,
    /// Averaged interval between packets, in the legacy timestamp's units.
    pub cycle_time: u64,
    /// Updates keyed by the measurement's textual alias.
    pub measurement_updates: HashMap<String, MeasurementUpdate>,
}

/// Numeric measurements carry statistics. Booleans and enum names use JSON primitives.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(untagged)]
pub enum MeasurementUpdate {
    /// Numeric measurement and its moving average.
    Numeric {
        /// Most recently received value.
        last: f64,
        /// Moving average of the received values.
        average: f64,
    },
    /// Most recently received boolean.
    Boolean(bool),
    /// Most recently received enum variant.
    Enum(String),
}
