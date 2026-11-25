use super::serialize::deserialize_adj_id;
use serde::Deserialize;
use software_core::model::AdjId;
use std::collections::HashMap;

/// Payload of `order/send`. The ADJ defines how to convert it to an `OrderPacket`.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct OrderSend {
    /// Requested order's ADJ id.
    #[serde(deserialize_with = "deserialize_adj_id")]
    pub id: AdjId,
    /// Parameters keyed by their ADJ aliases. The converter puts them in wire order.
    pub fields: HashMap<String, OrderField>,
}

/// One parameter supplied by the frontend.
#[derive(Debug, Clone, PartialEq, Deserialize)]
pub struct OrderField {
    /// Raw JSON value retained so integer precision can be checked before conversion to `f64`.
    pub value: serde_json::Value,
    /// Frontend type name, such as `uint16` or `bool`. The converter checks it against the ADJ.
    #[serde(rename = "type")]
    pub field_type: String,
}

/// Payload of `order/stateOrders`: board names mapped to enabled order ids.
pub type StateOrdersUpdate = HashMap<String, Vec<u16>>;
