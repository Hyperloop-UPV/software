//! One board's lifecycle, with persistent queued orders and reset-on-success backoff.

use super::{
    BoardLink, TcpConfig, connection::connect_with_backoff, fault, session, session::SessionEnd,
    writer,
};
use crate::{
    net::{Closed, Event, Reporter},
    protocol::Index,
};
use tokio::{sync::mpsc, time::sleep};

/// A closed receiver can still have outstanding send permits. Do not declare it
/// drained until all buffered frames and reserved capacity have been released.
fn orders_drained(orders: &mpsc::Receiver<Vec<u8>>) -> bool {
    orders.is_closed() && orders.capacity() == orders.max_capacity()
}

/// Connects and reconnects one board until its orders are drained or a consumer closes.
///
/// `link` selects the board; `config.boards` is not traversed here. The remaining
/// configuration supplies connection/write timeouts, keep-alive and the initial
/// backoff state. One local copy of that state advances after failed attempts and
/// ended sessions. Every successful connection resets it before session I/O, so
/// the next session loss waits the initial interval. The first attempt is immediate;
/// every reconnection waits, even if the preceding session ended normally.
///
/// The same borrowed order receiver survives every session. Queued orders retain
/// FIFO order and can still be submitted while disconnected, up to channel capacity.
/// Orders already dequeued by a session writer are never replayed: an interrupted
/// write may already have reached the board. No expiry or execution ACK is added.
///
/// Each established session emits [`Event::Connected`] before starting I/O and
/// [`Event::Disconnected`] after its socket is dropped. Each session error is
/// logged and reported once before retrying, including fatal decode errors: as in
/// the transport contract, the error consumer decides the application-level response.
/// Spawn supplies the board's fault endpoint to forward explicit requests;
/// this supervisor never triggers a fault itself.
/// No hash exchange, extra task or multi-board startup is added here.
/// Consume both Reporter channels concurrently: full channels apply backpressure.
///
/// Returns [`SessionEnd::OrdersDrained`] when the closed order channel has been
/// drained. Closure is checked between sessions and by the active writer; while
/// connecting to an unavailable peer, use external cancellation for immediate stop.
/// Dropping this future cancels connection attempts, session I/O, publication and
/// backoff waits. Cancellation may omit a final Disconnected event and discard
/// buffered input or a pending publication; already queued reports remain intact.
///
/// # Errors
///
/// Returns [`Closed`] when either Reporter consumer closes, including during idle
/// I/O or retries. Transport errors go through Reporter rather than being returned.
pub(super) async fn supervise(
    link: &BoardLink,
    config: &TcpConfig,
    index: &Index,
    reporter: &Reporter,
    orders: &mut mpsc::Receiver<Vec<u8>>,
    fault: &fault::Endpoint,
) -> Result<SessionEnd, Closed> {
    let supervising = async {
        let mut backoff = config.backoff;
        loop {
            if orders_drained(orders) {
                return Ok(SessionEnd::OrdersDrained);
            }
            let stream =
                connect_with_backoff(link, config.connect_timeout, &mut backoff, reporter).await?;
            if orders_drained(orders) {
                return Ok(SessionEnd::OrdersDrained);
            }
            // Register before publishing Connected so its consumer can request a
            // fault immediately. Cancellation also drops this session registration.
            let faults = fault.activate();
            reporter.notify(link.board, Event::Connected).await?;
            let end = session::run(
                stream,
                link.board,
                index,
                reporter,
                orders,
                writer::Settings {
                    write_timeout: config.write_timeout,
                    keep_alive: config.keep_alive,
                },
                Some(faults),
            )
            .await;
            let drained = match end {
                Ok(SessionEnd::ConsumerClosed) => return Err(Closed),
                Ok(SessionEnd::OrdersDrained) => true,
                Ok(SessionEnd::PeerClosed) => false,
                Err(error) => {
                    tracing::warn!(board = ?link.board, %error, "TCP session failed");
                    reporter.report(error).await?;
                    false
                }
            };
            reporter.notify(link.board, Event::Disconnected).await?;
            if drained || orders_drained(orders) {
                return Ok(SessionEnd::OrdersDrained);
            }
            sleep(backoff.get_interval()).await;
        }
    };
    tokio::select! {
        result = supervising => result,
        () = reporter.closed() => Err(Closed),
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        model::{BoardId, Port},
        net::{
            Notification, Sinks,
            tcp::{Backoff, Error},
        },
    };
    use std::{
        future::{Future, poll_fn},
        io,
        net::{Ipv4Addr, SocketAddr},
        pin::Pin,
        task::Poll,
        time::Duration,
    };
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::{TcpListener, TcpSocket, TcpStream},
        sync::mpsc::error::TryRecvError,
        time::{Instant, advance, timeout},
    };

    const TEST_TIMEOUT: Duration = Duration::from_secs(3);
    const FIRST: &[u8] = &[0xe9, 0x03, 0, 0, 0xa0, 0x40];
    const SECOND: &[u8] = &[0x58, 0x02];
    const THIRD: &[u8] = &[0x59, 0x02];
    const BOARD: BoardId = BoardId(7);

    type TestResult<T = ()> = Result<T, Box<dyn std::error::Error>>;

    struct TestSupervisor {
        link: BoardLink,
        config: TcpConfig,
        index: Index,
        reporter: Reporter,
        orders: mpsc::Receiver<Vec<u8>>,
    }

    struct TestPeer {
        listener: TcpListener,
        sinks: Sinks,
        sender: mpsc::Sender<Vec<u8>>,
    }

    impl TestSupervisor {
        fn new(addr: SocketAddr, capacity: usize) -> (Self, mpsc::Sender<Vec<u8>>, Sinks) {
            let link = BoardLink {
                board: BOARD,
                addr,
                local_port: Port(0),
            };
            let config = TcpConfig {
                boards: vec![link],
                connect_timeout: TEST_TIMEOUT,
                backoff: Backoff::new(20, 80),
                keep_alive: Duration::ZERO,
                write_timeout: TEST_TIMEOUT,
            };
            let (reporter, sinks) = Reporter::channels(8, 8);
            let (sender, orders) = mpsc::channel(capacity);
            (
                Self {
                    link,
                    config,
                    index: Index::default(),
                    reporter,
                    orders,
                },
                sender,
                sinks,
            )
        }

        async fn run_test(&mut self) -> Result<SessionEnd, Closed> {
            supervise(
                &self.link,
                &self.config,
                &self.index,
                &self.reporter,
                &mut self.orders,
                &fault::Endpoint::default(),
            )
            .await
        }

        async fn run_with_peer(&mut self, serving: impl Future<Output = TestResult>) -> TestResult {
            let (end, served) = timeout(TEST_TIMEOUT, async {
                tokio::join!(self.run_test(), serving)
            })
            .await?;
            served?;
            assert_eq!(end?, SessionEnd::OrdersDrained);
            Ok(())
        }
    }

    async fn setup(capacity: usize) -> TestResult<(TestSupervisor, TestPeer)> {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let (supervisor, sender, sinks) = TestSupervisor::new(listener.local_addr()?, capacity);
        Ok((
            supervisor,
            TestPeer {
                listener,
                sinks,
                sender,
            },
        ))
    }

    fn unavailable_socket() -> io::Result<TcpSocket> {
        let socket = TcpSocket::new_v4()?;
        socket.bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))?;
        Ok(socket)
    }

    async fn offline_setup(capacity: usize) -> TestResult<(TestSupervisor, TestPeer)> {
        let (mut supervisor, peer) = setup(capacity).await?;
        supervisor.link.local_port = Port(peer.listener.local_addr()?.port());
        Ok((supervisor, peer))
    }

    /// Polls a supervisor without automatically advancing Tokio's paused clock.
    async fn pending<F: Future>(mut future: Pin<&mut F>) {
        poll_fn(|cx| {
            assert!(future.as_mut().poll(cx).is_pending());
            Poll::Ready(())
        })
        .await;
    }

    /// Drives real loopback readiness at a frozen virtual instant. A wall-clock
    /// bound catches broken tests without letting an idle runtime advance retries.
    async fn polled_recv<F: Future, T>(
        mut future: Pin<&mut F>,
        receiver: &mut mpsc::Receiver<T>,
    ) -> io::Result<T> {
        let started = std::time::Instant::now();
        loop {
            pending(future.as_mut()).await;
            match receiver.try_recv() {
                Ok(report) => return Ok(report),
                Err(TryRecvError::Empty) if started.elapsed() < TEST_TIMEOUT => {
                    tokio::task::yield_now().await
                }
                _ => {
                    return Err(io::Error::new(
                        io::ErrorKind::TimedOut,
                        "expected a supervisor report",
                    ));
                }
            }
        }
    }

    fn assert_lifecycle(notification: Notification, expected: Event) {
        assert_eq!(notification.board, BOARD);
        assert!(matches!(
            (notification.event, expected),
            (Event::Connected, Event::Connected) | (Event::Disconnected, Event::Disconnected)
        ));
    }

    async fn expect_event(sinks: &mut Sinks, expected: Event) -> TestResult {
        let notification = sinks
            .notifications
            .recv()
            .await
            .ok_or("reporting stopped")?;
        assert_lifecycle(notification, expected);
        Ok(())
    }

    async fn expect_polled_event<F: Future>(
        future: Pin<&mut F>,
        sinks: &mut Sinks,
        expected: Event,
    ) -> TestResult {
        assert_lifecycle(
            polled_recv(future, &mut sinks.notifications).await?,
            expected,
        );
        Ok(())
    }

    fn assert_empty<T>(receiver: &mut mpsc::Receiver<T>) {
        assert_eq!(receiver.try_recv().err(), Some(TryRecvError::Empty));
    }

    fn assert_no_reports(sinks: &mut Sinks) {
        assert_empty(&mut sinks.notifications);
        assert_empty(&mut sinks.errors);
    }

    fn close_consumer(sinks: &mut Sinks, errors: bool) {
        if errors {
            sinks.errors.close();
        } else {
            sinks.notifications.close();
        }
    }

    async fn assert_socket_closed(peer: &mut TcpStream) -> TestResult {
        let mut byte = [0];
        // Zero linger may yield a reset instead of a graceful EOF.
        match timeout(TEST_TIMEOUT, peer.read(&mut byte)).await? {
            Ok(0) => {}
            Err(error) if error.kind() == io::ErrorKind::ConnectionReset => {}
            other => unreachable!("the cancelled socket must close, got {other:?}"),
        }
        Ok(())
    }

    async fn expect_bytes(peer: &mut TcpStream, expected: &[u8]) -> TestResult {
        let mut bytes = vec![0; expected.len()];
        peer.read_exact(&mut bytes).await?;
        assert_eq!(bytes, expected);
        Ok(())
    }

    #[tokio::test]
    async fn reconnects_with_the_same_fifo_queue_without_replaying_sent_orders() -> TestResult {
        // Start with one ordinary order, then queue two more only after the first
        // socket is gone. Both must survive offline and precede the new heartbeat.
        let (mut supervisor, mut peer) = setup(2).await?;
        supervisor.config.keep_alive = Duration::from_millis(10);
        peer.sender.try_send(FIRST.to_vec())?;
        let serving = async {
            let (mut first, _) = peer.listener.accept().await?;
            expect_event(&mut peer.sinks, Event::Connected).await?;
            expect_bytes(&mut first, FIRST).await?;
            expect_bytes(&mut first, &[1, 0]).await?;
            first.shutdown().await?;
            expect_event(&mut peer.sinks, Event::Disconnected).await?;
            drop(first);
            peer.sender.try_send(SECOND.to_vec())?;
            peer.sender.try_send(THIRD.to_vec())?;

            let (mut second, _) = peer.listener.accept().await?;
            expect_event(&mut peer.sinks, Event::Connected).await?;
            expect_bytes(&mut second, &[SECOND, THIRD].concat()).await?;
            expect_bytes(&mut second, &[1, 0]).await?;
            // Close the sender only after receiving the queued prefix so that
            // writer completion, not peer closure, stops the second session.
            drop(peer.sender);
            expect_event(&mut peer.sinks, Event::Disconnected).await?;
            Ok(())
        };
        supervisor.run_with_peer(serving).await?;
        assert!(matches!(
            supervisor.orders.try_recv(),
            Err(TryRecvError::Disconnected)
        ));
        assert_no_reports(&mut peer.sinks);
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn successful_connections_reset_backoff_before_the_next_session_loss() -> TestResult {
        // Refuse the initial connection while reserving its port, then keep a
        // listener alive across successful sessions. Start with a capped backoff;
        // every success must restore 100 ms before the next session is lost.
        let unavailable = unavailable_socket()?;
        let (mut supervisor, _sender, mut sinks) =
            TestSupervisor::new(unavailable.local_addr()?, 1);
        supervisor.config.backoff = Backoff::new(100, 700);
        for expected in [100, 200, 400] {
            assert_eq!(
                supervisor.config.backoff.get_interval(),
                Duration::from_millis(expected)
            );
        }
        let mut running = Box::pin(supervisor.run_test());
        let initial_failure = polled_recv(running.as_mut(), &mut sinks.errors).await?;
        assert!(matches!(
            initial_failure.error,
            crate::net::Error::Tcp(Error::Connect { .. })
        ));
        let listener = unavailable.listen(8)?;
        advance(Duration::from_millis(700)).await;
        expect_polled_event(running.as_mut(), &mut sinks, Event::Connected).await?;
        let (mut peer, _) = listener.accept().await?;

        for delay in [100; 4] {
            peer.shutdown().await?;
            expect_polled_event(running.as_mut(), &mut sinks, Event::Disconnected).await?;
            let waiting_since = Instant::now();
            advance(Duration::from_millis(delay - 1)).await;
            // Yield reactor readiness without moving virtual time. Reconnection
            // must neither happen immediately nor retain the old capped interval.
            for _ in 0..32 {
                pending(running.as_mut()).await;
                tokio::task::yield_now().await;
            }
            assert_empty(&mut sinks.notifications);
            advance(Duration::from_millis(1)).await;
            expect_polled_event(running.as_mut(), &mut sinks, Event::Connected).await?;
            assert_eq!(waiting_since.elapsed(), Duration::from_millis(delay));
            (peer, _) = listener.accept().await?;
        }
        assert_empty(&mut sinks.errors);
        Ok(())
    }

    #[tokio::test]
    async fn an_already_closed_and_empty_order_channel_needs_no_connection() -> TestResult {
        // Keep an actual remote port unavailable. A drained channel should stop
        // before trying to connect or emitting a synthetic lifecycle pair.
        let unavailable = unavailable_socket()?;
        let (mut supervisor, sender, mut sinks) = TestSupervisor::new(unavailable.local_addr()?, 1);
        drop(sender);
        let end = timeout(TEST_TIMEOUT, supervisor.run_test()).await??;
        assert_eq!(end, SessionEnd::OrdersDrained);
        assert_no_reports(&mut sinks);
        Ok(())
    }

    #[tokio::test]
    async fn a_closed_receiver_still_waits_for_orders_with_outstanding_permits() -> TestResult {
        // Receiver::close does not invalidate permits acquired earlier. An empty
        // buffer alone must not make the supervisor discard a reserved order.
        let (mut supervisor, mut peer) = setup(1).await?;
        let permit = peer.sender.reserve().await?;
        supervisor.orders.close();
        let serving = async {
            let (mut stream, _) = peer.listener.accept().await?;
            expect_event(&mut peer.sinks, Event::Connected).await?;
            permit.send(FIRST.to_vec());
            expect_bytes(&mut stream, FIRST).await?;
            expect_event(&mut peer.sinks, Event::Disconnected).await?;
            Ok(())
        };
        supervisor.run_with_peer(serving).await?;
        Ok(())
    }

    #[tokio::test]
    async fn closing_either_reporter_consumer_stops_an_idle_session() -> TestResult {
        // No inbound packets, queued orders or keep-alive are needed to detect
        // consumer loss. The supervisor watches both sinks outside session::run.
        for close_errors in [false, true] {
            let (mut supervisor, mut peer) = setup(1).await?;
            let mut running = Box::pin(supervisor.run_test());
            expect_polled_event(running.as_mut(), &mut peer.sinks, Event::Connected).await?;
            let (mut stream, _) = peer.listener.accept().await?;
            close_consumer(&mut peer.sinks, close_errors);
            assert!(matches!(timeout(TEST_TIMEOUT, running).await?, Err(Closed)));
            assert_socket_closed(&mut stream).await?;
        }
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn closing_either_consumer_interrupts_an_offline_retry_wait() -> TestResult {
        for close_errors in [false, true] {
            let (mut supervisor, mut peer) = offline_setup(1).await?;
            supervisor.config.backoff = Backoff::new(60_000, 60_000);
            let mut running = Box::pin(supervisor.run_test());
            pending(running.as_mut()).await;
            peer.sinks.errors.try_recv()?;
            close_consumer(&mut peer.sinks, close_errors);
            let started = Instant::now();
            assert!(matches!(timeout(TEST_TIMEOUT, running).await?, Err(Closed)));
            assert_eq!(started.elapsed(), Duration::ZERO);
        }
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn cancelling_an_offline_supervisor_keeps_queued_orders_and_stops_retries() -> TestResult
    {
        let (mut supervisor, mut peer) = offline_setup(2).await?;
        peer.sender.try_send(FIRST.to_vec())?;
        peer.sender.try_send(SECOND.to_vec())?;
        let mut running = Box::pin(supervisor.run_test());
        pending(running.as_mut()).await;
        drop(running);
        advance(Duration::from_secs(60)).await;
        // The receiver is borrowed, not owned or cleared by the supervisor.
        assert_eq!(supervisor.orders.try_recv()?, FIRST);
        assert_eq!(supervisor.orders.try_recv()?, SECOND);
        peer.sinks.errors.try_recv()?;
        assert_no_reports(&mut peer.sinks);
        Ok(())
    }

    #[tokio::test]
    async fn cancelling_an_active_supervisor_drops_the_socket_and_retains_unread_orders()
    -> TestResult {
        let (mut supervisor, mut peer) = setup(1).await?;
        let mut running = Box::pin(supervisor.run_test());
        expect_polled_event(running.as_mut(), &mut peer.sinks, Event::Connected).await?;
        let (mut stream, _) = peer.listener.accept().await?;
        // Queue only after the supervisor is parked in idle session I/O, then
        // drop it without polling again so this order has not been dequeued.
        peer.sender.try_send(FIRST.to_vec())?;
        drop(running);
        assert_eq!(supervisor.orders.try_recv()?, FIRST);
        assert_socket_closed(&mut stream).await?;
        assert_empty(&mut peer.sinks.notifications);
        Ok(())
    }

    #[tokio::test]
    async fn terminal_decode_errors_are_reported_once_before_reconnecting() -> TestResult {
        // Keep the existing fatal-error contract: report to station, drop this
        // stream and reconnect. No fault broadcast or application decision here.
        let (mut supervisor, mut peer) = setup(1).await?;
        let serving = async {
            let (mut first, _) = peer.listener.accept().await?;
            expect_event(&mut peer.sinks, Event::Connected).await?;
            first.write_all(&[0; 375]).await?;
            let Some(report) = peer.sinks.errors.recv().await else {
                unreachable!("the decode error is reported");
            };
            let crate::net::Error::Tcp(error) = report.error else {
                unreachable!("TCP reports its own error");
            };
            assert!(error.is_fatal());
            assert!(matches!(error, Error::Decode { board, .. } if board == BOARD));
            expect_event(&mut peer.sinks, Event::Disconnected).await?;
            peer.sender.try_send(SECOND.to_vec())?;
            let (mut second, _) = peer.listener.accept().await?;
            expect_event(&mut peer.sinks, Event::Connected).await?;
            expect_bytes(&mut second, SECOND).await?;
            drop(peer.sender);
            expect_event(&mut peer.sinks, Event::Disconnected).await?;
            Ok(())
        };
        supervisor.run_with_peer(serving).await?;
        assert_empty(&mut peer.sinks.errors);
        Ok(())
    }
}
