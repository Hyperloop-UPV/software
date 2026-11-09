//! One board's lifecycle, with persistent queued orders and reset-on-success backoff.

use super::{BoardLink, Config, SessionEnd, connect_with_backoff, session};
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
/// No fault broadcast, hash exchange, extra task or multi-board startup is added.
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
pub async fn supervise(
    link: &BoardLink,
    config: &Config,
    index: &Index,
    reporter: &Reporter,
    orders: &mut mpsc::Receiver<Vec<u8>>,
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
            reporter.notify(link.board, Event::Connected).await?;
            let end = session::run(
                stream,
                link.board,
                index,
                reporter,
                orders,
                config.write_timeout,
                config.keep_alive,
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
        model::BoardId,
        net::tcp::{Backoff, Error},
        net::{ErrorReport, Notification, Sinks},
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
        net::{TcpListener, TcpSocket},
        sync::mpsc::error::TryRecvError,
        time::{Instant, advance, timeout},
    };

    const TEST_TIMEOUT: Duration = Duration::from_secs(3);
    const FIRST: &[u8] = &[0xe9, 0x03, 0, 0, 0xa0, 0x40];
    const SECOND: &[u8] = &[0x58, 0x02];
    const THIRD: &[u8] = &[0x59, 0x02];

    /// Supplies transport timings only; this helper never runs multiple boards.
    fn configuration(addr: SocketAddr) -> (BoardLink, Config) {
        let link = BoardLink {
            board: BoardId(7),
            addr,
            local_port: 0,
        };
        let config = Config {
            boards: vec![link],
            connect_timeout: TEST_TIMEOUT,
            backoff: Backoff::new(20, 80),
            keep_alive: Duration::ZERO,
            write_timeout: TEST_TIMEOUT,
        };
        (link, config)
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
    async fn notification<F: Future>(
        mut future: Pin<&mut F>,
        sinks: &mut Sinks,
    ) -> Result<Notification, io::Error> {
        let started = std::time::Instant::now();
        loop {
            pending(future.as_mut()).await;
            match sinks.notifications.try_recv() {
                Ok(notification) => return Ok(notification),
                Err(TryRecvError::Empty) if started.elapsed() < TEST_TIMEOUT => {
                    tokio::task::yield_now().await
                }
                _ => {
                    return Err(io::Error::new(
                        io::ErrorKind::TimedOut,
                        "expected a lifecycle notification",
                    ));
                }
            }
        }
    }

    #[tokio::test]
    async fn reconnects_with_the_same_fifo_queue_without_replaying_sent_orders()
    -> Result<(), Box<dyn std::error::Error>> {
        // Start with one ordinary order, then queue two more only after the first
        // socket is gone. Both must survive offline and precede the new heartbeat.
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let (link, mut config) = configuration(listener.local_addr()?);
        config.keep_alive = Duration::from_millis(10);
        let index = Index::default();
        let (reporter, mut sinks) = Reporter::channels(8, 8);
        let (sender, mut orders) = mpsc::channel(2);
        sender.try_send(FIRST.to_vec())?;
        let serving = async {
            let (mut first, _) = listener.accept().await?;
            assert!(matches!(
                sinks.notifications.recv().await.map(|n| n.event),
                Some(Event::Connected)
            ));
            let mut bytes = [0; 6];
            first.read_exact(&mut bytes).await?;
            assert_eq!(bytes, FIRST);
            let mut heartbeat = [0; 2];
            first.read_exact(&mut heartbeat).await?;
            assert_eq!(heartbeat, [1, 0]);
            first.shutdown().await?;
            assert!(matches!(
                sinks.notifications.recv().await.map(|n| n.event),
                Some(Event::Disconnected)
            ));
            drop(first);
            sender.try_send(SECOND.to_vec())?;
            sender.try_send(THIRD.to_vec())?;

            let (mut second, _) = listener.accept().await?;
            assert!(matches!(
                sinks.notifications.recv().await.map(|n| n.event),
                Some(Event::Connected)
            ));
            let mut queued = [0; 4];
            second.read_exact(&mut queued).await?;
            assert_eq!(queued.as_slice(), [SECOND, THIRD].concat());
            second.read_exact(&mut heartbeat).await?;
            assert_eq!(heartbeat, [1, 0]);
            // Close the sender only after receiving the queued prefix so that
            // writer completion, not peer closure, stops the second session.
            drop(sender);
            assert!(matches!(
                sinks.notifications.recv().await.map(|n| n.event),
                Some(Event::Disconnected)
            ));
            Ok::<_, Box<dyn std::error::Error>>(())
        };
        let (end, served) = timeout(TEST_TIMEOUT, async {
            tokio::join!(
                supervise(&link, &config, &index, &reporter, &mut orders),
                serving
            )
        })
        .await?;
        served?;
        assert_eq!(end?, SessionEnd::OrdersDrained);
        assert!(matches!(orders.try_recv(), Err(TryRecvError::Disconnected)));
        assert!(matches!(sinks.errors.try_recv(), Err(TryRecvError::Empty)));
        assert!(matches!(
            sinks.notifications.try_recv(),
            Err(TryRecvError::Empty)
        ));
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn successful_connections_reset_backoff_before_the_next_session_loss()
    -> Result<(), Box<dyn std::error::Error>> {
        // Refuse the initial connection while reserving its port, then keep a
        // listener alive across successful sessions. Start with a capped backoff;
        // every success must restore 100 ms before the next session is lost.
        let unavailable = TcpSocket::new_v4()?;
        unavailable.bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))?;
        let (link, mut config) = configuration(unavailable.local_addr()?);
        config.backoff = Backoff::new(100, 700);
        for expected in [100, 200, 400] {
            assert_eq!(
                config.backoff.get_interval(),
                Duration::from_millis(expected)
            );
        }
        let index = Index::default();
        let (reporter, mut sinks) = Reporter::channels(8, 8);
        let (_sender, mut orders) = mpsc::channel(1);
        let mut running = Box::pin(supervise(&link, &config, &index, &reporter, &mut orders));
        let started = std::time::Instant::now();
        let initial_failure: ErrorReport = loop {
            pending(running.as_mut()).await;
            if let Ok(error) = sinks.errors.try_recv() {
                break error;
            }
            assert!(started.elapsed() < TEST_TIMEOUT);
            tokio::task::yield_now().await;
        };
        assert!(matches!(
            initial_failure.error,
            crate::net::Error::Tcp(Error::Connect { .. })
        ));
        let listener = unavailable.listen(8)?;
        advance(Duration::from_millis(700)).await;
        assert!(matches!(
            notification(running.as_mut(), &mut sinks).await?.event,
            Event::Connected
        ));
        let (mut peer, _) = listener.accept().await?;

        for delay in [100; 4] {
            peer.shutdown().await?;
            assert!(matches!(
                notification(running.as_mut(), &mut sinks).await?.event,
                Event::Disconnected
            ));
            let waiting_since = Instant::now();
            advance(Duration::from_millis(delay - 1)).await;
            // Yield reactor readiness without moving virtual time. Reconnection
            // must neither happen immediately nor retain the old capped interval.
            for _ in 0..32 {
                pending(running.as_mut()).await;
                tokio::task::yield_now().await;
            }
            assert!(matches!(
                sinks.notifications.try_recv(),
                Err(TryRecvError::Empty)
            ));
            advance(Duration::from_millis(1)).await;
            assert!(matches!(
                notification(running.as_mut(), &mut sinks).await?.event,
                Event::Connected
            ));
            assert_eq!(waiting_since.elapsed(), Duration::from_millis(delay));
            (peer, _) = listener.accept().await?;
        }
        assert!(matches!(sinks.errors.try_recv(), Err(TryRecvError::Empty)));
        Ok(())
    }

    #[tokio::test]
    async fn an_already_closed_and_empty_order_channel_needs_no_connection()
    -> Result<(), Box<dyn std::error::Error>> {
        // Keep an actual remote port unavailable. A drained channel should stop
        // before trying to connect or emitting a synthetic lifecycle pair.
        let unavailable = TcpSocket::new_v4()?;
        unavailable.bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))?;
        let (link, config) = configuration(unavailable.local_addr()?);
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let (sender, mut orders) = mpsc::channel(1);
        drop(sender);
        let end = timeout(
            TEST_TIMEOUT,
            supervise(&link, &config, &Index::default(), &reporter, &mut orders),
        )
        .await??;
        assert_eq!(end, SessionEnd::OrdersDrained);
        assert!(matches!(sinks.errors.try_recv(), Err(TryRecvError::Empty)));
        assert!(matches!(
            sinks.notifications.try_recv(),
            Err(TryRecvError::Empty)
        ));
        Ok(())
    }

    #[tokio::test]
    async fn a_closed_receiver_still_waits_for_orders_with_outstanding_permits()
    -> Result<(), Box<dyn std::error::Error>> {
        // Receiver::close does not invalidate permits acquired earlier. An empty
        // buffer alone must not make the supervisor discard a reserved order.
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let (link, config) = configuration(listener.local_addr()?);
        let index = Index::default();
        let (reporter, mut sinks) = Reporter::channels(8, 8);
        let (sender, mut orders) = mpsc::channel(1);
        let permit = sender.reserve().await?;
        orders.close();
        let serving = async {
            let (mut peer, _) = listener.accept().await?;
            assert!(matches!(
                sinks.notifications.recv().await.map(|n| n.event),
                Some(Event::Connected)
            ));
            permit.send(FIRST.to_vec());
            let mut received = [0; 6];
            peer.read_exact(&mut received).await?;
            assert_eq!(received, FIRST);
            assert!(matches!(
                sinks.notifications.recv().await.map(|n| n.event),
                Some(Event::Disconnected)
            ));
            Ok::<_, io::Error>(())
        };
        let (end, served) = timeout(TEST_TIMEOUT, async {
            tokio::join!(
                supervise(&link, &config, &index, &reporter, &mut orders),
                serving
            )
        })
        .await?;
        served?;
        assert_eq!(end?, SessionEnd::OrdersDrained);
        Ok(())
    }

    #[tokio::test]
    async fn closing_either_reporter_consumer_stops_an_idle_session()
    -> Result<(), Box<dyn std::error::Error>> {
        // No inbound packets, queued orders or keep-alive are needed to detect
        // consumer loss. The supervisor watches both sinks outside session::run.
        for close_errors in [false, true] {
            let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
            let (link, config) = configuration(listener.local_addr()?);
            let index = Index::default();
            let (reporter, mut sinks) = Reporter::channels(8, 8);
            let (_sender, mut orders) = mpsc::channel(1);
            let mut running = Box::pin(supervise(&link, &config, &index, &reporter, &mut orders));
            assert!(matches!(
                notification(running.as_mut(), &mut sinks).await?.event,
                Event::Connected
            ));
            let (mut peer, _) = listener.accept().await?;
            if close_errors {
                sinks.errors.close();
            } else {
                sinks.notifications.close();
            }
            assert!(matches!(timeout(TEST_TIMEOUT, running).await?, Err(Closed)));
            let mut byte = [0];
            // Zero linger may yield a reset instead of a graceful EOF.
            match timeout(TEST_TIMEOUT, peer.read(&mut byte)).await? {
                Ok(0) => {}
                Err(error) if error.kind() == io::ErrorKind::ConnectionReset => {}
                other => unreachable!("the cancelled socket must close, got {other:?}"),
            }
        }
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn closing_either_consumer_interrupts_an_offline_retry_wait()
    -> Result<(), Box<dyn std::error::Error>> {
        for close_errors in [false, true] {
            let occupied = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
            let (mut link, mut config) = configuration(occupied.local_addr()?);
            link.local_port = occupied.local_addr()?.port();
            config.backoff = Backoff::new(60_000, 60_000);
            let index = Index::default();
            let (reporter, mut sinks) = Reporter::channels(8, 8);
            let (_sender, mut orders) = mpsc::channel(1);
            let mut running = Box::pin(supervise(&link, &config, &index, &reporter, &mut orders));
            pending(running.as_mut()).await;
            sinks.errors.try_recv()?;
            if close_errors {
                sinks.errors.close();
            } else {
                sinks.notifications.close();
            }
            let started = Instant::now();
            assert!(matches!(timeout(TEST_TIMEOUT, running).await?, Err(Closed)));
            assert_eq!(started.elapsed(), Duration::ZERO);
        }
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn cancelling_an_offline_supervisor_keeps_queued_orders_and_stops_retries()
    -> Result<(), Box<dyn std::error::Error>> {
        let occupied = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let (mut link, config) = configuration(occupied.local_addr()?);
        link.local_port = occupied.local_addr()?.port();
        let index = Index::default();
        let (reporter, mut sinks) = Reporter::channels(8, 8);
        let (sender, mut orders) = mpsc::channel(2);
        sender.try_send(FIRST.to_vec())?;
        sender.try_send(SECOND.to_vec())?;
        let mut running = Box::pin(supervise(&link, &config, &index, &reporter, &mut orders));
        pending(running.as_mut()).await;
        drop(running);
        advance(Duration::from_secs(60)).await;
        // The receiver is borrowed, not owned or cleared by the supervisor.
        assert_eq!(orders.try_recv()?, FIRST);
        assert_eq!(orders.try_recv()?, SECOND);
        sinks.errors.try_recv()?;
        assert!(matches!(sinks.errors.try_recv(), Err(TryRecvError::Empty)));
        assert!(matches!(
            sinks.notifications.try_recv(),
            Err(TryRecvError::Empty)
        ));
        Ok(())
    }

    #[tokio::test]
    async fn cancelling_an_active_supervisor_drops_the_socket_and_retains_unread_orders()
    -> Result<(), Box<dyn std::error::Error>> {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let (link, config) = configuration(listener.local_addr()?);
        let index = Index::default();
        let (reporter, mut sinks) = Reporter::channels(8, 8);
        let (sender, mut orders) = mpsc::channel(1);
        let mut running = Box::pin(supervise(&link, &config, &index, &reporter, &mut orders));
        notification(running.as_mut(), &mut sinks).await?;
        let (mut peer, _) = listener.accept().await?;
        // Queue only after the supervisor is parked in idle session I/O, then
        // drop it without polling again so this order has not been dequeued.
        sender.try_send(FIRST.to_vec())?;
        drop(running);
        assert_eq!(orders.try_recv()?, FIRST);
        let mut byte = [0];
        match timeout(TEST_TIMEOUT, peer.read(&mut byte)).await? {
            Ok(0) => {}
            Err(error) if error.kind() == io::ErrorKind::ConnectionReset => {}
            other => unreachable!("the cancelled socket must close, got {other:?}"),
        }
        assert!(matches!(
            sinks.notifications.try_recv(),
            Err(TryRecvError::Empty)
        ));
        Ok(())
    }

    #[tokio::test]
    async fn terminal_decode_errors_are_reported_once_before_reconnecting()
    -> Result<(), Box<dyn std::error::Error>> {
        // Keep the existing fatal-error contract: report to station, drop this
        // stream and reconnect. No fault broadcast or application decision here.
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let (link, config) = configuration(listener.local_addr()?);
        let index = Index::default();
        let (reporter, mut sinks) = Reporter::channels(8, 8);
        let (sender, mut orders) = mpsc::channel(1);
        let serving = async {
            let (mut first, _) = listener.accept().await?;
            assert!(matches!(
                sinks.notifications.recv().await.map(|n| n.event),
                Some(Event::Connected)
            ));
            first.write_all(&[0; 375]).await?;
            let Some(report) = sinks.errors.recv().await else {
                unreachable!("the decode error is reported");
            };
            let crate::net::Error::Tcp(error) = report.error else {
                unreachable!("TCP reports its own error");
            };
            assert!(error.is_fatal());
            assert!(matches!(error, Error::Decode { board, .. } if board == link.board));
            assert!(matches!(
                sinks.notifications.recv().await.map(|n| n.event),
                Some(Event::Disconnected)
            ));
            sender.try_send(SECOND.to_vec())?;
            let (mut second, _) = listener.accept().await?;
            assert!(matches!(
                sinks.notifications.recv().await.map(|n| n.event),
                Some(Event::Connected)
            ));
            let mut bytes = [0; 2];
            second.read_exact(&mut bytes).await?;
            assert_eq!(bytes, SECOND);
            drop(sender);
            assert!(matches!(
                sinks.notifications.recv().await.map(|n| n.event),
                Some(Event::Disconnected)
            ));
            Ok::<_, Box<dyn std::error::Error>>(())
        };
        let (end, served) = timeout(TEST_TIMEOUT, async {
            tokio::join!(
                supervise(&link, &config, &index, &reporter, &mut orders),
                serving
            )
        })
        .await?;
        served?;
        assert_eq!(end?, SessionEnd::OrdersDrained);
        assert!(matches!(sinks.errors.try_recv(), Err(TryRecvError::Empty)));
        Ok(())
    }
}
