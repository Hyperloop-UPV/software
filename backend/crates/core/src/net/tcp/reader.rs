//! Reading and reporting ordinary frames from one established TCP session.

use super::{Error, framing};
use crate::{
    model::{BoardId, Packet},
    net::{Event, Reporter},
    protocol::{Index, tcp::TcpFrame},
};
use bytes::BytesMut;
use std::io;
use tokio::{io::AsyncReadExt, net::tcp::OwnedReadHalf};

/// Why a session reader stopped without a transport error.
#[derive(Debug, PartialEq, Eq)]
pub(super) enum ReceiveEnd {
    /// The peer closed its write side at a frame boundary.
    PeerClosed,
    /// Publishing a frame failed because the notification consumer is gone.
    /// The owner must stop rather than reconnect to an absent consumer.
    ConsumerClosed,
}

/// Reads ordinary frames and publishes each one through `reporter` in order.
///
/// The caller must complete any application handshake before handing over the
/// read half. The buffer is local to this invocation and is never reused across
/// sessions. The connection supplies board identity, including for global
/// message IDs whose index definitions do not belong to a real board.
///
/// A full notification channel applies backpressure instead of dropping frames.
/// Consumer closure is detected when publishing, not while an idle socket read
/// is pending. There is no read timeout: silence is not a protocol violation.
///
/// Only `Received` notifications are emitted. The session owner handles logging,
/// error reporting, connection events and disposal of both socket halves. This
/// function does not reconnect, write orders or decide to fault the pod.
///
/// # Errors
///
/// Returns [`Error::Read`] for socket failures or EOF in a partial frame, and
/// [`Error::Decode`] for a terminal framing error. Completed preceding frames
/// have already been published. The read half is dropped when the function ends.
// The session supervisor will use this once it is implemented.
#[cfg_attr(not(test), allow(dead_code))]
pub(super) async fn receive(
    mut reader: OwnedReadHalf,
    board: BoardId,
    index: &Index,
    reporter: &Reporter,
) -> Result<ReceiveEnd, Error> {
    let mut pending = BytesMut::new();
    let mut chunk = [0; 1024];

    loop {
        let read = reader
            .read(&mut chunk)
            .await
            .map_err(|source| Error::Read { board, source })?;
        if read == 0 {
            return if pending.is_empty() {
                Ok(ReceiveEnd::PeerClosed)
            } else {
                Err(Error::Read {
                    board,
                    source: io::Error::new(
                        io::ErrorKind::UnexpectedEof,
                        "peer closed with an incomplete TCP frame",
                    ),
                })
            };
        }

        pending.extend_from_slice(&chunk[..read]);
        while let Some(frame) = framing::next_frame(&mut pending, index)
            .map_err(|source| Error::Decode { board, source })?
        {
            let packet = match frame {
                TcpFrame::Message(message) => Packet::Message(message),
                TcpFrame::Protection(protection) => Packet::Protection(protection),
            };
            if reporter
                .notify(board, Event::Received(packet))
                .await
                .is_err()
            {
                return Ok(ReceiveEnd::ConsumerClosed);
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        model::{
            AdjId, Board, MacAddress, Measurement, MeasurementKind, MessageLevel, MessagePacket,
            PacketDef, PacketType, PodData, ProtectionPacket, ShortTimestamp, Value,
        },
        protocol::{
            DecodeError,
            packet::{message, protection},
        },
    };
    use std::{
        collections::HashMap,
        future::{Future, poll_fn},
        net::Ipv4Addr,
        task::Poll,
        time::Duration,
    };
    use tokio::{
        io::AsyncWriteExt,
        net::{TcpListener, TcpStream, tcp::OwnedWriteHalf},
        time::timeout,
    };

    const TEST_TIMEOUT: Duration = Duration::from_secs(2);

    fn sample_frames() -> (Index, Vec<(Packet, Vec<u8>)>) {
        let definition = PacketDef {
            id: AdjId((1 << 13) | 100),
            board: BoardId(7),
            name: "protection".to_string(),
            packet_type: PacketType::Protection(Measurement {
                id: AdjId(100),
                alias: "watched".to_string(),
                name: "Watched".to_string(),
                display_units: String::new(),
                kind: MeasurementKind::Boolean,
                protections: vec![],
            }),
        };
        let board = Board {
            id: BoardId(7),
            name: "MOCK".to_string(),
            ip: Ipv4Addr::LOCALHOST.into(),
            mac: MacAddress([0; 6]),
            packets: HashMap::from([(definition.id, definition)]),
        };
        let pod = PodData {
            boards: HashMap::from([(board.id, board)]),
        };
        let levels = HashMap::from([(AdjId(3), MessageLevel::Warning)]);
        let index = Index::new(&pod, Some(&levels));
        let timestamp = ShortTimestamp {
            hour: 12,
            minute: 30,
            second: 0,
            subsecond: 0,
        };
        let frames = [
            Packet::Message(MessagePacket {
                id: AdjId(3),
                timestamp,
                origin: "mock".to_string(),
                message: "hello".to_string(),
            }),
            Packet::Protection(ProtectionPacket {
                id: AdjId((1 << 13) | 100),
                timestamp,
                value: Value::Bool(true),
            }),
        ]
        .into_iter()
        .map(|packet| {
            let encoded = match &packet {
                Packet::Message(packet) => message::encode(packet, &index),
                Packet::Protection(packet) => protection::encode(packet, &index),
                _ => unreachable!("the fixture contains only inbound TCP frames"),
            };
            let Ok(bytes) = encoded else {
                unreachable!("the sample packets match their index definitions");
            };
            (packet, bytes)
        })
        .collect();
        (index, frames)
    }

    async fn connected_pair()
    -> Result<(OwnedReadHalf, OwnedWriteHalf, TcpStream), Box<dyn std::error::Error>> {
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let client = timeout(TEST_TIMEOUT, TcpStream::connect(listener.local_addr()?)).await??;
        let (peer, _) = timeout(TEST_TIMEOUT, listener.accept()).await??;
        let (reader, writer) = client.into_split();
        Ok((reader, writer, peer))
    }

    #[tokio::test]
    async fn reports_a_mixed_burst_in_order_with_the_connection_board()
    -> Result<(), Box<dyn std::error::Error>> {
        let (index, frames) = sample_frames();
        let (reader, _writer, mut peer) = connected_pair().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let mut bytes = Vec::new();
        for _ in 0..64 {
            for (_, encoded) in &frames {
                bytes.extend_from_slice(encoded);
            }
        }
        assert!(bytes.len() > 1024);

        // Consume concurrently: a one-slot channel must not stall the whole test.
        let (sent, received, ()) = timeout(TEST_TIMEOUT, async {
            tokio::join!(
                async {
                    peer.write_all(&bytes).await?;
                    peer.shutdown().await
                },
                receive(reader, BoardId(42), &index, &reporter),
                async {
                    for _ in 0..64 {
                        for (expected, _) in &frames {
                            let Some(notification) = sinks.notifications.recv().await else {
                                unreachable!("the reporter remains alive while receiving");
                            };
                            assert_eq!(notification.board, BoardId(42));
                            let Event::Received(packet) = notification.event else {
                                unreachable!("the reader emits only Received notifications");
                            };
                            assert_eq!(&packet, expected);
                        }
                    }
                }
            )
        })
        .await?;
        sent?;
        assert_eq!(received?, ReceiveEnd::PeerClosed);
        assert!(sinks.notifications.try_recv().is_err());
        assert!(sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn waits_for_more_bytes_without_publishing_a_partial_frame()
    -> Result<(), Box<dyn std::error::Error>> {
        let (index, frames) = sample_frames();
        let (mut reader, _writer, mut peer) = connected_pair().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let (expected, bytes) = &frames[0];

        // Make a prefix readable before polling the reader, then keep the peer open.
        peer.write_all(&bytes[..7]).await?;
        timeout(TEST_TIMEOUT, reader.peek(&mut [0; 1])).await??;
        let reading = receive(reader, BoardId(42), &index, &reporter);
        tokio::pin!(reading);
        poll_fn(|cx| {
            assert!(reading.as_mut().poll(cx).is_pending());
            Poll::Ready(())
        })
        .await;
        assert!(sinks.notifications.try_recv().is_err());

        // Completing the frame and closing the write side must produce exactly one packet.
        peer.write_all(&bytes[7..]).await?;
        peer.shutdown().await?;
        assert_eq!(
            timeout(TEST_TIMEOUT, reading).await??,
            ReceiveEnd::PeerClosed
        );
        let Ok(notification) = sinks.notifications.try_recv() else {
            unreachable!("the completed frame was published");
        };
        let Event::Received(packet) = notification.event else {
            unreachable!("the reader emits only Received notifications");
        };
        assert_eq!(&packet, expected);
        assert!(sinks.notifications.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn an_empty_peer_closure_is_normal_and_emits_no_events()
    -> Result<(), Box<dyn std::error::Error>> {
        let (reader, _writer, mut peer) = connected_pair().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);

        // Connection lifecycle notifications belong to the future supervisor, not this reader.
        peer.shutdown().await?;
        let end = timeout(
            TEST_TIMEOUT,
            receive(reader, BoardId(42), &Index::default(), &reporter),
        )
        .await??;
        assert_eq!(end, ReceiveEnd::PeerClosed);
        assert!(sinks.notifications.try_recv().is_err());
        assert!(sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn eof_in_a_partial_frame_is_a_nonfatal_read_error_after_the_valid_prefix()
    -> Result<(), Box<dyn std::error::Error>> {
        let (index, frames) = sample_frames();
        let (reader, _writer, mut peer) = connected_pair().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);

        // A complete message must survive a following protection cut short by EOF.
        peer.write_all(&frames[0].1).await?;
        peer.write_all(&frames[1].1[..8]).await?;
        peer.shutdown().await?;
        let Err(error) = timeout(
            TEST_TIMEOUT,
            receive(reader, BoardId(42), &index, &reporter),
        )
        .await?
        else {
            unreachable!("EOF cannot complete the pending protection value");
        };
        assert!(!error.is_fatal());
        let Error::Read { board, source } = error else {
            unreachable!("a truncated connection is a read failure, not an ADJ mismatch");
        };
        assert_eq!(board, BoardId(42));
        assert_eq!(source.kind(), io::ErrorKind::UnexpectedEof);
        let Ok(notification) = sinks.notifications.try_recv() else {
            unreachable!("the complete message preceding EOF was published");
        };
        let Event::Received(packet) = notification.event else {
            unreachable!("the reader emits only Received notifications");
        };
        assert_eq!(packet, frames[0].0);
        assert!(sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn an_oversized_invalid_suffix_is_fatal_after_publishing_the_valid_prefix()
    -> Result<(), Box<dyn std::error::Error>> {
        let (index, frames) = sample_frames();
        let (reader, _writer, mut peer) = connected_pair().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);

        // A terminal suffix must not hide a valid message that arrived before it.
        let mut bytes = frames[0].1.clone();
        bytes.extend([0xff; 375]);
        peer.write_all(&bytes).await?;
        let Err(error) = timeout(
            TEST_TIMEOUT,
            receive(reader, BoardId(42), &index, &reporter),
        )
        .await?
        else {
            unreachable!("an undecodable suffix above 374 bytes must terminate the session");
        };
        assert!(error.is_fatal());
        let Error::Decode { board, source } = error else {
            unreachable!("framing errors must retain the protocol decoder error");
        };
        assert_eq!(board, BoardId(42));
        assert_eq!(source, DecodeError::UnknownId(AdjId(u16::MAX)));
        let Ok(notification) = sinks.notifications.try_recv() else {
            unreachable!("the complete message preceding the invalid suffix was published");
        };
        let Event::Received(packet) = notification.event else {
            unreachable!("the reader emits only Received notifications");
        };
        assert_eq!(packet, frames[0].0);
        assert!(sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn a_socket_reset_preserves_the_io_error_and_is_not_fatal()
    -> Result<(), Box<dyn std::error::Error>> {
        let (reader, _writer, peer) = connected_pair().await?;
        let (reporter, _sinks) = Reporter::channels(1, 1);

        // Abort the peer rather than half-closing it, to exercise the actual read-error path.
        peer.set_zero_linger()?;
        drop(peer);
        let Err(error) = timeout(
            TEST_TIMEOUT,
            receive(reader, BoardId(42), &Index::default(), &reporter),
        )
        .await?
        else {
            unreachable!("an abortive peer close must fail the socket read");
        };
        assert!(!error.is_fatal());
        let Error::Read { board, source } = error else {
            unreachable!("a connection reset is a read failure");
        };
        assert_eq!(board, BoardId(42));
        assert_eq!(source.kind(), io::ErrorKind::ConnectionReset);
        Ok(())
    }

    #[tokio::test]
    async fn a_closed_notification_consumer_stops_instead_of_requesting_reconnection()
    -> Result<(), Box<dyn std::error::Error>> {
        let (index, frames) = sample_frames();
        let (reader, _writer, mut peer) = connected_pair().await?;
        let (reporter, mut sinks) = Reporter::channels(1, 1);

        // Keep the peer connected: this outcome comes from notify, not from socket EOF.
        sinks.notifications.close();
        peer.write_all(&frames[0].1).await?;
        let end = timeout(
            TEST_TIMEOUT,
            receive(reader, BoardId(42), &index, &reporter),
        )
        .await??;
        assert_eq!(end, ReceiveEnd::ConsumerClosed);
        assert!(sinks.errors.try_recv().is_err());
        Ok(())
    }

    #[tokio::test]
    async fn backpressure_waits_for_capacity_or_consumer_closure()
    -> Result<(), Box<dyn std::error::Error>> {
        let (index, frames) = sample_frames();
        for close_consumer in [false, true] {
            let (mut reader, _writer, mut peer) = connected_pair().await?;
            let (reporter, mut sinks) = Reporter::channels(1, 1);
            let bytes: Vec<_> = frames
                .iter()
                .flat_map(|(_, bytes)| bytes.iter().copied())
                .collect();
            peer.write_all(&bytes).await?;
            peer.shutdown().await?;

            // Peek without consuming until this tiny burst is available. This makes
            // one reader poll reach notify, without sleeps or assumptions about writes.
            let mut preview = vec![0; bytes.len()];
            timeout(TEST_TIMEOUT, async {
                while reader.peek(&mut preview).await? < bytes.len() {
                    tokio::task::yield_now().await;
                }
                Ok::<_, io::Error>(())
            })
            .await??;

            // Fill the only notification slot before the reader attempts to publish.
            reporter.notify(BoardId(42), Event::Connected).await?;
            let reading = receive(reader, BoardId(42), &index, &reporter);
            tokio::pin!(reading);
            poll_fn(|cx| {
                assert!(reading.as_mut().poll(cx).is_pending());
                Poll::Ready(())
            })
            .await;

            if close_consumer {
                // Closing a full channel must release the pending publication.
                sinks.notifications.close();
                assert_eq!(
                    timeout(TEST_TIMEOUT, reading).await??,
                    ReceiveEnd::ConsumerClosed
                );
            } else {
                let Some(initial) = sinks.notifications.recv().await else {
                    unreachable!("the test prefilled the notification slot");
                };
                assert!(matches!(initial.event, Event::Connected));

                // Drain while the reader advances, proving no decoded packet was dropped.
                let (end, ()) = timeout(TEST_TIMEOUT, async {
                    tokio::join!(reading, async {
                        for (expected, _) in &frames {
                            let Some(notification) = sinks.notifications.recv().await else {
                                unreachable!("the reporter remains alive");
                            };
                            let Event::Received(packet) = notification.event else {
                                unreachable!("the prefilled lifecycle event was already drained");
                            };
                            assert_eq!(&packet, expected);
                        }
                    })
                })
                .await?;
                assert_eq!(end?, ReceiveEnd::PeerClosed);
                assert!(sinks.notifications.try_recv().is_err());
            }
        }
        Ok(())
    }
}
