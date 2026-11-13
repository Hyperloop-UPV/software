//! ADJ v3 data packet catalog returned by `/backend/adj/DataPackets`.

use serde::{Serialize, Serializer};

use crate::model::{AdjId, BoardId, NumericKind};

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
    /// Declared transmission period, expressed in `period_type` units.
    pub period: f64,
    /// ADJ period unit, e.g. `ms`.
    pub period_type: String,
    /// Name of the socket declared by the ADJ.
    pub socket: String,
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

// Serialize domain types locally without changing the internal model.
fn serialize_board_id<S: Serializer>(id: &BoardId, serializer: S) -> Result<S::Ok, S::Error> {
    serializer.serialize_u16(id.0)
}

fn serialize_adj_id<S: Serializer>(id: &AdjId, serializer: S) -> Result<S::Ok, S::Error> {
    serializer.serialize_u16(id.0)
}

// Serialize numeric kind to match ADJv3 types 
fn serialize_numeric_kind<S: Serializer>(
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
