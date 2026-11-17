//! Decodes a `Message` packet: a board's free-text log line. Only ever
//! received, over TCP. Also provides `encode`, purely so tests can build
//! well-formed frames without hand-written byte arrays — nothing in the
//! real backend calls it, since a message never travels backend -> board.
//!
//! Wire structure (whole frame, including the leading id):
//! ```text
//! | byte(s) | 0-1 | 2    | 3   | 4   | 5      | 6..       | ..        |
//! |---------|-----|------|-----|-----|--------|-----------|-----------|
//! | field   | id  | hora | min | seg | subseg | origin\0  | message\0 |
//! ```
//! `id` (2 bytes) is normally read by a TCP dispatcher before it even
//! knows to call [`decode`] (it needs the id first, to decide this is a
//! message and not a protection) — when that's the case, pass it as
//! `Some`, and `reader` should start right at byte 2 above. Otherwise
//! pass `None`: `reader` should then start at byte 0, id included, and
//! `decode` reads it itself — all of this frame's byte parsing stays in
//! this file either way, never split out into whatever dispatches here.
//! Unlike [`super::protection`], there's no `resv` padding — the
//! timestamp is followed directly by `origin`, a NUL-terminated string
//! of at most `ORIGIN_MAX` bytes (terminator included), then `message`,
//! at most `MESSAGE_MAX` bytes the same way. Both are variable-length —
//! there's no fixed byte range for either.
//!
//! Unlike [`super::protection`] too, [`MessagePacket`] doesn't carry its
//! own severity — `id` is resolved against `index` to confirm it's
//! actually a declared [`crate::model::PacketType::Message`] (so a
//! `WrongPacketType`/`UnknownId` frame is rejected), but the severity
//! itself is never stored redundantly on the decoded instance; look it up
//! via `index.packet(id)` again if it's needed.

use crate::model::{AdjId, MessagePacket, PacketType, ShortTimestamp};
use crate::protocol::{DecodeError, EncodeError, Index};
use std::io::Read;

// `origin`/`message` max lengths, content + NUL terminator included
// (docu_backend/Comunicaciones_Reunion01.qmd, lines 207-237).
const ORIGIN_MAX: usize = 48;
const MESSAGE_MAX: usize = 320;

/// Decodes a message frame, resolving its id against `index` to confirm
/// it's actually a declared message.
///
/// `id`: `Some` if the caller already read it (see this module's doc
/// comment); `None` to have `decode` read it itself off `reader`'s first
/// 2 bytes.
pub fn decode(
    mut reader: impl Read,
    id: Option<AdjId>,
    index: &Index,
) -> Result<MessagePacket, DecodeError> {
    let id = match id {
        Some(id) => id,
        None => super::read_id(&mut reader)?,
    };

    // Look up the packet definition for this id, and ensure it's a
    // message packet. If not, the frame is malformed and we can't decode it.
    let packet_def = index.packet(id).ok_or(DecodeError::UnknownId(id))?;

    let PacketType::Message(_) = &packet_def.packet_type else {
        return Err(DecodeError::WrongPacketType { id });
    };

    let mut header = [0u8; 4];
    reader.read_exact(&mut header)?;
    let timestamp = ShortTimestamp {
        hour: header[0],
        minute: header[1],
        second: header[2],
        subsecond: header[3],
    };

    let origin = read_null_terminated_string(&mut reader, ORIGIN_MAX)?;
    let message = read_null_terminated_string(&mut reader, MESSAGE_MAX)?;

    Ok(MessagePacket {
        id,
        timestamp,
        origin,
        message,
    })
}

/// Reads bytes up to the first `0x00` (exclusive) or `max` bytes total,
/// whichever comes first — [`DecodeError::UnterminatedString`] if no
/// terminator shows up within `max` bytes.
fn read_null_terminated_string(reader: &mut impl Read, max: usize) -> Result<String, DecodeError> {
    // Byte by byte via `read_exact`, not `.bytes()` — that iterator warns
    // under clippy for being unbuffered, and `reader` here can be any
    // `impl Read`, not necessarily a buffered one.
    let mut bytes = Vec::new();
    for _ in 0..max {
        let mut byte = [0u8; 1];
        reader.read_exact(&mut byte)?;
        if byte[0] == 0 {
            return String::from_utf8(bytes).map_err(|e| DecodeError::InvalidUtf8(e.into_bytes()));
        }
        bytes.push(byte[0]);
    }
    Err(DecodeError::UnterminatedString { max })
}

