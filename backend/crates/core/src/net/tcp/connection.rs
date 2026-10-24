//! A single TCP connection attempt, independent of session supervision.

use super::{BoardLink, Error};
use std::{
    io,
    net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr},
    time::Duration,
};
use tokio::{
    net::{TcpSocket, TcpStream},
    time::timeout,
};

/// Opens one board's connection, binding its local port before connecting.
///
/// The remote address selects IPv4 or IPv6. The local address is unspecified
/// so routing selects the interface; local port zero requests an ephemeral port.
/// Kernel keep-alive is disabled: the application keep-alive is an empty order
/// with ID 1, sent later by the session's single writer. TCP_NODELAY is enabled.
/// Zero linger makes closing abortive and may discard unsent data.
///
/// The timeout bounds the asynchronous connect, not the synchronous socket
/// setup. This function makes no retries, emits no events and performs no
/// application I/O or handshake. The caller owns the returned stream.
///
/// # Errors
///
/// Returns [`Error::Connect`] with the board ID and original I/O error if socket
/// creation, configuration, binding or connecting fails. An elapsed timeout is
/// represented by [`io::ErrorKind::TimedOut`]; its pending socket is dropped.
// The connection supervisor will use this once it is implemented.
#[cfg_attr(not(test), allow(dead_code))]
pub(super) async fn connect(
    link: &BoardLink,
    connect_timeout: Duration,
) -> Result<TcpStream, Error> {
    let result = async {
        let (socket, local_ip) = match link.addr {
            SocketAddr::V4(_) => (TcpSocket::new_v4()?, IpAddr::V4(Ipv4Addr::UNSPECIFIED)),
            SocketAddr::V6(_) => (TcpSocket::new_v6()?, IpAddr::V6(Ipv6Addr::UNSPECIFIED)),
        };
        socket.set_keepalive(false)?;
        socket.set_zero_linger()?;
        socket.set_nodelay(true)?;
        socket.bind(SocketAddr::new(local_ip, link.local_port))?;

        timeout(connect_timeout, socket.connect(link.addr))
            .await
            .map_err(io::Error::from)?
    }
    .await;

    result.map_err(|source| Error::Connect {
        board: link.board,
        source,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::BoardId;
    use tokio::net::TcpListener;

    const TEST_TIMEOUT: Duration = Duration::from_secs(2);

    async fn check_loopback_connection(
        listener: TcpListener,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let link = BoardLink {
            board: BoardId(3),
            addr: listener.local_addr()?,
            local_port: 0,
        };

        // Port zero lets parallel tests obtain distinct client ports from the OS.
        let stream = connect(&link, TEST_TIMEOUT).await?;
        let (_peer, source) = timeout(TEST_TIMEOUT, listener.accept()).await??;
        assert_eq!(stream.peer_addr()?, link.addr);
        assert_eq!(source, stream.local_addr()?);
        assert_ne!(source.port(), 0);

        // Inspect the connected socket, not just the options requested during setup.
        assert!(stream.nodelay()?);
        assert_eq!(stream.linger()?, Some(Duration::ZERO));
        Ok(())
    }

    #[tokio::test]
    async fn connects_to_an_ipv4_server_with_the_requested_options()
    -> Result<(), Box<dyn std::error::Error>> {
        // A loopback listener acts as firmware without requiring a physical board.
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        check_loopback_connection(listener).await
    }

    #[tokio::test]
    async fn connects_to_an_ipv6_server_with_the_requested_options()
    -> Result<(), Box<dyn std::error::Error>> {
        // Skip only when the host cannot provide IPv6 loopback; other failures matter.
        // Linux EAFNOSUPPORT is not mapped to ErrorKind::Unsupported by std::io.
        const LINUX_EAFNOSUPPORT: i32 = 97;
        let listener = match TcpListener::bind((Ipv6Addr::LOCALHOST, 0)).await {
            Ok(listener) => listener,
            Err(error)
                if matches!(
                    error.kind(),
                    io::ErrorKind::AddrNotAvailable | io::ErrorKind::Unsupported
                ) || (cfg!(target_os = "linux")
                    && error.raw_os_error() == Some(LINUX_EAFNOSUPPORT)) =>
            {
                eprintln!("IPv6 loopback is unavailable; skipping IPv6 connection test: {error}");
                return Ok(());
            }
            Err(error) => return Err(error.into()),
        };
        check_loopback_connection(listener).await
    }

    #[tokio::test]
    async fn an_occupied_local_port_reports_the_board_and_bind_error()
    -> Result<(), Box<dyn std::error::Error>> {
        // Keep the port occupied throughout the attempt, avoiding a free-port race.
        let occupied = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let link = BoardLink {
            board: BoardId(7),
            addr: occupied.local_addr()?,
            local_port: occupied.local_addr()?.port(),
        };
        let Err(error) = connect(&link, TEST_TIMEOUT).await else {
            unreachable!("binding an occupied local port must fail");
        };

        // Setup failures must retain both identity and cause, without faulting the pod.
        assert!(!error.is_fatal());
        let Error::Connect { board, source } = error else {
            unreachable!("a bind failure belongs to the connection attempt");
        };
        assert_eq!(board, BoardId(7));
        assert_eq!(source.kind(), io::ErrorKind::AddrInUse);
        Ok(())
    }

    #[tokio::test]
    async fn a_non_listening_peer_reports_the_board_and_connect_error()
    -> Result<(), Box<dyn std::error::Error>> {
        // Reserve the remote port without listening, so no other test can claim it.
        let unavailable = TcpSocket::new_v4()?;
        unavailable.bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))?;
        let link = BoardLink {
            board: BoardId(9),
            addr: unavailable.local_addr()?,
            local_port: 0,
        };
        let Err(error) = connect(&link, TEST_TIMEOUT).await else {
            unreachable!("a bound but non-listening peer cannot accept the connection");
        };

        // A refused connection is a retryable network failure, not a decode fault.
        assert!(!error.is_fatal());
        let Error::Connect { board, source } = error else {
            unreachable!("a refused connection must return Error::Connect");
        };
        assert_eq!(board, BoardId(9));
        assert_eq!(source.kind(), io::ErrorKind::ConnectionRefused);
        Ok(())
    }
}
