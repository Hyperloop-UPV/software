//! Concurrent reading and writing for one already-prepared TCP connection.

use super::{Error, reader, writer};
use crate::{model::BoardId, net::Reporter, protocol::Index};
use std::time::Duration;
use tokio::{net::TcpStream, sync::mpsc};

/// Why a session ended without a transport error.
#[derive(Debug, PartialEq, Eq)]
pub enum SessionEnd {
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
/// socket half. Cancelling `run` also drops both halves and releases the borrow
/// of `orders`. Never resume that connection or automatically replay an order
/// whose write may have been interrupted. [`super::supervise`] retains this
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
pub async fn run(
    stream: TcpStream,
    board: BoardId,
    index: &Index,
    reporter: &Reporter,
    orders: &mut mpsc::Receiver<Vec<u8>>,
    write_timeout: Duration,
    keep_alive: Duration,
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
        result = writer::send(write_half, board, orders, write_timeout, keep_alive) => {
            result.map(|()| SessionEnd::OrdersDrained)
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        model::{AdjId, MessageLevel, MessagePacket, Packet, PodData, ShortTimestamp},
        net::{Event, Notification},
        protocol::{DecodeError, packet::message},
    };
    use std::{
        collections::HashMap,
        future::{Future, poll_fn},
        io,
        net::Ipv4Addr,
        task::Poll,
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

    /// A global message definition deliberately has no real connection board.
    fn sample_message() -> (Index, MessagePacket, Vec<u8>) {
        let index = Index::new(
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
        let Ok(bytes) = message::encode(&packet, &index) else {
            unreachable!("the fixture matches its message definition");
        };
        (index, packet, bytes)
    }

    /// Creates ordinary loopback sockets so tests can observe orderly write-side EOF.
    async fn connected_pair() -> Result<(TcpStream, TcpStream), Box<dyn std::error::Error>> {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let client = timeout(TEST_TIMEOUT, TcpStream::connect(listener.local_addr()?)).await??;
        let (peer, _) = timeout(TEST_TIMEOUT, listener.accept()).await??;
        Ok((client, peer))
    }

    /// Keeps the sender alive unless a test explicitly initiates writer shutdown.
    fn queued_orders() -> (mpsc::Sender<Vec<u8>>, mpsc::Receiver<Vec<u8>>) {
        let (sender, receiver) = mpsc::channel(2);
        assert!(sender.try_send(FIRST.to_vec()).is_ok());
        assert!(sender.try_send(SECOND.to_vec()).is_ok());
        (sender, receiver)
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
    async fn assert_peer_eof(peer: &mut TcpStream) -> Result<(), Box<dyn std::error::Error>> {
        let mut rest = vec![];
        timeout(TEST_TIMEOUT, peer.read_to_end(&mut rest)).await??;
        assert!(rest.is_empty());
        Ok(())
    }

    #[tokio::test]
    async fn exchanges_orders_and_a_split_message_concurrently()
    -> Result<(), Box<dyn std::error::Error>> {
        // The peer waits for outbound orders before completing its inbound frame.
        // Sequentially awaiting either whole loop would deadlock this exchange.
        let (client, mut peer) = connected_pair().await?;
        let (index, expected, bytes) = sample_message();
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let (_sender, mut orders) = queued_orders();
        let mut sent = [0; 5];
        let mut rest = vec![];
        let (end, exchanged) = timeout(TEST_TIMEOUT, async {
            tokio::join!(
                run(
                    client,
                    BOARD,
                    &index,
                    &reporter,
                    &mut orders,
                    TEST_TIMEOUT,
                    Duration::ZERO
                ),
                async {
                    peer.write_all(&bytes[..7]).await?;
                    peer.read_exact(&mut sent).await?;
                    peer.write_all(&bytes[7..]).await?;
                    let Some(notification) = sinks.notifications.recv().await else {
                        unreachable!("the session keeps its reporter alive");
                    };
                    assert_message(notification, &expected, BOARD);
                    peer.shutdown().await?;
                    peer.read_to_end(&mut rest).await?;
                    Ok::<_, io::Error>(())
                }
            )
        })
        .await?;
        exchanged?;
        assert_eq!(end?, SessionEnd::PeerClosed);
        assert_eq!(sent.as_slice(), [FIRST, SECOND].concat());
        assert!(rest.is_empty());
        assert!(sinks.notifications.try_recv().is_err());
        assert!(sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn keep_alive_continues_while_the_reader_waits_for_a_partial_frame()
    -> Result<(), Box<dyn std::error::Error>> {
        // Incomplete inbound data must not prevent the single writer's heartbeat.
        // Complete the message only after observing ID 1, then close the peer's send side.
        let (client, mut peer) = connected_pair().await?;
        let (index, expected, bytes) = sample_message();
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let (_sender, mut orders) = mpsc::channel(1);
        let mut heartbeat = [0; 2];
        let mut rest = vec![];
        let (end, exchanged) = timeout(TEST_TIMEOUT, async {
            tokio::join!(
                run(
                    client,
                    BOARD,
                    &index,
                    &reporter,
                    &mut orders,
                    TEST_TIMEOUT,
                    Duration::from_millis(10)
                ),
                async {
                    peer.write_all(&bytes[..7]).await?;
                    peer.read_exact(&mut heartbeat).await?;
                    peer.write_all(&bytes[7..]).await?;
                    let Some(notification) = sinks.notifications.recv().await else {
                        unreachable!("the session keeps its reporter alive");
                    };
                    assert_message(notification, &expected, BOARD);
                    peer.shutdown().await?;
                    peer.read_to_end(&mut rest).await?;
                    Ok::<_, io::Error>(())
                }
            )
        })
        .await?;
        exchanged?;
        assert_eq!(end?, SessionEnd::PeerClosed);
        assert_eq!(heartbeat, [1, 0]);
        // Scheduling can allow more complete heartbeats before the reader observes EOF.
        assert_eq!(rest.len() % 2, 0);
        assert!(rest.chunks(2).all(|frame| frame == [1, 0]));
        assert!(sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn peer_eof_cancels_an_idle_writer_and_releases_the_order_receiver()
    -> Result<(), Box<dyn std::error::Error>> {
        // Keep the order channel open: writer completion cannot be the reason this ends.
        // Peer-side EOF afterward proves the waiting writer's half was dropped.
        let (client, mut peer) = connected_pair().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let (sender, mut orders) = mpsc::channel(1);
        peer.shutdown().await?;
        let end = timeout(
            TEST_TIMEOUT,
            run(
                client,
                BOARD,
                &Index::default(),
                &reporter,
                &mut orders,
                TEST_TIMEOUT,
                Duration::ZERO,
            ),
        )
        .await??;
        assert_eq!(end, SessionEnd::PeerClosed);
        assert_peer_eof(&mut peer).await?;
        sender.try_send(FIRST.to_vec())?;
        assert_eq!(orders.try_recv(), Ok(FIRST.to_vec()));
        assert!(sinks.notifications.try_recv().is_err());
        assert!(sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn a_drained_order_channel_cancels_an_idle_reader()
    -> Result<(), Box<dyn std::error::Error>> {
        // The peer stays connected and sends nothing, so the read loop cannot finish itself.
        // Closing orders must stop the session rather than wait for a read or heartbeat.
        let (client, mut peer) = connected_pair().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let (sender, mut orders) = mpsc::channel(1);
        drop(sender);
        let end = timeout(
            TEST_TIMEOUT,
            run(
                client,
                BOARD,
                &Index::default(),
                &reporter,
                &mut orders,
                TEST_TIMEOUT,
                Duration::from_millis(10),
            ),
        )
        .await??;
        assert_eq!(end, SessionEnd::OrdersDrained);
        assert_peer_eof(&mut peer).await?;
        assert!(sinks.notifications.try_recv().is_err());
        assert!(sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn order_channel_shutdown_drains_queued_frames_before_cancelling_the_reader()
    -> Result<(), Box<dyn std::error::Error>> {
        // The writer must send both already-queued frames before its normal completion.
        // Read the whole stream concurrently, without assuming TCP write boundaries.
        let (client, mut peer) = connected_pair().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let (sender, mut orders) = queued_orders();
        drop(sender);
        let index = Index::default();
        let mut received = vec![];
        let (end, read) = timeout(TEST_TIMEOUT, async {
            tokio::join!(
                run(
                    client,
                    BOARD,
                    &index,
                    &reporter,
                    &mut orders,
                    TEST_TIMEOUT,
                    Duration::ZERO
                ),
                peer.read_to_end(&mut received),
            )
        })
        .await?;
        read?;
        assert_eq!(end?, SessionEnd::OrdersDrained);
        assert_eq!(received, [FIRST, SECOND].concat());
        assert_eq!(
            orders.try_recv(),
            Err(mpsc::error::TryRecvError::Disconnected)
        );
        assert!(sinks.notifications.try_recv().is_err());
        assert!(sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn notification_consumer_loss_stops_the_session_and_the_idle_writer()
    -> Result<(), Box<dyn std::error::Error>> {
        // Consumer loss is observed by publishing a real packet, not by closing the socket.
        // Leave orders open to prove the writer is cancelled by the reader's result.
        let (client, mut peer) = connected_pair().await?;
        let (index, _expected, bytes) = sample_message();
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        sinks.notifications.close();
        let (_sender, mut orders) = mpsc::channel(1);
        peer.write_all(&bytes).await?;
        let end = timeout(
            TEST_TIMEOUT,
            run(
                client,
                BOARD,
                &index,
                &reporter,
                &mut orders,
                TEST_TIMEOUT,
                Duration::ZERO,
            ),
        )
        .await??;
        assert_eq!(end, SessionEnd::ConsumerClosed);
        assert_peer_eof(&mut peer).await?;
        assert!(sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn partial_eof_returns_the_read_error_and_keeps_already_queued_notifications()
    -> Result<(), Box<dyn std::error::Error>> {
        // The first message is published before a second incomplete frame reaches EOF.
        // Session cleanup must retain that queued notification and must not report the error twice.
        let (client, mut peer) = connected_pair().await?;
        let (index, expected, bytes) = sample_message();
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let (_sender, mut orders) = mpsc::channel(1);
        peer.write_all(&bytes).await?;
        peer.write_all(&bytes[..7]).await?;
        peer.shutdown().await?;
        let Err(error) = timeout(
            TEST_TIMEOUT,
            run(
                client,
                BOARD,
                &index,
                &reporter,
                &mut orders,
                TEST_TIMEOUT,
                Duration::ZERO,
            ),
        )
        .await?
        else {
            unreachable!("EOF in the second frame must remain a read error");
        };
        assert!(!error.is_fatal());
        let Error::Read { board, source } = error else {
            unreachable!("the session must return its selected reader error unchanged");
        };
        assert_eq!(board, BOARD);
        assert_eq!(source.kind(), io::ErrorKind::UnexpectedEof);
        assert_message(sinks.notifications.try_recv()?, &expected, BOARD);
        assert!(sinks.notifications.try_recv().is_err());
        assert!(sinks.errors.try_recv().is_err());
        assert_peer_eof(&mut peer).await?;
        Ok(())
    }

    #[tokio::test]
    async fn a_terminal_decode_error_cancels_the_writer_and_preserves_fatality()
    -> Result<(), Box<dyn std::error::Error>> {
        // Exceed the framing limit with an unknown ID while the writer is idle.
        // The session must preserve the protocol error, board and fatal classification.
        let (client, mut peer) = connected_pair().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let (_sender, mut orders) = mpsc::channel(1);
        peer.write_all(&[0xff; 375]).await?;
        let Err(error) = timeout(
            TEST_TIMEOUT,
            run(
                client,
                BOARD,
                &Index::default(),
                &reporter,
                &mut orders,
                TEST_TIMEOUT,
                Duration::ZERO,
            ),
        )
        .await?
        else {
            unreachable!("an undecodable suffix above 374 bytes is terminal");
        };
        assert!(error.is_fatal());
        let Error::Decode { board, source } = error else {
            unreachable!("the selected decoder error must not be converted into I/O");
        };
        assert_eq!(board, BOARD);
        assert_eq!(source, DecodeError::UnknownId(AdjId(u16::MAX)));
        assert!(sinks.notifications.try_recv().is_err());
        assert!(sinks.errors.try_recv().is_err());
        assert_peer_eof(&mut peer).await?;
        Ok(())
    }

    #[tokio::test]
    async fn a_socket_read_failure_is_returned_without_reporting_it()
    -> Result<(), Box<dyn std::error::Error>> {
        // Reset the peer with no queued orders, avoiding a race with a write failure.
        // The connection owner's future reporting path must receive the original read cause.
        let (client, peer) = connected_pair().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let (_sender, mut orders) = mpsc::channel(1);
        peer.set_zero_linger()?;
        drop(peer);
        let Err(error) = timeout(
            TEST_TIMEOUT,
            run(
                client,
                BOARD,
                &Index::default(),
                &reporter,
                &mut orders,
                TEST_TIMEOUT,
                Duration::ZERO,
            ),
        )
        .await?
        else {
            unreachable!("an abortive peer close must fail the read");
        };
        assert!(!error.is_fatal());
        let Error::Read { board, source } = error else {
            unreachable!("the idle writer cannot produce this read failure");
        };
        assert_eq!(board, BOARD);
        assert_eq!(source.kind(), io::ErrorKind::ConnectionReset);
        assert!(sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn a_write_failure_cancels_the_reader_and_preserves_the_remaining_order_queue()
    -> Result<(), Box<dyn std::error::Error>> {
        // Locally shut down only the send side to force BrokenPipe deterministically.
        // The peer remains open and silent, so the reader cannot be the winning branch.
        let (mut client, _peer) = connected_pair().await?;
        client.shutdown().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let (sender, mut orders) = queued_orders();
        let Err(error) = timeout(
            TEST_TIMEOUT,
            run(
                client,
                BOARD,
                &Index::default(),
                &reporter,
                &mut orders,
                TEST_TIMEOUT,
                Duration::ZERO,
            ),
        )
        .await?
        else {
            unreachable!("writing after a local send shutdown must fail");
        };
        assert!(!error.is_fatal());
        let Error::Write { board, source } = error else {
            unreachable!("the session must preserve its selected writer error");
        };
        assert_eq!(board, BOARD);
        assert_eq!(source.kind(), io::ErrorKind::BrokenPipe);
        assert_eq!(orders.try_recv(), Ok(SECOND.to_vec()));
        assert_eq!(orders.try_recv(), Err(mpsc::error::TryRecvError::Empty));
        sender.try_send(FIRST.to_vec())?;
        assert!(sinks.notifications.try_recv().is_err());
        assert!(sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn cancelling_the_session_releases_its_socket_and_receiver_borrow()
    -> Result<(), Box<dyn std::error::Error>> {
        // Poll until both loops wait, then drop the session future externally.
        // No spawned task may keep the write side or the borrowed receiver alive.
        let (client, mut peer) = connected_pair().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let (sender, mut orders) = mpsc::channel(1);
        let index = Index::default();
        {
            let running = run(
                client,
                BOARD,
                &index,
                &reporter,
                &mut orders,
                TEST_TIMEOUT,
                Duration::ZERO,
            );
            tokio::pin!(running);
            poll_fn(|cx| {
                assert!(running.as_mut().poll(cx).is_pending());
                Poll::Ready(())
            })
            .await;
        }
        assert_peer_eof(&mut peer).await?;
        sender.try_send(FIRST.to_vec())?;
        assert_eq!(orders.try_recv(), Ok(FIRST.to_vec()));
        assert!(sinks.notifications.try_recv().is_err());
        assert!(sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn order_shutdown_cancels_a_reader_blocked_on_notification_capacity()
    -> Result<(), Box<dyn std::error::Error>> {
        // Fill Reporter, then make a complete frame readable before polling the session.
        // Immediate cancellation can discard its blocked publication, but must retain
        // the already-queued notification. This is explicitly not lossless shutdown.
        let (client, mut peer) = connected_pair().await?;
        let (index, expected, bytes) = sample_message();
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        reporter
            .notify(
                BoardId(99),
                Event::Received(Packet::Message(expected.clone())),
            )
            .await?;
        let (sender, mut orders) = mpsc::channel(1);
        peer.write_all(&bytes).await?;
        let mut preview = vec![0; bytes.len()];
        timeout(TEST_TIMEOUT, async {
            while client.peek(&mut preview).await? < bytes.len() {
                tokio::task::yield_now().await;
            }
            Ok::<_, io::Error>(())
        })
        .await??;
        {
            let running = run(
                client,
                BOARD,
                &index,
                &reporter,
                &mut orders,
                TEST_TIMEOUT,
                Duration::ZERO,
            );
            tokio::pin!(running);
            poll_fn(|cx| {
                assert!(running.as_mut().poll(cx).is_pending());
                Poll::Ready(())
            })
            .await;
            drop(sender);
            assert_eq!(
                timeout(TEST_TIMEOUT, running).await??,
                SessionEnd::OrdersDrained
            );
        }
        assert_message(sinks.notifications.try_recv()?, &expected, BoardId(99));
        assert!(sinks.notifications.try_recv().is_err());
        assert!(sinks.errors.try_recv().is_err());
        assert_peer_eof(&mut peer).await?;
        Ok(())
    }
}
