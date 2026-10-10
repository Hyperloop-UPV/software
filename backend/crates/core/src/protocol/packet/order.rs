//! Encodes an `Order` packet: a command sent to a board. Only ever sent,
//! over TCP — the backend never receives one back.

use crate::model::{OrderPacket, PacketKind};
use crate::protocol::{wire, EncodeError, Index};

/// Encodes `order` into the bytes to write to a board's connection,
/// resolving its field shapes against `index`.
pub fn encode(order: &OrderPacket, index: &Index) -> Result<Vec<u8>, EncodeError> {

    //Unwrap PacketDef for kind
    let packet_def = index
        .packet(order.id)
        .ok_or(EncodeError::UnknownId(order.id))?;// Question mark for error propagation and prevent crash

    //Check if packetdef is PacketKind::Order(measurement). Also returns the list of measurements
    let measurements = match &packet_def.kind{
        PacketKind::Order(measurements) => measurements,
        _ => return Err(EncodeError::WrongKind {id:order.id})
    };

    //Check if length of list of fields matches number of measurements.
    if order.fields.len() != measurements.len(){
        return Err(EncodeError::WrongFieldCount {expected:measurements.len(),got:order.fields.len()})
    }

    let mut bytes = Vec::new();

    bytes.extend_from_slice(&order.id.0.to_be_bytes());//Header prefix of byte stream to 16 bit big-endian

    //Encoding to bytes
    for (field,measurement) in order.fields.iter().zip(measurements){ //For each measurement
        let field_bytes = wire::encode_value(field,&measurement.kind)?;// Encode field Value into bytes according to MeasurementKind
        bytes.extend(field_bytes);// Adds to byte stream
    }

    Ok(bytes) // Return bytes
}



// todo!(
//     "look up order.id in `index` to get its PacketDef (UnknownId if \
//          absent); match its `kind` for PacketKind::Order(measurements) \
//          (WrongKind if it's some other kind); error with WrongFieldCount \
//          if order.fields.len() doesn't match measurements.len(); encode \
//          the id then each field positionally via wire::encode_value"
// )