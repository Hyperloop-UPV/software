//! Decodes a `Protection` packet: a board reporting one of its declared
//! protections triggered. Only ever received, over TCP. Also provides
//! `encode`, purely so tests can build well-formed frames without
//! hand-written byte arrays — nothing in the real backend calls it, since
//! a protection never travels backend -> board.
//!
//! Wire structure (whole frame, including the leading id):
//! ```text
//! | byte(s) | 0-1 | 2    | 3   | 4   | 5      | 6-7  | 8..          |
//! |---------|-----|------|-----|-----|--------|------|--------------|
//! | field   | id  | hora | min | seg | subseg | resv | value        |
//! ```
//! `id` (2 bytes) is normally read by a TCP dispatcher before it even
//! knows to call [`decode`] (it needs the id first, to decide this is a
//! protection and not a message) — when that's the case, pass it as
//! `Some`, and `reader` should start right at byte 2 above. Otherwise
//! pass `None`: `reader` should then start at byte 0, id included, and
//! `decode` reads it itself — all of this frame's byte parsing stays in
//! this file either way, never split out into whatever dispatches here.
//! `resv` (2 bytes) only exists to align `value` to an 8-byte offset;
//! it's read and discarded, never stored. `value`'s width is whatever
//! [`crate::protocol::wire::byte_width`] says for the watched
//! measurement's kind — not fixed, unlike every other field here.

use crate::model::{AdjId, PacketType, ProtectionPacket, ShortTimestamp};
use crate::protocol::{DecodeError, EncodeError, Index, wire};
use std::io::Read;

/// Decodes a protection frame, resolving the watched measurement's wire
/// type against `index`.
///
/// `compound_id`: `Some` if the caller already read it (see this
/// module's doc comment); `None` to have `decode` read it itself off
/// `reader`'s first 2 bytes.
pub fn decode(
    mut reader: impl Read,
    compound_id: Option<AdjId>,
    index: &Index,
) -> Result<ProtectionPacket, DecodeError> {
    let compound_id = match compound_id {
        Some(id) => id,
        None => super::read_id(&mut reader)?,
    };

    // Look up the packet definition for this compound id, and ensure it's a
    // protection packet. If not, the frame is malformed and we can't decode it.
    let packet_def = index
        .packet(compound_id)
        .ok_or(DecodeError::UnknownId(compound_id))?;

    let PacketType::Protection(measurement) = &packet_def.packet_type else {
        return Err(DecodeError::WrongPacketType { id: compound_id });
    };

    // `hora`/`min`/`seg`/`subseg` (1 byte each), then 2 bytes of `resv`
    // padding that only exist to align `value` to an 8-byte offset — read
    // and discarded, there's nowhere to put them in `ProtectionPacket`.
    let mut header = [0u8; 6];
    reader.read_exact(&mut header)?;
    let timestamp = ShortTimestamp {
        hour: header[0],
        minute: header[1],
        second: header[2],
        subsecond: header[3],
    };

    // Read the `value` bytes, whose length is determined by the measurement's wire type, and decode them into a `Value`.
    let mut value_bytes = vec![0u8; wire::byte_width(&measurement.kind)];
    reader.read_exact(&mut value_bytes)?;
    let value = wire::decode_value(&value_bytes, &measurement.kind)?;

    Ok(ProtectionPacket {
        id: compound_id,
        timestamp,
        value,
    })
}

