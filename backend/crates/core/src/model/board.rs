//! Boards and their packet definitions.
//!
//! [`PodData`] is the whole vehicle as described by the ADJ: every board,
//! and every packet each board can send or receive.
//!
//! This module only carries fields we have solid grounds for: `id`,
//! `name`, whether a packet is data or an order, and its
//! measurements. Framing details that might still apply per packet (cycle
//! time, raw byte count...) are not confirmed for ADJv3 yet, so they are
//! left out rather than guessed — add them once the packet-level JSON
//! shape is settled.

use super::{AdjId, BoardId, MacAddress, Measurement};
use std::collections::HashMap;
use std::net::IpAddr;

/// What kind of packet a [`PacketDef`] declares.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
pub enum PacketKind {
    /// Measurements sent by a board.
    Data,
    /// Protection associated with a measurement.
    Protection,
    /// An order sent to a board.
    Order,
    /// A message sent by a board.
    Message,
}

/// The declaration of a single packet a board can send or receive, as
/// defined by the ADJ.
///
/// This is the *declaration* — see [`super::Packet`] for a decoded
/// instance actually sent or received over the wire.
#[derive(Debug, Clone, PartialEq)]
pub struct PacketDef {
    /// The packet's numeric ADJ id.
    pub id: AdjId,
    /// The board this packet belongs to. A `PacketDef` is always reached
    /// through its owning [`Board`] already, but carrying the id here too
    /// means anything holding just a `&PacketDef` (e.g. a lookup table
    /// indexed by [`AdjId`]) knows which board it is without a second,
    /// separate index back to it.
    pub board: BoardId,
    /// The human-readable name shown to the user.
    pub name: String,
    /// Whether this is data or an order.
    pub kind: PacketKind,
    /// The measurements this packet carries, in ADJ order.
    pub measurements: Vec<Measurement>,
}

/// A single board of the vehicle, as defined by the ADJ.
#[derive(Debug, Clone, PartialEq)]
pub struct Board {
    /// The board's unique id.
    pub id: BoardId,
    /// The board's name, e.g. `"BCU"`.
    pub name: String,
    /// The board's IP address, used to open its TCP/UDP connections.
    pub ip: IpAddr,
    /// The board's MAC address (ADJv3 spec, section 5).
    pub mac: MacAddress,
    /// The packets this board can send or receive, keyed by id — same
    /// reasoning as [`PodData::boards`], the ADJ gives this list no
    /// meaningful order either.
    pub packets: HashMap<AdjId, PacketDef>,
}

/// The whole vehicle, as described by the ADJ: every board and every
/// packet each one can send or receive.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct PodData {
    /// Every board of the vehicle, keyed by its id — the ADJ doesn't give
    /// boards any meaningful order, so iterating this in some particular
    /// sequence is never something to rely on.
    pub boards: HashMap<BoardId, Board>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::MeasurementKind;

    fn sample_measurement() -> Measurement {
        Measurement {
            id: AdjId(3000),
            alias: "temperature_1".to_string(),
            name: "Temperature 1".to_string(),
            display_units: "ºC".to_string(),
            kind: MeasurementKind::Boolean,
            protections: vec![],
        }
    }

    #[test]
    fn an_empty_pod_data_has_no_boards() {
        let pod_data = PodData::default();
        assert!(pod_data.boards.is_empty());
    }

    #[test]
    fn a_board_groups_its_packets_and_their_measurements() {
        let board = Board {
            id: BoardId(1),
            name: "BCU".to_string(),
            ip: IpAddr::from([192, 168, 0, 10]),
            mac: MacAddress([0x00, 0x11, 0x22, 0x33, 0x44, 0x55]),
            packets: HashMap::from([(
                AdjId(1000),
                PacketDef {
                    id: AdjId(1000),
                    board: BoardId(1),
                    name: "bcu_data".to_string(),
                    kind: PacketKind::Data,
                    measurements: vec![sample_measurement()],
                },
            )]),
        };

        assert_eq!(board.packets.len(), 1);
        let Some(packet) = board.packets.get(&AdjId(1000)) else {
            unreachable!("the packet we just inserted should be there");
        };
        assert_eq!(packet.measurements.len(), 1);
        assert_eq!(packet.kind, PacketKind::Data);
        assert_eq!(board.mac.to_string(), "00:11:22:33:44:55");
    }
}
