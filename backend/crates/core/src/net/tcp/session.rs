//! Concurrent reading and writing for one already-prepared TCP connection.

use super::{Error, fault, reader, writer};
use crate::{model::BoardId, net::Reporter, protocol::Index};
use tokio::{net::TcpStream, sync::mpsc};

/// Why a session ended without a transport error.
#[derive(Debug, PartialEq, Eq)]
pub(super) enum SessionEnd {
    /// The peer closed its write side at a frame boundary.
    PeerClosed,
    /// Publishing a received packet detected a closed notification consumer.
    /// The future connection owner must stop, not reconnect without a consumer.
    ConsumerClosed,
    /// The writer completed after the order channel was closed and drained.
    OrdersDrained,
}

/// Drives both halves until either finishes, then drops both session futures.
///
/// Takes ownership of a connected stream after any application handshake. It
/// does not read or validate a firmware hash. The caller retains the receiver:
/// orders not yet dequeued survive completion or cancellation of this function.
/// No task is spawned; both I/O loops run concurrently in the caller's task.
///
/// Whichever completion `select!` chooses determines the result, including if
/// both are ready. The other future is dropped before returning, releasing its
/// socket half. Cancelling the session also drops both halves and releases the borrow
/// of `orders`. Never resume that connection or automatically replay an order
/// whose write may have been interrupted. The supervisor retains this
/// receiver across reconnections without replaying dequeued orders.
///
/// This is immediate session cancellation, not lossless shutdown: a decoded
/// packet still waiting for notification capacity may be discarded when the
/// reader is cancelled. Already queued notifications remain in `Reporter`.
/// Consumer loss is detected only when the reader publishes, not while idle.
/// Only the reader's `Received` events are emitted. This helper does not log,
/// report errors, emit lifecycle events, reconnect or implement `spawn`.
///
/// # Errors
///
/// Returns the selected reader or writer error unchanged. The caller can report
/// that single result once; this function does not collect errors from both sides.
pub(super) async fn run(
    stream: TcpStream,
    board: BoardId,
    index: &Index,
    reporter: &Reporter,
    orders: &mut mpsc::Receiver<Vec<u8>>,
    settings: writer::Settings,
    faults: Option<fault::Active>,
) -> Result<SessionEnd, Error> {
    let (read_half, write_half) = stream.into_split();

    // These futures own their halves directly. Selecting a result drops both,
    // rather than detaching a background task or waiting for the other loop.
    tokio::select! {
        result = reader::receive(read_half, board, index, reporter) => {
            result.map(|end| match end {
                reader::ReceiveEnd::PeerClosed => SessionEnd::PeerClosed,
                reader::ReceiveEnd::ConsumerClosed => SessionEnd::ConsumerClosed,
            })
        }
        result = writer::send(write_half, board, orders, settings, faults) => {
            result.map(|()| SessionEnd::OrdersDrained)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        model::{AdjId, MessageLevel, MessagePacket, Packet, PodData, ShortTimestamp},
        net::{Event, Notification, Sinks},
        protocol::{DecodeError, packet::message},
    };
    use std::{
        collections::HashMap,
        future::{Future, poll_fn},
        io,
        net::Ipv4Addr,
        pin::Pin,
        task::Poll,
        time::Duration,
    };
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::TcpListener,
        time::timeout,
    };

    const TEST_TIMEOUT: Duration = Duration::from_secs(2);
    const FIRST: &[u8] = &[0x58, 0x02, 42];
    const SECOND: &[u8] = &[0x59, 0x02];
    const BOARD: BoardId = BoardId(42);

    type TestResult<T = ()> = Result<T, Box<dyn std::error::Error>>;

    struct TestSession {
        index: Index,
        reporter: Reporter,
        orders: mpsc::Receiver<Vec<u8>>,
        keep_alive: Duration,
    }

    struct TestPeer {
        stream: TcpStream,
        sinks: Sinks,
        sender: mpsc::Sender<Vec<u8>>,
    }

    impl TestSession {
        /// A global message deliberately has no real connection board in the index.
        fn message(&mut self) -> (MessagePacket, Vec<u8>) {
            self.index = Index::new(
                &PodData {
                    boards: HashMap::new(),
                },
                Some(&HashMap::from([(AdjId(3), MessageLevel::Warning)])),
            );
            let packet = MessagePacket {
                id: AdjId(3),
                timestamp: ShortTimestamp {
                    hour: 12,
                    minute: 30,
                    second: 0,
                    subsecond: 0,
                },
                origin: "mock".to_string(),
                message: "session test".to_string(),
            };
            let Ok(bytes) = message::encode(&packet, &self.index) else {
                unreachable!("the fixture matches its message definition");
            };
            (packet, bytes)
        }

        async fn run_session_test(&mut self, stream: TcpStream) -> Result<SessionEnd, Error> {
            run(
                stream,
                BOARD,
                &self.index,
                &self.reporter,
                &mut self.orders,
                writer::Settings {
                    write_timeout: TEST_TIMEOUT,
                    keep_alive: self.keep_alive,
                },
                None,
            )
            .await
        }

        async fn failure(&mut self, stream: TcpStream) -> TestResult<Error> {
            timeout(TEST_TIMEOUT, self.run_session_test(stream))
                .await?
                .err()
                .ok_or_else(|| "the session should return an error".into())
        }
    }

    /// Uses ordinary sockets for orderly EOF and leaves order-sender lifetime to each test.
    async fn setup(initial_orders: &[&[u8]]) -> TestResult<(TestSession, TcpStream, TestPeer)> {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let client = timeout(TEST_TIMEOUT, TcpStream::connect(listener.local_addr()?)).await??;
        let (stream, _) = timeout(TEST_TIMEOUT, listener.accept()).await??;
        let (reporter, sinks) = Reporter::channels(1, 1);
        let (sender, orders) = mpsc::channel(initial_orders.len().max(1));
        for bytes in initial_orders {
            sender.try_send(bytes.to_vec())?;
        }
        Ok((
            TestSession {
                index: Index::default(),
                reporter,
                orders,
                keep_alive: Duration::ZERO,
            },
            client,
            TestPeer {
                stream,
                sinks,
                sender,
            },
        ))
    }

    /// Verifies packet identity and connection identity without introducing lifecycle events.
    fn assert_message(notification: Notification, expected: &MessagePacket, board: BoardId) {
        assert_eq!(notification.board, board);
        let Event::Received(Packet::Message(packet)) = notification.event else {
            unreachable!("this session fixture emits only received messages");
        };
        assert_eq!(&packet, expected);
    }

    /// Requires the cancelled writer to release its write half, not remain idle forever.
    async fn assert_peer_eof(peer: &mut TcpStream) -> TestResult {
        let mut rest = vec![];
        timeout(TEST_TIMEOUT, peer.read_to_end(&mut rest)).await??;
        assert!(rest.is_empty());
        Ok(())
    }

    fn assert_no_reports(sinks: &mut Sinks) {
        assert!(sinks.notifications.try_recv().is_err());
        assert!(sinks.errors.try_recv().is_err());
    }

    async fn assert_pending<F: Future>(mut future: Pin<&mut F>) {
        poll_fn(|cx| {
            assert!(future.as_mut().poll(cx).is_pending());
            Poll::Ready(())
        })
        .await;
    }

    fn assert_read_error(error: Error, kind: io::ErrorKind) {
        assert!(!error.is_fatal());
        let Error::Read { board, source } = error else {
            unreachable!("the session must preserve its selected reader error");
        };
        assert_eq!(board, BOARD);
        assert_eq!(source.kind(), kind);
    }

    /// Complete the inbound frame only after observing the writer's output.
    async fn exchange_split_message(
        peer: &mut TestPeer,
        bytes: &[u8],
        expected: &MessagePacket,
        output: &mut [u8],
    ) -> TestResult<Vec<u8>> {
        peer.stream.write_all(&bytes[..7]).await?;
        peer.stream.read_exact(output).await?;
        peer.stream.write_all(&bytes[7..]).await?;
        let notification = peer
            .sinks
            .notifications
            .recv()
            .await
            .ok_or("reporting stopped")?;
        assert_message(notification, expected, BOARD);
        peer.stream.shutdown().await?;
        let mut rest = vec![];
        peer.stream.read_to_end(&mut rest).await?;
        Ok(rest)
    }

    #[tokio::test]
    async fn exchanges_orders_and_a_split_message_concurrently() -> TestResult {
        let (mut session, client, mut peer) = setup(&[FIRST, SECOND]).await?;
        let (expected, bytes) = session.message();
        let mut sent = [0; 5];
        let (end, exchanged) = timeout(TEST_TIMEOUT, async {
            tokio::join!(
                session.run_session_test(client),
                exchange_split_message(&mut peer, &bytes, &expected, &mut sent),
            )
        })
        .await?;
        assert!(exchanged?.is_empty());
        assert_eq!(end?, SessionEnd::PeerClosed);
        assert_eq!(sent.as_slice(), [FIRST, SECOND].concat());
        assert_no_reports(&mut peer.sinks);
        Ok(())
    }

    #[tokio::test]
    async fn keep_alive_continues_while_the_reader_waits_for_a_partial_frame() -> TestResult {
        let (mut session, client, mut peer) = setup(&[]).await?;
        let (expected, bytes) = session.message();
        session.keep_alive = Duration::from_millis(10);
        let mut heartbeat = [0; 2];
        let (end, exchanged) = timeout(TEST_TIMEOUT, async {
            tokio::join!(
                session.run_session_test(client),
                exchange_split_message(&mut peer, &bytes, &expected, &mut heartbeat),
            )
        })
        .await?;
        let rest = exchanged?;
        assert_eq!(end?, SessionEnd::PeerClosed);
        assert_eq!(heartbeat, [1, 0]);
        // Scheduling can allow more complete heartbeats before the reader observes EOF.
        assert_eq!(rest.len() % 2, 0);
        assert!(rest.chunks(2).all(|frame| frame == [1, 0]));
        assert!(peer.sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn peer_eof_cancels_an_idle_writer_and_releases_the_order_receiver() -> TestResult {
        let (mut session, client, mut peer) = setup(&[]).await?;
        peer.stream.shutdown().await?;
        let end = timeout(TEST_TIMEOUT, session.run_session_test(client)).await??;
        assert_eq!(end, SessionEnd::PeerClosed);
        assert_peer_eof(&mut peer.stream).await?;
        peer.sender.try_send(FIRST.to_vec())?;
        assert_eq!(session.orders.try_recv(), Ok(FIRST.to_vec()));
        assert_no_reports(&mut peer.sinks);
        Ok(())
    }

    #[tokio::test]
    async fn a_drained_order_channel_cancels_an_idle_reader() -> TestResult {
        let (mut session, client, mut peer) = setup(&[]).await?;
        session.keep_alive = Duration::from_millis(10);
        drop(peer.sender);
        let end = timeout(TEST_TIMEOUT, session.run_session_test(client)).await??;
        assert_eq!(end, SessionEnd::OrdersDrained);
        assert_peer_eof(&mut peer.stream).await?;
        assert_no_reports(&mut peer.sinks);
        Ok(())
    }

    #[tokio::test]
    async fn order_channel_shutdown_drains_queued_frames_before_cancelling_the_reader() -> TestResult
    {
        let (mut session, client, mut peer) = setup(&[FIRST, SECOND]).await?;
        drop(peer.sender);
        let mut received = vec![];
        let (end, read) = timeout(TEST_TIMEOUT, async {
            tokio::join!(
                session.run_session_test(client),
                peer.stream.read_to_end(&mut received),
            )
        })
        .await?;
        read?;
        assert_eq!(end?, SessionEnd::OrdersDrained);
        assert_eq!(received, [FIRST, SECOND].concat());
        assert_eq!(
            session.orders.try_recv(),
            Err(mpsc::error::TryRecvError::Disconnected)
        );
        assert_no_reports(&mut peer.sinks);
        Ok(())
    }

    #[tokio::test]
    async fn notification_consumer_loss_stops_the_session_and_the_idle_writer() -> TestResult {
        let (mut session, client, mut peer) = setup(&[]).await?;
        let (_, bytes) = session.message();
        peer.sinks.notifications.close();
        peer.stream.write_all(&bytes).await?;
        let end = timeout(TEST_TIMEOUT, session.run_session_test(client)).await??;
        assert_eq!(end, SessionEnd::ConsumerClosed);
        assert_peer_eof(&mut peer.stream).await?;
        assert!(peer.sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn partial_eof_returns_the_read_error_and_keeps_already_queued_notifications()
    -> TestResult {
        let (mut session, client, mut peer) = setup(&[]).await?;
        let (expected, bytes) = session.message();
        peer.stream.write_all(&bytes).await?;
        peer.stream.write_all(&bytes[..7]).await?;
        peer.stream.shutdown().await?;
        let error = session.failure(client).await?;
        assert_read_error(error, io::ErrorKind::UnexpectedEof);
        assert_message(peer.sinks.notifications.try_recv()?, &expected, BOARD);
        assert_no_reports(&mut peer.sinks);
        assert_peer_eof(&mut peer.stream).await?;
        Ok(())
    }

    #[tokio::test]
    async fn a_terminal_decode_error_cancels_the_writer_and_preserves_fatality() -> TestResult {
        let (mut session, client, mut peer) = setup(&[]).await?;
        peer.stream.write_all(&[0xff; 375]).await?;
        let error = session.failure(client).await?;
        assert!(error.is_fatal());
        let Error::Decode { board, source } = error else {
            unreachable!("the selected decoder error must not be converted into I/O");
        };
        assert_eq!(board, BOARD);
        assert_eq!(source, DecodeError::UnknownId(AdjId(u16::MAX)));
        assert_no_reports(&mut peer.sinks);
        assert_peer_eof(&mut peer.stream).await?;
        Ok(())
    }

    #[tokio::test]
    async fn a_socket_read_failure_is_returned_without_reporting_it() -> TestResult {
        // Reset the peer with no queued orders, avoiding a race with a write failure.
        // The connection owner's future reporting path must receive the original read cause.
        let (mut session, client, mut peer) = setup(&[]).await?;
        peer.stream.set_zero_linger()?;
        drop(peer.stream);
        let error = session.failure(client).await?;
        assert_read_error(error, io::ErrorKind::ConnectionReset);
        assert!(peer.sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn a_write_failure_cancels_the_reader_and_preserves_the_remaining_order_queue()
    -> TestResult {
        // Locally shut down only the send side to force BrokenPipe deterministically.
        // The peer remains open and silent, so the reader cannot be the winning branch.
        let (mut session, mut client, mut peer) = setup(&[FIRST, SECOND]).await?;
        client.shutdown().await?;
        let error = session.failure(client).await?;
        assert!(!error.is_fatal());
        let Error::Write { board, source } = error else {
            unreachable!("the session must preserve its selected writer error");
        };
        assert_eq!(board, BOARD);
        assert_eq!(source.kind(), io::ErrorKind::BrokenPipe);
        assert_eq!(session.orders.try_recv(), Ok(SECOND.to_vec()));
        assert_eq!(
            session.orders.try_recv(),
            Err(mpsc::error::TryRecvError::Empty)
        );
        peer.sender.try_send(FIRST.to_vec())?;
        assert_no_reports(&mut peer.sinks);
        Ok(())
    }

    #[tokio::test]
    async fn cancelling_the_session_releases_its_socket_and_receiver_borrow() -> TestResult {
        // Poll until both loops wait, then drop the session future externally.
        // No spawned task may keep the write side or the borrowed receiver alive.
        let (mut session, client, mut peer) = setup(&[]).await?;
        {
            let running = session.run_session_test(client);
            tokio::pin!(running);
            assert_pending(running.as_mut()).await;
        }
        assert_peer_eof(&mut peer.stream).await?;
        peer.sender.try_send(FIRST.to_vec())?;
        assert_eq!(session.orders.try_recv(), Ok(FIRST.to_vec()));
        assert_no_reports(&mut peer.sinks);
        Ok(())
    }

    #[tokio::test]
    async fn order_shutdown_cancels_a_reader_blocked_on_notification_capacity() -> TestResult {
        // Fill Reporter, then make a complete frame readable before polling the session.
        // Immediate cancellation can discard its blocked publication, but must retain
        // the already-queued notification. This is explicitly not lossless shutdown.
        let (mut session, client, mut peer) = setup(&[]).await?;
        let (expected, bytes) = session.message();
        session
            .reporter
            .notify(
                BoardId(99),
                Event::Received(Packet::Message(expected.clone())),
            )
            .await?;
        peer.stream.write_all(&bytes).await?;
        let mut preview = vec![0; bytes.len()];
        timeout(TEST_TIMEOUT, async {
            while client.peek(&mut preview).await? < bytes.len() {
                tokio::task::yield_now().await;
            }
            Ok::<_, io::Error>(())
        })
        .await??;
        {
            let running = session.run_session_test(client);
            tokio::pin!(running);
            assert_pending(running.as_mut()).await;
            drop(peer.sender);
            assert_eq!(
                timeout(TEST_TIMEOUT, running).await??,
                SessionEnd::OrdersDrained
            );
        }
        assert_message(peer.sinks.notifications.try_recv()?, &expected, BoardId(99));
        assert_no_reports(&mut peer.sinks);
        assert_peer_eof(&mut peer.stream).await?;
        Ok(())
    }
}
