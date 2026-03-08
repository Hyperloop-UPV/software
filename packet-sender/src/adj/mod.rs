use anyhow::{anyhow, Context, Error, Result};
use serde::{Deserialize, Serialize};
use std::path::Path;
use std::{collections::HashMap, path::PathBuf};
use tokio::fs;
use tracing::{debug, info};

pub mod board;
pub mod packet;

pub use board::Board;
pub use packet::{Packet, PacketType, ValueType, Variable};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ADJ {
    pub info: Info,
    pub boards: Vec<Board>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Info {
    pub addresses: HashMap<String, String>,
    pub ports: HashMap<String, u16>,
}

pub fn get_default_adj_path(default: PathBuf) -> Result<PathBuf, Error> {
    let cache_dir = dirs::cache_dir().ok_or(anyhow!("Failed to get cache directory"))?;
    let adj_path = cache_dir.join(default);
    Ok(adj_path)
}

pub async fn load_adj(adj_path: &Path) -> Result<ADJ> {
    info!("Loading ADJ from {:?}", adj_path);

    // Load general_info.json
    let info_path = adj_path.join("general_info.json");
    let info_content = fs::read_to_string(&info_path).await.context(format!(
        "Failed to read general_info.json from {:?}",
        info_path
    ))?;
    let general_info: serde_json::Value =
        serde_json::from_str(&info_content).context("Failed to parse general_info.json")?;

    // Convert to our Info structure
    let info = Info {
        addresses: serde_json::from_value(general_info["addresses"].clone())?,
        ports: serde_json::from_value(general_info["ports"].clone())?,
    };

    debug!("Loaded info: {:?}", info);

    // Load boards.json
    let boards_path = adj_path.join("boards.json");
    let boards_content = fs::read_to_string(&boards_path)
        .await
        .context("Failed to read boards.json")?;
    let board_map: HashMap<String, String> =
        serde_json::from_str(&boards_content).context("Failed to parse boards.json")?;

    // Load each board
    let mut boards = Vec::new();
    for (board_name, board_file) in board_map {
        let board_path = adj_path.join(&board_file);
        if let Ok(board) = load_board_from_file(&board_path, &board_name).await {
            boards.push(board);
        }
    }

    info!("Loaded {} boards", boards.len());

    Ok(ADJ { info, boards })
}

async fn load_board_from_file(board_config_path: &Path, board_name: &str) -> Result<Board> {
    debug!("Loading board: {} from {:?}", board_name, board_config_path);

    // Load board configuration
    let board_config_content = fs::read_to_string(&board_config_path)
        .await
        .context(format!("Failed to read board config for {}", board_name))?;
    let board_config: serde_json::Value = serde_json::from_str(&board_config_content)?;

    let id = board_config["board_id"].as_u64().unwrap_or(0) as u16;
    let ip = board_config["board_ip"]
        .as_str()
        .unwrap_or("127.0.0.1")
        .to_string();

    // Get the board directory
    let board_dir = board_config_path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Invalid board config path"))?;

    // First, load all measurements into a map
    let mut measurements_map: HashMap<String, serde_json::Value> = HashMap::new();

    if let Some(measurement_files) = board_config["measurements"].as_array() {
        for measurement_file in measurement_files {
            if let Some(filename) = measurement_file.as_str() {
                let measurement_path = board_dir.join(filename);
                if let Ok(measurements_content) = fs::read_to_string(&measurement_path).await {
                    if let Ok(measurements) =
                        serde_json::from_str::<Vec<serde_json::Value>>(&measurements_content)
                    {
                        for measurement in measurements {
                            if let Some(id) = measurement["id"].as_str() {
                                measurements_map.insert(id.to_string(), measurement);
                            }
                        }
                    }
                }
            }
        }
    }

    // Load all packet files
    let mut all_packets = Vec::new();

    if let Some(packet_files) = board_config["packets"].as_array() {
        for packet_file in packet_files {
            if let Some(filename) = packet_file.as_str() {
                let packet_path = board_dir.join(filename);
                if let Ok(packets_content) = fs::read_to_string(&packet_path).await {
                    if let Ok(packet_defs) =
                        serde_json::from_str::<Vec<serde_json::Value>>(&packets_content)
                    {
                        for packet_def in packet_defs {
                            if let Ok(packet) =
                                parse_packet_with_measurements(&packet_def, &measurements_map)
                            {
                                all_packets.push(packet);
                            }
                        }
                    }
                }
            }
        }
    }

    Ok(Board {
        name: board_name.to_string(),
        id,
        ip,
        packets: all_packets,
    })
}

fn parse_packet_with_measurements(
    packet_def: &serde_json::Value,
    measurements_map: &HashMap<String, serde_json::Value>,
) -> Result<Packet> {
    let id = packet_def["id"]
        .as_u64()
        .ok_or_else(|| anyhow::anyhow!("Missing packet id"))? as u16;
    let name = packet_def["name"].as_str().unwrap_or("Unknown").to_string();
    let packet_type_str = packet_def["type"].as_str().unwrap_or("data");

    let packet_type = match packet_type_str {
        "data" => PacketType::Data,
        "protection" => PacketType::Protection,
        "order" => PacketType::Order,
        "info" => PacketType::Info,
        _ => PacketType::Data,
    };

    let mut variables = Vec::new();
    let mut variables_ids = Vec::new();

    if let Some(var_names) = packet_def["variables"].as_array() {
        for (idx, var_name) in var_names.iter().enumerate() {
            if let Some(var_id) = var_name.as_str() {
                if let Some(measurement) = measurements_map.get(var_id) {
                    let type_str = measurement["type"].as_str().unwrap_or("uint32");
                    let value_type = if type_str == "enum" {
                        // Parse enum with its values
                        if let Some(enum_values) = measurement["enumValues"].as_array() {
                            let values: Vec<String> = enum_values
                                .iter()
                                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                                .collect();
                            if values.is_empty() {
                                // Fallback to at least one value to prevent empty range panic
                                ValueType::Enum(vec!["Unknown".to_string()])
                            } else {
                                ValueType::Enum(values)
                            }
                        } else {
                            // Fallback to at least one value to prevent empty range panic
                            ValueType::Enum(vec!["Unknown".to_string()])
                        }
                    } else {
                        parse_value_type(type_str)?
                    };

                    // Parse out_of_range field if it exists
                    let mut warning_range = None;
                    if let Some(out_of_range) = measurement["out_of_range"].as_object() {
                        if let Some(warning) = out_of_range.get("warning") {
                            warning_range = parse_range(warning);
                        }
                    }

                    let variable = Variable {
                        id: idx as u16,
                        name: measurement["name"].as_str().unwrap_or(var_id).to_string(),
                        value_type,
                        units: measurement["displayUnits"].as_str().map(|s| s.to_string()),
                        safe_range: parse_range(&measurement["safeRange"]),
                        warning_range,
                    };
                    variables.push(variable);
                    variables_ids.push(idx as u16);
                }
            }
        }
    }

    Ok(Packet {
        id,
        name,
        packet_type,
        variables,
        variables_ids,
    })
}

fn parse_value_type(type_str: &str) -> Result<ValueType> {
    match type_str {
        "uint8" => Ok(ValueType::UInt8),
        "uint16" => Ok(ValueType::UInt16),
        "uint32" => Ok(ValueType::UInt32),
        "uint64" => Ok(ValueType::UInt64),
        "int8" => Ok(ValueType::Int8),
        "int16" => Ok(ValueType::Int16),
        "int32" => Ok(ValueType::Int32),
        "int64" => Ok(ValueType::Int64),
        "float32" => Ok(ValueType::Float32),
        "float64" => Ok(ValueType::Float64),
        "bool" => Ok(ValueType::Bool),
        s if s.starts_with("enum") => {
            // This case handles enum types that might come from other sources
            // We provide a default value to prevent empty range panic
            Ok(ValueType::Enum(vec!["Unknown".to_string()]))
        }
        _ => Ok(ValueType::UInt32), // Default
    }
}

fn parse_range(range_val: &serde_json::Value) -> Option<[Option<f64>; 2]> {
    if let Some(arr) = range_val.as_array() {
        if arr.len() >= 2 {
            return Some([arr[0].as_f64(), arr[1].as_f64()]);
        }
    }
    None
}
