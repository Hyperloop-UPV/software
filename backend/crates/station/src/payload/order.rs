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
    /// Legacy frontend flag, defaulting to false when omitted.
    /// As in Go, it does not exclude the parameter from validation or wire encoding.
    #[serde(default, rename = "isEnabled")]
    pub is_enabled: bool,
    /// Frontend type name, such as `uint16` or `bool`. The converter checks it against the ADJ.
    #[serde(rename = "type")]
    pub field_type: String,
}

/// Payload of `order/stateOrders`: board names mapped to enabled order ids.
pub type StateOrdersUpdate = HashMap<String, Vec<u16>>;

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::OrderSend;

    #[test]
    fn order_fields_read_is_enabled_with_the_legacy_default() -> Result<(), serde_json::Error> {
        for enabled in [Some(true), Some(false), None] {
            let mut field = json!({"value": 12.5, "type": "float32"});
            if let Some(enabled) = enabled {
                field["isEnabled"] = json!(enabled);
            }
            let request: OrderSend = serde_json::from_value(json!({
                "id": 1001,
                "fields": {"target_speed": field}
            }))?;
            assert_eq!(
                request.fields["target_speed"].is_enabled,
                enabled.unwrap_or(false)
            );
        }
        Ok(())
    }

    #[test]
    fn order_fields_reject_non_boolean_is_enabled() {
        for enabled in [json!("true"), json!(1), json!(null)] {
            assert!(
                serde_json::from_value::<OrderSend>(json!({
                    "id": 1001,
                    "fields": {
                        "target_speed": {"value": 12.5, "type": "float32", "isEnabled": enabled}
                    }
                }))
                .is_err()
            );
        }
    }
}
