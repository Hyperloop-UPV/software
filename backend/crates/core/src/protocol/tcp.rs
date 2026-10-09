//! Transport-level TCP framing: a board's dedicated connection carries
//! triggered protections and free-text messages from the board, and
//! orders to it. Never a `Data` packet — see the module doc on
//! [`super`].
//!
//! Both functions here are thin: the actual per-kind decoding lives in
//! [`super::packet::protection`]/[`super::packet::message`]/
//! [`super::packet::order`], independent of TCP. This module only adds
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
/// Reads the frame's leading 16-bit id first, then decides which of
/// [`super::packet::protection::decode`] (the id's high 3 bits are a
/// protection's position, non-zero) or [`super::packet::message::decode`]
/// (the id matches one of `general_info.json`'s `message_ids`) to hand
/// the rest of the frame to, wrapping the result in the matching
/// [`TcpFrame`] variant.
pub fn decode_next(reader: impl Read, index: &Index) -> Result<TcpFrame, DecodeError> {
    let _ = (reader, index);
    todo!(
        "read the leading 16-bit id; if its top 3 bits are non-zero, call \
         packet::protection::decode; otherwise resolve it against \
         general_info.json's message_ids (not yet reachable from `Index` \
         — needs AdjInfo too) and call packet::message::decode; wrap \
         either result in the matching TcpFrame variant"
    )
}

/// Encodes `order` into the bytes to write to the board's connection.
pub fn encode_order(order: &OrderPacket, index: &Index) -> Result<Vec<u8>, EncodeError> {
    packet::order::encode(order, index)
}