/// Encodes a [`MessagePacket`] back into the bytes [`decode`] expects —
/// a complete, self-contained frame, leading id included.
///
/// Nothing in the real backend calls this — per the ADJ spec, message
/// packets only ever travel board -> backend. This exists purely so
/// tests can build well-formed frames without hand-written byte arrays,
/// and to prove `decode` recovers exactly what was encoded.
pub fn encode(packet: &MessagePacket, index: &Index) -> Result<Vec<u8>, EncodeError> {
    let packet_def = index
        .packet(packet.id)
        .ok_or(EncodeError::UnknownId(packet.id))?;

    let PacketType::Message(_) = &packet_def.packet_type else {
        return Err(EncodeError::WrongPacketType { id: packet.id });
    };

    let mut bytes = packet.id.0.to_le_bytes().to_vec();
    bytes.extend([
        packet.timestamp.hour,
        packet.timestamp.minute,
        packet.timestamp.second,
        packet.timestamp.subsecond,
    ]);

    write_null_terminated_string(&mut bytes, &packet.origin, ORIGIN_MAX)?;
    write_null_terminated_string(&mut bytes, &packet.message, MESSAGE_MAX)?;

    Ok(bytes)
}

/// Appends `value` to `bytes` as a NUL-terminated string, erroring if it
/// can't be represented that way: an embedded `\0` would be misread as
/// an early terminator, and the content plus its terminator must still
/// fit within `max` bytes.
fn write_null_terminated_string(
    bytes: &mut Vec<u8>,
    value: &str,
    max: usize,
) -> Result<(), EncodeError> {
    if value.contains('\0') {
        return Err(EncodeError::EmbeddedNulByte);
    }
    if value.len() >= max {
        return Err(EncodeError::StringTooLong { max });
    }

    bytes.extend_from_slice(value.as_bytes());
    bytes.push(0);
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Board, BoardId, MacAddress, MessageLevel, PacketDef, PodData};
    use std::collections::HashMap;
    use std::io::Cursor;
    use std::net::IpAddr;

    /// Builds an `Index` declaring one message severity: `id` as
    /// `MessageLevel::Fault`, exactly as `protocol::Index::new` would
    /// synthesize it from a loaded ADJ's `message_levels`.
    fn index_with_message(id: AdjId, level: MessageLevel) -> Index {
        let message_levels = HashMap::from([(id, level)]);
        Index::new(&PodData::default(), Some(&message_levels))
    }

    #[test]
    fn decodes_timestamp_and_both_strings() {
        let index = index_with_message(AdjId(11), MessageLevel::Warning);
        let mut bytes = vec![12, 30, 5, 0]; // hour, minute, second, subsecond
        bytes.extend(b"main.c");
        bytes.push(0);
        bytes.extend(b"something went wrong");
        bytes.push(0);

        let Ok(packet) = decode(Cursor::new(bytes), Some(AdjId(11)), &index) else {
            unreachable!("decoding a well-formed message frame should succeed");
        };

        assert_eq!(packet.id, AdjId(11));
        assert_eq!(packet.timestamp.hour, 12);
        assert_eq!(packet.timestamp.minute, 30);
        assert_eq!(packet.timestamp.second, 5);
        assert_eq!(packet.origin, "main.c");
        assert_eq!(packet.message, "something went wrong");
    }

    #[test]
    fn decode_treats_a_leading_terminator_as_an_empty_string() {
        let index = index_with_message(AdjId(12), MessageLevel::Info);
        let mut bytes = vec![0, 0, 0, 0];
        bytes.push(0); // origin: empty
        bytes.push(0); // message: empty

        let Ok(packet) = decode(Cursor::new(bytes), Some(AdjId(12)), &index) else {
            unreachable!("decoding a well-formed message frame should succeed");
        };

        assert_eq!(packet.origin, "");
        assert_eq!(packet.message, "");
    }

    #[test]
    fn decode_fails_when_origin_has_no_terminator_within_max() {
        let index = index_with_message(AdjId(10), MessageLevel::Fault);
        let mut bytes = vec![0, 0, 0, 0];
        bytes.extend(vec![b'a'; ORIGIN_MAX]); // no terminator anywhere

        let Err(err) = decode(Cursor::new(bytes), Some(AdjId(10)), &index) else {
            unreachable!("decoding an unterminated origin should fail");
        };
        assert_eq!(err, DecodeError::UnterminatedString { max: ORIGIN_MAX });
    }

    #[test]
    fn decode_fails_when_message_has_no_terminator_within_max() {
        let index = index_with_message(AdjId(13), MessageLevel::Panic);
        let mut bytes = vec![0, 0, 0, 0];
        bytes.push(0); // origin: empty, terminated
        bytes.extend(vec![b'a'; MESSAGE_MAX]); // message: no terminator

        let Err(err) = decode(Cursor::new(bytes), Some(AdjId(13)), &index) else {
            unreachable!("decoding an unterminated message should fail");
        };
        assert_eq!(err, DecodeError::UnterminatedString { max: MESSAGE_MAX });
    }

    #[test]
    fn decode_fails_on_invalid_utf8() {
        let index = index_with_message(AdjId(12), MessageLevel::Info);
        let mut bytes = vec![0, 0, 0, 0];
        bytes.push(0x80); // lone continuation byte: not valid UTF-8 on its own
        bytes.push(0);

        let Err(err) = decode(Cursor::new(bytes), Some(AdjId(12)), &index) else {
            unreachable!("decoding invalid UTF-8 should fail");
        };
        assert_eq!(err, DecodeError::InvalidUtf8(vec![0x80]));
    }

    #[test]
    fn decode_fails_on_truncated_header() {
        let index = index_with_message(AdjId(12), MessageLevel::Info);
        let Err(err) = decode(Cursor::new(vec![0, 0]), Some(AdjId(12)), &index) else {
            unreachable!("decoding a truncated header should fail");
        };
        assert!(matches!(err, DecodeError::Io(_)));
    }

    #[test]
    fn decode_reads_the_id_itself_when_not_given_one() {
        let index = index_with_message(AdjId(11), MessageLevel::Warning);
        let mut bytes = AdjId(11).0.to_le_bytes().to_vec();
        bytes.extend([12, 30, 5, 0]); // hour, minute, second, subsecond
        bytes.push(0); // origin: empty
        bytes.push(0); // message: empty

        let Ok(packet) = decode(Cursor::new(bytes), None, &index) else {
            unreachable!("decoding a well-formed message frame should succeed");
        };

        assert_eq!(packet.id, AdjId(11));
    }

    #[test]
    fn decode_fails_on_an_unknown_id() {
        let index = index_with_message(AdjId(11), MessageLevel::Warning);
        let bytes = 9999u16.to_le_bytes().to_vec();

        let Err(err) = decode(Cursor::new(bytes), None, &index) else {
            unreachable!("decoding an unknown message id should fail");
        };
        assert_eq!(err, DecodeError::UnknownId(AdjId(9999)));
    }

    #[test]
    fn decode_fails_when_the_id_resolves_to_a_non_message_packet() {
        let data_id = AdjId(2000);
        let packet = PacketDef {
            id: data_id,
            board: BoardId(1),
            name: "bcu_data".to_string(),
            packet_type: PacketType::Data(vec![]),
        };
        let board = Board {
            id: BoardId(1),
            name: "BCU".to_string(),
            ip: IpAddr::from([127, 0, 0, 1]),
            mac: MacAddress([0; 6]),
            packets: HashMap::from([(packet.id, packet)]),
        };
        let pod_data = PodData {
            boards: HashMap::from([(board.id, board)]),
        };
        let index = Index::new(&pod_data, None);

        let bytes = data_id.0.to_le_bytes().to_vec();
        let Err(err) = decode(Cursor::new(bytes), None, &index) else {
            unreachable!("decoding an id that resolves to a Data packet should fail");
        };
        assert_eq!(err, DecodeError::WrongPacketType { id: data_id });
    }

    // --- ENCODE TESTS ---

    #[test]
    fn encode_then_decode_round_trips_timestamp_and_strings() {
        let index = index_with_message(AdjId(10), MessageLevel::Fault);
        let original = MessagePacket {
            id: AdjId(10),
            timestamp: ShortTimestamp {
                hour: 23,
                minute: 59,
                second: 58,
                subsecond: 200,
            },
            origin: "board/src/main.c".to_string(),
            message: "overcurrent detected".to_string(),
        };

        let Ok(bytes) = encode(&original, &index) else {
            unreachable!("encoding a well-formed message packet should succeed");
        };
        // `encode` writes the id too, so `decode` can read it back itself —
        // proves the full frame round-trips, not just the body.
        let Ok(decoded) = decode(Cursor::new(bytes), None, &index) else {
            unreachable!("decoding what we just encoded should succeed");
        };

        assert_eq!(decoded, original);
    }

    #[test]
    fn encode_fails_on_unknown_id() {
        let index = index_with_message(AdjId(10), MessageLevel::Fault);
        let packet = MessagePacket {
            id: AdjId(9999),
            timestamp: ShortTimestamp {
                hour: 0,
                minute: 0,
                second: 0,
                subsecond: 0,
            },
            origin: String::new(),
            message: String::new(),
        };

        let Err(err) = encode(&packet, &index) else {
            unreachable!("encoding an unknown id should fail");
        };
        assert_eq!(err, EncodeError::UnknownId(AdjId(9999)));
    }

    #[test]
    fn encode_fails_on_wrong_packet_type() {
        let data_id = AdjId(2000);
        let packet_def = PacketDef {
            id: data_id,
            board: BoardId(1),
            name: "bcu_data".to_string(),
            packet_type: PacketType::Data(vec![]),
        };
        let board = Board {
            id: BoardId(1),
            name: "BCU".to_string(),
            ip: IpAddr::from([127, 0, 0, 1]),
            mac: MacAddress([0; 6]),
            packets: HashMap::from([(packet_def.id, packet_def)]),
        };
        let pod_data = PodData {
            boards: HashMap::from([(board.id, board)]),
        };
        let index = Index::new(&pod_data, None);

        let packet = MessagePacket {
            id: data_id,
            timestamp: ShortTimestamp {
                hour: 0,
                minute: 0,
                second: 0,
                subsecond: 0,
            },
            origin: String::new(),
            message: String::new(),
        };

        let Err(err) = encode(&packet, &index) else {
            unreachable!("encoding into a non-message packet's id should fail");
        };
        assert_eq!(err, EncodeError::WrongPacketType { id: data_id });
    }

    #[test]
    fn encode_rejects_a_too_long_origin() {
        let index = index_with_message(AdjId(12), MessageLevel::Info);
        let packet = MessagePacket {
            id: AdjId(12),
            timestamp: ShortTimestamp {
                hour: 0,
                minute: 0,
                second: 0,
                subsecond: 0,
            },
            origin: "a".repeat(ORIGIN_MAX),
            message: String::new(),
        };

        let Err(err) = encode(&packet, &index) else {
            unreachable!("encoding an origin with no room for its terminator should fail");
        };
        assert_eq!(err, EncodeError::StringTooLong { max: ORIGIN_MAX });

        let fits = MessagePacket {
            origin: "a".repeat(ORIGIN_MAX - 1),
            ..packet
        };
        assert!(encode(&fits, &index).is_ok());
    }

    #[test]
    fn encode_rejects_an_embedded_nul_byte() {
        let index = index_with_message(AdjId(12), MessageLevel::Info);
        let packet = MessagePacket {
            id: AdjId(12),
            timestamp: ShortTimestamp {
                hour: 0,
                minute: 0,
                second: 0,
                subsecond: 0,
            },
            origin: "ab\0cd".to_string(),
            message: String::new(),
        };

        let Err(err) = encode(&packet, &index) else {
            unreachable!("encoding a string with an embedded NUL byte should fail");
        };
        assert_eq!(err, EncodeError::EmbeddedNulByte);
    }
}
