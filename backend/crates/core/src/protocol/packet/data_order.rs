//! Encodes and decodes a positional Data/Order packet — see
//! [`crate::model::DataOrderPacket`] for why both share this one wire
//! shape under a phantom `Kind`.
//!
//! [`encode`]/[`decode`] are generic over that `Kind` via
//! [`crate::model::PacketTypeTag`], so they're written once and work for
//! either [`crate::model::Data`] or [`crate::model::Order`] — the backend
//! itself only ever calls `encode::<Order>` (via [`super::super::tcp`])
//! and `decode::<Data>` (via [`super::super::udp`]), but that restriction
//! lives at the transport layer, not here. [`crate::model::PacketTypeTag`]
//! only answers whether a `PacketDef`'s type matches `Kind` at all; the
//! actual measurement list comes from
//! [`crate::model::PacketType::measurements`] either way.

use crate::model::{AdjId, DataOrderPacket, PacketTypeTag};
use crate::protocol::{DecodeError, EncodeError, Index, wire};

/// Encodes `packet` into the bytes to write to a board's connection,
/// resolving its field shapes against `index`.
pub fn encode<Kind: PacketTypeTag>(
    packet: &DataOrderPacket<Kind>,
    index: &Index,
) -> Result<Vec<u8>, EncodeError> {
    // Look up the packet definition for this packet's id
    let packet_def = index
        .packet(packet.id)
        .ok_or(EncodeError::UnknownId(packet.id))?;

    // Check that the packet is an order or data, as expected by the generic PacketTypeTag
    if !Kind::matches(&packet_def.packet_type) {
        return Err(EncodeError::WrongPacketType { id: packet.id });
    }

    // Get the measurements for this packet
    let measurements = packet_def.packet_type.measurements();

    // Check that the number of values that we want to encode matches the number of measurements in the packet definition
    if packet.values.len() != measurements.len() {
        return Err(EncodeError::WrongFieldCount {
            expected: measurements.len(),
            got: packet.values.len(),
        });
    }

    // Encode the packet id as little-endian u16
    let mut bytes = Vec::new();
    bytes.extend_from_slice(&packet.id.0.to_le_bytes());

    // for each value in the packet encode it according to the corresponding measurements
    for (field, measurement) in packet.values.iter().zip(measurements) {
        // Encode the field value according to the measurement's kind
        let field_bytes = wire::encode_value(field, &measurement.kind)?;

        // Append the encoded field bytes to the output vector
        bytes.extend(field_bytes);
    }

    Ok(bytes)
}

