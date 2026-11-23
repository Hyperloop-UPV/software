use super::{BoardHandle, SendError, Unreachable};
use crate::model::{BoardId, OrderPacket, PacketType};
use crate::protocol::Index;
use std::{
    collections::HashMap,
    future::{Future, poll_fn},
    sync::Arc,
    task::Poll,
    time::Duration,
};
use tokio::time::Instant;

/// Access to the configured boards' TCP clients.
///
/// A board remains in this collection while disconnected. Connection state
/// belongs to its task, not to the presence of its handle in this map.
/// The shared, read-only index resolves order IDs to their destination boards.
#[derive(Debug)]
pub struct BoardClients {
    // Configured boards by ID, including disconnected destinations.
    boards: HashMap<BoardId, BoardHandle>,
    // Immutable ADJ packet definitions used to resolve order destinations.
    index: Arc<Index>,
    // Absolute budget for each fault attempt, including frame-boundary waits.
    write_timeout: Duration,
}

impl BoardClients {
    /// Assembles the configured handles after their supervisor tasks are started.
    pub(super) fn new(
        boards: HashMap<BoardId, BoardHandle>,
        index: Arc<Index>,
        write_timeout: Duration,
    ) -> Self {
        Self {
            boards,
            index,
            write_timeout,
        }
    }

    /// Returns read-only access to a configured board, regardless of connection state.
    /// Presence does not imply a live connection. Send orders through [`Self::send`]
    /// rather than selecting a destination manually.
    #[must_use]
    pub fn board(&self, board: BoardId) -> Option<&BoardHandle> {
        self.boards.get(&board)
    }

    /// Resolves, validates and writes an order to the current destination session.
    ///
    /// Success confirms complete write_all acceptance, not firmware receipt or
    /// execution. Offline sessions fail immediately. Connected callers wait for
    /// the same mutex as heartbeats and faults; write_timeout bounds waiting and
    /// writing together. No request survives reconnection and no background task
    /// retains orders. Cancelling while waiting writes nothing; cancelling an
    /// unfinished write closes that session.
    ///
    /// Routing/encoding failures are returned only. Transport failures also
    /// publish [`super::TcpError::Send`]; consume both Reporter channels concurrently,
    /// as reporting backpressure is outside write_timeout.
    ///
    /// # Errors
    /// UnknownId, NoClient and Encode reject invalid input before writing.
    /// Disconnected, Timeout and Write describe the transport attempt.
    pub async fn send(&self, order: OrderPacket) -> Result<(), SendError> {
        let definition = self
            .index
            .packet(order.id)
            // Check if the packet is typed as order
            .filter(|definition| matches!(&definition.packet_type, PacketType::Order(_)))
            .ok_or(SendError::UnknownId(order.id))?;
        let handle = self
            .board(definition.board)
            .ok_or(SendError::NoClient(definition.board))?;

        handle.send(order).await
    }

