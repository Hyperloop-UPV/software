//! Walks an ADJ directory and builds an [`crate::adj::Adj`] from it.

use super::types::{RawBoard, RawGeneralInfo, RawMeasurement, RawPacket};
use crate::adj::error::LoadError;
use crate::adj::{Adj, AdjInfo};
use crate::model::{
    AdjId, Board, BoardId, MacAddress, Measurement, PacketDef, PacketKind, PodData,
};
use serde::de::DeserializeOwned;
use std::collections::HashMap;
use std::fs;
use std::net::IpAddr;
use std::path::Path;

/// Loads an ADJ directory rooted at `path` (containing `general_info.json`
/// and `boards.json`) into an [`Adj`].
///
/// A board present on disk but absent from `boards.json` is never read;
/// that isn't an error.
pub fn load_from_dir(path: &Path) -> Result<Adj, LoadError> {
    let general_info: RawGeneralInfo = read_json(&path.join("general_info.json"))?;
    let board_paths: HashMap<String, String> = read_json(&path.join("boards.json"))?;

    let mut boards = HashMap::new();
    for (name, rel_path) in &board_paths {
        let board = load_board(path, name, rel_path)?;
        boards.insert(board.id, board);
    }

    Ok(Adj {
        pod_data: PodData { boards },
        info: AdjInfo::try_from(general_info)?,
    })
}

/// Reads a JSON file at `path` and deserializes it into `T`, returning a
/// [`LoadError`] on failure.
fn read_json<T: DeserializeOwned>(path: &Path) -> Result<T, LoadError> {
    let text = fs::read_to_string(path).map_err(|source| LoadError::ReadFile {
        path: path.to_path_buf(),
        source,
    })?;
    serde_json::from_str(&text).map_err(|source| LoadError::ParseJson {
        path: path.to_path_buf(),
        source,
    })
}

pub(crate) fn load_board(root: &Path, name: &str, rel_path: &str) -> Result<Board, LoadError> {
    // Read the board's JSON, then its measurements and packets, and build a `Board` from it
    let board_file = root.join(rel_path);
    let raw_board: RawBoard = read_json(&board_file)?;
    let board_id = BoardId(raw_board.board_id);
    let board_dir = board_file
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| root.to_path_buf());

    let mut measurements: HashMap<String, Measurement> = HashMap::new();
    let mut packets: HashMap<AdjId, PacketDef> = HashMap::new();

    for measurements_path in &raw_board.measurements {
        let raws: Vec<RawMeasurement> = read_json(&board_dir.join(measurements_path))?;
        for raw in raws {
            let alias = raw.alias.clone();
            let measurement =
                Measurement::try_from(raw).map_err(|source| LoadError::Measurement {
                    board: name.to_string(),
                    alias: alias.clone(),
                    source,
                })?;

            for (idx, _protection) in measurement.protections.iter().enumerate() {
                // protection number into bits 13-15, and the measurement ID into bits 0-12.
                let pos = idx as u16 + 1; //Change to u16 to match ADJ ID size. We start at one because 0 is the measurement id not a protection by ADJ definition.
                let protection_packet_id = (pos << 13) | measurement.id.0; // Push Protection number 13 bits into specified region of the ID. Perform OR with the ID.

                let packet = PacketDef {
                    id: AdjId(protection_packet_id),
                    board: board_id,
                    name: format!("{}_{}_protection_{}", name, measurement.alias, idx + 1),
                    kind: PacketKind::Protection(measurement.clone()),
                };
                packets.insert(packet.id, packet);
            }
            measurements.insert(alias, measurement);
        }
    }

    for packets_path in &raw_board.packets {
        let raws: Vec<RawPacket> = read_json(&board_dir.join(packets_path))?;
        for raw in raws {
            let packet = build_packet_def(name, board_id, raw, &measurements)?;
            packets.insert(packet.id, packet);
        }
    }

    let ip: IpAddr = raw_board
        .board_ip
        .parse()
        .map_err(|source| LoadError::InvalidIp {
            board: name.to_string(),
            raw: raw_board.board_ip.clone(),
            source,
        })?;

    let mac_text = raw_board.mac.ok_or_else(|| LoadError::MissingMac {
        board: name.to_string(),
    })?;
    let mac = parse_mac(&mac_text).ok_or_else(|| LoadError::InvalidMac {
        board: name.to_string(),
        raw: mac_text.clone(),
    })?;

    Ok(Board {
        id: board_id,
        name: name.to_string(),
        ip,
        mac,
        packets,
    })
}

