//! The `id -> PacketDef` lookup `tcp`/`udp` decode against.

use crate::model::{AdjId, PacketDef, PodData};
use std::collections::HashMap;

/// A lookup table from a packet's [`AdjId`] to its declaration, built once
/// from a loaded ADJ's [`PodData`].
///
/// Owns its own copy of every [`PacketDef`] (cloned out of `PodData` at
/// construction) rather than borrowing, so it carries no lifetime and can
/// be shared across `tokio::spawn`ed tasks via `Arc<Index>` without a
/// fight with the borrow checker. Knows nothing about networking (no
/// `IpAddr`/`SocketAddr`) — that bookkeeping belongs to `core::net`, not
/// here.
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Index {
    by_id: HashMap<AdjId, PacketDef>,
}

impl Index {
    /// Builds an index over every packet declared by every board in
    /// `pod_data`.
    pub fn new(pod_data: &PodData) -> Self {
        let by_id = pod_data
            .boards
            .values()
            .flat_map(|board| board.packets.values())
            .map(|packet| (packet.id, packet.clone()))
            .collect();
        Self { by_id }
    }

    /// Looks up a packet's declaration by id.
    pub fn packet(&self, id: AdjId) -> Option<&PacketDef> {
        self.by_id.get(&id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Board, BoardId, MacAddress, PacketKind};
    use std::net::IpAddr;

    fn sample_pod_data() -> PodData {
        let packet = PacketDef {
            id: AdjId(1000),
            board: BoardId(1),
            name: "bcu_data".to_string(),
            kind: PacketKind::Data(vec![]),
        };
        let board = Board {
            id: BoardId(1),
            name: "BCU".to_string(),
            ip: IpAddr::from([192, 168, 0, 10]),
            mac: MacAddress([0; 6]),
            packets: HashMap::from([(packet.id, packet)]),
        };
        PodData {
            boards: HashMap::from([(board.id, board)]),
        }
    }

    #[test]
    fn finds_a_packet_declared_on_any_board() {
        let index = Index::new(&sample_pod_data());
        let Some(packet) = index.packet(AdjId(1000)) else {
            unreachable!("packet 1000 was declared in the sample pod data");
        };
        assert_eq!(packet.name, "bcu_data");
    }

    #[test]
    fn unknown_id_is_not_found() {
        let index = Index::new(&sample_pod_data());
        assert!(index.packet(AdjId(9999)).is_none());
    }
}
