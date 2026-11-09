//! TCP connection attempts and initial retries, independent of session supervision.

use super::{Backoff, BoardLink, Error};
use crate::net::{Closed, Reporter};
use std::{
    io,
    net::{IpAddr, Ipv4Addr, Ipv6Addr, SocketAddr},
    time::Duration,
};
use tokio::{
    net::{TcpSocket, TcpStream},
    time::{sleep, timeout},
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
pub async fn connect(link: &BoardLink, connect_timeout: Duration) -> Result<TcpStream, Error> {
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

/// Retries connection attempts until one succeeds or reporting detects consumer loss.
///
/// The first attempt is immediate. Each failure is logged and published through
/// [`Reporter::report`], then this helper waits for the next `backoff` interval.
/// Reporting applies backpressure: the interval starts after the error is queued,
/// not when the attempt fails. Consume the error channel concurrently to avoid
/// parking retries behind a full channel. Each attempt has its own
/// `connect_timeout`; reporting and backoff are outside that timeout.
///
/// Failed attempts advance the caller's backoff state. A successful connection
/// resets it before returning the stream, so a later disconnection starts at the
/// initial interval. Retries have no limit. Zero intervals add no deliberate
/// retry delay and may generate errors rapidly.
///
/// Success returns the connected stream immediately without emitting lifecycle
/// events, exchanging a hash, starting session I/O or reconnecting a later session.
/// No tasks are spawned. Dropping this future cancels the pending attempt, report
/// or wait; already queued errors remain available to the consumer.
///
/// # Errors
///
/// Returns [`Closed`] when publishing a failed attempt detects a closed error
/// consumer. Transport failures are reported, not returned. Consumer closure is
/// checked only when reporting, not proactively during a connection or wait.
pub async fn connect_with_backoff(
    link: &BoardLink,
    connect_timeout: Duration,
    backoff: &mut Backoff,
    reporter: &Reporter,
) -> Result<TcpStream, Closed> {
    loop {
        match connect(link, connect_timeout).await {
            Ok(stream) => {
                backoff.reset();
                return Ok(stream);
            }
            Err(error) => {
                tracing::warn!(board = ?link.board, addr = %link.addr, %error,
                    "TCP connection attempt failed");
                reporter.report(error).await?;
                sleep(backoff.get_interval()).await;
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::BoardId;
    use std::{
        future::{Future, poll_fn},
        pin::Pin,
        task::Poll,
    };
    use tokio::{
        net::TcpListener,
        sync::mpsc::error::TryRecvError,
        time::{Instant, advance},
    };

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

    /// Keeps the client bind port occupied so retry failures are synchronous and
    /// deterministic, without depending on reactor readiness or remote routing.
    async fn occupied_link() -> Result<(TcpListener, BoardLink), io::Error> {
        let occupied = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let link = BoardLink {
            board: BoardId(7),
            addr: occupied.local_addr()?,
            local_port: occupied.local_addr()?.port(),
        };
        Ok((occupied, link))
    }

    /// Polls without letting Tokio automatically advance the paused clock.
    async fn assert_pending_once<F: Future>(mut future: Pin<&mut F>) {
        poll_fn(|cx| {
            assert!(future.as_mut().poll(cx).is_pending());
            Poll::Ready(())
        })
        .await;
    }

    #[tokio::test]
    async fn retries_return_an_immediate_success_without_reporting_or_waiting()
    -> Result<(), Box<dyn std::error::Error>> {
        // A minute-long backoff must not delay the first attempt. The returned
        // stream retains connect's real socket configuration, with no I/O startup.
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let link = BoardLink {
            board: BoardId(3),
            addr: listener.local_addr()?,
            local_port: 0,
        };
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let mut backoff = Backoff::new(60_000, 240_000);
        assert_eq!(backoff.get_interval(), Duration::from_secs(60));
        let stream = timeout(
            TEST_TIMEOUT,
            connect_with_backoff(&link, TEST_TIMEOUT, &mut backoff, &reporter),
        )
        .await??;
        assert_eq!(backoff.get_interval(), Duration::from_secs(60));
        let (_peer, source) = timeout(TEST_TIMEOUT, listener.accept()).await??;
        assert_eq!(stream.peer_addr()?, link.addr);
        assert_eq!(stream.local_addr()?, source);
        assert!(stream.nodelay()?);
        assert_eq!(stream.linger()?, Some(Duration::ZERO));
        assert!(matches!(sinks.errors.try_recv(), Err(TryRecvError::Empty)));
        assert!(matches!(
            sinks.notifications.try_recv(),
            Err(TryRecvError::Empty)
        ));
        Ok(())
    }

    #[tokio::test]
    async fn retries_connect_when_a_previously_unavailable_peer_starts_listening()
    -> Result<(), Box<dyn std::error::Error>> {
        // Keep the remote port reserved without listening until the first refusal
        // has been reported, then turn that same socket into the real server.
        let unavailable = TcpSocket::new_v4()?;
        unavailable.bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))?;
        let link = BoardLink {
            board: BoardId(9),
            addr: unavailable.local_addr()?,
            local_port: 0,
        };
        let (reporter, mut sinks) = Reporter::channels(1, 16);
        let mut backoff = Backoff::new(10, 40);
        let connecting =
            async { connect_with_backoff(&link, TEST_TIMEOUT, &mut backoff, &reporter).await };
        let serving = async {
            let Some(report) = sinks.errors.recv().await else {
                unreachable!("the helper reports its initial connection failure");
            };
            assert!(
                matches!(report.error, crate::net::Error::Tcp(Error::Connect { board, source })
                if board == link.board && source.kind() == io::ErrorKind::ConnectionRefused)
            );
            let listener = unavailable.listen(1)?;
            let (peer, _) = listener.accept().await?;
            Ok::<_, io::Error>(peer)
        };
        let (stream, peer) =
            timeout(TEST_TIMEOUT, async { tokio::join!(connecting, serving) }).await?;
        let stream = stream?;
        let _peer = peer?;
        // Even after one or more refused attempts, success restores the first wait.
        assert_eq!(backoff.get_interval(), Duration::from_millis(10));
        assert_eq!(stream.peer_addr()?, link.addr);
        assert!(matches!(
            sinks.notifications.try_recv(),
            Err(TryRecvError::Empty)
        ));
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn retries_report_each_failure_and_wait_with_a_capped_backoff()
    -> Result<(), Box<dyn std::error::Error>> {
        let (_occupied, link) = occupied_link().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let mut backoff = Backoff::new(100, 700);
        let connecting = connect_with_backoff(&link, TEST_TIMEOUT, &mut backoff, &reporter);
        tokio::pin!(connecting);
        let started = Instant::now();
        assert_pending_once(connecting.as_mut()).await;
        assert_eq!(started.elapsed(), Duration::ZERO);
        let first = sinks.errors.try_recv()?;
        assert!(
            matches!(first.error, crate::net::Error::Tcp(Error::Connect { board, source })
            if board == link.board && source.kind() == io::ErrorKind::AddrInUse)
        );

        // Check both sides of every deadline, including repeated capped waits.
        // There must be one report per attempt and no synthetic lifecycle events.
        for interval in [100, 200, 400, 700, 700, 700] {
            advance(Duration::from_millis(interval - 1)).await;
            assert_pending_once(connecting.as_mut()).await;
            assert!(matches!(sinks.errors.try_recv(), Err(TryRecvError::Empty)));
            advance(Duration::from_millis(1)).await;
            assert_pending_once(connecting.as_mut()).await;
            let report = sinks.errors.try_recv()?;
            assert!(
                matches!(report.error, crate::net::Error::Tcp(Error::Connect { board, source })
                if board == link.board && source.kind() == io::ErrorKind::AddrInUse)
            );
            assert!(matches!(sinks.errors.try_recv(), Err(TryRecvError::Empty)));
        }
        assert!(matches!(
            sinks.notifications.try_recv(),
            Err(TryRecvError::Empty)
        ));
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn failed_retries_use_the_supplied_backoff_state_without_resetting_it()
    -> Result<(), Box<dyn std::error::Error>> {
        // Passing an already advanced value must start its waits at 200 ms,
        // rather than silently constructing a fresh sequence at 100 ms.
        let (_occupied, link) = occupied_link().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let mut backoff = Backoff::new(100, 700);
        assert_eq!(backoff.get_interval(), Duration::from_millis(100));
        {
            let connecting = connect_with_backoff(&link, TEST_TIMEOUT, &mut backoff, &reporter);
            tokio::pin!(connecting);
            assert_pending_once(connecting.as_mut()).await;
            sinks.errors.try_recv()?;
            advance(Duration::from_millis(199)).await;
            assert_pending_once(connecting.as_mut()).await;
            assert!(matches!(sinks.errors.try_recv(), Err(TryRecvError::Empty)));
            advance(Duration::from_millis(1)).await;
            assert_pending_once(connecting.as_mut()).await;
            sinks.errors.try_recv()?;
        }
        // Both scheduled waits advance the same caller-owned state, even when
        // this helper is cancelled before completing its second wait.
        assert_eq!(backoff.get_interval(), Duration::from_millis(700));
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn retries_wait_for_error_capacity_before_starting_the_next_interval()
    -> Result<(), Box<dyn std::error::Error>> {
        let (_occupied, link) = occupied_link().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let mut backoff = Backoff::new(100, 700);
        let connecting = connect_with_backoff(&link, TEST_TIMEOUT, &mut backoff, &reporter);
        tokio::pin!(connecting);
        assert_pending_once(connecting.as_mut()).await;
        // Leave the first report queued. The second failure cannot be published
        // at 100 ms, and elapsed time must not consume its following 200 ms wait.
        advance(Duration::from_millis(100)).await;
        assert_pending_once(connecting.as_mut()).await;
        advance(Duration::from_secs(1)).await;
        assert_pending_once(connecting.as_mut()).await;
        sinks.errors.try_recv()?;
        assert_pending_once(connecting.as_mut()).await;
        sinks.errors.try_recv()?;
        assert!(matches!(sinks.errors.try_recv(), Err(TryRecvError::Empty)));
        advance(Duration::from_millis(199)).await;
        assert_pending_once(connecting.as_mut()).await;
        assert!(matches!(sinks.errors.try_recv(), Err(TryRecvError::Empty)));
        advance(Duration::from_millis(1)).await;
        assert_pending_once(connecting.as_mut()).await;
        sinks.errors.try_recv()?;
        Ok(())
    }

    #[tokio::test]
    async fn retries_stop_when_reporting_detects_a_closed_error_consumer()
    -> Result<(), Box<dyn std::error::Error>> {
        // A failed report must return Closed, not enter the minute-long wait.
        let (_occupied, link) = occupied_link().await?;
        let (reporter, sinks) = Reporter::channels(1, 1);
        drop(sinks.errors);
        let mut backoff = Backoff::new(60_000, 60_000);
        let result = timeout(
            TEST_TIMEOUT,
            connect_with_backoff(&link, TEST_TIMEOUT, &mut backoff, &reporter),
        )
        .await?;
        assert!(matches!(result, Err(Closed)));
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn retries_stop_if_the_consumer_closes_while_a_report_is_blocked()
    -> Result<(), Box<dyn std::error::Error>> {
        let (_occupied, link) = occupied_link().await?;
        let (reporter, sinks) = Reporter::channels(1, 1);
        let mut backoff = Backoff::new(100, 700);
        let connecting = connect_with_backoff(&link, TEST_TIMEOUT, &mut backoff, &reporter);
        tokio::pin!(connecting);
        assert_pending_once(connecting.as_mut()).await;
        advance(Duration::from_millis(100)).await;
        assert_pending_once(connecting.as_mut()).await;
        // The second error is waiting for capacity behind the first one.
        // Closing the receiver must release that wait and end the retry loop.
        drop(sinks.errors);
        assert!(matches!(
            timeout(TEST_TIMEOUT, connecting).await?,
            Err(Closed)
        ));
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn cancelling_retries_during_backoff_preserves_reports_and_stops_attempts()
    -> Result<(), Box<dyn std::error::Error>> {
        let (_occupied, link) = occupied_link().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 16);
        let mut backoff = Backoff::new(100, 700);
        let mut connecting = Box::pin(connect_with_backoff(
            &link,
            TEST_TIMEOUT,
            &mut backoff,
            &reporter,
        ));
        assert_pending_once(connecting.as_mut()).await;
        drop(connecting);
        // Cancellation owns no background task: advancing past many retries
        // leaves exactly the one failure that had already been queued.
        advance(Duration::from_secs(60)).await;
        sinks.errors.try_recv()?;
        assert!(matches!(sinks.errors.try_recv(), Err(TryRecvError::Empty)));
        assert!(matches!(
            sinks.notifications.try_recv(),
            Err(TryRecvError::Empty)
        ));
        Ok(())
    }
}
