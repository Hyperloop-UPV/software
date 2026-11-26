//! Read-only board identity and direct, session-bound normal order writes.
use super::{SendError, TcpError, endpoint};
use crate::{
    model::{BoardId, OrderPacket},
    net::Reporter,
    protocol::{Index, tcp},
};
use std::{io, sync::Arc, time::Duration};
use tokio::time::Instant;

/// A configured board, including while disconnected. Presence does not imply a
/// live socket. Submit orders through BoardClients so the index controls routing.
#[derive(Debug)]
pub struct BoardHandle {
    pub(super) board: BoardId,
    pub(super) index: Arc<Index>,
    pub(super) endpoint: endpoint::Endpoint,
    pub(super) write_timeout: Duration,
    pub(super) reporter: Reporter,
}
impl BoardHandle {
    /// The configured board's identity; independent of connection state.
    #[must_use]
    pub fn board(&self) -> BoardId {
        self.board
    }

    /// Encoding precedes writing. A send snapshots one session, waits for its
    /// writer within write_timeout, and never waits for reconnection. Failed
    /// transport attempts are reported once here; encoding failures are returned
    /// only. Reporting backpressure is outside write_timeout.
    pub(super) async fn send(&self, order: OrderPacket) -> Result<(), SendError> {
        let started = Instant::now();
        tracing::debug!(board = ?self.board, order = ?order.id, "Attempting TCP order send");
        let bytes = tcp::encode_order(&order, &self.index).map_err(|source| {
            tracing::debug!(board = ?self.board, order = ?order.id, error = ?source,
                elapsed_ms = started.elapsed().as_millis(), "TCP order encoding failed");
            SendError::Encode {
                board: self.board,
                source,
            }
        })?;
        let result = match self.endpoint.current_writer() {
            Some(writer) => {
                writer
                    .write_order(self.board, &bytes, self.write_timeout)
                    .await
            }
            None => Err(SendError::Disconnected(self.board)),
        };
        if let Err(error) = &result {
            let source = match error {
                SendError::Disconnected(_) => Arc::new(io::Error::new(
                    io::ErrorKind::NotConnected,
                    "TCP session ended or has not connected",
                )),
                SendError::Timeout(_) => Arc::new(io::Error::new(
                    io::ErrorKind::TimedOut,
                    "TCP order write timed out",
                )),
                SendError::Write { source, .. } => Arc::clone(source),
                _ => unreachable!("routing and encoding finish before writing"),
            };
            tracing::warn!(board = ?self.board, order = ?order.id, error = ?error,
                frame_len = bytes.len(), elapsed_ms = started.elapsed().as_millis(),
                "TCP order send failed");
            let _ = self
                .reporter
                .report(TcpError::Send {
                    board: self.board,
                    order: order.id,
                    source,
                })
                .await;
        } else {
            tracing::debug!(board = ?self.board, order = ?order.id,
                frame_len = bytes.len(), elapsed_ms = started.elapsed().as_millis(),
                "TCP order write completed");
        }
        result
    }
}

#[cfg(test)]
mod tests {
    use crate::{
        model::AdjId,
        net::{
            Reporter,
            tcp::{SendError, TcpError, spawn, test_support::*},
        },
    };
    use std::{
        future::Future,
        net::{Ipv4Addr, SocketAddr},
        time::Duration,
    };
    use tokio::{
        io::AsyncReadExt,
        net::{TcpListener, TcpSocket},
        time::timeout,
    };

