use ntp_server::{protocol::Stratum, server::NtpServer};
use std::{
    io,
    net::{Ipv4Addr, SocketAddrV4},
};
use tracing::{debug, info, instrument};

const NTP_DEFAULT_PORT: u16 = 8123;

/// Represents the address used to start the NTP server.
/// It can be defined as an IPv4 interface + port or as a full socket address.
#[derive(Debug)]
pub enum NtpAddress {
    /// Uses the interface and port separately.
    Interface {
        /// IPv4 interface to bind to. If `None`, the default interface (`0.0.0.0`) is used.
        interface: Option<Ipv4Addr>, 
        /// Port to listen on. If `None`, the default NTP port (`8123`) is used.
        port: Option<u16>,
    },
    /// Uses a complete IPv4 socket address.
    Socket(Option<SocketAddrV4>)
}

/// Starts the NTP server
/// Arguments:
/// - `address`: The target address configuration used to bind the server. 
#[instrument(level = "info")]
pub async fn start_ntp_server(address: NtpAddress) -> io::Result<()> {

    let (interface, port) = match address {
        NtpAddress::Interface {interface, port} => (interface, port),
        NtpAddress::Socket(Some(socket)) => {
            (Some(*socket.ip()), Some(socket.port()))
        },
        NtpAddress::Socket(None) => (None, None)
    };

    let server = build_ntp_server(interface, port).await?;
    info!("Starting NTP server loop");
    // Any internal log of server.run() will be wrapped within this function Span
    server.run().await
}

async fn build_ntp_server(interface: Option<Ipv4Addr>, port: Option<u16>) -> io::Result<NtpServer> {
    let interface = interface.unwrap_or(Ipv4Addr::UNSPECIFIED); // Same as Ipv4Addr::new(0,0,0,0);

    let port = port.unwrap_or(NTP_DEFAULT_PORT);

    let socket_addr_v4 = SocketAddrV4::new(interface, port);

    // % -> use structured variables
    debug!(%socket_addr_v4, "Building NTP server");

    let server = NtpServer::builder()
        .listen(socket_addr_v4.to_string())
        // Stratum indicates the server's distance from the source of the reference clock.
        // This server synchronizes from a stratum 1 source, and advertises stratum 2 to its clients.
        .stratum(Stratum(2))
        .build()
        .await?;

    info!(%socket_addr_v4, "NTP server built successfully");

    Ok(server)
}

#[cfg(test)]
mod test {

    use super::*;
    use ntp_server::protocol::{
        ConstPackedSizeBytes, FromBytes, Mode, Packet, TimestampFormat, ToBytes, Version,
    };
    use std::time::Duration;
    use tokio::net::UdpSocket;
    use tracing_subscriber;

    // Initializes the subscriber for tests
    fn init_tracing_for_tests() {
        let _ = tracing_subscriber::fmt()
            .with_env_filter("debug")
            .with_test_writer() // Ensures that the logs are shown by cargo test
            .try_init(); // Avoids the test failure if there is another test in parallel
    }

    #[tokio::test]
    // Verifies if the NTP server responds correctly to a client request
    async fn ntp_server_responds_to_client_request() {
        init_tracing_for_tests();

        // Create the NTP server
        let server = build_ntp_server(Some(Ipv4Addr::LOCALHOST), Some(0))
            .await
            .expect("NTP server should bind to an ephemeral local port");

        // Get the address assigned by the OS
        let server_addr = server
            .local_addr()
            .expect("NTP server should expose its bound address");

        // Start the server on a thread
        let server_task = tokio::spawn(server.run());

        // Bind a UDP socket to send NTP requests
        let socket = UdpSocket::bind((Ipv4Addr::LOCALHOST, 0))
            .await
            .expect("NTP client socket should bind to an ephemeral local port");
        
        // Build NTP request packet for testing requests
        let request = Packet {
            transmit_timestamp: TimestampFormat {
                // Test data, just to verify the server responds correctly
                seconds: 0xE0000000,
                fraction: 0x12345678,
            },
            ..Packet::default() // Fills the rest of the packet with the default values
        };

        // Serialize the request into a fixed-size byte array.
        let mut request_bytes = [0; Packet::PACKED_SIZE_BYTES];
        request
            .to_bytes(&mut request_bytes)
            .expect("NTP client request should serialize");

        // Send the request
        socket
            .send_to(&request_bytes, server_addr)
            .await
            .expect("NTP client request should be sent");

        // Waiting for the server to respond
        let mut response_bytes = [0; 2048];
        let (response_len, source_addr) = tokio::time::timeout(
            Duration::from_secs(2),
            socket.recv_from(&mut response_bytes),
        )
        .await
        .expect("NTP server should respond before timeout")
        .expect("NTP response should be received");

        // Response should come from the same server address
        assert_eq!(source_addr, server_addr);
        // Response should have the same packet length
        assert_eq!(response_len, Packet::PACKED_SIZE_BYTES);

        // Deserialize response and validate contents
        let (response, bytes_read) = Packet::from_bytes(&response_bytes[..response_len])
            .expect("server response should be a valid NTP packet");
        assert_eq!(bytes_read, Packet::PACKED_SIZE_BYTES);
        assert_eq!(response.mode, Mode::Server);
        assert_eq!(response.version, Version::V4);
        assert_eq!(response.stratum, Stratum(2));
        assert_eq!(response.origin_timestamp, request.transmit_timestamp);
        assert_ne!(response.transmit_timestamp, TimestampFormat::default());

        // Stop the server task and verify that it was cancelled.
        server_task.abort();
        assert!(
            server_task
                .await
                .expect_err("server task should be aborted")
                .is_cancelled()
        );
    }
}
