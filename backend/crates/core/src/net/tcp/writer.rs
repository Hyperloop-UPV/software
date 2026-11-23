//! Complete-frame writes shared by orders, heartbeats and faults.
//!
//! Each TCP session owns one `SessionWriter`, shared through `Arc`. It holds the
//! socket's write half behind an asynchronous mutex. Every outgoing frame uses
//! that same mutex, keeping it until `write_all` finishes so bytes from concurrent
//! frames cannot interleave. Writes run in their callers' futures; waiting sends
//! stay with those callers, and no frame kind has special priority.
//!
//! `write_order` converts a duration budget into a deadline and returns a
//! board-specific `SendError`. `write_control` accepts an existing deadline for
//! heartbeats and faults. Both use `write_frame`, with one deadline covering the
//! mutex wait and the complete write. Success confirms local socket acceptance,
//! not firmware receipt or execution.
//!
//! The write path has three phases: `acquire_socket` waits for exclusive access,
//! `FrameGuard::write_all` writes the bytes, and `FrameGuard::finish` handles the
//! result before releasing the mutex. Expiry or cancellation while waiting sends
//! nothing and leaves the active frame untouched. After acquisition, the guard
//! closes the session on failure or cancellation before releasing exclusivity,
//! preventing another frame from following a possibly incomplete one.
//!
//! The `ended` watch signal tells the session owner and pending writes to stop.
//! `close()` drops an idle socket immediately; an active write drops it when it
//! observes closure or is cancelled. Captured writers remain tied to this session,
//! and failed frames are never replayed on a new connection.
//!
//! `FailureReporter` assigns write errors to the order caller or supervisor.
//! The first terminal `WriteFailure` is retained to avoid duplicate reports;
//! `take_unreported_failure` returns only errors still owed to the supervisor.
//! Cancelling an acquired write also records a supervisor error, since its caller
//! can no longer receive the result. `W` defaults to the real TCP write half;
//! tests substitute scripted writers to exercise partial writes and cancellation.

use super::SendError;
use crate::model::BoardId;
use std::{
    io,
    sync::{Arc, Mutex as StdMutex, MutexGuard as StdGuard},
    time::Duration,
};
use tokio::{
    io::{AsyncWrite, AsyncWriteExt},
    net::tcp::OwnedWriteHalf,
    sync::{Mutex, MutexGuard, watch},
    time::{Instant, timeout_at},
};

/// One exclusive socket per session. All frames wait for the same mutex.
#[derive(Debug)]
pub(super) struct SessionWriter<W = OwnedWriteHalf> {
    socket: Mutex<Option<W>>,
    ended: watch::Sender<bool>,
    // Keep the first failure's reporting owner to avoid duplicate error reports.
    failure: StdMutex<Option<WriteFailure>>,
}

#[derive(Debug)]
enum WriteFailure {
    // The order caller owns this report; the supervisor must not duplicate it.
    Caller,
    Supervisor(io::Error),
}

/// Determines who reports a failed write: the order caller or the session supervisor.
#[derive(Debug, Clone, Copy)]
enum FailureReporter {
    Caller,
    Supervisor,
}

pub(super) fn lock<T>(mutex: &StdMutex<T>) -> StdGuard<'_, T> {
    mutex
        .lock()
        .unwrap_or_else(std::sync::PoisonError::into_inner)
}

impl<W> SessionWriter<W> {
    pub(super) fn new(socket: W) -> Self {
        Self {
            socket: Mutex::new(Some(socket)),
            ended: watch::channel(false).0,
            failure: StdMutex::new(None),
        }
    }

    /// Invalidate this session and wake both active and waiting writes.
    pub(super) fn close(&self) {
        self.ended.send_replace(true);
        if let Ok(mut socket) = self.socket.try_lock() {
            socket.take();
        }
    }

    pub(super) fn is_closed(&self) -> bool {
        *self.ended.borrow()
    }

    pub(super) async fn closed(&self) {
        let mut ended = self.ended.subscribe();
        let _ = ended.wait_for(|ended| *ended).await;
    }

    /// Take a terminal error that still needs reporting by the session supervisor.
    pub(super) fn take_unreported_failure(&self) -> Option<io::Error> {
        match lock(&self.failure).take() {
            Some(WriteFailure::Supervisor(error)) => Some(error),
            _ => None,
        }
    }

    fn fail(&self, failure: WriteFailure) {
        lock(&self.failure).get_or_insert(failure);
        self.close();
    }

