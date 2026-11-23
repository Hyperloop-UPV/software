//! Connection retries without retaining application orders between sessions.
use super::{
    BoardLink, TcpConfig,
    connection::connect,
    endpoint, keep_alive,
    session::{self, SessionEnd},
};
use crate::{
    net::{Closed, Event, Reporter},
    protocol::Index,
};
use tokio::time::sleep;

/// Reconnects indefinitely with independent backoff. Each session installs a new
/// writer endpoint and clears it before Disconnected; neither orders nor fault
/// writes migrate between sessions. Closing either Reporter consumer cancels
/// all I/O, publication and retry waits. Tasks remain detached; dropping handles
/// alone does not stop supervision. No order channel determines task lifetime.
/// Startup and recovery both use connection::connect(), including its failure
/// retries. After a session ends, this supervisor waits one interval from the
/// same backoff state before connecting again; the last success reset that state.
pub(super) async fn supervise(
    link: &BoardLink,
    config: &TcpConfig,
    index: &Index,
    reporter: &Reporter,
    endpoint: &endpoint::Endpoint,
) -> Result<(), Closed> {
    let supervising = async {
        let mut backoff = config.backoff;
        loop {
            let stream = connect(link, config.connect_timeout, &mut backoff, reporter).await?;
            tracing::info!(board = ?link.board, addr = %link.addr, "TCP board connected");
            let end = session::run(
                stream,
                link.board,
                index,
                reporter,
                endpoint,
                keep_alive::Settings {
                    write_timeout: config.write_timeout,
                    keep_alive: config.keep_alive,
                },
            )
            .await;
            match end {
                Ok(SessionEnd::ConsumerClosed) => return Err(Closed),
                Ok(SessionEnd::PeerClosed) => (),
                Err(error) => {
                    tracing::warn!(board = ?link.board, addr = %link.addr, error = ?error,
                        "TCP session failed");
                    reporter.report(error).await?;
                }
            }
            tracing::info!(board = ?link.board, addr = %link.addr, "TCP board disconnected");
            reporter.notify(link.board, Event::Disconnected).await?;
            sleep(backoff.get_interval()).await;
        }
    };
    let result =
        tokio::select! { result = supervising => result, () = reporter.closed() => Err(Closed) };
    tracing::debug!(board = ?link.board, addr = %link.addr, "TCP supervisor stopped");
    result
}

#[cfg(test)]
mod tests {
    use crate::{
        model::AdjId,
        net::{
            Event, Reporter,
            tcp::{SendError, TcpError, spawn, test_support::*},
        },
    };
    use std::{
        net::{Ipv4Addr, SocketAddr},
        time::Duration,
    };
    use tokio::{
        io::{AsyncReadExt, AsyncWriteExt},
        net::{TcpListener, TcpSocket},
        time::timeout,
    };

    #[tokio::test]
    async fn offline_and_disconnected_orders_never_appear_after_connection_or_reconnection()
    -> TestResult {
        bounded(async {
            let socket = TcpSocket::new_v4()?;
            socket.bind(SocketAddr::from((Ipv4Addr::LOCALHOST, 0)))?;
            let addr = socket.local_addr()?; // Bound but not listening: no port-reuse race.
            let (reporter, mut sinks) = Reporter::channels(32, 64);
            let clients = spawn(config(addr), index(), reporter);
            assert!(matches!(
                clients.send(order(600, 11.0)).await,
                Err(SendError::Disconnected(BOARD))
            ));
            let listener = socket.listen(8)?;
            let (mut peer, _) = listener.accept().await?;
            connected(&mut sinks).await?;
            clients.send(order(600, 22.0)).await?;
            let mut bytes = [0; 3];
            peer.read_exact(&mut bytes).await?;
            assert_eq!(bytes, [0x58, 2, 22]);
            let old_session = clients
                .board(BOARD)
                .ok_or("missing board")?
                .endpoint
                .current_writer()
                .ok_or("missing session")?;
            drop(peer);
            assert!(matches!(
                event(&mut sinks).await?.event,
                Event::Disconnected
            ));
            assert!(matches!(
                clients.send(order(600, 33.0)).await,
                Err(SendError::Disconnected(BOARD))
            ));
            let (mut peer, _) = listener.accept().await?;
            connected(&mut sinks).await?;
            assert!(matches!(
                old_session.write_order(BOARD, &[0x58, 2, 44], LIMIT).await,
                Err(SendError::Disconnected(BOARD))
            ));
            clients.send(order(600, 55.0)).await?;
            peer.read_exact(&mut bytes).await?;
            assert_eq!(bytes, [0x58, 2, 55]);
            assert!(
                timeout(Duration::from_millis(20), peer.read(&mut bytes))
                    .await
                    .is_err()
            );
            let mut rejected = vec![];
            while let Ok(report) = sinks.errors.try_recv() {
                if let crate::net::Error::Tcp(TcpError::Send {
                    board,
                    order,
                    source,
                }) = report.error
                {
                    assert_eq!(board, BOARD);
                    assert_eq!(order, AdjId(600));
                    assert_eq!(source.kind(), std::io::ErrorKind::NotConnected);
                    rejected.push(order);
                }
            }
            assert_eq!(rejected.len(), 2);
            sinks.errors.close();
            peer_closed(&mut peer).await?;
            Ok(())
        })
        .await
    }

    #[tokio::test]
    async fn closing_either_consumer_stops_an_idle_session_and_invalidates_its_writer() -> TestResult
    {
        bounded(async {
            for errors in [false, true] {
                let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
                let (reporter, mut sinks) = Reporter::channels(16, 16);
                let clients = spawn(config(listener.local_addr()?), index(), reporter);
                let (mut peer, _) = listener.accept().await?;
                connected(&mut sinks).await?;
                let old = clients
                    .board(BOARD)
                    .ok_or("board missing")?
                    .endpoint
                    .current_writer()
                    .ok_or("session missing")?;
                if errors {
                    sinks.errors.close();
                } else {
                    sinks.notifications.close();
                }
                peer_closed(&mut peer).await?;
                assert!(matches!(
                    old.write_order(BOARD, &[0x58, 2, 22], LIMIT).await,
                    Err(SendError::Disconnected(BOARD))
                ));
            }
            Ok(())
        })
        .await
    }

    #[tokio::test]
    async fn receive_decode_errors_are_reported_before_reopening_the_session() -> TestResult {
        bounded(async {
            let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
            let (reporter, mut sinks) = Reporter::channels(16, 16);
            let clients = spawn(config(listener.local_addr()?), index(), reporter);
            let (mut peer, _) = listener.accept().await?;
            connected(&mut sinks).await?;
            peer.write_all(&[0xff; 375]).await?;
            let report = sinks.errors.recv().await.ok_or("missing decode error")?;
            assert!(matches!(
                report.error,
                crate::net::Error::Tcp(TcpError::Decode { board: BOARD, .. })
            ));
            assert!(matches!(
                event(&mut sinks).await?.event,
                Event::Disconnected
            ));
            let (mut peer, _) = listener.accept().await?;
            connected(&mut sinks).await?;
            clients.send(order(600, 22.0)).await?;
            let mut bytes = [0; 3];
            peer.read_exact(&mut bytes).await?;
            assert_eq!(bytes, [0x58, 2, 22]);
            sinks.notifications.close();
            Ok(())
        })
        .await
    }
}
