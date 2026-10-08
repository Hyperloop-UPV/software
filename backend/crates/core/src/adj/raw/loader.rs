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
/// Boards are read in alphabetical order by name — not `boards.json`'s own
/// unordered map order — so [`PodData::boards`] is deterministic. A board
/// present on disk but absent from `boards.json` is never read; that isn't
/// an error.
pub fn load_from_dir(path: &Path) -> Result<Adj, LoadError> {
    let general_info: RawGeneralInfo = read_json(&path.join("general_info.json"))?;
    let board_paths: HashMap<String, String> = read_json(&path.join("boards.json"))?;

    let mut entries: Vec<(&String, &String)> = board_paths.iter().collect();
    entries.sort_by_key(|(name, _)| *name);

    let mut boards = Vec::with_capacity(entries.len());
    for (name, rel_path) in entries {
        boards.push(load_board(path, name, rel_path)?);
    }

    Ok(Adj {
        pod_data: PodData { boards },
        info: AdjInfo::from(general_info),
    })
}

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

pub fn load_board(root: &Path, name: &str, rel_path: &str) -> Result<Board, LoadError> {
    let board_file = root.join(rel_path);
    let raw_board: RawBoard = read_json(&board_file)?;
    let board_dir = board_file
        .parent()
        .map(Path::to_path_buf)
        .unwrap_or_else(|| root.to_path_buf());

    let mut measurements: HashMap<String, Measurement> = HashMap::new();
    let mut protection_packets: Vec<PacketDef> = Vec::new();

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

            for (idx,protection) in measurement.protections.iter().enumerate() {
                // protection number into bits 13-15, and the measurement ID into bits 0-12.
                let pos = idx as u16 + 1; //Change to u16 to match ADJ ID size. We start at one because 0 is not a protection by ADJ definition.
                let protection_packet_id = (pos << 13) | measurement.id.0; // Push Protection number 13 bits into specified region of the ID. Perform OR with the ID.



                protection_packets.push(PacketDef {
                    id: AdjId(protection_packet_id),
                    name: format!("{}_{}_protection_{}", name, measurement.alias, idx+1),
                    kind: PacketKind::Protection,
                    measurements: vec![measurement.clone()],
                });

            }
            measurements.insert(alias, measurement);
        }
    }

    let mut packets = Vec::new();
    for packets_path in &raw_board.packets {
        let raws: Vec<RawPacket> = read_json(&board_dir.join(packets_path))?;
        for raw in raws {
            packets.push(build_packet_def(name, raw, &measurements)?);
        }
    }

    packets.extend(protection_packets);

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
        id: BoardId(raw_board.board_id),
        name: name.to_string(),
        ip,
        mac,
        packets,
    })
}

fn build_packet_def(
    board: &str,
    raw: RawPacket,
    measurements: &HashMap<String, Measurement>,
) -> Result<PacketDef, LoadError> {
    let kind = match raw.kind.as_str() {
        "data" => PacketKind::Data,
        "order" => PacketKind::Order,
        other => {
            return Err(LoadError::UnknownPacketType {
                board: board.to_string(),
                name: raw.name.clone(),
                type_name: other.to_string(),
            });
        }
    };

    let mut packet_measurements = Vec::with_capacity(raw.variables.len());
    for alias in &raw.variables {
        let measurement =
            measurements
                .get(alias)
                .cloned()
                .ok_or_else(|| LoadError::UnknownAlias {
                    board: board.to_string(),
                    name: raw.name.clone(),
                    alias: alias.clone(),
                })?;
        packet_measurements.push(measurement);
    }

    Ok(PacketDef {
        id: AdjId(raw.id),
        name: raw.name,
        kind,
        measurements: packet_measurements,
    })
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
    use crate::model::{PacketKind, ProtectionKind, Severity};
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
            build_packet_def("VCU", raw, &HashMap::new()),
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
            build_packet_def("VCU", raw, &HashMap::new()),
            Err(LoadError::UnknownAlias { .. })
        ));
    }

    #[test]
    fn loads_the_sample_adj_fixture() {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/adj/test/adj");
        let adj = must_load(&path);

        let board_names: Vec<&str> = adj
            .pod_data
            .boards
            .iter()
            .map(|b| b.name.as_str())
            .collect();
        assert_eq!(board_names, vec!["HVBMS", "LCU", "PCU", "VCU"]);

        let Some(vcu) = adj.pod_data.boards.iter().find(|b| b.name == "VCU") else {
            unreachable!("VCU should be among the loaded boards");
        };
        assert_eq!(vcu.id, BoardId(3));
        assert_eq!(vcu.ip, IpAddr::from([192, 168, 1, 3]));
        assert_eq!(vcu.mac, MacAddress([0; 6]));
        assert_eq!(vcu.packets.len(), 18);
        assert_eq!(vcu.packets[0].kind, PacketKind::Order);
        assert_eq!(vcu.packets[0].id, AdjId(600));
        assert_eq!(vcu.packets[13].kind, PacketKind::Data);
        assert_eq!(vcu.packets[13].id, AdjId(625));

        let Some(pcu) = adj.pod_data.boards.iter().find(|b| b.name == "PCU") else {
            unreachable!("PCU should be among the loaded boards");
        };
        let Some(protected) = pcu
            .packets
            .iter()
            .flat_map(|p| &p.measurements)
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

        assert_eq!(adj.info.ports["TCP_SERVER"], 50500);
        assert_eq!(adj.info.addresses["backend"], "192.168.0.9");
        assert_eq!(adj.info.message_ids["fault"], 2);
        assert_eq!(
            adj.info.protection_types["Range"],
            ProtectionTypeInfo {
                is_range: true,
                text: "Value out of range {} (measured: %)".to_string(),
                text_time: None,
            }
        );

        let protection_packet = pcu.packets.iter().find(|p| p.name.contains("_protection_")).unwrap();
        assert_eq!(protection_packet.id, AdjId(protected.id.0 + 1));
    }
}
