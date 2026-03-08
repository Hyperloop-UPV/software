use super::packet::Packet;
use serde::{Deserialize, Serialize};

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Board {
    pub name: String,
    pub id: u16,
    pub ip: String,
    pub packets: Vec<Packet>,
}

impl Board {
    pub fn get_data_packets(&self) -> Vec<&Packet> {
        self.packets
            .iter()
            .filter(|p| p.packet_type == super::packet::PacketType::Data)
            .collect()
    }

    pub fn get_protection_packets(&self) -> Vec<&Packet> {
        self.packets
            .iter()
            .filter(|p| p.packet_type == super::packet::PacketType::Protection)
            .collect()
    }

    pub fn get_order_packets(&self) -> Vec<&Packet> {
        self.packets
            .iter()
            .filter(|p| p.packet_type == super::packet::PacketType::Order)
            .collect()
    }

    pub fn get_info_packets(&self) -> Vec<&Packet> {
        self.packets
            .iter()
            .filter(|p| p.packet_type == super::packet::PacketType::Info)
            .collect()
    }

    pub fn find_packet_by_id(&self, id: u16) -> Option<&Packet> {
        self.packets.iter().find(|p| p.id == id)
    }

    pub fn find_packet_by_name(&self, name: &str) -> Option<&Packet> {
        self.packets.iter().find(|p| p.name == name)
    }
}
