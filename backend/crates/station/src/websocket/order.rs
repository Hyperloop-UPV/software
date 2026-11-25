use super::error::OrderError;
use serde_json::Value as JsonValue;
use software_core::{
    model::{MeasurementKind, NumericKind, OrderPacket, PacketType, Value},
    protocol::{Index, wire},
};
use std::sync::Arc;
use tokio::sync::mpsc;

use super::payload::{OrderField, OrderSend};

/// Validates frontend requests against the ADJ and forwards them to the vehicle.
#[derive(Debug, Clone)]
pub(crate) struct OrderForwarder {
    index: Arc<Index>,
    orders: mpsc::Sender<OrderPacket>,
}

impl OrderForwarder {
    pub(crate) fn new(index: Arc<Index>, orders: mpsc::Sender<OrderPacket>) -> Self {
        Self { index, orders }
    }

    pub(super) fn forward(&self, payload: JsonValue) -> Result<(), OrderError> {
        let request = serde_json::from_value(payload)?;
        let packet = to_packet(request, &self.index)?;
        self.orders.try_send(packet).map_err(|error| match error {
            mpsc::error::TrySendError::Full(_) => OrderError::QueueFull,
            mpsc::error::TrySendError::Closed(_) => OrderError::VehicleUnavailable,
        })
    }
}

/// Resolves aliases and emits values in the ADJ's wire order.
fn to_packet(mut request: OrderSend, index: &Index) -> Result<OrderPacket, OrderError> {
    let Some(PacketType::Order(measurements)) =
        index.packet(request.id).map(|packet| &packet.packet_type)
    else {
        return Err(OrderError::UnknownOrder(request.id));
    };

    let mut values = Vec::with_capacity(measurements.len());
    for measurement in measurements {
        let alias = &measurement.alias;
        let field = request
            .fields
            .remove(alias)
            .ok_or_else(|| OrderError::MissingField(alias.clone()))?;
        values.push(field_value(&field, alias, &measurement.kind)?);
    }
    // Removing each declared field leaves only parameters the ADJ does not recognize.
    if let Some(extra) = request.fields.into_keys().next() {
        return Err(OrderError::UnexpectedField(extra));
    }
    Ok(OrderPacket::new(request.id, values))
}

fn field_value(
    field: &OrderField,
    alias: &str,
    kind: &MeasurementKind,
) -> Result<Value, OrderError> {
    let expected = match kind {
        MeasurementKind::Numeric { wire_type } => numeric_type_name(*wire_type),
        MeasurementKind::Boolean => "bool",
        MeasurementKind::Enum { .. } => "enum",
    };
    if field.field_type != expected {
        return Err(OrderError::WrongFieldType {
            field: alias.into(),
            expected,
        });
    }

    let value = match kind {
        MeasurementKind::Numeric { wire_type } => {
            number(&field.value, *wire_type).map(Value::Number)
        }
        MeasurementKind::Boolean => field.value.as_bool().map(Value::Bool),
        MeasurementKind::Enum { options } => field.value.as_str().and_then(|name| {
            let index = options.iter().position(|option| option == name)?;
            // The order encoder takes the one-byte index into the ADJ's options.
            u8::try_from(index)
                .ok()
                .map(|index| Value::Number(f64::from(index)))
        }),
    }
    .ok_or_else(|| OrderError::InvalidValue(alias.into()))?;

    // Apply the same range checks as the vehicle's encoder before queuing the order.
    wire::encode_value(&value, kind).map_err(|_| OrderError::InvalidValue(alias.into()))?;
    Ok(value)
}

/// Checks that an integer survives conversion to the packet's `f64` representation.
fn number(value: &JsonValue, kind: NumericKind) -> Option<f64> {
    let JsonValue::Number(raw) = value else {
        return None;
    };
    let number = raw.as_f64()?;
    if matches!(kind, NumericKind::F32 | NumericKind::F64) {
        return Some(number);
    }

    let integer = raw
        .as_i64()
        .map(i128::from)
        .or_else(|| raw.as_u64().map(i128::from));
    if let Some(integer) = integer {
        // OrderPacket stores numbers as f64. Avoid changing a large integer in transit.
        if number as i128 != integer {
            return None;
        }
    } else if number.fract() != 0.0 || number.abs() >= (1_u64 << 53) as f64 {
        // Float-form integers must stay within the range where adjacent integers remain distinct.
        return None;
    }
    // The 64-bit upper bounds round up when represented as f64.
    match kind {
        NumericKind::U64 if number >= u64::MAX as f64 => None,
        NumericKind::I64 if number >= i64::MAX as f64 => None,
        _ => Some(number),
    }
}

fn numeric_type_name(kind: NumericKind) -> &'static str {
    match kind {
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
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::*;

    #[test]
    fn integer_fields_reject_values_the_packet_or_wire_would_change() {
        let cases = [
            (NumericKind::U32, json!(2.5)),
            (NumericKind::I64, json!(1_u64 << 63)),
            (NumericKind::U64, json!((1_u64 << 53) + 1)),
            (NumericKind::U64, json!(u64::MAX)),
        ];
        for (kind, value) in cases {
            assert!(number(&value, kind).is_none());
        }
        assert_eq!(number(&json!(2.0), NumericKind::U32), Some(2.0));
        assert_eq!(
            number(&json!(1_u64 << 63), NumericKind::U64),
            Some((1_u64 << 63) as f64)
        );
    }

    #[test]
    fn enum_order_field_is_converted_to_the_encoder_index() -> Result<(), OrderError> {
        let kind = MeasurementKind::Enum {
            options: vec!["idle".into(), "ready".into()],
        };
        let field = OrderField {
            value: json!("ready"),
            field_type: "enum".into(),
        };
        assert_eq!(field_value(&field, "mode", &kind)?, Value::Number(1.0));
        let unknown = OrderField {
            value: json!("unknown"),
            ..field
        };
        assert!(matches!(
            field_value(&unknown, "mode", &kind),
            Err(OrderError::InvalidValue(_))
        ));
        Ok(())
    }
}
