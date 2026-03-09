use anyhow::{anyhow, Context, Result};
use clap::ValueEnum;
use std::net::SocketAddr;
use std::str::FromStr;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::RwLock;
use tokio::time::{interval, Duration};
use tracing::{debug, error, info};

mod macos;
use crate::adj::{Board, ADJ};
use crate::generator::PacketGenerator;

#[derive(Debug, ValueEnum, Clone)]
pub enum SimulationMode {
    Random,
}

impl FromStr for SimulationMode {
    type Err = anyhow::Error;

    fn from_str(s: &str) -> std::result::Result<Self, Self::Err> {
        match s {
            "random" => Ok(SimulationMode::Random),
            _ => Err(anyhow::anyhow!("Unknown simulation mode: {}", s)),
        }
    }
}

pub struct NetworkManager {
    backend_addr: SocketAddr,
    pub adj: Arc<ADJ>,
    sockets: Arc<RwLock<Vec<BoardSocket>>>,
}

struct BoardSocket {
    board: Board,
    socket: Arc<UdpSocket>,
    generator: PacketGenerator,
}

impl NetworkManager {
    pub async fn new(backend_host: &str, backend_port: u16, adj: Arc<ADJ>) -> Result<Self> {
        let backend_addr = format!("{}:{}", backend_host, backend_port)
            .parse()
            .context("Invalid backend address")?;

        let sockets = Arc::new(RwLock::new(Vec::new()));

        Ok(Self {
            backend_addr,
            adj,
            sockets,
        })
    }

    pub async fn initialize_boards(&self) -> Result<()> {
        let sockets = Arc::clone(&self.sockets);
        let mut sockets_lock = sockets.write().await;

        for board in &self.adj.boards {
            info!(
                "Initializing socket for board {} ({})",
                board.name, board.ip
            );

            // Create socket with board's IP
            let socket = create_board_socket(&board.ip, &self.backend_addr).await?;

            let board_socket = BoardSocket {
                board: board.clone(),
                socket: Arc::new(socket),
                generator: PacketGenerator::new(board.clone()),
            };

            sockets_lock.push(board_socket);
        }

        info!("Initialized {} board sockets", sockets_lock.len(),);
        Ok(())
    }

    pub async fn send_packet(&self, board_name: &str, packet_data: Vec<u8>) -> Result<()> {
        let sockets = Arc::clone(&self.sockets);
        let sockets_lock = sockets.read().await;

        let board_socket = sockets_lock
            .iter()
            .find(|bs| bs.board.name == board_name)
            .ok_or_else(|| anyhow::anyhow!("Board {} not found", board_name))?;

        match board_socket.socket.send(&packet_data).await {
            Ok(bytes_sent) => {
                info!("Sent {} bytes from board {}", bytes_sent, board_name);
                Ok(())
            }
            Err(e) => {
                error!("Failed to send packet from {}: {}", board_name, e);
                Err(e.into())
            }
        }
    }

    // pub async fn start_random_generation(&self, rate: u32) -> Result<()> {
    //     let interval_ms = 1000 / rate;
    //     let mut interval = interval(Duration::from_millis(interval_ms as u64));

    //     info!("Starting packet generation at {} packets/second", rate);

    //     loop {
    //         interval.tick().await;

    //         let sockets = self.sockets.lock().await;
    //         if sockets.is_empty() {
    //             error!("No board sockets available");
    //             continue;
    //         }

    //         // Select random board
    //         let idx = {
    //             let mut rng = rand::thread_rng();
    //             rng.gen_range(0..sockets.len())
    //         };
    //         let board_socket = &sockets[idx];

    //         // Generate random packet
    //         let packet_data = match board_socket.generator.generate_random_data_packet() {
    //             Ok(data) => data,
    //             Err(e) => {
    //                 error!(
    //                     "Failed to generate packet for board {}: {}",
    //                     board_socket.board.name, e
    //                 );
    //                 continue;
    //             }
    //         };

    //         // Send packet
    //         match board_socket.socket.send(&packet_data).await {
    //             Ok(bytes_sent) => {
    //                 info!(
    //                     "Sent {} bytes from board {}",
    //                     bytes_sent, board_socket.board.name
    //                 );
    //             }
    //             Err(e) => {
    //                 error!(
    //                     "Failed to send packet from {}: {}",
    //                     board_socket.board.name, e
    //                 );
    //             }
    //         }
    //     }
    // }

    pub async fn simulate_boards(self: Arc<Self>, period: Duration) -> Result<()> {
        let mut handles = Vec::new();

        for board in &self.adj.boards {
            let board_name = board.name.clone();

            let manager = Arc::clone(&self);

            let handle = tokio::spawn(async move {
                let result = manager
                    .simulate_board_with_period(&board_name, &SimulationMode::Random, period)
                    .await;

                match result {
                    Ok(()) => {}
                    Err(err) => println!("error: {}", err),
                }
            });

            handles.push(handle);
        }

        for handle in handles {
            handle.await?;
        }

        Ok(())
    }

    pub async fn send_random_packets(&self, board_name: &str) -> Result<()> {
        self.send_random_packets_with_rate(board_name, Duration::from_millis(10))
            .await
    }

