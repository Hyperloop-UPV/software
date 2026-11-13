//! Parses an ADJ (Architecture Description JSON) directory into
//! [`crate::model::PodData`], plus backend-session metadata not modeled as
//! vehicle data ([`crate::adj::AdjInfo`]).
//!
//! [`load_from_dir`] loads an existing ADJ directory. With the `git` feature
//! enabled, `auto_adj` updates the ADJ repository before loading its data
//! and returns the checked-out commit hash.
//!
//! Loading is not specific to `station`: a sniffer, a simulator, or any
//! other tool that reads an ADJ needs exactly the same parsing.
//!
//! Scope for this iteration: no `sockets.json`, no
//! `period`/`period_type`/`socket` packet fields (matches
//! [`crate::model::PacketDef`]'s own omission), and no schema validation
//! (`adj::validate` is a separate, deliberately out-of-scope concern for
//! now). This module only surfaces structural errors it cannot avoid,
//! e.g. a packet referencing a measurement alias that doesn't exist.

mod error;
mod info;
mod raw;

#[cfg(feature = "http")]
pub mod http;

#[cfg(feature = "git")]
use std::path::PathBuf;
#[cfg(feature = "git")]
use tracing::{info, instrument};

pub use error::{LoadError, MeasurementError, ProtectionError};
pub use info::{AdjInfo, ProtectionTypeInfo};
pub use raw::load_from_dir;

#[cfg(feature = "git")]
use crate::git::{unwrap_repo_path, update_adj};
use crate::model::PodData;

/// The result of loading an ADJ: the vehicle's data (as [`crate::model`]
/// describes it) plus backend-session metadata. Built by
/// [`raw::load_from_dir`].
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Adj {
    /// Every board and packet defined by the ADJ.
    pub pod_data: PodData,
    /// Backend-session metadata from `general_info.json`.
    pub info: AdjInfo,
}

#[cfg(feature = "http")]
use self::http::{
    data::{
        DataBoardResponse, DataMeasurementKind, DataMeasurementResponse, DataPacketResponse,
        DataResponse,
    },
    order::{
        OrderBoardResponse, OrderMeasurementResponse, OrderPacketResponse, OrderProtectionResponse,
        OrderResponse,
    },
    protection::{ProtectionInfoResponse, ProtectionResponse, ProtectionTypeResponse},
};

#[cfg(feature = "http")]
use crate::model::{MeasurementKind, PacketType};

#[cfg(feature = "http")]
impl Adj {
    /// Builds the data catalog without modifying or consuming the ADJ.
    ///
    /// Boards and data packets are sorted by id. Boards without data packets are
    /// retained with an empty list. Measurements keep their wire order and omit
    /// protection metadata.
    pub fn data_response(&self) -> DataResponse {
        let mut boards: Vec<DataBoardResponse> = self
            .pod_data
            .boards
            .values()
            .map(|board| {
                let mut packets: Vec<DataPacketResponse> = board
                    .packets
                    .values()
                    .filter_map(|packet| {
                        let PacketType::Data(measurements) = &packet.packet_type else {
                            return None;
                        };

                        Some(DataPacketResponse {
                            id: packet.id,
                            name: packet.name.clone(),
                            packet_type: "data".to_string(),
                            measurements: measurements
                                .iter()
                                .map(|measurement| DataMeasurementResponse {
                                    id: measurement.id,
                                    alias: measurement.alias.clone(),
                                    name: measurement.name.clone(),
                                    display_units: measurement.display_units.clone(),
                                    kind: match &measurement.kind {
                                        MeasurementKind::Numeric { wire_type } => {
                                            DataMeasurementKind::Numeric {
                                                wire_type: *wire_type,
                                            }
                                        }
                                        MeasurementKind::Boolean => DataMeasurementKind::Boolean,
                                        MeasurementKind::Enum { options } => {
                                            DataMeasurementKind::Enum {
                                                options: options.clone(),
                                            }
                                        }
                                    },
                                })
                                .collect(),
                        })
                    })
                    .collect();
                packets.sort_unstable_by_key(|packet| packet.id.0);

                DataBoardResponse {
                    id: board.id,
                    name: board.name.clone(),
                    packets,
                }
            })
            .collect();
        boards.sort_unstable_by_key(|board| board.id.0);

        DataResponse { boards }
    }

