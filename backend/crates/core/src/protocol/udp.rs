//! Transport-level UDP framing: the shared socket carries periodic
//! telemetry (`Data` packets) from any board. Receive-only — the backend
//! never sends anything over this socket.
//!
//! The actual decoding lives in [`super::packet::data`], independent of
//! UDP — this module only adds the transport-level guarantee: a UDP
//! datagram is a complete, already-delimited buffer (the OS preserves
//! datagram boundaries even on a socket shared by every board), unlike
//! [`super::tcp::decode_next`]'s stream.

use super::{DecodeError, Index, packet};
use crate::model::DataPacket;

/// Decodes a single UDP datagram's bytes into a [`DataPacket`].
pub fn decode_datagram(bytes: &[u8], index: &Index) -> Result<DataPacket, DecodeError> {
    packet::data::decode(bytes, index)
}
