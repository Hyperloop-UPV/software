//! Encodes an `Order` packet: a command sent to a board. Only ever sent,
//! over TCP — the backend never receives one back.

use crate::model::OrderPacket;
use crate::protocol::{EncodeError, Index};

/// Encodes `order` into the bytes to write to a board's connection,
/// resolving its field shapes against `index`.
pub fn encode(order: &OrderPacket, index: &Index) -> Result<Vec<u8>, EncodeError> {
    let _ = (order, index);
    todo!(
        "look up order.id in `index` to get its PacketDef (UnknownId if \
         absent); match its `kind` for PacketKind::Order(measurements) \
         (WrongKind if it's some other kind); error with WrongFieldCount \
         if order.fields.len() doesn't match measurements.len(); encode \
         the id then each field positionally via wire::encode_value"
    )
}
