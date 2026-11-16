use crate::{
    adj::Adj,
    model::{
        AdjId, MeasurementKind, PacketType,
        http::{
            data::{
                DataBoardResponse, DataMeasurementKind, DataMeasurementResponse,
                DataPacketResponse, DataResponse,
            },
            order::{
                OrderBoardResponse, OrderMeasurementResponse, OrderPacketResponse,
                OrderProtectionResponse, OrderResponse,
            },
            protection::{ProtectionInfoResponse, ProtectionResponse, ProtectionTypeResponse},
        },
    },
};

use std::time::Duration;

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
                                    kind: match_measurement_kind(&measurement.kind),
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
                                    kind: match_measurement_kind(&measurement.kind),
                                    protections: measurement
                                        .protections
                                        .iter()
                                        .map(|protection| OrderProtectionResponse {
                                            id: AdjId((protection.id.0 << 13) | measurement.id.0),
                                            kind: protection.kind,
                                            severity: protection.severity,
                                            time: protection_time_to_nanos(protection.time),
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
                    time: protection_time_to_nanos(protection.time),
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

// Returns Some("(time)xs") if the time is not 0
fn protection_time_to_nanos(time: Duration) -> Option<String> {
    if time == Duration::new(0, 0) {
        None
    } else {
        // If the duration is in nanoseconds (default)
        let mut res = format!("{}ns", time.as_nanos().to_string());

        if time.as_millis() > 0 {
            res = format!("{}ms", time.as_millis().to_string());
        } else if time.as_micros() > 0 {
            res = format!("{}us", time.as_micros().to_string());
        }

        Some(res)
    }
}

// Matches the kind of measurement and returns the specific type/structure
fn match_measurement_kind(measurement: &MeasurementKind) -> DataMeasurementKind {
    match measurement {
        MeasurementKind::Numeric { wire_type } => DataMeasurementKind::Numeric {
            wire_type: *wire_type,
        },
        MeasurementKind::Boolean => DataMeasurementKind::Boolean,
        MeasurementKind::Enum { options } => DataMeasurementKind::Enum {
            options: options.clone(),
        },
    }
}