    /// Waiting owns no frame guard: cancellation or expiry here leaves the session usable.
    async fn acquire_socket(
        &self,
        deadline: Instant,
    ) -> Result<MutexGuard<'_, Option<W>>, FrameError> {
        if self.is_closed() {
            return Err(FrameError::Closed);
        }
        if Instant::now() >= deadline {
            return Err(FrameError::Timeout);
        }
        let socket = tokio::select! {
            biased;
            () = self.closed() => return Err(FrameError::Closed),
            result = timeout_at(deadline, self.socket.lock()) => {
                result.map_err(|_| FrameError::Timeout)?
            }
        };
        if Instant::now() >= deadline {
            return Err(FrameError::Timeout);
        }
        Ok(socket)
    }
}

impl<W: AsyncWrite + Unpin> SessionWriter<W> {
    /// One budget covers waiting for the writer and writing the complete frame.
    pub(super) async fn write_order(
        &self,
        board: BoardId,
        bytes: &[u8],
        budget: Duration,
    ) -> Result<(), SendError> {
        let deadline = Instant::now() + budget;
        self.write_frame(bytes, deadline, FailureReporter::Caller)
            .await
            .map_err(|error| error.into_send_error(board))
    }

    /// Heartbeats and faults share order exclusivity; their failures go to the supervisor.
    pub(super) async fn write_control(
        &self,
        bytes: &[u8],
        deadline: Instant,
    ) -> Result<(), FrameError> {
        self.write_frame(bytes, deadline, FailureReporter::Supervisor)
            .await
    }

    /// Acquire exclusivity, write one frame, then handle its result before unlocking.
    async fn write_frame(
        &self,
        bytes: &[u8],
        deadline: Instant,
        failure_reporter: FailureReporter,
    ) -> Result<(), FrameError> {
        tracing::trace!(writer = ?std::ptr::from_ref(self), frame_len = bytes.len(),
            ?failure_reporter, "Waiting for TCP writer");
        let socket = match self.acquire_socket(deadline).await {
            Ok(socket) => socket,
            Err(error) => {
                tracing::debug!(writer = ?std::ptr::from_ref(self), frame_len = bytes.len(),
                    stage = "waiting", ?error, "TCP frame write could not start");
                return Err(error);
            }
        };
        // From here onward, cancellation must close the socket before releasing it.
        let mut guard = FrameGuard {
            session: self,
            socket,
            finished: false,
        };
        tracing::trace!(writer = ?std::ptr::from_ref(self), frame_len = bytes.len(),
            "TCP writer acquired");
        let result = tokio::select! {
            biased;
            () = self.closed() => Err(FrameError::Closed),
            result = guard.write_all(bytes, deadline) => result,
        };
        let result = guard.finish(result, failure_reporter);
        match &result {
            Ok(()) => tracing::trace!(writer = ?std::ptr::from_ref(self), frame_len = bytes.len(),
                "TCP frame write completed"),
            Err(error) => {
                tracing::debug!(writer = ?std::ptr::from_ref(self), frame_len = bytes.len(),
                stage = "writing", ?error, "TCP frame write ended before completion")
            }
        }
        result
    }
}

#[derive(Debug)]
pub(super) enum FrameError {
    Closed,
    Timeout,
    Io(io::Error),
}
impl FrameError {
    fn into_send_error(self, board: BoardId) -> SendError {
        match self {
            Self::Timeout => SendError::Timeout(board),
            Self::Closed => SendError::Disconnected(board),
            Self::Io(source) => match source.kind() {
                io::ErrorKind::TimedOut => SendError::Timeout(board),
                io::ErrorKind::NotConnected => SendError::Disconnected(board),
                _ => SendError::Write {
                    board,
                    source: Arc::new(source),
                },
            },
        }
    }

    fn to_io_error(&self) -> io::Error {
        match self {
            Self::Closed => io::Error::new(io::ErrorKind::NotConnected, "TCP session ended"),
            Self::Timeout => io::Error::new(io::ErrorKind::TimedOut, "TCP frame write timed out"),
            Self::Io(error) => io::Error::new(error.kind(), error.to_string()),
        }
    }
}

/// Dropping an unfinished write closes its socket before releasing exclusivity.
struct FrameGuard<'a, W> {
    session: &'a SessionWriter<W>,
    socket: MutexGuard<'a, Option<W>>,
    // Both success and handled failure disarm cancellation cleanup.
    finished: bool,
}

impl<W: AsyncWrite + Unpin> FrameGuard<'_, W> {
    async fn write_all(&mut self, bytes: &[u8], deadline: Instant) -> Result<(), FrameError> {
        let socket = self.socket.as_mut().ok_or(FrameError::Closed)?;
        timeout_at(deadline, socket.write_all(bytes))
            .await
            .map_err(|_| FrameError::Timeout)?
            .map_err(FrameError::Io)
    }
}

