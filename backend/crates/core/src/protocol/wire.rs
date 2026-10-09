//! Byte <-> [`Value`] codec for a single measurement, given its declared
//! [`MeasurementKind`]. The one piece of `protocol` with no framing or id
//! lookup — just "this type, these bytes, that value" and back. `tcp`/
//! `udp` build their packet-level decoding on top of this.
//!
//! Every wire width here is fixed by the measurement's own `kind` (a
//! `NumericKind` always has a known byte width; booleans and enums are
//! fixed-width too), so decoding never needs to report back how many
//! bytes it consumed — the caller already has the `MeasurementKind` (from
//! the `Measurement` it's decoding) and can derive the width from it
//! directly if it needs to advance through a buffer.
//!
//! [`decode_value`]/[`encode_value`] are thin dispatchers: they only pick
//! which per-kind function to call. All the actual work lives in its own
//! public function (`decode_numeric`, `decode_boolean`, `decode_enum`...),
//! each independently implementable and testable.

use super::{DecodeError, EncodeError};
use crate::model::{MeasurementKind, NumericKind, Value};

/// Decodes a single value from the front of `bytes`, according to `kind`.
pub fn decode_value(bytes: &[u8], kind: &MeasurementKind) -> Result<Value, DecodeError> {
    match kind {
        MeasurementKind::Numeric { wire_type } => decode_numeric(bytes, *wire_type),
        MeasurementKind::Boolean => decode_boolean(bytes),
        MeasurementKind::Enum { options } => decode_enum(bytes, options),
    }
}

/// Encodes a single value according to `kind`.
pub fn encode_value(value: &Value, kind: &MeasurementKind) -> Result<Vec<u8>, EncodeError> {
    match kind {
        MeasurementKind::Numeric { wire_type } => encode_numeric(value, *wire_type),
        MeasurementKind::Boolean => encode_boolean(value),
        MeasurementKind::Enum { options } => encode_enum(value, options),
    }
}

/// Decodes a numeric value of the given wire type, little-endian.
pub fn decode_numeric(bytes: &[u8], wire_type: NumericKind) -> Result<Value, DecodeError> {
    fn take<const N: usize>(bytes: &[u8]) -> Result<[u8; N], DecodeError> {
        bytes
            .get(..N)
            .and_then(|slice| slice.try_into().ok())
            .ok_or(DecodeError::UnexpectedEof)
    }

    let number: f64 = match wire_type {
        NumericKind::U8 => f64::from(u8::from_le_bytes(take::<1>(bytes)?)),
        NumericKind::U16 => f64::from(u16::from_le_bytes(take::<2>(bytes)?)),
        NumericKind::U32 => f64::from(u32::from_le_bytes(take::<4>(bytes)?)),
        NumericKind::U64 => u64::from_le_bytes(take::<8>(bytes)?) as f64,
        NumericKind::I8 => f64::from(i8::from_le_bytes(take::<1>(bytes)?)),
        NumericKind::I16 => f64::from(i16::from_le_bytes(take::<2>(bytes)?)),
        NumericKind::I32 => f64::from(i32::from_le_bytes(take::<4>(bytes)?)),
        NumericKind::I64 => i64::from_le_bytes(take::<8>(bytes)?) as f64,
        NumericKind::F32 => f64::from(f32::from_le_bytes(take::<4>(bytes)?)),
        NumericKind::F64 => f64::from_le_bytes(take::<8>(bytes)?),
    };

    Ok(Value::Number(number))
}

/// Encodes a numeric value as the given wire type, little-endian.
///
/// Errors with [`EncodeError::OutOfRange`] if `value` doesn't fit the
/// wire type's representable range (this also rejects NaN, which compares
/// false to every bound).
pub fn encode_numeric(value: &Value, wire_type: NumericKind) -> Result<Vec<u8>, EncodeError> {
    let Value::Number(number) = value else {
        return Err(EncodeError::TypeMismatch);
    };
    let number = *number;

    let (min, max) = numeric_range(wire_type);
    if !(min..=max).contains(&number) {
        return Err(EncodeError::OutOfRange {
            value: number,
            min,
            max,
        });
    }

    Ok(match wire_type {
        NumericKind::U8 => vec![number as u8], // no need to call `to_le_bytes` for a single byte
        NumericKind::U16 => (number as u16).to_le_bytes().to_vec(),
        NumericKind::U32 => (number as u32).to_le_bytes().to_vec(),
        NumericKind::U64 => (number as u64).to_le_bytes().to_vec(),
        NumericKind::I8 => (number as i8).to_le_bytes().to_vec(),
        NumericKind::I16 => (number as i16).to_le_bytes().to_vec(),
        NumericKind::I32 => (number as i32).to_le_bytes().to_vec(),
        NumericKind::I64 => (number as i64).to_le_bytes().to_vec(),
        NumericKind::F32 => (number as f32).to_le_bytes().to_vec(),
        NumericKind::F64 => number.to_le_bytes().to_vec(),
    })
}