    /// Builds the order catalog without modifying or consuming the ADJ.
    ///
    /// Boards and orders are sorted by id. Boards without orders are retained with
    /// an empty list. Parameters and their protections keep their ADJ order;
    /// protection ids remain their one-based positions within each measurement.
    pub fn order_response(&self) -> OrderResponse {
        let mut boards: Vec<OrderBoardResponse> = self
            .pod_data
            .boards
            .values()
            .map(|board| {
                let mut orders: Vec<OrderPacketResponse> = board
                    .packets
                    .values()
                    .filter_map(|packet| {
                        let PacketType::Order(measurements) = &packet.packet_type else {
                            return None;
                        };

                        Some(OrderPacketResponse {
                            id: packet.id,
                            name: packet.name.clone(),
                            packet_type: "order".to_string(),
                            measurements: measurements
                                .iter()
                                .map(|measurement| OrderMeasurementResponse {
                                    id: measurement.id,
                                    alias: measurement.alias.clone(),
                                    name: measurement.name.clone(),
                                    display_units: measurement.display_units.clone(),
                                    kind: match &measurement.kind {
                                        MeasurementKind::Numeric { wire_type } => {
                                            DataMeasurementKind::Numeric {
                                                wire_type: *wire_type,
                                            }
                                        }
                                        MeasurementKind::Boolean => DataMeasurementKind::Boolean,
                                        MeasurementKind::Enum { options } => {
                                            DataMeasurementKind::Enum {
                                                options: options.clone(),
                                            }
                                        }
                                    },
                                    protections: measurement
                                        .protections
                                        .iter()
                                        .map(|protection| OrderProtectionResponse {
                                            id: protection.id,
                                            kind: protection.kind,
                                            severity: protection.severity,
                                            time: protection.time,
                                        })
                                        .collect(),
                                })
                                .collect(),
                        })
                    })
                    .collect();
                orders.sort_unstable_by_key(|order| order.id.0);

                OrderBoardResponse {
                    id: board.id,
                    name: board.name.clone(),
                    orders,
                }
            })
            .collect();
        boards.sort_unstable_by_key(|board| board.id.0);

        OrderResponse { boards }
    }

    /// Builds the flat protection catalog without modifying or consuming the ADJ.
    ///
    /// Protection packet ids and names are reused from the loader. The position in
    /// each compound id selects its definition within the watched measurement.
    /// Packets with no definition at that position are omitted. The resulting list
    /// is sorted by packet id, then board id to break ties.
    pub fn protection_response(&self) -> ProtectionResponse {
        let mut protections: Vec<ProtectionInfoResponse> = self
            .pod_data
            .boards
            .values()
            .flat_map(|board| board.packets.values())
            .filter_map(|packet| {
                let PacketType::Protection(measurement) = &packet.packet_type else {
                    return None;
                };

                let index = usize::from(packet.id.protection_position()).checked_sub(1)?;
                let protection = measurement.protections.get(index)?;

                Some(ProtectionInfoResponse {
                    id: packet.id,
                    name: packet.name.clone(),
                    board_id: packet.board,
                    measurement_id: measurement.id,
                    kind: protection.kind,
                    severity: protection.severity,
                    time: protection.time,
                })
            })
            .collect();
        protections.sort_unstable_by_key(|protection| (protection.id.0, protection.board_id.0));

        let info = self
            .info
            .protection_types
            .iter()
            .map(|(name, metadata)| {
                (
                    name.clone(),
                    ProtectionTypeResponse {
                        is_range: metadata.is_range,
                        text: metadata.text.clone(),
                        text_time: metadata.text_time.clone(),
                    },
                )
            })
            .collect();

        ProtectionResponse { protections, info }
    }
}

/// The result of [`auto_adj`]: the loaded ADJ data and the checked-out commit hash.
#[cfg(feature = "git")]
#[derive(Debug, Clone)]
pub struct AutoAdj {
    /// Vehicle data
    pub adj: Adj,
    /// Full commit hash of the repository checkout used to load the ADJ.
    pub hash: String,
}

/// Updates the ADJ repository and returns an [`AutoAdj`] containing the loaded
/// data and the full commit hash of the checkout used to load it.
///
/// `path` identifies the repository directory, not its parent. If omitted,
/// the platform's user cache directory is used.
///
/// Online, the repository is replaced and local edits and commits are discarded.
/// Offline, the current cached checkout is loaded without switching branches,
/// so it may differ from `branch`; `hash` is the full commit hash of its HEAD.
/// If no cached repository is available offline, or a Git operation fails,
/// returns [`LoadError::Git`] instead of an [`AutoAdj`], so no hash is returned.
/// Clone failures do not fall back to the cache.
///
/// This performs blocking network and filesystem operations. Call during startup,
/// before readers use ADJ, with only one updater at a time.
///
/// # Errors
///
/// Returns [`LoadError::Git`] if path resolution or the update fails.
/// Other variants report failures loading the checked-out ADJ data.
/// Loading failures do not restore the previous cache.
#[cfg(feature = "git")]
#[instrument(level = "debug")]
pub fn auto_adj(path: Option<PathBuf>, branch: &str) -> Result<AutoAdj, LoadError> {
    let repo_path = unwrap_repo_path(path)?;
    let hash = update_adj(Some(repo_path.clone()), branch)?;
    let adj = load_from_dir(&repo_path)?;

    info!(path = ?repo_path, %hash, "ADJ loaded");
    Ok(AutoAdj { adj, hash })
}