    /// Writes the reserved fault frame (00 00) through every current board writer.
    ///
    /// Attempts run concurrently, each bounded by [`super::TcpConfig::write_timeout`]
    /// from the start of this call, including waiting for the writer. Faults use
    /// the same mutex as orders and heartbeats, without a priority reservation or
    /// separate control queue. An in-progress frame is never interrupted by a fault.
    ///
    /// Disconnected boards fail immediately; no reconnection or automatic replay
    /// is attempted. Each attempt snapshots its session. Cancelling before writing
    /// sends nothing; cancelling an unfinished write closes that session. An empty
    /// configuration succeeds. Success confirms write_all, not firmware execution.
    /// A persistent fault latch and recovery policy belong to the application.
    ///
    /// # Errors
    /// Returns the configured boards whose write completion was not confirmed
    /// (offline, session ended, I/O failure, or deadline elapsed). A failed/partial
    /// write is never retried and ends that session. Expiry while waiting leaves
    /// it usable. Failure does not prove that no bytes were delivered.
    pub async fn broadcast_fault(&self) -> Result<(), Unreachable> {
        let started = Instant::now();
        let deadline = started + self.write_timeout;
        tracing::info!(board_count = self.boards.len(), write_timeout = ?self.write_timeout,
            "TCP fault broadcast requested");
        let mut pending: Vec<_> = self
            .boards
            .values()
            .map(|handle| {
                (
                    handle.board,
                    Box::pin(handle.endpoint.request_fault(deadline)),
                )
            })
            .collect();
        let mut failed = Vec::new();
        // Poll every board without spawning detached tasks or serialising waits.
        // Dropping this future cancels every pending attempt in its captured session.
        poll_fn(|cx| {
            pending.retain_mut(|(board, request)| match request.as_mut().poll(cx) {
                Poll::Ready(success) => {
                    if !success {
                        failed.push(*board);
                    }
                    false
                }
                Poll::Pending => true,
            });
            if pending.is_empty() {
                Poll::Ready(())
            } else {
                Poll::Pending
            }
        })
        .await;
        if failed.is_empty() {
            tracing::info!(
                board_count = self.boards.len(),
                elapsed_ms = started.elapsed().as_millis(),
                "TCP fault broadcast writes completed"
            );
            Ok(())
        } else {
            failed.sort_unstable_by_key(|board| board.0);
            tracing::warn!(board_count = self.boards.len(), unconfirmed_boards = ?failed,
                elapsed_ms = started.elapsed().as_millis(),
                "TCP fault broadcast has unconfirmed writes");
            Err(Unreachable(failed))
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        model::{AdjId, OrderPacket, Port, Value},
        net::{
            Notification, Reporter, Sinks,
            tcp::{Backoff, BoardLink, TcpConfig, spawn, test_support::*},
        },
        protocol::EncodeError,
    };
    use std::net::{Ipv4Addr, SocketAddr};
    use tokio::{
        io::AsyncReadExt,
        net::{TcpListener, TcpSocket, TcpStream},
    };

    async fn next_notification(
        sinks: &mut Sinks,
        missing: &str,
    ) -> Result<Notification, Box<dyn std::error::Error>> {
        sinks
            .notifications
            .recv()
            .await
            .ok_or_else(|| missing.into())
    }

    async fn assert_fault_broadcast(
        handles: &BoardClients,
        first: &mut TcpStream,
        second: &mut TcpStream,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let (mut a, mut b) = ([0xff; 2], [0xff; 2]);
        let (broadcast, read_a, read_b) = tokio::join!(
            handles.broadcast_fault(),
            first.read_exact(&mut a),
            second.read_exact(&mut b)
        );
        assert_eq!(broadcast, Ok(()));
        read_a?;
        read_b?;
        assert_eq!((a, b), ([0, 0], [0, 0]));
        Ok(())
    }

    #[tokio::test]
    async fn routes_and_encodes_each_order_only_to_its_destination() -> TestResult {
        bounded(async {
            let first = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
            let second = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
            let mut config = config(first.local_addr()?);
            config.boards.push(BoardLink {
                board: BoardId(9),
                addr: second.local_addr()?,
                local_port: Port(0),
            });
            let (reporter, mut sinks) = Reporter::channels(16, 16);
            let clients = spawn(config, index(), reporter);
            let ((mut a, _), (mut b, _)) = tokio::try_join!(first.accept(), second.accept())?;
            connected(&mut sinks).await?;
            connected(&mut sinks).await?;
            assert_eq!(clients.board(BOARD).map(BoardHandle::board), Some(BOARD));
            assert!(clients.board(BoardId(10)).is_none());
            clients.send(order(600, 42.0)).await?;
            clients.send(order(601, 99.0)).await?;
            let (mut aa, mut bb) = ([0; 3], [0; 3]);
            a.read_exact(&mut aa).await?;
            b.read_exact(&mut bb).await?;
            assert_eq!(aa, [0x58, 2, 42]);
            assert_eq!(bb, [0x59, 2, 99]);
            assert!(sinks.errors.try_recv().is_err());
            sinks.notifications.close();
            peer_closed(&mut a).await?;
            peer_closed(&mut b).await?;
            Ok(())
        })
        .await
    }

    #[tokio::test]
    async fn validation_and_unconfigured_destination_fail_before_transport_admission() -> TestResult
    {
        let (reporter, mut sinks) = Reporter::channels(16, 16);
        let clients = spawn(
            TcpConfig {
                boards: vec![],
                ..config(SocketAddr::from((Ipv4Addr::LOCALHOST, 1)))
            },
            index(),
            reporter,
        );
        assert!(matches!(
            clients.send(order(999, 1.0)).await,
            Err(SendError::UnknownId(AdjId(999)))
        ));
        assert!(matches!(
            clients.send(order(1600, 1.0)).await,
            Err(SendError::UnknownId(AdjId(1600)))
        ));
        assert!(matches!(
            clients.send(order(600, 1.0)).await,
            Err(SendError::NoClient(BOARD))
        ));
        assert!(clients.broadcast_fault().await.is_ok());
        assert!(sinks.errors.try_recv().is_err());
        let socket = TcpSocket::new_v4()?;
        socket.bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))?;
        let (reporter, mut sinks) = Reporter::channels(16, 16);
        let clients = spawn(config(socket.local_addr()?), index(), reporter);
        assert!(matches!(
            clients
                .send(OrderPacket::new(AdjId(600), vec![Value::Bool(true)]))
                .await,
            Err(SendError::Encode {
                board: BOARD,
                source: EncodeError::TypeMismatch
            })
        ));
        assert!(matches!(
            clients.send(OrderPacket::new(AdjId(600), vec![])).await,
            Err(SendError::Encode {
                source: EncodeError::WrongFieldCount {
                    expected: 1,
                    got: 0
                },
                ..
            })
        ));
        assert!(matches!(
            clients.send(order(600, 256.0)).await,
            Err(SendError::Encode {
                source: EncodeError::OutOfRange { .. },
                ..
            })
        ));
        assert!(sinks.errors.try_recv().is_err()); // Spawned task has not been polled.
        sinks.notifications.close();
        Ok(())
    }

    #[tokio::test]
    async fn broadcasts_faults_over_active_clients_without_replaying_after_reconnect()
    -> Result<(), Box<dyn std::error::Error>> {
        use crate::net::Event;
        use std::net::Ipv4Addr;
        use tokio::{net::TcpListener, time::timeout};

        timeout(Duration::from_secs(6), async {
            let first_listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
            let third_listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
            let config = TcpConfig {
                boards: vec![
                    BoardLink {
                        board: BoardId(1),
                        addr: first_listener.local_addr()?,
                        local_port: Port(0),
                    },
                    BoardLink {
                        board: BoardId(3),
                        addr: third_listener.local_addr()?,
                        local_port: Port(0),
                    },
                ],
                connect_timeout: Duration::from_millis(100),
                backoff: Backoff::new(1000, 1000),
                write_timeout: Duration::from_millis(200),
                keep_alive: Duration::ZERO,
            };
            let (reporter, mut sinks) = Reporter::channels(32, 16);
            // Reserved ID 0 must work with no ADJ orders declared at all.
            let handles = spawn(config, Arc::new(Index::default()), reporter);
            let (first, third) =
                tokio::try_join!(first_listener.accept(), third_listener.accept())?;
            let (mut first, mut third) = (first.0, third.0);
            for _ in 0..2 {
                let notification = next_notification(&mut sinks, "reporting stopped").await?;
                assert!(matches!(notification.event, Event::Connected));
            }

            assert_fault_broadcast(&handles, &mut first, &mut third).await?;

            drop(first);
            let notification = next_notification(&mut sinks, "missing disconnection").await?;
            assert_eq!(notification.board, BoardId(1));
            assert!(matches!(notification.event, Event::Disconnected));
            // The offline board fails, without preventing the healthy board's write.
            let mut b = [0xff; 2];
            let (broadcast, read_b) =
                tokio::join!(handles.broadcast_fault(), third.read_exact(&mut b));
            assert_eq!(broadcast, Err(Unreachable(vec![BoardId(1)])));
            read_b?;
            assert_eq!(b, [0, 0]);

            let (mut reconnected, _) = first_listener.accept().await?;
            let notification = next_notification(&mut sinks, "missing reconnection").await?;
            assert_eq!(notification.board, BoardId(1));
            assert!(matches!(notification.event, Event::Connected));
            // Neither the successful first fault nor the offline request is replayed.
            let mut a = [0xff; 2];
            assert!(
                timeout(Duration::from_millis(30), reconnected.read_exact(&mut a))
                    .await
                    .is_err()
            );
            assert_fault_broadcast(&handles, &mut reconnected, &mut third).await?;
            sinks.notifications.close();
            sinks.errors.close();
            Ok::<_, Box<dyn std::error::Error>>(())
        })
        .await??;
        Ok(())
    }
}