/// The `[min, max]` range a wire type can represent, as `f64` bounds.
fn numeric_range(wire_type: NumericKind) -> (f64, f64) {
    match wire_type {
        NumericKind::U8 => (f64::from(u8::MIN), f64::from(u8::MAX)),
        NumericKind::U16 => (f64::from(u16::MIN), f64::from(u16::MAX)),
        NumericKind::U32 => (f64::from(u32::MIN), f64::from(u32::MAX)),
        NumericKind::U64 => (u64::MIN as f64, u64::MAX as f64),
        NumericKind::I8 => (f64::from(i8::MIN), f64::from(i8::MAX)),
        NumericKind::I16 => (f64::from(i16::MIN), f64::from(i16::MAX)),
        NumericKind::I32 => (f64::from(i32::MIN), f64::from(i32::MAX)),
        NumericKind::I64 => (i64::MIN as f64, i64::MAX as f64),
        NumericKind::F32 => (f64::from(f32::MIN), f64::from(f32::MAX)),
        NumericKind::F64 => (f64::MIN, f64::MAX),
    }
}

/// Decodes a boolean value.
///
/// Wire width isn't settled yet — not specified anywhere in the ADJv3
/// spec read so far. Confirm against firmware before implementing.
pub fn decode_boolean(bytes: &[u8]) -> Result<Value, DecodeError> {
    let _ = bytes;
    todo!("confirm the wire width firmware uses for a boolean measurement")
}

/// Encodes a boolean value.
pub fn encode_boolean(value: &Value) -> Result<Vec<u8>, EncodeError> {
    let _ = value;
    todo!("confirm the wire width firmware uses for a boolean measurement")
}

/// Decodes an enum value: a single `uint8` byte, the index into
/// `options`. Returns the option's text, not its index — see
/// [`encode_enum`] for why that's not symmetric.
pub fn decode_enum(bytes: &[u8], options: &[String]) -> Result<Value, DecodeError> {
    let &index = bytes.first().ok_or(DecodeError::UnexpectedEof)?;
    let Some(option) = options.get(usize::from(index)) else {
        return Err(DecodeError::InvalidEnumValue {
            index: u32::from(index),
            options: options.len(),
        });
    };
    Ok(Value::Enum(option.clone()))
}