/// Encodes a [`ProtectionPacket`] back into the bytes [`decode`] expects
/// — a complete, self-contained frame, leading id included.
///
/// Nothing in the real backend calls this — per the ADJ spec, protection
/// packets only ever travel board -> backend. This exists purely so
/// tests can build well-formed frames without hand-written byte arrays,
/// and to prove `decode` recovers exactly what was encoded.
pub fn encode(packet: &ProtectionPacket, index: &Index) -> Result<Vec<u8>, EncodeError> {
    let packet_def = index
        .packet(packet.id)
        .ok_or(EncodeError::UnknownId(packet.id))?;

    let PacketType::Protection(measurement) = &packet_def.packet_type else {
        return Err(EncodeError::WrongPacketType { id: packet.id });
    };

    let mut bytes = packet.id.0.to_le_bytes().to_vec();
    // `hora`/`min`/`seg`/`subseg` (1 byte each), then 2 bytes of `resv`
    // — decode discards these, nothing to round-trip.
    bytes.extend([
        packet.timestamp.hour,
        packet.timestamp.minute,
        packet.timestamp.second,
        packet.timestamp.subsecond,
        0,
        0,
    ]);
    bytes.extend(wire::encode_value(&packet.value, &measurement.kind)?);

    Ok(bytes)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{
        AdjId, Board, BoardId, MacAddress, Measurement, MeasurementKind, NumericKind, PacketDef,
        PodData, Value,
    };
    use std::collections::HashMap;
    use std::io::Cursor;
    use std::net::IpAddr;

    fn sample_measurement(id: u16, kind: MeasurementKind) -> Measurement {
        Measurement {
            id: AdjId(id),
            alias: "mock_alias".to_string(),
            name: "Mock Measurement".to_string(),
            display_units: String::new(),
            kind,
            protections: vec![],
        }
    }

    fn index_with_protection(measurement: Measurement, position: u16) -> (Index, AdjId) {
        let compound_id = AdjId((position << 13) | measurement.id.0);
        let packet = PacketDef {
            id: compound_id,
            board: BoardId(1),
            name: "mock_protection".to_string(),
            packet_type: PacketType::Protection(measurement),
        };
        let board = Board {
            id: BoardId(1),
            name: "MOCK".to_string(),
            ip: IpAddr::from([127, 0, 0, 1]),
            mac: MacAddress([0; 6]),
            packets: HashMap::from([(packet.id, packet)]),
        };
        let pod_data = PodData {
            boards: HashMap::from([(board.id, board)]),
        };
        (Index::new(&pod_data, None), compound_id)
    }

    #[test]
    fn decodes_a_numeric_protections_timestamp_and_value() {
        let measurement = sample_measurement(
            100,
            MeasurementKind::Numeric {
                wire_type: NumericKind::F32,
            },
        );
        let (index, compound_id) = index_with_protection(measurement, 1);

        let mut bytes = vec![12, 30, 5, 0, 0, 0]; // hora, min, seg, subseg, resv(2)
        bytes.extend(53.2f32.to_le_bytes());
        let reader = Cursor::new(bytes);

        let Ok(packet) = decode(reader, Some(compound_id), &index) else {
            unreachable!("decoding a well-formed protection frame should succeed");
        };

        assert_eq!(packet.id.measurement_id(), AdjId(100));
        assert_eq!(packet.id.protection_position(), 1);
        assert_eq!(packet.timestamp.hour, 12);
        assert_eq!(packet.timestamp.minute, 30);
        assert_eq!(packet.timestamp.second, 5);
        assert_eq!(packet.value, Value::Number(f64::from(53.2f32)));
    }

    #[test]
    fn decode_reads_the_id_itself_when_not_given_one() {
        let measurement = sample_measurement(
            100,
            MeasurementKind::Numeric {
                wire_type: NumericKind::F32,
            },
        );
        let (index, compound_id) = index_with_protection(measurement, 1);

        // Full frame, id included — nobody's pre-read it for us.
        let mut bytes = compound_id.0.to_le_bytes().to_vec();
        bytes.extend([12, 30, 5, 0, 0, 0]); // hora, min, seg, subseg, resv(2)
        bytes.extend(53.2f32.to_le_bytes());

        let Ok(packet) = decode(Cursor::new(bytes), None, &index) else {
            unreachable!("decoding a well-formed protection frame should succeed");
        };

        assert_eq!(packet.id, compound_id);
        assert_eq!(packet.timestamp.hour, 12);
        assert_eq!(packet.value, Value::Number(f64::from(53.2f32)));
    }

    #[test]
    fn unknown_compound_id_is_an_error() {
        let measurement = sample_measurement(
            100,
            MeasurementKind::Numeric {
                wire_type: NumericKind::U8,
            },
        );
        let (index, _) = index_with_protection(measurement, 1);
        let unknown_id = AdjId((2 << 13) | 100);

        assert!(matches!(
            decode(Cursor::new(vec![]), Some(unknown_id), &index),
            Err(DecodeError::UnknownId(id)) if id == unknown_id
        ));
    }

    #[test]
    fn a_non_protection_packet_at_that_id_is_the_wrong_packet_type() {
        let measurement = sample_measurement(
            200,
            MeasurementKind::Numeric {
                wire_type: NumericKind::U8,
            },
        );
        let compound_id = AdjId(200); // pos = 0: a normal, non-protection id
        let packet = PacketDef {
            id: compound_id,
            board: BoardId(1),
            name: "mock_data".to_string(),
            packet_type: PacketType::Data(vec![measurement]),
        };
        let board = Board {
            id: BoardId(1),
            name: "MOCK".to_string(),
            ip: IpAddr::from([127, 0, 0, 1]),
            mac: MacAddress([0; 6]),
            packets: HashMap::from([(packet.id, packet)]),
        };
        let pod_data = PodData {
            boards: HashMap::from([(board.id, board)]),
        };
        let index = Index::new(&pod_data, None);

        assert!(matches!(
            decode(Cursor::new(vec![]), Some(compound_id), &index),
            Err(DecodeError::WrongPacketType { id }) if id == compound_id
        ));
    }

    #[test]
    fn truncated_frame_is_unexpected_eof() {
        let measurement = sample_measurement(
            100,
            MeasurementKind::Numeric {
                wire_type: NumericKind::U32,
            },
        );
        let (index, compound_id) = index_with_protection(measurement, 1);

        // Header alone, no value bytes at all.
        let reader = Cursor::new(vec![0u8; 6]);

        assert!(matches!(
            decode(reader, Some(compound_id), &index),
            Err(DecodeError::Io(_))
        ));
    }

    // --- ENCODE TESTS ---

    #[test]
    fn encode_then_decode_round_trips_timestamp_and_value() {
        let measurement = sample_measurement(
            100,
            MeasurementKind::Numeric {
                wire_type: NumericKind::F32,
            },
        );
        let (index, compound_id) = index_with_protection(measurement, 1);

        let original = ProtectionPacket {
            id: compound_id,
            timestamp: ShortTimestamp {
                hour: 12,
                minute: 30,
                second: 5,
                subsecond: 0,
            },
            value: Value::Number(f64::from(53.2f32)),
        };

        let Ok(bytes) = encode(&original, &index) else {
            unreachable!("encoding a well-formed protection packet should succeed");
        };
        // `encode` writes the id too, so `decode` can read it back itself —
        // proves the full frame round-trips, not just the body.
        let Ok(decoded) = decode(Cursor::new(bytes), None, &index) else {
            unreachable!("decoding what we just encoded should succeed");
        };

        assert_eq!(decoded, original);
    }

    #[test]
    fn encode_zeroes_the_reserved_bytes() {
        let measurement = sample_measurement(
            100,
            MeasurementKind::Numeric {
                wire_type: NumericKind::U8,
            },
        );
        let (index, compound_id) = index_with_protection(measurement, 1);

        let packet = ProtectionPacket {
            id: compound_id,
            timestamp: ShortTimestamp {
                hour: 1,
                minute: 2,
                second: 3,
                subsecond: 4,
            },
            value: Value::Number(7.0),
        };

        let Ok(bytes) = encode(&packet, &index) else {
            unreachable!("encoding a well-formed protection packet should succeed");
        };

        // bytes[0..2] = id, [2..6] = timestamp, [6..8] = resv.
        assert_eq!(bytes[6], 0);
        assert_eq!(bytes[7], 0);
    }

    #[test]
    fn encode_fails_on_unknown_id() {
        let measurement = sample_measurement(
            100,
            MeasurementKind::Numeric {
                wire_type: NumericKind::U8,
            },
        );
        let (index, _) = index_with_protection(measurement, 1);
        let unknown_id = AdjId((2 << 13) | 100);

        let packet = ProtectionPacket {
            id: unknown_id,
            timestamp: ShortTimestamp {
                hour: 0,
                minute: 0,
                second: 0,
                subsecond: 0,
            },
            value: Value::Number(0.0),
        };

        let Err(err) = encode(&packet, &index) else {
            unreachable!("encoding an unknown id should fail");
        };
        assert_eq!(err, EncodeError::UnknownId(unknown_id));
    }

    #[test]
    fn encode_fails_on_wrong_packet_type() {
        let measurement = sample_measurement(
            200,
            MeasurementKind::Numeric {
                wire_type: NumericKind::U8,
            },
        );
        let compound_id = AdjId(200); // pos = 0: a normal, non-protection id
        let packet_def = PacketDef {
            id: compound_id,
            board: BoardId(1),
            name: "mock_data".to_string(),
            packet_type: PacketType::Data(vec![measurement]),
        };
        let board = Board {
            id: BoardId(1),
            name: "MOCK".to_string(),
            ip: IpAddr::from([127, 0, 0, 1]),
            mac: MacAddress([0; 6]),
            packets: HashMap::from([(packet_def.id, packet_def)]),
        };
        let pod_data = PodData {
            boards: HashMap::from([(board.id, board)]),
        };
        let index = Index::new(&pod_data, None);

        let packet = ProtectionPacket {
            id: compound_id,
            timestamp: ShortTimestamp {
                hour: 0,
                minute: 0,
                second: 0,
                subsecond: 0,
            },
            value: Value::Number(0.0),
        };

        let Err(err) = encode(&packet, &index) else {
            unreachable!("encoding the wrong packet type should fail");
        };
        assert_eq!(err, EncodeError::WrongPacketType { id: compound_id });
    }

    #[test]
    fn encode_bubbles_up_type_mismatch() {
        let measurement = sample_measurement(
            100,
            MeasurementKind::Numeric {
                wire_type: NumericKind::U8,
            },
        );
        let (index, compound_id) = index_with_protection(measurement, 1);

        let packet = ProtectionPacket {
            id: compound_id,
            timestamp: ShortTimestamp {
                hour: 0,
                minute: 0,
                second: 0,
                subsecond: 0,
            },
            value: Value::Bool(true),
        };

        let Err(err) = encode(&packet, &index) else {
            unreachable!("encoding a value of the wrong variant should fail");
        };
        assert_eq!(err, EncodeError::TypeMismatch);
    }

    #[test]
    fn encode_bubbles_up_out_of_range() {
        let measurement = sample_measurement(
            100,
            MeasurementKind::Numeric {
                wire_type: NumericKind::U8,
            },
        );
        let (index, compound_id) = index_with_protection(measurement, 1);

        let packet = ProtectionPacket {
            id: compound_id,
            timestamp: ShortTimestamp {
                hour: 0,
                minute: 0,
                second: 0,
                subsecond: 0,
            },
            value: Value::Number(300.0),
        };

        let Err(err) = encode(&packet, &index) else {
            unreachable!("encoding an out-of-range value should fail");
        };
        assert!(matches!(err, EncodeError::OutOfRange { .. }));
    }
}
