//! Decodes a `Message` packet: a board's free-text log line. Only ever
//! received, over TCP.

use crate::model::{MessageLevel, MessagePacket};
use crate::protocol::DecodeError;
use std::io::Read;

/// Decodes a message frame's remaining bytes, given the frame's
/// already-resolved severity level (`tcp::decode_next`'s job).
pub fn decode(reader: impl Read, level: MessageLevel) -> Result<MessagePacket, DecodeError> {
    let _ = (reader, level);
    todo!(
        "read the timestamp, then the null-terminated `origin` (max 48 \
         bytes) and `message` (max 320 bytes) strings"
    )
}
