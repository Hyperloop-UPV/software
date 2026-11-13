//! Flat ADJ v3 protection catalog returned by `/backend/adj/ProtectionPackets`.

use std::{collections::HashMap, time::Duration};

use serde::Serialize;

use crate::model::{AdjId, BoardId, ProtectionKind, Severity};

use super::utils::{
    serialize_adj_id, serialize_adj_protection_kind, serialize_board_id, serialize_severity,
};

/// Protection definitions and their display metadata, matching `example/protection.json`.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ProtectionResponse {
    /// Flat list of protections, not grouped by board or measurement.
    pub protections: Vec<ProtectionInfoResponse>,
    /// Contents of the ADJ's `protectionTypes`, keyed by names such as `Range`.
    pub info: HashMap<String, ProtectionTypeResponse>,
}

/// A single protection definition referencing its board and measurement by id.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct ProtectionInfoResponse {
    /// Compound packet id already assigned by the ADJ loader.
    /// Its low 13 bits identify the measurement and its high 3 bits the
    /// one-based protection position. This is not the position alone.
    #[serde(serialize_with = "serialize_adj_id")]
    pub id: AdjId,
    /// Name assigned to the synthesized protection packet by the loader.
    pub name: String,
    /// Id of the board declaring this protection.
    #[serde(serialize_with = "serialize_board_id")]
    pub board_id: BoardId,
    /// Id of the watched measurement, also encoded in the compound packet id.
    #[serde(serialize_with = "serialize_adj_id")]
    pub measurement_id: AdjId,
    /// Trigger condition; `type` preserves the ADJ name to index `info` directly.
    #[serde(serialize_with = "serialize_adj_protection_kind")]
    pub kind: ProtectionKind,
    /// Severity serialized as `fault` or `warning`.
    #[serde(serialize_with = "serialize_severity")]
    pub severity: Severity,
    /// Required duration, serialized as `{"secs": ..., "nanos": ...}`.
    pub time: Duration,
}

/// Display metadata for one entry of `general_info.json`'s `protectionTypes`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
pub struct ProtectionTypeResponse {
    /// Whether the protection takes an interval instead of a single bound.
    #[serde(rename = "range")]
    pub is_range: bool,
    /// Display template; `{}` marks bounds and `%` the measured value.
    pub text: String,
    /// Optional time-related display template, omitted if absent from the ADJ.
    #[serde(rename = "textTime", skip_serializing_if = "Option::is_none")]
    pub text_time: Option<String>,
}
