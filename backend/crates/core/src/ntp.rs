use ntp_server::{protocol::Stratum, server::NtpServer};
use std::{
    io,
    net::{Ipv4Addr, SocketAddrV4},
};
use tracing::{debug, info, instrument};

/// Starts the NTP server
/// Arguments:
/// - `interface`: (Optional) Interface which is suposed to listen. Default interface is `0.0.0.0`.
/// - `port`: (Optional) Specific port for the server to listen. Default port is `8123`.  
#[instrument(level = "info")]
pub async fn start_ntp_server(interface: Option<Ipv4Addr>, port: Option<u16>) -> io::Result<()> {
    let server = build_ntp_server(interface, port).await?;
    debug!("Starting NTP server loop");
    // Any internal log of server.run() will be wrapped within this function Span
    server.run().await
}

async fn build_ntp_server(interface: Option<Ipv4Addr>, port: Option<u16>) -> io::Result<NtpServer> {
    let interface = interface.unwrap_or(Ipv4Addr::UNSPECIFIED); // Same as Ipv4Addr::new(0,0,0,0);

    let port = port.unwrap_or(8123);

    let socket_addr_v4 = SocketAddrV4::new(interface, port);

    // % -> use structured variables
    debug!(%socket_addr_v4, "Building NTP server");

    let server = NtpServer::builder()
        .listen(socket_addr_v4.to_string())
        // Stratum indicates the server's distance from the source of the reference clock.
        // This server syncronizes from a stratum 1 source, and advertises stratum 2 to its clients.
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

    // Inicializes the subscriber for tests
    fn init_tracing_for_tests() {
        let _ = tracing_subscriber::fmt()
            .with_env_filter("debug")
            .with_test_writer() // Ensures that the logs get showed by cargo test
            .try_init(); // Avoids the test failure if there is another test in parallel
    }

    #[tokio::test]
    async fn ntp_server_responds_to_client_request() {
        init_tracing_for_tests();

        let server = build_ntp_server(Some(Ipv4Addr::LOCALHOST), Some(0))
            .await
            .expect("NTP server should bind to an ephemeral local port");
        let server_addr = server
            .local_addr()
            .expect("NTP server should expose its bound address");
        let server_task = tokio::spawn(server.run());

        let socket = UdpSocket::bind((Ipv4Addr::LOCALHOST, 0))
            .await
            .expect("NTP client socket should bind to an ephemeral local port");
        let request = Packet {
            transmit_timestamp: TimestampFormat {
                seconds: 0xE0000000,
                fraction: 0x12345678,
            },
            ..Packet::default()
        };
        let mut request_bytes = [0; Packet::PACKED_SIZE_BYTES];
        request
            .to_bytes(&mut request_bytes)
            .expect("NTP client request should serialize");
        socket
            .send_to(&request_bytes, server_addr)
            .await
            .expect("NTP client request should be sent");

        let mut response_bytes = [0; 2048];
        let (response_len, source_addr) = tokio::time::timeout(
            Duration::from_secs(2),
            socket.recv_from(&mut response_bytes),
        )
        .await
        .expect("NTP server should respond before timeout")
        .expect("NTP response should be received");

        assert_eq!(source_addr, server_addr);
        assert_eq!(response_len, Packet::PACKED_SIZE_BYTES);

        let (response, bytes_read) = Packet::from_bytes(&response_bytes[..response_len])
            .expect("server response should be a valid NTP packet");
        assert_eq!(bytes_read, Packet::PACKED_SIZE_BYTES);
        assert_eq!(response.mode, Mode::Server);
        assert_eq!(response.version, Version::V4);
        assert_eq!(response.stratum, Stratum(2));
        assert_eq!(response.origin_timestamp, request.transmit_timestamp);
        assert_ne!(response.transmit_timestamp, TimestampFormat::default());

        server_task.abort();
        assert!(
            server_task
                .await
                .expect_err("server task should be aborted")
                .is_cancelled()
        );
    }
}
