use anyhow::Result;
use byteorder::{LittleEndian, WriteBytesExt};
use rand::Rng;
use std::io::Cursor;

mod data;
mod protection;
mod random;

pub use data::DataPacketGenerator;
pub use protection::ProtectionPacketGenerator;
pub use random::RandomValueGenerator;

use crate::adj::{Board, Packet, PacketType, ValueType};

#[derive(Clone)]
pub struct PacketGenerator {
    board: Board,
    data_generator: DataPacketGenerator,
    protection_generator: ProtectionPacketGenerator,
}

impl PacketGenerator {
    pub fn new(board: Board) -> Self {
        Self {
            board: board.clone(),
            data_generator: DataPacketGenerator::new(board.clone()),
            protection_generator: ProtectionPacketGenerator::new(board.clone()),
        }
    }

    pub fn generate_random_data_packet(&self) -> Result<Vec<u8>> {
        let data_packets = self.board.get_data_packets();
        if data_packets.is_empty() {
            return Err(anyhow::anyhow!(
                "No data packets available for board {}",
                self.board.name
            ));
        }

        // For now, just pick any data packet - we handle empty packets in the generator
        let packet = data_packets[rand::thread_rng().gen_range(0..data_packets.len())];
        self.generate_packet(packet)
    }

    pub fn generate_random_protection_packet(&self) -> Result<Vec<u8>> {
        let protection_packets = self.board.get_protection_packets();
        if protection_packets.is_empty() {
            return Err(anyhow::anyhow!("No protection packets available"));
        }

        let packet = protection_packets[rand::thread_rng().gen_range(0..protection_packets.len())];
        self.generate_packet(packet)
    }

    pub fn generate_packet_with_id(&self, packet_id: u16) -> Result<Vec<u8>> {
        let packet = self
            .board
            .find_packet_by_id(packet_id)
            .ok_or_else(|| anyhow::anyhow!("Packet with ID {} not found", packet_id))?;

        self.generate_packet(packet)
    }

    pub fn generate_sine_data_packet(&self, time: f64) -> Result<Vec<u8>> {
        let data_packets = self.board.get_data_packets();
        if data_packets.is_empty() {
            return Err(anyhow::anyhow!("No data packets available"));
        }

        let packet = data_packets[rand::thread_rng().gen_range(0..data_packets.len())];
        self.data_generator.generate_sine_packet(packet, time)
    }

    fn generate_packet(&self, packet: &Packet) -> Result<Vec<u8>> {
        match packet.packet_type {
            PacketType::Data => self.data_generator.generate(packet),
            PacketType::Protection => self.protection_generator.generate(packet),
            _ => Err(anyhow::anyhow!(
                "Unsupported packet type: {:?}",
                packet.packet_type
            )),
        }
    }
}

pub fn encode_packet_header(packet_id: u16) -> Vec<u8> {
    let mut buffer = vec![];
    buffer.write_u16::<LittleEndian>(packet_id).unwrap();
    buffer
}

pub fn encode_value(value: f64, value_type: &ValueType) -> Result<Vec<u8>> {
    let mut cursor = Cursor::new(Vec::new());

    match value_type {
        ValueType::UInt8 => cursor.write_u8(value as u8)?,
        ValueType::UInt16 => cursor.write_u16::<LittleEndian>(value as u16)?,
        ValueType::UInt32 => cursor.write_u32::<LittleEndian>(value as u32)?,
        ValueType::UInt64 => cursor.write_u64::<LittleEndian>(value as u64)?,
        ValueType::Int8 => cursor.write_i8(value as i8)?,
        ValueType::Int16 => cursor.write_i16::<LittleEndian>(value as i16)?,
        ValueType::Int32 => cursor.write_i32::<LittleEndian>(value as i32)?,
        ValueType::Int64 => cursor.write_i64::<LittleEndian>(value as i64)?,
        ValueType::Float32 => cursor.write_f32::<LittleEndian>(value as f32)?,
        ValueType::Float64 => cursor.write_f64::<LittleEndian>(value)?,
        ValueType::Bool => cursor.write_u8(if value > 0.5 { 1 } else { 0 })?,
        ValueType::Enum(_) => cursor.write_u8(value as u8)?,
        ValueType::String => return Err(anyhow::anyhow!("String encoding not supported")),
    }

    Ok(cursor.into_inner())
}