/// Decodes a complete, already-delimited buffer into a
/// [`DataOrderPacket<Kind>`], resolving its field shapes against `index`.
pub fn decode<Kind: PacketTypeTag>(
    bytes: &[u8],
    index: &Index,
) -> Result<DataOrderPacket<Kind>, DecodeError> {
    // The first two bytes are the packet id, in little-endian u16
    if bytes.len() < 2 {
        return Err(DecodeError::UnexpectedEof);
    }

    // generate the packet id from the first two bytes
    let id: [u8; 2] = bytes[0..2]
        .try_into()
        .map_err(|_| DecodeError::UnexpectedEof)?;

    // generate ADJ id from the little-endian bytes
    let adj_id = AdjId(u16::from_le_bytes(id));

    // Look up the packet definition for this id if not found return an UnknownId error
    let packet_def = index.packet(adj_id).ok_or(DecodeError::UnknownId(adj_id))?;

    // Check that the packet is an order or data, as expected by the generic PacketTypeTag
    if !Kind::matches(&packet_def.packet_type) {
        return Err(DecodeError::WrongPacketType { id: adj_id });
    }
    // Get the measurements for this packet
    let measurements = packet_def.packet_type.measurements();

    // Prepare a vector to hold the decoded values and a pointer to track the current position in the byte slice
    let mut values = Vec::with_capacity(measurements.len());
    let mut pointer = 2;

    // For each measurement, decode the corresponding bytes from the input slice
    for measurement in measurements {
        let width = wire::byte_width(&measurement.kind);
        let next = pointer + width;

        // Check if there are enough bytes to decode the field
        if bytes.len() < next {
            return Err(DecodeError::UnexpectedEof);
        }

        // Slice the bytes for the current field and decode it according to the measurement's kind
        let field = &bytes[pointer..next];
        let value = wire::decode_value(field, &measurement.kind)?; // Append the decoded value to the values vector
        values.push(value);

        pointer = next;
    }

    Ok(DataOrderPacket::new(adj_id, values))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{
        Board, BoardId, Data, DataPacket, MacAddress, Measurement, MeasurementKind, NumericKind,
        Order, OrderPacket, PacketDef, PacketType, PodData, Value,
    };
    use std::collections::HashMap;
    use std::net::IpAddr;

    // Auxiliar function to create a sample measurement for testing

    fn sample_measurement(id: u16, kind: MeasurementKind) -> Measurement {
        Measurement {
            id: AdjId(id),
            alias: format!("field_{id}"),
            name: format!("Field {id}"),
            display_units: String::new(),
            kind,
            protections: vec![],
        }
    }

    fn sample_packet_def(id: AdjId, packet_type: PacketType) -> PacketDef {
        PacketDef {
            id,
            board: BoardId(1),
            name: "TestPacket".into(),
            packet_type,
        }
    }

    fn make_test_index(defs: Vec<PacketDef>) -> Index {
        let packets: HashMap<AdjId, PacketDef> = defs.into_iter().map(|p| (p.id, p)).collect();
        let board = Board {
            id: BoardId(1),
            name: "TestBoard".to_string(),
            ip: IpAddr::from([127, 0, 0, 1]),
            mac: MacAddress([0; 6]),
            packets,
        };
        let pod_data = PodData {
            boards: HashMap::from([(board.id, board)]),
        };
        Index::new(&pod_data, None)
    }

    // --- ENCODE TESTS ---

    #[test]
    fn encode_success_little_endian_and_positional_fields() {
        let order_id = AdjId(1001);
        let packet_def = sample_packet_def(
            order_id,
            PacketType::Order(vec![
                sample_measurement(
                    1,
                    MeasurementKind::Numeric {
                        wire_type: NumericKind::U16,
                    },
                ),
                sample_measurement(
                    2,
                    MeasurementKind::Enum {
                        options: vec!["Off".to_string(), "On".to_string()],
                    },
                ),
            ]),
        );

        let index = make_test_index(vec![packet_def]);

        let packet = OrderPacket::new(order_id, vec![Value::Number(300.0), Value::Number(1.0)]);

        let Ok(encoded) = encode(&packet, &index) else {
            unreachable!("encoding a well-formed order should succeed");
        };

        // 1001 in little-endian u16: [0xE9, 0x03]
        // 300 in little-endian u16: [0x2C, 0x01]
        // enum index 1: [0x01]
        assert_eq!(encoded, vec![0xE9, 0x03, 0x2C, 0x01, 0x01]);
    }

    #[test]
    fn encode_fails_on_unknown_id() {
        let index = make_test_index(vec![]);
        let packet = OrderPacket::new(AdjId(9999), vec![]);

        let Err(err) = encode(&packet, &index) else {
            unreachable!("encoding an unknown id should fail");
        };
        assert_eq!(err, EncodeError::UnknownId(AdjId(9999)));
    }

    #[test]
    fn encode_fails_on_wrong_packet_type() {
        let data_id = AdjId(2001);
        let packet_def = sample_packet_def(data_id, PacketType::Data(vec![]));

        let index = make_test_index(vec![packet_def]);
        let packet = OrderPacket::new(data_id, vec![]);

        let Err(err) = encode(&packet, &index) else {
            unreachable!("encoding the wrong packet type should fail");
        };
        assert_eq!(err, EncodeError::WrongPacketType { id: data_id });
    }

    #[test]
    fn encode_fails_on_wrong_field_count() {
        let order_id = AdjId(1002);
        let packet_def = sample_packet_def(
            order_id,
            PacketType::Order(vec![
                sample_measurement(
                    1,
                    MeasurementKind::Numeric {
                        wire_type: NumericKind::U8,
                    },
                ),
                sample_measurement(
                    2,
                    MeasurementKind::Numeric {
                        wire_type: NumericKind::U8,
                    },
                ),
            ]),
        );

        let index = make_test_index(vec![packet_def]);
        let packet = OrderPacket::new(order_id, vec![Value::Number(10.0)]);

        let Err(err) = encode(&packet, &index) else {
            unreachable!("encoding with the wrong field count should fail");
        };
        assert_eq!(
            err,
            EncodeError::WrongFieldCount {
                expected: 2,
                got: 1,
            }
        );
    }

    // --- DECODE TESTS ---

    #[test]
    fn decode_success_little_endian_and_values() {
        let data_id = AdjId(3001);
        let packet_def = sample_packet_def(
            data_id,
            PacketType::Data(vec![
                sample_measurement(
                    1,
                    MeasurementKind::Numeric {
                        wire_type: NumericKind::U16,
                    },
                ),
                sample_measurement(
                    2,
                    MeasurementKind::Enum {
                        options: vec!["Off".to_string(), "On".to_string()],
                    },
                ),
            ]),
        );

        let index = make_test_index(vec![packet_def]);

        // 3001 in little-endian u16: [0xB9, 0x0B]
        // 500 in little-endian u16: [0xF4, 0x01]
        // enum index 0: [0x00]
        let raw_bytes = [0xB9, 0x0B, 0xF4, 0x01, 0x00];

        let Ok(decoded) = decode::<Data>(&raw_bytes, &index) else {
            unreachable!("decoding a well-formed data packet should succeed");
        };

        assert_eq!(decoded.id, data_id);
        assert_eq!(
            decoded.values,
            vec![Value::Number(500.0), Value::Enum("Off".to_string())]
        );
    }

    #[test]
    fn decode_fails_when_buffer_is_shorter_than_header() {
        let index = make_test_index(vec![]);
        let Err(err) = decode::<Data>(&[0x01], &index) else {
            unreachable!("decoding a buffer shorter than the header should fail");
        };
        assert_eq!(err, DecodeError::UnexpectedEof);
    }

    #[test]
    fn decode_fails_on_unexpected_eof_in_payload() {
        let data_id = AdjId(3002);
        let packet_def = sample_packet_def(
            data_id,
            PacketType::Data(vec![sample_measurement(
                1,
                MeasurementKind::Numeric {
                    wire_type: NumericKind::U32,
                },
            )]),
        );

        let index = make_test_index(vec![packet_def]);

        let raw_bytes = [0xBA, 0x0B, 0x01, 0x02];
        let Err(err) = decode::<Data>(&raw_bytes, &index) else {
            unreachable!("decoding a truncated payload should fail");
        };
        assert_eq!(err, DecodeError::UnexpectedEof);
    }

    #[test]
    fn decode_fails_on_unknown_id() {
        let index = make_test_index(vec![]);
        let raw_bytes = [0x88, 0x13];

        let Err(err) = decode::<Data>(&raw_bytes, &index) else {
            unreachable!("decoding an unknown id should fail");
        };
        assert_eq!(err, DecodeError::UnknownId(AdjId(5000)));
    }

    #[test]
    fn decode_fails_on_wrong_packet_type() {
        let order_id = AdjId(4001);
        let packet_def = sample_packet_def(order_id, PacketType::Order(vec![]));

        let index = make_test_index(vec![packet_def]);
        let raw_bytes = [0xA1, 0x0F];

        let Err(err) = decode::<Data>(&raw_bytes, &index) else {
            unreachable!("decoding the wrong packet type should fail");
        };
        assert_eq!(err, DecodeError::WrongPacketType { id: order_id });
    }

    // --- ROUND-TRIP TESTS ---
    //
    // `encode`/`decode` are generic over `Kind`, so the same `PacketDef`
    // works for both directions here — that genericity is the whole
    // point of giving `DataOrderPacket` a phantom `Kind` in the first
    // place, instead of writing one hardcoded pair of functions per type.
    //
    // Enum fields are left out of both: `encode_enum` takes an
    // already-selected index (`Value::Number`) but `decode_enum` returns
    // the option's text (`Value::Enum`) — see `wire.rs` — so an enum
    // field's `Value` is never expected to round-trip unchanged, only its
    // underlying byte.

    fn numeric_measurements() -> Vec<Measurement> {
        vec![
            sample_measurement(
                1,
                MeasurementKind::Numeric {
                    wire_type: NumericKind::U16,
                },
            ),
            sample_measurement(
                2,
                MeasurementKind::Numeric {
                    wire_type: NumericKind::I8,
                },
            ),
        ]
    }

    #[test]
    fn an_order_packet_round_trips_through_encode_then_decode() {
        let id = AdjId(6001);
        let index = make_test_index(vec![sample_packet_def(
            id,
            PacketType::Order(numeric_measurements()),
        )]);
        let original = OrderPacket::new(id, vec![Value::Number(1234.0), Value::Number(-5.0)]);

        let Ok(bytes) = encode(&original, &index) else {
            unreachable!("encoding this well-formed order should succeed");
        };
        let Ok(decoded) = decode::<Order>(&bytes, &index) else {
            unreachable!("decoding what we just encoded should succeed");
        };

        assert_eq!(decoded.id, original.id);
        assert_eq!(decoded.values, original.values);
    }

    #[test]
    fn a_data_packet_round_trips_through_encode_then_decode() {
        let id = AdjId(6002);
        let index = make_test_index(vec![sample_packet_def(
            id,
            PacketType::Data(numeric_measurements()),
        )]);
        let original = DataPacket::new(id, vec![Value::Number(42.0), Value::Number(-1.0)]);

        let Ok(bytes) = encode(&original, &index) else {
            unreachable!("encoding this well-formed data packet should succeed");
        };
        let Ok(decoded) = decode::<Data>(&bytes, &index) else {
            unreachable!("decoding what we just encoded should succeed");
        };

        assert_eq!(decoded.id, original.id);
        assert_eq!(decoded.values, original.values);
    }
}
