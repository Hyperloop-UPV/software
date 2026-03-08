use anyhow::Result;
use std::sync::Arc;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};
use tracing::{debug, error, info};

use super::NetworkManager;
use crate::adj::ADJ;
use crate::generator::PacketGenerator;

#[derive(Clone)]
pub struct PacketSender {
    network: Arc<NetworkManager>,
    pub adj: ADJ,
    generators: Arc<RwLock<Vec<(String, PacketGenerator)>>>,
}

impl PacketSender {
    pub async fn new(backend_host: &str, backend_port: u16, adj: ADJ) -> Result<Self> {
        let mut network = NetworkManager::new(backend_host, backend_port, adj.clone()).await?;
        network.initialize_boards().await?;

        let generators = Arc::new(RwLock::new(Vec::new()));

        // Create generators for each board
        {
            let mut gens = generators.write().await;
            for board in &adj.boards {
                gens.push((board.name.clone(), PacketGenerator::new(board.clone())));
            }
        }

        Ok(Self {
            network: Arc::new(network),
            adj,
            generators,
        })
    }

    pub async fn start_random_all(&mut self, rate: u32) -> Result<()> {
        self.network.start_random_generation(rate).await
    }

    pub async fn start_random_single(&mut self, board_name: &str, rate: u32) -> Result<()> {
        let generators = self.generators.read().await;
        let (_, generator) = generators
            .iter()
            .find(|(name, _)| name == board_name)
            .ok_or_else(|| anyhow::anyhow!("Board {} not found", board_name))?;

        let network = self.network.clone();
        let board_name = board_name.to_string();
        let generator = generator.clone();

        let interval_ms = 1000 / rate;
        let mut interval = interval(Duration::from_millis(interval_ms as u64));

        info!(
            "Starting random generation for {} at {} packets/second",
            board_name, rate
        );

        loop {
            interval.tick().await;

            if let Ok(packet_data) = generator.generate_random_data_packet() {
                if let Err(e) = network.send_packet(&board_name, packet_data).await {
                    error!("Failed to send packet: {}", e);
                }
            }
        }
    }

    pub async fn simulate_board(&mut self, board_name: &str, mode: &str) -> Result<()> {
        match mode {
            "random" => self.simulate_random(board_name).await,
            "sine" => self.simulate_sine(board_name).await,
            "sequence" => self.simulate_sequence(board_name).await,
            _ => Err(anyhow::anyhow!("Unknown simulation mode: {}", mode)),
        }
    }

    async fn simulate_random(&self, board_name: &str) -> Result<()> {
        let generators = self.generators.read().await;
        let (_, generator) = generators
            .iter()
            .find(|(name, _)| name == board_name)
            .ok_or_else(|| anyhow::anyhow!("Board {} not found", board_name))?;

        let network = self.network.clone();
        let board_name = board_name.to_string();
        let generator = generator.clone();

        let mut interval = interval(Duration::from_millis(10));

        info!("Starting random simulation for {}", board_name);

        loop {
            interval.tick().await;

            if let Ok(packet_data) = generator.generate_random_data_packet() {
                if let Err(e) = network.send_packet(&board_name, packet_data).await {
                    error!("Failed to send packet: {}", e);
                }
            }
        }
    }

    async fn simulate_sine(&self, board_name: &str) -> Result<()> {
        let generators = self.generators.read().await;
        let (_, generator) = generators
            .iter()
            .find(|(name, _)| name == board_name)
            .ok_or_else(|| anyhow::anyhow!("Board {} not found", board_name))?;

        let network = self.network.clone();
        let board_name = board_name.to_string();
        let generator = generator.clone();

        let mut interval = interval(Duration::from_millis(10));
        let start_time = std::time::Instant::now();

        info!("Starting sine wave simulation for {}", board_name);

        loop {
            interval.tick().await;

            let elapsed = start_time.elapsed().as_secs_f64();
            if let Ok(packet_data) = generator.generate_sine_data_packet(elapsed) {
                if let Err(e) = network.send_packet(&board_name, packet_data).await {
                    error!("Failed to send packet: {}", e);
                }
            }
        }
    }

    async fn simulate_sequence(&self, board_name: &str) -> Result<()> {
        let board = self
            .adj
            .boards
            .iter()
            .find(|b| b.name == board_name)
            .ok_or_else(|| anyhow::anyhow!("Board {} not found", board_name))?;

        let data_packets = board.get_data_packets();
        if data_packets.is_empty() {
            return Err(anyhow::anyhow!(
                "No data packets found for board {}",
                board_name
            ));
        }

        let generators = self.generators.read().await;
        let (_, generator) = generators
            .iter()
            .find(|(name, _)| name == board_name)
            .ok_or_else(|| anyhow::anyhow!("Board {} not found", board_name))?;

        let network = self.network.clone();
        let board_name = board_name.to_string();
        let generator = generator.clone();

        let mut interval = interval(Duration::from_millis(100));
        let mut packet_index = 0;

        info!(
            "Starting sequence simulation for {} ({} packets)",
            board_name,
            data_packets.len()
        );

        loop {
            interval.tick().await;

            let packet = data_packets[packet_index];
            if let Ok(packet_data) = generator.generate_packet_with_id(packet.id) {
                if let Err(e) = network.send_packet(&board_name, packet_data).await {
                    error!("Failed to send packet: {}", e);
                } else {
                    debug!(
                        "Sent packet {} ({}) from {}",
                        packet.id, packet.name, board_name
                    );
                }
            }

            packet_index = (packet_index + 1) % data_packets.len();
        }
    }

    pub async fn send_raw_packet(&self, board_name: &str, packet_data: Vec<u8>) -> Result<()> {
        self.network.send_packet(board_name, packet_data).await
    }
}
