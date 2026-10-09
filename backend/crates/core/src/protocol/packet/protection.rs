//! Decodes a `Protection` packet: a board reporting one of its declared
//! protections triggered. Only ever received, over TCP.

use crate::model::{AdjId, ProtectionPacket};
use crate::protocol::{DecodeError, Index};
use std::io::Read;

/// Decodes a protection frame's remaining bytes, given the frame's
/// already-read compound id (`tcp::decode_next`'s job), resolving the
/// watched measurement's wire type against `index`.
pub fn decode(
    reader: impl Read,
    compound_id: AdjId,
    index: &Index,
) -> Result<ProtectionPacket, DecodeError> {
    let _ = (reader, compound_id, index);
    todo!(
        "look up compound_id's PacketDef in `index` (already keyed by \
         this exact compound id, see adj::raw::loader); match its `kind` \
         for PacketKind::Protection(measurement) (WrongKind if it's some \
         other kind) to get the watched measurement's wire type; \
         separately split compound_id's bits into (measurement, position) \
         to fill ProtectionPacket's `measurement`/`protection` fields; \
         read the timestamp, then the value via wire::decode_value"
    )
}
