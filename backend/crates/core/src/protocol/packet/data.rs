//! Decodes a `Data` packet: a board's periodic telemetry. Only ever
//! received, over UDP — a board never receives one back.

use crate::model::DataPacket;
use crate::protocol::{DecodeError, Index};

/// Decodes a complete, already-delimited buffer into a [`DataPacket`],
/// resolving its field shapes against `index`.
pub fn decode(bytes: &[u8], index: &Index) -> Result<DataPacket, DecodeError> {
    let _ = (bytes, index);
    todo!(
        "read the leading 16-bit id; look up its PacketDef in `index` \
         (UnknownId if absent); match its `kind` for \
         PacketKind::Data(measurements) (WrongKind if it's some other \
         kind); decode each measurement's value positionally via \
         wire::decode_value, advancing through `bytes` using each \
         measurement's own wire width"
    )
}
