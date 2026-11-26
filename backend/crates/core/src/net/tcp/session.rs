//! One connection's reader, keep-alive loop, and shared frame writer.
use super::{TcpError, endpoint, keep_alive, reader, writer::SessionWriter};
use crate::{
    model::BoardId,
    net::{Event, Reporter},
    protocol::Index,
};
use std::sync::Arc;
use tokio::net::TcpStream;

/// Session completion without a transport failure.
#[derive(Debug, PartialEq, Eq)]
pub(super) enum SessionEnd {
    PeerClosed,
    ConsumerClosed,
}

/// Registers a fresh writer before Connected, then drives reads and control I/O.
/// Orders execute in their callers through that same exclusive writer. The registration
/// guard closes the writer on every exit, including cancellation while publishing
/// Connected. Old session references are invalidated and cannot target a reconnect.
/// A failed order reports [`TcpError::Send`] through its caller; cancelled writes and
/// control-write failures are reported as [`TcpError::Write`] by the supervisor.
pub(super) async fn run(
    stream: TcpStream,
    board: BoardId,
    index: &Index,
    reporter: &Reporter,
    endpoint: &endpoint::Endpoint,
    settings: keep_alive::Settings,
) -> Result<SessionEnd, TcpError> {
    let (read_half, write_half) = stream.into_split();
    let writer = Arc::new(SessionWriter::new(write_half));
    let registration = endpoint.register(Arc::clone(&writer));
    if reporter.notify(board, Event::Connected).await.is_err() {
        return Ok(SessionEnd::ConsumerClosed);
    }
    let result = tokio::select! {
        biased;
        () = writer.closed() => Ok(SessionEnd::PeerClosed),
        result = reader::receive(read_half, board, index, reporter) => result.map(|end| match end {
            reader::ReceiveEnd::PeerClosed => SessionEnd::PeerClosed,
            reader::ReceiveEnd::ConsumerClosed => SessionEnd::ConsumerClosed,
        }),
        () = keep_alive::run_keep_alive(&writer, settings) => Ok(SessionEnd::PeerClosed),
    };
    // Close and unregister before collecting a terminal write failure.
    drop(registration);
    if let Some(source) = writer.take_unreported_failure() {
        return Err(TcpError::Write { board, source });
    }
    result
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::net::tcp::{SendError, test_support::*};
    use std::{future::Future, time::Duration};

    #[tokio::test]
    async fn cancellation_during_connected_publication_closes_and_unregisters_the_session()
    -> TestResult {
        bounded(async {
            let (stream, mut peer) = socket_pair(LIMIT).await?;
            let (reporter, mut sinks) = Reporter::channels(1, 16);
            reporter.notify(BOARD, Event::Connected).await?; // Fill notification capacity.
            let endpoint = endpoint::Endpoint::default();
            let index = index();
            let mut session = Box::pin(run(
                stream,
                BOARD,
                &index,
                &reporter,
                &endpoint,
                keep_alive::Settings {
                    write_timeout: LIMIT,
                    keep_alive: Duration::ZERO,
                },
            ));
            std::future::poll_fn(|cx| {
                assert!(session.as_mut().poll(cx).is_pending());
                std::task::Poll::Ready(())
            })
            .await;
            let old = endpoint.current_writer().ok_or("session not registered")?;
            drop(session);
            assert!(endpoint.current_writer().is_none());
            assert!(
                !endpoint
                    .request_fault(tokio::time::Instant::now() + LIMIT)
                    .await
            );
            assert!(matches!(
                old.write_order(BOARD, &[2, 3], LIMIT).await,
                Err(SendError::Disconnected(BOARD))
            ));
            peer_closed(&mut peer).await?;
            assert!(sinks.errors.try_recv().is_err());
            Ok(())
        })
        .await
    }
}