    pub async fn send_random_packets_with_rate(
        &self,
        board_name: &str,
        period: Duration,
    ) -> Result<()> {
        let sockets = Arc::clone(&self.sockets);
        let sockets_lock = sockets.read().await;

        let board_socket = sockets_lock
            .iter()
            .find(|socket| socket.board.name == board_name)
            .ok_or_else(|| anyhow!("board not found"))?;

        let board_name = board_name.to_string();
        let generator = board_socket.generator.clone();

        let mut interval = interval(period);

        info!("Starting random simulation for {}", board_name);

        loop {
            interval.tick().await;

            if let Ok(packet_data) = generator.generate_random_data_packet() {
                if let Err(e) = self.send_packet(&board_name, packet_data).await {
                    error!("Failed to send packet: {}", e);
                }
            }
        }
    }

    pub async fn simulate_board(&self, board_name: &str, mode: &SimulationMode) -> Result<()> {
        let default_period = Duration::from_millis(10);
        self.simulate_board_with_period(board_name, mode, default_period)
            .await
    }

    pub async fn simulate_board_with_period(
        &self,
        board_name: &str,
        mode: &SimulationMode,
        period: Duration,
    ) -> Result<()> {
        match *mode {
            SimulationMode::Random => self.send_random_packets_with_rate(board_name, period).await,
            // "sine" => self.send_random_packets(board_name).await,
            // "sequence" => self.send_random_packets(board_name).await,
        }
    }

    // async fn simulate_random(&self, board_name: &str) -> Result<()> {
    // let generators = self.generators.read().await;
    // let (_, generator) = generators
    //     .iter()
    //     .find(|(name, _)| name == board_name)
    //     .ok_or_else(|| anyhow::anyhow!("Board {} not found", board_name))?;
    // }

    // async fn simulate_sine(&self, board_name: &str) -> Result<()> {
    //     let generators = self.generators.read().await;
    //     let (_, generator) = generators
    //         .iter()
    //         .find(|(name, _)| name == board_name)
    //         .ok_or_else(|| anyhow::anyhow!("Board {} not found", board_name))?;

    //     let network = self.clone();
    //     let board_name = board_name.to_string();
    //     let generator = generator.clone();

    //     let mut interval = interval(Duration::from_millis(10));
    //     let start_time = std::time::Instant::now();

    //     info!("Starting sine wave simulation for {}", board_name);

    //     loop {
    //         interval.tick().await;

    //         let elapsed = start_time.elapsed().as_secs_f64();
    //         if let Ok(packet_data) = generator.generate_sine_data_packet(elapsed) {
    //             if let Err(e) = network.send_packet(&board_name, packet_data).await {
    //                 error!("Failed to send packet: {}", e);
    //             }
    //         }
    //     }
    // }

    // async fn simulate_sequence(&self, board_name: &str) -> Result<()> {
    //     let board = self
    //         .adj
    //         .boards
    //         .iter()
    //         .find(|b| b.name == board_name)
    //         .ok_or_else(|| anyhow::anyhow!("Board {} not found", board_name))?;

    //     let data_packets = board.get_data_packets();
    //     if data_packets.is_empty() {
    //         return Err(anyhow::anyhow!(
    //             "No data packets found for board {}",
    //             board_name
    //         ));
    //     }

    //     let generators = self.generators.read().await;
    //     let (_, generator) = generators
    //         .iter()
    //         .find(|(name, _)| name == board_name)
    //         .ok_or_else(|| anyhow::anyhow!("Board {} not found", board_name))?;

    //     let network = self.clone();
    //     let board_name = board_name.to_string();
    //     let generator = generator.clone();

    //     let mut interval = interval(Duration::from_millis(100));
    //     let mut packet_index = 0;

    //     info!(
    //         "Starting sequence simulation for {} ({} packets)",
    //         board_name,
    //         data_packets.len()
    //     );

    //     loop {
    //         interval.tick().await;

    //         let packet = data_packets[packet_index];
    //         if let Ok(packet_data) = generator.generate_packet_with_id(packet.id) {
    //             if let Err(e) = network.send_packet(&board_name, packet_data).await {
    //                 error!("Failed to send packet: {}", e);
    //             } else {
    //                 debug!(
    //                     "Sent packet {} ({}) from {}",
    //                     packet.id, packet.name, board_name
    //                 );
    //             }
    //         }

    //         packet_index = (packet_index + 1) % data_packets.len();
    //     }
    // }

    pub async fn send_raw_packet(&self, board_name: &str, packet_data: Vec<u8>) -> Result<()> {
        self.send_packet(board_name, packet_data).await
    }
}

async fn create_board_socket(board_ip: &str, backend_addr: &SocketAddr) -> Result<UdpSocket> {
    // In dev mode, we can bind to any available port on the board IP
    // In production mode (sniffer), we must bind to the exact board IP
    let bind_addr = format!("{}:0", board_ip);

    debug!("Creating socket: {} -> {}", bind_addr, backend_addr);

    let socket = UdpSocket::bind(&bind_addr)
        .await
        .context(format!("Failed to bind to {}. In production mode, ensure the board IP {} is configured on a network interface", bind_addr, board_ip))?;

    // Apply macOS-specific configurations
    macos::configure_socket(&socket)?;

    // Connect to backend
    socket
        .connect(backend_addr)
        .await
        .context("Failed to connect to backend")?;

    let local_addr = socket.local_addr()?;
    info!("Socket created: {} -> {}", local_addr, backend_addr);

    Ok(socket)
}
