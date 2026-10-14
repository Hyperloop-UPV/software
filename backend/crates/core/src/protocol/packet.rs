//! Encode/decode for one specific type of packet, independent of which
//! transport carries it — that mapping lives in [`super::tcp`]/
//! [`super::udp`], which are thin wrappers around these.
//!
//! [`data_order`]'s `encode`/`decode` are generic over `Kind`
//! ([`crate::model::PacketTypeTag`]), so they work for both `Data` and
//! `Order` alike; the backend itself only ever exercises one direction per
//! type (an order is only ever sent, data only ever received), but that's
//! a restriction `tcp`/`udp` apply, not something baked into the codec.
//!
//! [`message`]/[`protection`] are genuinely one-directional in
//! production — a board only ever sends these, never receives them —
//! but both also expose an `encode`, purely so tests can build
//! well-formed frames without hand-written byte arrays; see each
//! module's own doc comment.

pub mod data_order;
pub mod message;
pub mod protection;

use crate::model::AdjId;
use crate::protocol::DecodeError;
use std::io::Read;

/// Reads a raw little-endian 16-bit id off the front of `reader`.
///
/// Shared by [`message`]/[`protection`] — the only two types whose
/// `decode` ever needs to read its own leading id, when the caller
/// doesn't already know it (see each module's own doc comment on why) —
/// and by [`super::tcp::decode_next`], which needs the id *before* it
/// can even decide which of the two to call. `pub(super)` (visible to
/// `protocol` and everything under it) rather than private, for that
/// last caller: `tcp` is `packet`'s sibling, not its descendant, so
/// private wouldn't reach it. [`data_order`] doesn't need this: it reads
/// its id a different way, straight out of an in-memory byte slice,
/// never a `Read` stream.
pub(super) fn read_id(reader: &mut impl Read) -> Result<AdjId, DecodeError> {
    let mut bytes = [0u8; 2];
    reader.read_exact(&mut bytes)?;
    Ok(AdjId(u16::from_le_bytes(bytes)))
}
