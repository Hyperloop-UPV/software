//! The `id -> PacketDef` lookup `tcp`/`udp` decode against.

use crate::model::{AdjId, BoardId, MessageLevel, PacketDef, PacketType, PodData};
use std::collections::HashMap;

/// A lookup table from a packet's [`AdjId`] to its declaration, built once
/// from a loaded ADJ's [`PodData`] — and, optionally, its message
/// severities too.
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
    /// `pod_data`, plus one synthesized [`PacketDef`] per entry in
    /// `message_levels` (an ADJ's `general_info.json`-derived
    /// [`crate::adj::AdjInfo::message_levels`]).
    ///
    /// `message_levels` is `Option` rather than a plain reference so
    /// that callers with no [`crate::adj::AdjInfo`] at hand — most tests
    /// in this crate, which only ever build a bare [`PodData`] — can
    /// just pass `None` instead of having to construct an empty map.
    ///
    /// A message severity isn't declared by any one board (any board's
    /// free-text log frame can reuse the same `"fault"` id), so its
    /// synthesized `PacketDef` gets the reserved `BoardId(0)` — no real
    /// board uses that id — instead of a real one.
    pub fn new(pod_data: &PodData, message_levels: Option<&HashMap<AdjId, MessageLevel>>) -> Self {
        let mut by_id: HashMap<AdjId, PacketDef> = pod_data
            .boards
            .values()
            .flat_map(|board| board.packets.values())
            .map(|packet| (packet.id, packet.clone()))
            .collect();

        if let Some(message_levels) = message_levels {
            for (&id, &level) in message_levels {
                by_id.insert(
                    id,
                    PacketDef {
                        id,
                        board: BoardId(0),
                        name: level.name().to_string(),
                        packet_type: PacketType::Message(level),
                    },
                );
            }
        }

        Self { by_id }
    }

    /// Looks up a packet's declaration by id — a message severity
    /// resolves through here too, as a synthesized `PacketDef` with
    /// `packet_type: PacketType::Message(level)`; see this type's doc
    /// comment.
    pub fn packet(&self, id: AdjId) -> Option<&PacketDef> {
        self.by_id.get(&id)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{Board, BoardId, MacAddress, PacketType};
    use std::net::IpAddr;

    fn sample_pod_data() -> PodData {
        let packet = PacketDef {
            id: AdjId(1000),
            board: BoardId(1),
            name: "bcu_data".to_string(),
            packet_type: PacketType::Data(vec![]),
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
        let index = Index::new(&sample_pod_data(), None);
        let Some(packet) = index.packet(AdjId(1000)) else {
            unreachable!("packet 1000 was declared in the sample pod data");
        };
        assert_eq!(packet.name, "bcu_data");
    }

    #[test]
    fn unknown_id_is_not_found() {
        let index = Index::new(&sample_pod_data(), None);
        assert!(index.packet(AdjId(9999)).is_none());
    }

    #[test]
    fn a_message_severity_resolves_as_a_synthesized_packet_def() {
        let message_levels = HashMap::from([(AdjId(2), MessageLevel::Fault)]);
        let index = Index::new(&sample_pod_data(), Some(&message_levels));

        let Some(packet) = index.packet(AdjId(2)) else {
            unreachable!("the \"fault\" severity was declared at id 2");
        };
        assert_eq!(packet.packet_type, PacketType::Message(MessageLevel::Fault));
        assert_eq!(packet.board, BoardId(0));
    }

    #[test]
    fn with_no_message_levels_given_only_board_packets_resolve() {
        let index = Index::new(&sample_pod_data(), None);
        assert_eq!(index.packet(AdjId(2)), None);
    }
}
