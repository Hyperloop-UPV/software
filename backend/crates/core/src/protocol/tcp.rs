//! Transport-level TCP framing: a board's dedicated connection carries
//! triggered protections and free-text messages from the board, and
//! orders to it. Never a `Data` packet — see the module doc on
//! [`super`].
//!
//! Both functions here are thin: the actual per-type decoding lives in
//! [`super::packet::protection`]/[`super::packet::message`]/
//! [`super::packet::data_order`], independent of TCP. This module only adds
//! the transport-level guarantee — [`decode_next`] can only ever return
//! a [`TcpFrame`], never a `DataPacket`.

use super::{DecodeError, EncodeError, Index, packet};
use crate::model::{MessagePacket, OrderPacket, ProtectionPacket};
use std::io::Read;

/// A decoded TCP frame — everything a board can send to the backend over
/// its dedicated TCP connection.
#[derive(Debug, Clone, PartialEq)]
pub enum TcpFrame {
    /// A protection triggered.
    Protection(ProtectionPacket),
    /// A free-text message.
    Message(MessagePacket),
}

/// Reads and decodes the next complete frame from `reader`, resolving
/// field shapes against `index`.
///
/// Reads the frame's leading 16-bit id first — the one piece of byte
/// handling this function does itself, since it has no way to decide
/// which of [`super::packet::protection::decode`]/
/// [`super::packet::message::decode`] to call otherwise (see
/// `packet/README.md`'s "dispatcher's one unavoidable read"). A
/// protection's compound id always has its high 3 bits set to a nonzero
/// position (see [`crate::model::AdjId`]'s own docs on its ranges), so
/// `id.0 >= 8192` (`1 << 13`) is a protection; anything below that hands
/// off to `message::decode` instead — `message::decode` resolves it
/// against `index` itself (`UnknownId`/`WrongPacketType` if it isn't
/// actually a declared message), so there's no separate lookup to do here
/// first.
/// Either call's result is wrapped in the matching [`TcpFrame`] variant.
pub fn decode_next(mut reader: impl Read, index: &Index) -> Result<TcpFrame, DecodeError> {
    let id = packet::read_id(&mut reader)?;

    if id.0 >= 8192 {
        let protection = packet::protection::decode(reader, Some(id), index)?;
        Ok(TcpFrame::Protection(protection))
    } else {
        let message = packet::message::decode(reader, Some(id), index)?;
        Ok(TcpFrame::Message(message))
    }
}

/// Encodes `order` into the bytes to write to the board's connection.
pub fn encode_order(order: &OrderPacket, index: &Index) -> Result<Vec<u8>, EncodeError> {
    packet::data_order::encode(order, index)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{
        AdjId, Board, BoardId, MacAddress, Measurement, MeasurementKind, MessageLevel, NumericKind,
        PacketDef, PacketType, PodData, ShortTimestamp, Value,
    };
    use std::collections::HashMap;
    use std::io::Cursor;
    use std::net::IpAddr;

    /// A board with one protection (position 1 on measurement 100, wire
    /// type `U8`) and one declared message severity (`id` 10 = `Fault`).
    fn sample_index() -> Index {
        let measurement = Measurement {
            id: AdjId(100),
            alias: "temp".to_string(),
            name: "Temp".to_string(),
            display_units: String::new(),
            kind: MeasurementKind::Numeric {
                wire_type: NumericKind::U8,
            },
            protections: vec![],
        };
        let compound_id = AdjId((1u16 << 13) | measurement.id.0);
        let packet_def = PacketDef {
            id: compound_id,
            board: BoardId(1),
            name: "temp_protection".to_string(),
            packet_type: PacketType::Protection(measurement),
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
        let message_levels = HashMap::from([(AdjId(10), MessageLevel::Fault)]);
        Index::new(&pod_data, Some(&message_levels))
    }

    #[test]
    fn decode_next_dispatches_a_protection_frame() {
        let index = sample_index();
        let compound_id = AdjId((1u16 << 13) | 100);

        let mut bytes = compound_id.0.to_le_bytes().to_vec();
        bytes.extend([12, 30, 5, 0, 0, 0]); // hora, min, seg, subseg, resv(2)
        bytes.push(42); // value, U8

        let Ok(frame) = decode_next(Cursor::new(bytes), &index) else {
            unreachable!("decoding a well-formed protection frame should succeed");
        };

        let TcpFrame::Protection(protection) = frame else {
            unreachable!("a non-zero protection_position should dispatch to Protection");
        };
        assert_eq!(protection.id, compound_id);
        assert_eq!(protection.value, Value::Number(42.0));
    }

    #[test]
    fn decode_next_dispatches_a_message_frame() {
        let index = sample_index();

        let mut bytes = AdjId(10).0.to_le_bytes().to_vec();
        bytes.extend([1, 2, 3, 4]); // hora, min, seg, subseg
        bytes.push(0); // origin: empty
        bytes.push(0); // message: empty

        let Ok(frame) = decode_next(Cursor::new(bytes), &index) else {
            unreachable!("decoding a well-formed message frame should succeed");
        };

        let TcpFrame::Message(message) = frame else {
            unreachable!("a zero protection_position should dispatch to Message");
        };
        assert_eq!(message.id, AdjId(10));
        assert_eq!(
            message.timestamp,
            ShortTimestamp {
                hour: 1,
                minute: 2,
                second: 3,
                subsecond: 4,
            }
        );
    }

    #[test]
    fn decode_next_propagates_an_unknown_message_id() {
        let index = sample_index();
        let bytes = 9999u16.to_le_bytes().to_vec();

        let Err(err) = decode_next(Cursor::new(bytes), &index) else {
            unreachable!("decoding an id that's neither a protection nor a message should fail");
        };
        assert_eq!(err, DecodeError::UnknownId(AdjId(9999)));
    }
}
