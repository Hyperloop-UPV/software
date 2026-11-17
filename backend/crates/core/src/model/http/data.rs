//! ADJ v3 data packet catalog returned by `/backend/adj/DataPackets`.

use serde::Serialize;

use crate::{
    model::{AdjId, BoardId, NumericKind},
    utils::serialize::{serialize_adj_id, serialize_board_id, serialize_data_measurement_type},
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
    /// Measurement type metadata, serialized under the JSON key `type`.
    /// Numeric and boolean types are strings; enums are objects with options.
    #[serde(rename = "type", serialize_with = "serialize_data_measurement_type")]
    pub kind: DataMeasurementKind,
}

/// Measurement type metadata used by the custom response serializer.
///
/// As a measurement's JSON `type` value, numeric types become their ADJ wire
/// type name, booleans become `"boolean"`, and enums become an object with
/// `"type": "enum"` and an `options` array.
#[derive(Debug, Clone, PartialEq)]
pub enum DataMeasurementKind {
    /// Numeric measurement, serialized as a wire type string such as `"float32"`.
    Numeric {
        /// Selects the ADJ type name; no separate `wire_type` JSON field is emitted.
        wire_type: NumericKind,
    },
    /// Boolean measurement, serialized as the string `"boolean"`.
    Boolean,
    /// Enumeration, serialized as `{"type":"enum","options":[...]}`.
    Enum {
        /// Allowed variant names, preserved in ADJ order.
        options: Vec<String>,
    },
}
