use std::collections::HashMap;

use serde::Deserialize;

use crate::{model::AdjId, utils::serialize::deserialize_adj_id};

/// Payload of `order/send`; conversion to an `OrderPacket` requires the ADJ.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct OrderSend {
    /// Requested order's ADJ id.
    #[serde(deserialize_with = "deserialize_adj_id")]
    pub id: AdjId,
    /// Parameters keyed by their textual aliases, rather than wire position.
    pub fields: HashMap<String, OrderField>,
}

/// One parameter supplied by the frontend.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct OrderField {
    /// Raw JSON value; its type and range must be checked against the ADJ.
    /// Keeping it raw also preserves integer precision before validation.
    pub value: serde_json::Value,
    /// Whether the frontend enables this parameter.
    #[serde(rename = "isEnabled")]
    pub is_enabled: bool,
    /// Legacy type name, such as `uint16`, `float32`, `bool` or `enum`.
    #[serde(rename = "type")]
    pub field_type: String,
}

/// Payload of `order/stateOrders`: board names mapped to enabled order ids.
pub type StateOrdersUpdate = HashMap<String, Vec<u16>>;
