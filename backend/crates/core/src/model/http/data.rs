//! ADJ v3 data packet catalog returned by `/backend/adj/DataPackets`.

use serde::Serialize;

use crate::{
    model::{AdjId, BoardId, NumericKind},
    utils::serialize::{serialize_adj_id, serialize_board_id, serialize_numeric_kind},
};

/// Data packet definitions grouped by board.
///
/// Serialized as a JSON object containing a `boards` array.
/// See `example/data.json` for the response shape.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DataResponse {
    /// Boards and their data packet definitions.
    pub boards: Vec<DataBoardResponse>,
}

/// A board and the data packets it declares.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DataBoardResponse {
    /// Numeric board id from the ADJ.
    #[serde(serialize_with = "serialize_board_id")]
    pub id: BoardId,
    /// Human-readable board name.
    pub name: String,
    /// Data packet definitions, each carrying its own numeric id.
    pub packets: Vec<DataPacketResponse>,
}

/// A data packet's ADJ metadata, not its current telemetry values.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DataPacketResponse {
    /// Numeric packet id from the ADJ.
    #[serde(serialize_with = "serialize_adj_id")]
    pub id: AdjId,
    /// Human-readable packet name.
    pub name: String,
    /// ADJ packet type: `data` for this endpoint.
    #[serde(rename = "type")]
    pub packet_type: String,
    /// Measurement definitions in wire order, without protections.
    pub measurements: Vec<DataMeasurementResponse>,
}

/// A measurement's definition with protection metadata deliberately omitted.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct DataMeasurementResponse {
    /// Numeric measurement id, distinct from its textual alias.
    #[serde(serialize_with = "serialize_adj_id")]
    pub id: AdjId,
    /// Textual identifier declared in the ADJ.
    pub alias: String,
    /// Human-readable measurement name.
    pub name: String,
    /// Unit label displayed to the user.
    pub display_units: String,
    /// Numeric, boolean or enum metadata.
    pub kind: DataMeasurementKind,
}

/// Measurement metadata tagged with an explicit `type` field in JSON.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum DataMeasurementKind {
    /// Numeric measurement, including its binary representation.
    Numeric {
        /// Wire type, serialized with its ADJ name, e.g. `float32`.
        #[serde(serialize_with = "serialize_numeric_kind")]
        wire_type: NumericKind,
    },
    /// Boolean measurement, serialized as `{"type":"boolean"}`.
    Boolean,
    /// Enumeration with variants in ADJ order.
    Enum {
        /// Allowed variant names.
        options: Vec<String>,
    },
}
