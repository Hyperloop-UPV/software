//! ADJ v3 order catalog returned by `/backend/adj/OrderPackets`.

use std::time::Duration;

use serde::Serialize;

use crate::{
    model::{AdjId, BoardId, ProtectionKind, Severity},
    utils::serialize::{
        serialize_adj_id, serialize_board_id, serialize_protection_kind, serialize_severity,
    },
};

use super::data::DataMeasurementKind;

/// Order definitions grouped by board, matching `example/order.json`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OrderResponse {
    /// Boards and their order definitions.
    pub boards: Vec<OrderBoardResponse>,
}

/// A board and the orders it declares.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OrderBoardResponse {
    /// Numeric board id from the ADJ.
    #[serde(serialize_with = "serialize_board_id")]
    pub id: BoardId,
    /// Human-readable board name.
    pub name: String,
    /// Order definitions, each carrying its own numeric id.
    pub orders: Vec<OrderPacketResponse>,
}

/// An order definition, not a request to execute that order.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OrderPacketResponse {
    /// Numeric order id from the ADJ.
    #[serde(serialize_with = "serialize_adj_id")]
    pub id: AdjId,
    /// Human-readable order name.
    pub name: String,
    /// ADJ packet type: `order` for this endpoint.
    #[serde(rename = "type")]
    pub packet_type: String,
    /// Parameters in wire order; empty for parameterless orders.
    pub measurements: Vec<OrderMeasurementResponse>,
}

/// An order parameter's ADJ definition, including its protections.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OrderMeasurementResponse {
    /// Numeric measurement id, distinct from its textual alias.
    #[serde(serialize_with = "serialize_adj_id")]
    pub id: AdjId,
    /// Textual identifier declared in the ADJ.
    pub alias: String,
    /// Human-readable parameter name.
    pub name: String,
    /// Unit label displayed to the user.
    pub display_units: String,
    /// Same numeric, boolean or enum metadata used by data measurements.
    pub kind: DataMeasurementKind,
    /// Protection definitions in ADJ order; empty when none are declared.
    pub protections: Vec<OrderProtectionResponse>,
}

/// A parameter protection's definition, not a triggered protection event.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct OrderProtectionResponse {
    /// One-based protection position within its measurement, not a packet id.
    #[serde(serialize_with = "serialize_adj_id")]
    pub id: AdjId,
    /// Trigger condition, serialized with its type and named bounds.
    #[serde(serialize_with = "serialize_protection_kind")]
    pub kind: ProtectionKind,
    /// Severity serialized as `fault` or `warning`.
    #[serde(serialize_with = "serialize_severity")]
    pub severity: Severity,
    /// Required duration, serialized as `{"secs": ..., "nanos": ...}`.
    pub time: Duration,
}