fn build_packet_def(
    board: &str,
    board_id: BoardId,
    raw: RawPacket,
    measurements: &HashMap<String, Measurement>,
) -> Result<PacketDef, LoadError> {
    let kind = match raw.kind.as_str() {
        "data" => PacketKind::Data(resolve_measurements(
            board,
            &raw.name,
            &raw.variables,
            measurements,
        )?),
        "order" => PacketKind::Order(resolve_measurements(
            board,
            &raw.name,
            &raw.variables,
            measurements,
        )?),
        "message" => PacketKind::Message,
        other => {
            return Err(LoadError::UnknownPacketType {
                board: board.to_string(),
                name: raw.name.clone(),
                type_name: other.to_string(),
            });
        }
    };

    Ok(PacketDef {
        id: AdjId(raw.id),
        board: board_id,
        name: raw.name,
        kind,
    })
}

/// Resolves `variables` (a packet's declared measurement aliases) against
/// `measurements`, in order.
fn resolve_measurements(
    board: &str,
    packet_name: &str,
    variables: &[String],
    measurements: &HashMap<String, Measurement>,
) -> Result<Vec<Measurement>, LoadError> {
    let mut resolved = Vec::with_capacity(variables.len());
    for alias in variables {
        let measurement =
            measurements
                .get(alias)
                .cloned()
                .ok_or_else(|| LoadError::UnknownAlias {
                    board: board.to_string(),
                    name: packet_name.to_string(),
                    alias: alias.clone(),
                })?;
        resolved.push(measurement);
    }
    Ok(resolved)
}

