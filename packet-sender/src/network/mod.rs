use anyhow::{Result, Context};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::net::UdpSocket;
use tokio::sync::Mutex;
use tokio::time::{interval, Duration};
use tracing::{debug, error, info, trace};
use rand::Rng;

mod macos;
mod sender;

pub use sender::PacketSender;

use crate::adj::{ADJ, Board};
use crate::generator::PacketGenerator;

pub struct NetworkManager {
    backend_addr: SocketAddr,
    adj: ADJ,
    sockets: Arc<Mutex<Vec<BoardSocket>>>,
    dev_mode: bool,
}

struct BoardSocket {
    board: Board,
    socket: Arc<UdpSocket>,
    generator: PacketGenerator,
}

impl NetworkManager {
    pub async fn new(backend_host: &str, backend_port: u16, adj: ADJ, dev_mode: bool) -> Result<Self> {
        let backend_addr = format!("{}:{}", backend_host, backend_port)
            .parse()
            .context("Invalid backend address")?;
        
        let sockets = Arc::new(Mutex::new(Vec::new()));
        
        Ok(Self {
            backend_addr,
            adj,
            sockets,
            dev_mode,
        })
    }
    
    pub async fn initialize_boards(&mut self) -> Result<()> {
        let mut sockets = self.sockets.lock().await;
        
        for board in &self.adj.boards {
            info!("Initializing socket for board {} ({})", board.name, board.ip);
            
            // Create socket with board's IP
            let socket = create_board_socket(&board.ip, &self.backend_addr, self.dev_mode).await?;
            
            let board_socket = BoardSocket {
                board: board.clone(),
                socket: Arc::new(socket),
                generator: PacketGenerator::new(board.clone()),
            };
            
            sockets.push(board_socket);
        }
        
        info!("Initialized {} board sockets (dev_mode: {})", sockets.len(), self.dev_mode);
        Ok(())
    }
    
    pub async fn send_packet(&self, board_name: &str, packet_data: Vec<u8>) -> Result<()> {
        let sockets = self.sockets.lock().await;
        
        let board_socket = sockets
            .iter()
            .find(|bs| bs.board.name == board_name)
            .ok_or_else(|| anyhow::anyhow!("Board {} not found", board_name))?;
        
        board_socket.socket.send(&packet_data).await?;
        trace!("Sent {} bytes from board {}", packet_data.len(), board_name);
        
        Ok(())
    }
    
    pub async fn start_random_generation(&self, rate: u32) -> Result<()> {
        let interval_ms = 1000 / rate;
        let mut interval = interval(Duration::from_millis(interval_ms as u64));
        
        info!("Starting packet generation at {} packets/second", rate);
        
        loop {
            interval.tick().await;
            
            let sockets = self.sockets.lock().await;
            if sockets.is_empty() {
                error!("No board sockets available");
                continue;
            }
            
            // Select random board
            let idx = {
                let mut rng = rand::thread_rng();
                rng.gen_range(0..sockets.len())
            };
            let board_socket = &sockets[idx];

            // Generate random packet
            let packet_data = match board_socket.generator.generate_random_data_packet() {
                Ok(data) => data,
                Err(e) => {
                    error!("Failed to generate packet for board {}: {}", board_socket.board.name, e);
                    continue;
                }
            };
            
            // Send packet
            match board_socket.socket.send(&packet_data).await {
                Ok(bytes_sent) => {
                    info!("Sent {} bytes from board {}", bytes_sent, board_socket.board.name);
                }
                Err(e) => {
                    error!("Failed to send packet from {}: {}", board_socket.board.name, e);
                }
            }
        }
    }
}

async fn create_board_socket(board_ip: &str, backend_addr: &SocketAddr, dev_mode: bool) -> Result<UdpSocket> {
    // In dev mode, we can bind to any available port on the board IP
    // In production mode (sniffer), we must bind to the exact board IP
    let bind_addr = if dev_mode || macos::is_localhost(board_ip) {
        // For localhost addresses in dev mode, use the board IP
        format!("{}:0", board_ip)
    } else {
        // For non-localhost addresses, we need to ensure the packets come from the right IP
        // Note: This requires the host to have these IPs configured on network interfaces
        format!("{}:0", board_ip)
    };
    
    debug!("Creating socket: {} -> {} (dev_mode: {})", bind_addr, backend_addr, dev_mode);
    
    let socket = UdpSocket::bind(&bind_addr)
        .await
        .context(format!("Failed to bind to {}. In production mode, ensure the board IP {} is configured on a network interface", bind_addr, board_ip))?;
    
    // Apply macOS-specific configurations
    macos::configure_socket(&socket)?;
    
    // Connect to backend
    socket.connect(backend_addr)
        .await
        .context("Failed to connect to backend")?;
    
    let local_addr = socket.local_addr()?;
    info!("Socket created: {} -> {} (dev_mode: {})", local_addr, backend_addr, dev_mode);
    
    Ok(socket)
}