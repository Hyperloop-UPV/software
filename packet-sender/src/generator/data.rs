use super::{encode_packet_header, encode_value, RandomValueGenerator};
use crate::adj::{Board, Packet, ValueType, Variable};
use anyhow::Result;

#[derive(Clone)]
pub struct DataPacketGenerator {
    board: Board,
    random_gen: RandomValueGenerator,
}

impl DataPacketGenerator {
    pub fn new(board: Board) -> Self {
        Self {
            board,
            random_gen: RandomValueGenerator::new(),
        }
    }

    pub fn generate(&self, packet: &Packet) -> Result<Vec<u8>> {
        let mut buffer = encode_packet_header(packet.id);

        // Handle packets with no variables (like FAULT packet with ID 0)
        if packet.variables.is_empty() {
            return Ok(buffer);
        }

        for variable in &packet.variables {
            let value = self.random_gen.generate_for_variable(variable)?;
            let encoded = encode_value(value, &variable.value_type)?;
            buffer.extend_from_slice(&encoded);
        }

        Ok(buffer)
    }

    pub fn generate_sine_packet(&self, packet: &Packet, time: f64) -> Result<Vec<u8>> {
        let mut buffer = encode_packet_header(packet.id);

        // Handle packets with no variables
        if packet.variables.is_empty() {
            return Ok(buffer);
        }

        for (i, variable) in packet.variables.iter().enumerate() {
            let value = self.generate_sine_value(variable, time, i as f64)?;
            let encoded = encode_value(value, &variable.value_type)?;
            buffer.extend_from_slice(&encoded);
        }

        Ok(buffer)
    }

    fn generate_sine_value(&self, variable: &Variable, time: f64, offset: f64) -> Result<f64> {
        let frequency = 0.1 + offset * 0.05; // Different frequencies for each variable
        let phase = offset * std::f64::consts::PI / 4.0;
        let sine = (time * frequency * 2.0 * std::f64::consts::PI + phase).sin();

        // Map sine wave (-1 to 1) to variable range
        let normalized = (sine + 1.0) / 2.0; // 0 to 1

        // Try warning range first
        if let Some(warning_range) = &variable.warning_range {
            if let (Some(min), Some(max)) = (warning_range[0], warning_range[1]) {
                if min < max {
                    let type_min = variable.value_type.min_value();
                    let type_max = variable.value_type.max_value();
                    let clamped_min = min.max(type_min);
                    let clamped_max = max.min(type_max);
                    return Ok(clamped_min + normalized * (clamped_max - clamped_min));
                }
            }
        }

        // Try safe range
        if let Some(safe_range) = &variable.safe_range {
            if let (Some(min), Some(max)) = (safe_range[0], safe_range[1]) {
                if min < max {
                    let type_min = variable.value_type.min_value();
                    let type_max = variable.value_type.max_value();
                    let clamped_min = min.max(type_min);
                    let clamped_max = max.min(type_max);
                    return Ok(clamped_min + normalized * (clamped_max - clamped_min));
                }
            }
        }

        // Fallback to reasonable type-based range
        match &variable.value_type {
            ValueType::Bool => Ok(if normalized > 0.5 { 1.0 } else { 0.0 }),
            ValueType::Enum(variants) => {
                let max_idx = if variants.is_empty() {
                    0.0
                } else {
                    (variants.len() - 1) as f64
                };
                Ok((normalized * max_idx).round())
            }
            ValueType::UInt8 | ValueType::UInt16 | ValueType::UInt32 => {
                let max = variable.value_type.max_value().min(1000.0);
                Ok(normalized * max)
            }
            ValueType::Int8 | ValueType::Int16 | ValueType::Int32 => {
                // Map to -500 to 500 range
                Ok(-500.0 + normalized * 1000.0)
            }
            ValueType::Float32 | ValueType::Float64 => {
                // Map to -100 to 100 range for floats
                Ok(-100.0 + normalized * 200.0)
            }
            _ => Ok(normalized * 10000.0),
        }
    }
}
