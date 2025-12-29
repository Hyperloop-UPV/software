use std::net::UdpSocket;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};

pub fn start_test_listener(addr: &str) -> std::io::Result<()> {
    println!("Starting test UDP listener on {}", addr);

    let socket = UdpSocket::bind(addr)?;
    println!("Listening for packets...");

    let mut buf = [0u8; 65536];
    let packet_count = Arc::new(AtomicU64::new(0));
    let start_time = Instant::now();

    // Print stats periodically
    let count_clone = packet_count.clone();
    std::thread::spawn(move || loop {
        std::thread::sleep(Duration::from_secs(5));
        let count = count_clone.load(Ordering::Relaxed);
        let elapsed = start_time.elapsed().as_secs_f64();
        let rate = count as f64 / elapsed;
        println!("Received {} packets ({:.1} pps)", count, rate);
    });

    loop {
        match socket.recv_from(&mut buf) {
            Ok((size, src)) => {
                packet_count.fetch_add(1, Ordering::Relaxed);

                if size >= 2 {
                    let packet_id = u16::from_le_bytes([buf[0], buf[1]]);
                    println!("Packet from {}: ID={}, size={} bytes", src, packet_id, size);

                    // Print first few bytes
                    if size > 2 {
                        print!("  Data: ");
                        for i in 2..size.min(18) {
                            print!("{:02x} ", buf[i]);
                        }
                        if size > 18 {
                            print!("...");
                        }
                        println!();
                    }
                }
            }
            Err(e) => {
                eprintln!("Error receiving packet: {}", e);
            }
        }
    }
}