/// Encodes an enum value as a single `uint8` byte.
///
/// `value` is the already-selected index (e.g. a frontend dropdown
/// already resolved to its position in `options`), **not** the option's
/// text — unlike [`decode_enum`], which produces the text. Errors with
/// [`EncodeError::OutOfRange`] if the index isn't a whole number or
/// doesn't fall within `options`.
pub fn encode_enum(value: &Value, options: &[String]) -> Result<Vec<u8>, EncodeError> {
    let Value::Number(index) = value else {
        return Err(EncodeError::TypeMismatch);
    };
    let index = *index;
    let max = options.len().saturating_sub(1) as f64;

    let in_range = !options.is_empty() && index.fract() == 0.0 && (0.0..=max).contains(&index);
    if !in_range {
        return Err(EncodeError::OutOfRange {
            value: index,
            min: 0.0,
            max,
        });
    }

    Ok(vec![index as u8]) // no need to call `to_le_bytes` for a single byte
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn decodes_an_unsigned_integer_little_endian() {
        let Ok(value) = decode_numeric(&[0x34, 0x12], NumericKind::U16) else {
            unreachable!("decoding a well-formed U16 should succeed");
        };
        assert_eq!(value, Value::Number(0x1234 as f64));
    }

    #[test]
    fn decodes_a_signed_integer_little_endian() {
        let Ok(value) = decode_numeric(&[0xFF], NumericKind::I8) else {
            unreachable!("decoding a well-formed I8 should succeed");
        };
        assert_eq!(value, Value::Number(-1.0));
    }

    #[test]
    fn decodes_floats_little_endian() {
        let bytes = 1.5f32.to_le_bytes();
        let Ok(value) = decode_numeric(&bytes, NumericKind::F32) else {
            unreachable!("decoding a well-formed F32 should succeed");
        };
        assert_eq!(value, Value::Number(1.5));
    }

    #[test]
    fn decode_numeric_rejects_short_input() {
        assert!(matches!(
            decode_numeric(&[0x00], NumericKind::U32),
            Err(DecodeError::UnexpectedEof)
        ));
    }

    #[test]
    fn numeric_round_trips_through_encode_then_decode() {
        let value = Value::Number(1234.0);
        let Ok(bytes) = encode_numeric(&value, NumericKind::U16) else {
            unreachable!("encoding a well-formed value should succeed");
        };
        let Ok(decoded) = decode_numeric(&bytes, NumericKind::U16) else {
            unreachable!("decoding what we just encoded should succeed");
        };
        assert_eq!(decoded, value);
    }

    #[test]
    fn encode_numeric_rejects_the_wrong_value_variant() {
        assert!(matches!(
            encode_numeric(&Value::Bool(true), NumericKind::U8),
            Err(EncodeError::TypeMismatch)
        ));
    }

    #[test]
    fn encode_numeric_rejects_out_of_range_values() {
        assert!(matches!(
            encode_numeric(&Value::Number(300.0), NumericKind::U8),
            Err(EncodeError::OutOfRange { .. })
        ));
        assert!(matches!(
            encode_numeric(&Value::Number(-1.0), NumericKind::U8),
            Err(EncodeError::OutOfRange { .. })
        ));
    }

    #[test]
    fn encode_numeric_accepts_the_exact_boundary_values() {
        assert!(encode_numeric(&Value::Number(0.0), NumericKind::U8).is_ok());
        assert!(encode_numeric(&Value::Number(255.0), NumericKind::U8).is_ok());
    }

    #[test]
    fn encode_numeric_rejects_nan() {
        assert!(matches!(
            encode_numeric(&Value::Number(f64::NAN), NumericKind::F32),
            Err(EncodeError::OutOfRange { .. })
        ));
    }

    #[test]
    fn decodes_an_enum_value_by_index_into_its_text() {
        let options = vec!["Idle".to_string(), "Fault".to_string()];
        let Ok(value) = decode_enum(&[1], &options) else {
            unreachable!("decoding a valid enum index should succeed");
        };
        assert_eq!(value, Value::Enum("Fault".to_string()));
    }

    #[test]
    fn decode_enum_rejects_an_out_of_range_index() {
        let options = vec!["Idle".to_string()];
        assert!(matches!(
            decode_enum(&[5], &options),
            Err(DecodeError::InvalidEnumValue {
                index: 5,
                options: 1
            })
        ));
    }

    #[test]
    fn decode_enum_rejects_empty_input() {
        assert!(matches!(
            decode_enum(&[], &[]),
            Err(DecodeError::UnexpectedEof)
        ));
    }

    #[test]
    fn encodes_an_enum_value_from_its_already_selected_index() {
        let options = vec!["Idle".to_string(), "Fault".to_string()];
        let Ok(bytes) = encode_enum(&Value::Number(1.0), &options) else {
            unreachable!("encoding a valid index should succeed");
        };
        assert_eq!(bytes, vec![1]);
    }

    #[test]
    fn encode_enum_rejects_an_out_of_range_index() {
        let options = vec!["Idle".to_string()];
        assert!(matches!(
            encode_enum(&Value::Number(1.0), &options),
            Err(EncodeError::OutOfRange { .. })
        ));
    }

    #[test]
    fn encode_enum_rejects_a_fractional_index() {
        let options = vec!["Idle".to_string(), "Fault".to_string()];
        assert!(matches!(
            encode_enum(&Value::Number(0.5), &options),
            Err(EncodeError::OutOfRange { .. })
        ));
    }

    #[test]
    fn encode_enum_rejects_the_wrong_value_variant() {
        let options = vec!["Idle".to_string()];
        assert!(matches!(
            encode_enum(&Value::Enum("Idle".to_string()), &options),
            Err(EncodeError::TypeMismatch)
        ));
    }
}