impl<W> FrameGuard<'_, W> {
    fn finish(
        mut self,
        result: Result<(), FrameError>,
        failure_reporter: FailureReporter,
    ) -> Result<(), FrameError> {
        if let Err(error) = &result {
            self.session.fail(match failure_reporter {
                FailureReporter::Caller => WriteFailure::Caller,
                FailureReporter::Supervisor => WriteFailure::Supervisor(error.to_io_error()),
            });
            self.socket.take();
        }
        self.finished = true;
        result
    }
}

impl<W> Drop for FrameGuard<'_, W> {
    fn drop(&mut self) {
        if !self.finished {
            self.session.fail(WriteFailure::Supervisor(io::Error::new(
                io::ErrorKind::Interrupted,
                "TCP frame write cancelled",
            )));
            self.socket.take();
            tracing::debug!(writer = ?std::ptr::from_ref(self.session), stage = "writing",
                "TCP frame write cancelled; session closed");
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::net::tcp::SendError;
    use crate::net::tcp::test_support::writes::*;

    #[tokio::test]
    async fn teardown_wakes_an_inflight_send_and_invalidates_old_session_references() {
        let (writer, trace) = setup([Step::Write(1), Step::Pending]);
        let mut order = Box::pin(writer.write_order(BOARD, &[2, 3], BUDGET));
        pending_once(order.as_mut()).await;
        writer.close();
        assert!(matches!(order.await, Err(SendError::Disconnected(BOARD))));
        assert!(lock(&trace).dropped);
        assert_eq!(lock(&trace).bytes, [2]);
    }

    #[tokio::test(start_paused = true)]
    async fn concurrent_orders_wait_and_write_whole_frames_in_turn() {
        let (writer, trace) = setup([Step::Write(1), Step::Pending]);
        let mut first = Box::pin(writer.write_order(BOARD, &[2, 3], BUDGET));
        pending_once(first.as_mut()).await;
        let mut second = Box::pin(writer.write_order(BOARD, &[8, 9], BUDGET));
        pending_once(second.as_mut()).await;
        assert_eq!(lock(&trace).bytes, [2]);
        lock(&trace).resume = true;
        assert!(first.await.is_ok());
        assert!(second.await.is_ok());
        assert_eq!(lock(&trace).bytes, [2, 3, 8, 9]);
        assert!(!lock(&trace).dropped);
    }

    #[tokio::test(start_paused = true)]
    async fn waiting_timeout_does_not_cancel_the_active_frame_or_deliver_later() {
        let (writer, trace) = setup([Step::Write(1), Step::Pending]);
        let mut first = Box::pin(writer.write_order(BOARD, &[2, 3], BUDGET * 3));
        pending_once(first.as_mut()).await;
        let started = Instant::now();
        assert!(matches!(
            writer.write_order(BOARD, &[8, 9], BUDGET).await,
            Err(SendError::Timeout(BOARD))
        ));
        assert_eq!(started.elapsed(), BUDGET);
        assert_eq!(lock(&trace).bytes, [2]);
        assert!(!lock(&trace).dropped);
        lock(&trace).resume = true;
        assert!(first.await.is_ok());
        assert!(writer.write_order(BOARD, &[4, 5], BUDGET).await.is_ok());
        assert_eq!(lock(&trace).bytes, [2, 3, 4, 5]);
    }

    #[tokio::test]
    async fn cancelling_a_waiter_leaves_the_active_frame_and_session_usable() {
        let (writer, trace) = setup([Step::Write(1), Step::Pending]);
        let mut first = Box::pin(writer.write_order(BOARD, &[2, 3], BUDGET));
        pending_once(first.as_mut()).await;
        let mut second = Box::pin(writer.write_order(BOARD, &[8, 9], BUDGET));
        pending_once(second.as_mut()).await;
        drop(second);
        assert!(!lock(&trace).dropped);
        lock(&trace).resume = true;
        assert!(first.await.is_ok());
        assert!(writer.write_order(BOARD, &[4, 5], BUDGET).await.is_ok());
        assert_eq!(lock(&trace).bytes, [2, 3, 4, 5]);
        assert!(writer.take_unreported_failure().is_none());
    }

    #[tokio::test]
    async fn teardown_wakes_waiters_without_writing_their_frames() {
        let (writer, trace) = setup([Step::Write(1), Step::Pending]);
        let mut first = Box::pin(writer.write_order(BOARD, &[2, 3], BUDGET));
        pending_once(first.as_mut()).await;
        let mut second = Box::pin(writer.write_order(BOARD, &[8, 9], BUDGET));
        pending_once(second.as_mut()).await;
        writer.close();
        assert!(matches!(second.await, Err(SendError::Disconnected(BOARD))));
        assert!(matches!(first.await, Err(SendError::Disconnected(BOARD))));
        assert_eq!(lock(&trace).bytes, [2]);
        assert!(lock(&trace).dropped);
    }

    #[tokio::test(start_paused = true)]
    async fn zero_budget_writes_nothing_and_leaves_the_session_usable() {
        let (writer, trace) = setup([]);
        assert!(matches!(
            writer.write_order(BOARD, &[8, 9], Duration::ZERO).await,
            Err(SendError::Timeout(BOARD))
        ));
        assert_eq!(lock(&trace).calls, 0);
        assert!(writer.write_order(BOARD, &[2, 3], BUDGET).await.is_ok());
        assert_eq!(lock(&trace).bytes, [2, 3]);
    }

    #[tokio::test]
    async fn dropping_an_unpolled_order_does_not_take_or_close_the_writer() {
        let (writer, trace) = setup([]);
        let order = Box::pin(writer.write_order(BOARD, &[2, 3], BUDGET));
        drop(order);
        assert!(lock(&trace).bytes.is_empty());
        assert!(!lock(&trace).dropped);
        assert!(writer.write_order(BOARD, &[4, 5], BUDGET).await.is_ok());
        assert_eq!(lock(&trace).bytes, [4, 5]);
    }

    #[tokio::test]
    async fn success_finishes_every_partial_write_before_returning() {
        let (writer, trace) = setup([Step::Write(1), Step::Write(1)]);
        assert!(
            writer
                .write_order(BOARD, &[2, 3, 4, 5], BUDGET)
                .await
                .is_ok()
        );
        assert_eq!(lock(&trace).bytes, [2, 3, 4, 5]);
        assert_eq!(lock(&trace).calls, 3);
        assert!(!lock(&trace).dropped);
    }

    #[tokio::test(start_paused = true)]
    async fn timeout_after_a_prefix_closes_the_socket_and_never_replays() {
        let (writer, trace) = setup([Step::Write(1), Step::Pending]);
        let started = Instant::now();
        assert!(matches!(
            writer.write_order(BOARD, &[2, 3], BUDGET).await,
            Err(SendError::Timeout(BOARD))
        ));
        assert_eq!(started.elapsed(), BUDGET);
        assert_eq!(lock(&trace).bytes, [2]);
        assert!(lock(&trace).dropped);
        // Ordinary failed orders report through BoardHandle rather than producing a
        // second session Write error. The terminal condition still ends the session.
        assert!(writer.take_unreported_failure().is_none());
        writer.closed().await;
        assert!(matches!(
            writer.write_order(BOARD, &[4, 5], BUDGET).await,
            Err(SendError::Disconnected(BOARD))
        ));
    }

    #[tokio::test]
    async fn io_failure_and_zero_progress_close_before_another_frame_can_start() {
        for (step, expected) in [
            (
                Step::Fail(io::ErrorKind::BrokenPipe),
                io::ErrorKind::BrokenPipe,
            ),
            (Step::Zero, io::ErrorKind::WriteZero),
        ] {
            let (writer, trace) = setup([Step::Write(1), step]);
            assert!(matches!(writer.write_order(BOARD, &[2, 3], BUDGET).await,
                Err(SendError::Write { board: BOARD, source }) if source.kind() == expected));
            assert_eq!(lock(&trace).bytes, [2]);
            assert!(lock(&trace).dropped);
        }
    }

    #[tokio::test]
    async fn socket_reported_timeout_and_disconnect_keep_their_send_classification() {
        for kind in [io::ErrorKind::TimedOut, io::ErrorKind::NotConnected] {
            let (writer, trace) = setup([Step::Fail(kind)]);
            let result = writer.write_order(BOARD, &[2, 3], BUDGET).await;
            assert!(matches!(
                (kind, result),
                (io::ErrorKind::TimedOut, Err(SendError::Timeout(BOARD)))
                    | (
                        io::ErrorKind::NotConnected,
                        Err(SendError::Disconnected(BOARD))
                    )
            ));
            assert!(lock(&trace).dropped);
            assert!(writer.take_unreported_failure().is_none());
        }
    }

    #[tokio::test]
    async fn cancellation_closes_before_unlock_and_reports_the_interrupted_write() {
        let (writer, trace) = setup([Step::Write(1), Step::Pending]);
        let mut order = Box::pin(writer.write_order(BOARD, &[2, 3], BUDGET));
        pending_once(order.as_mut()).await;
        drop(order);
        assert_eq!(
            writer.take_unreported_failure().map(|error| error.kind()),
            Some(io::ErrorKind::Interrupted)
        );
        assert!(lock(&trace).dropped);
        assert_eq!(lock(&trace).bytes, [2]);
        assert!(matches!(
            writer.write_order(BOARD, &[4, 5], BUDGET).await,
            Err(SendError::Disconnected(BOARD))
        ));
    }
}