    #[tokio::test]
    async fn zero_write_budget_reports_once_without_writing_or_reconnecting() -> TestResult {
        bounded(async {
            let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
            let mut config = config(listener.local_addr()?);
            config.write_timeout = Duration::ZERO;
            let (reporter, mut sinks) = Reporter::channels(16, 16);
            let clients = spawn(config, index(), reporter);
            let (mut peer, _) = listener.accept().await?;
            connected(&mut sinks).await?;
            assert!(matches!(
                clients.send(order(600, 22.0)).await,
                Err(SendError::Timeout(BOARD))
            ));
            let report = sinks.errors.recv().await.ok_or("missing send report")?;
            assert!(
                matches!(report.error, crate::net::Error::Tcp(TcpError::Send {
                board: BOARD, order: AdjId(600), source
            }) if source.kind() == std::io::ErrorKind::TimedOut)
            );
            let mut bytes = [0; 3];
            assert!(
                timeout(Duration::from_millis(20), peer.read(&mut bytes))
                    .await
                    .is_err()
            );
            assert!(sinks.notifications.try_recv().is_err());
            assert!(sinks.errors.try_recv().is_err());
            sinks.errors.close();
            peer_closed(&mut peer).await?;
            Ok(())
        })
        .await
    }

    #[tokio::test]
    async fn concurrent_orders_and_fault_use_the_same_complete_frame_writer() -> TestResult {
        bounded(async {
            let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
            let (reporter, mut sinks) = Reporter::channels(16, 16);
            let clients = spawn(config(listener.local_addr()?), index(), reporter);
            let (mut peer, _) = listener.accept().await?;
            connected(&mut sinks).await?;
            let (first, fault, second) = tokio::join!(
                clients.send(order(600, 11.0)),
                clients.broadcast_fault(),
                clients.send(order(600, 22.0)),
            );
            first?;
            fault?;
            second?;
            let mut bytes = [0; 8];
            peer.read_exact(&mut bytes).await?;
            // Concurrent calls have no promised invocation order. Every frame
            // must still be intact, with each order and the fault appearing once.
            let mut offset = 0;
            let mut values = Vec::new();
            let mut faults = 0;
            while offset < bytes.len() {
                let id = u16::from_le_bytes([bytes[offset], bytes[offset + 1]]);
                offset += 2;
                match id {
                    0 => faults += 1,
                    600 => {
                        values.push(bytes[offset]);
                        offset += 1;
                    }
                    _ => return Err(format!("interleaved frame ID {id}").into()),
                }
            }
            values.sort_unstable();
            assert_eq!(values, [11, 22]);
            assert_eq!(faults, 1);
            assert!(sinks.errors.try_recv().is_err());
            sinks.errors.close();
            peer_closed(&mut peer).await?;
            Ok(())
        })
        .await
    }

    #[tokio::test]
    async fn reporting_backpressure_never_defers_a_rejected_order_into_a_new_connection()
    -> TestResult {
        bounded(async {
            let socket = TcpSocket::new_v4()?;
            socket.bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))?;
            let (reporter, mut sinks) = Reporter::channels(16, 1);
            let clients = spawn(config(socket.local_addr()?), index(), reporter);
            assert!(matches!(
                clients.send(order(600, 11.0)).await,
                Err(SendError::Disconnected(BOARD))
            ));
            let mut rejected = Box::pin(clients.send(order(600, 22.0)));
            std::future::poll_fn(|cx| {
                assert!(rejected.as_mut().poll(cx).is_pending());
                std::task::Poll::Ready(())
            })
            .await; // The second send waits only to publish its failure.
            let listener = socket.listen(8)?;
            let (mut peer, _) = listener.accept().await?;
            connected(&mut sinks).await?;
            sinks.errors.recv().await.ok_or("missing first rejection")?;
            assert!(matches!(
                rejected.await,
                Err(SendError::Disconnected(BOARD))
            ));
            sinks
                .errors
                .recv()
                .await
                .ok_or("missing second rejection")?;
            clients.send(order(600, 33.0)).await?;
            let mut bytes = [0; 3];
            peer.read_exact(&mut bytes).await?;
            assert_eq!(bytes, [0x58, 2, 33]);
            assert!(
                timeout(Duration::from_millis(20), peer.read(&mut bytes))
                    .await
                    .is_err()
            );
            sinks.notifications.close();
            Ok(())
        })
        .await
    }
}