/// Parses a MAC address text form, e.g. `"aa:bb:cc:dd:ee:ff"` or the
/// unpadded `"0:0:0:0:0:0"` real ADJ fixtures actually use — each octet is
/// 1 or 2 hex digits. `None` on anything else.
fn parse_mac(raw: &str) -> Option<MacAddress> {
    let parts: Vec<&str> = raw.split(':').collect();
    if parts.len() != 6 {
        return None;
    }

    let mut octets = [0u8; 6];
    for (octet, part) in octets.iter_mut().zip(parts) {
        if part.is_empty() || part.len() > 2 {
            return None;
        }
        *octet = u8::from_str_radix(part, 16).ok()?;
    }
    Some(MacAddress(octets))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::adj::ProtectionTypeInfo;
    use crate::model::{PacketKind, Port, ProtectionKind, Severity};
    use std::path::Path;
    use std::time::Duration;

    fn must_load(path: &Path) -> Adj {
        let Ok(adj) = load_from_dir(path) else {
            unreachable!("fixture directory should load cleanly");
        };
        adj
    }

    #[test]
    fn mac_address_accepts_padded_and_unpadded_octets() {
        assert_eq!(
            parse_mac("aa:bb:cc:dd:ee:ff"),
            Some(MacAddress([0xaa, 0xbb, 0xcc, 0xdd, 0xee, 0xff]))
        );
        assert_eq!(parse_mac("0:0:0:0:0:0"), Some(MacAddress([0; 6])));
    }

    #[test]
    fn mac_address_rejects_malformed_text() {
        assert_eq!(parse_mac("aa:bb:cc:dd:ee"), None);
        assert_eq!(parse_mac("aa:bb:cc:dd:ee:ff:00"), None);
        assert_eq!(parse_mac("aaa:bb:cc:dd:ee:ff"), None);
        assert_eq!(parse_mac("zz:bb:cc:dd:ee:ff"), None);
    }

    #[test]
    fn build_packet_def_rejects_unknown_packet_type() {
        let raw = RawPacket {
            id: 1,
            kind: "status".to_string(),
            name: "Status".to_string(),
            variables: vec![],
        };
        assert!(matches!(
            build_packet_def("VCU", BoardId(3), raw, &HashMap::new()),
            Err(LoadError::UnknownPacketType { .. })
        ));
    }

    #[test]
    fn build_packet_def_rejects_unknown_alias() {
        let raw = RawPacket {
            id: 1,
            kind: "data".to_string(),
            name: "Status".to_string(),
            variables: vec!["missing".to_string()],
        };
        assert!(matches!(
            build_packet_def("VCU", BoardId(3), raw, &HashMap::new()),
            Err(LoadError::UnknownAlias { .. })
        ));
    }

    #[test]
    fn loads_the_sample_adj_fixture() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/adj/test/adj");
        let adj = must_load(&path);

        // `HashMap` iteration order is unspecified, so sort before comparing.
        let mut board_names: Vec<&str> = adj
            .pod_data
            .boards
            .values()
            .map(|b| b.name.as_str())
            .collect();
        board_names.sort();
        assert_eq!(board_names, vec!["HVBMS", "LCU", "PCU", "VCU"]);

        let Some(vcu) = adj.pod_data.boards.get(&BoardId(3)) else {
            unreachable!("VCU should be among the loaded boards");
        };
        assert_eq!(vcu.id, BoardId(3));
        assert_eq!(vcu.ip, IpAddr::from([192, 168, 1, 3]));
        assert_eq!(vcu.mac, MacAddress([0; 6]));
        assert_eq!(vcu.packets.len(), 18);
        let Some(order) = vcu.packets.get(&AdjId(600)) else {
            unreachable!("VCU should have order 600");
        };
        let PacketKind::Order(_) = &order.kind else {
            unreachable!("order 600 should be an Order");
        };
        assert_eq!(order.board, BoardId(3));
        let Some(data) = vcu.packets.get(&AdjId(625)) else {
            unreachable!("VCU should have data packet 625");
        };
        let PacketKind::Data(_) = &data.kind else {
            unreachable!("data packet 625 should be Data");
        };

        let Some(pcu) = adj.pod_data.boards.get(&BoardId(5)) else {
            unreachable!("PCU should be among the loaded boards");
        };
        let Some(protected) = pcu
            .packets
            .values()
            .flat_map(|p| p.kind.measurements())
            .find(|m| !m.protections.is_empty())
        else {
            unreachable!("PCU should have a measurement with a protection");
        };
        assert_eq!(protected.protections.len(), 1);
        let protection = &protected.protections[0];
        assert_eq!(protection.kind, ProtectionKind::Equal { target: 1.0 });
        assert_eq!(protection.severity, Severity::Fault);
        assert_eq!(protection.time, Duration::ZERO);
        assert_eq!(protection.id, AdjId(1));

        assert_eq!(adj.info.ports["TCP_SERVER"], Port(50500));
        assert_eq!(
            adj.info.addresses["backend"],
            IpAddr::from([192, 168, 0, 9])
        );
        assert_eq!(adj.info.message_ids["fault"], AdjId(2));
        assert_eq!(
            adj.info.protection_types["Range"],
            ProtectionTypeInfo {
                is_range: true,
                text: "Value out of range {} (measured: %)".to_string(),
                text_time: None,
            }
        );

        // `protected` has exactly one protection (asserted above), at position 1,
        // so its compound wire id is `(1 << 13) | protected.id.0`.
        let Some(protection_packet) = pcu.packets.get(&AdjId((1u16 << 13) | protected.id.0)) else {
            unreachable!("PCU should have a synthetic protection packet");
        };
        let PacketKind::Protection(measurement) = &protection_packet.kind else {
            unreachable!("protection_packet should be a Protection");
        };
        assert_eq!(measurement, protected);
        assert_eq!(protection_packet.board, pcu.id);
    }
}
