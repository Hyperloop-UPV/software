//! Session-scoped fault requests; unlike orders, they never survive reconnection.
//!
//! A board handle lives across reconnects, but a fault must target only the socket
//! that was active when the caller requested it. `Endpoint` therefore advertises
//! the current session's bounded sender, while that session owns the receiver in
//! `Active`. Every request carries one absolute deadline and a one-shot completion
//! signal. The writer checks the deadline/caller state before starting the frame,
//! then acknowledges only after `write_all` completes.

use std::future::Future;
use tokio::{
    sync::{mpsc, oneshot, watch},
    time::{Instant, timeout_at},
};

/// Stable handle to the fault-control queue of a board's current TCP session.
///
/// The endpoint itself survives reconnects with its `BoardHandle`. Its current
/// sender does not: the supervisor installs a fresh one for each session and
/// `Active::drop` clears it when that session ends. The `watch` sender is used as
/// a small shared cell; no task waits for watch changes, because a request must
/// either target the session that is active now or fail rather than migrate.
#[derive(Debug, Clone)]
pub(super) struct Endpoint {
    /// `None` while offline; otherwise the bounded sender for the active session.
    current: watch::Sender<Option<mpsc::Sender<Request>>>,
}

impl Default for Endpoint {
    fn default() -> Self {
        Self {
            // Keep the shared watch value; the receiver is unnecessary because
            // callers snapshot the current sender instead of waiting for changes.
            current: watch::channel(None).0,
        }
    }
}

impl Endpoint {
    /// Registers a new session and gives its writer the receiving end.
    ///
    /// Call only from the owning supervisor, and do not activate another session
    /// until the previous `Active` has been dropped. That sequential lifecycle is
    /// what makes clearing the shared endpoint on `Drop` unambiguous.
    pub(super) fn activate(&self) -> Active {
        // One queued request is enough: calls beyond it apply backpressure until
        // the writer takes a request, all within each caller's original deadline.
        let (sender, receiver) = mpsc::channel(1);
        // Replace any stale value before exposing the new session's sender.
        self.current.send_replace(Some(sender));
        Active {
            receiver,
            endpoint: self.clone(),
        }
    }

    /// Requests one fault write and returns whether the writer confirmed it.
    ///
    /// The sender is cloned before constructing the future, so the target session
    /// is fixed when this method is called, not when the returned future is first
    /// polled. Offline requests fail immediately and cannot wait for reconnection.
    /// One absolute deadline covers both waiting for queue capacity and awaiting
    /// the writer's completion signal. `true` means only that `write_all` finished;
    /// it is not a firmware acknowledgement or proof of fault execution.
    pub(super) fn request(&self, deadline: Instant) -> impl Future<Output = bool> + Send + 'static {
        // Snapshot the active connection now. Never subscribe and redirect this
        // request if the supervisor publishes a different session later.
        let sender = self.current.borrow().clone();
        async move {
            let Some(sender) = sender else { return false };
            // Avoid putting an already-expired request in the session queue.
            if Instant::now() >= deadline {
                return false;
            }
            // `complete` travels with the request to the writer; `completed` stays
            // with this caller and resolves only after the frame write succeeds.
            let (complete, completed) = oneshot::channel();
            // The timeout wraps queue admission and acknowledgement together. If
            // it expires after admission, dropping `completed` lets the writer
            // recognize and skip the request if it has not started the frame yet.
            matches!(
                timeout_at(deadline, async {
                    sender.send(Request { deadline, complete }).await.ok()?;
                    completed.await.ok()
                })
                .await,
                Ok(Some(()))
            )
        }
    }
}

#[derive(Debug)]
pub(super) struct Request {
    /// Absolute caller deadline; queueing and frame-boundary delay consume it too.
    pub(super) deadline: Instant,
    /// The writer sends this only after completing the entire fault frame.
    pub(super) complete: oneshot::Sender<()>,
}

impl Request {
    /// Whether the caller still awaits this request and enough time remains to start.
    ///
    /// The writer checks this at a frame boundary. Once it starts `write_all`, it
    /// does not cancel midway just because the caller timed out; that could leave
    /// a truncated frame on the stream. Instead the write itself uses the same
    /// absolute deadline and the normal per-frame write timeout.
    pub(super) fn pending(&self) -> bool {
        !self.complete.is_closed() && Instant::now() < self.deadline
    }
}

/// Owns a session's fault receiver and unregisters that session on drop.
///
/// Kept by the session writer for exactly its lifetime. Ordinary return, write/read
/// error, and cancellation all drop this guard, so the stable board endpoint stops
/// accepting requests for this connection. Dropping the receiver also discards any
/// requests still queued for it; they cannot leak into a later connection.
#[derive(Debug)]
pub(super) struct Active {
    /// Drained by the single writer that also serializes normal orders/heartbeats.
    pub(super) receiver: mpsc::Receiver<Request>,
    /// Shared registration to clear when this session is destroyed.
    endpoint: Endpoint,
}

impl Drop for Active {
    fn drop(&mut self) {
        // Clear availability before the receiver field is dropped. A concurrent
        // request either captured this sender already (and will fail with its
        // closed channel) or observes `None`; neither case can target a reconnect.
        self.endpoint.current.send_replace(None);
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{future::poll_fn, task::Poll, time::Duration};
    use tokio::time::advance;

    const LIMIT: Duration = Duration::from_millis(10);

    async fn poll_pending<F: Future>(mut future: std::pin::Pin<&mut F>) {
        // Run one poll without advancing paused time, asserting the future has
        // registered its waker and is waiting for a session event or deadline.
        poll_fn(|cx| {
            assert!(future.as_mut().poll(cx).is_pending());
            Poll::Ready(())
        })
        .await;
    }

    #[tokio::test(start_paused = true)]
    async fn offline_and_ended_sessions_fail_without_waiting_for_reconnection() {
        let endpoint = Endpoint::default();
        let started = Instant::now();
        // No active sender: an offline fault is not held for the next connection.
        assert!(!endpoint.request(started + LIMIT).await);
        let active = endpoint.activate();
        // Snapshot A, then end A and publish B before polling the request. It must
        // still fail against A and must not appear in B's newly created queue.
        let request = endpoint.request(started + LIMIT);
        drop(active);
        let mut next = endpoint.activate();
        assert!(!request.await);
        assert!(next.receiver.try_recv().is_err());
        assert_eq!(started.elapsed(), Duration::ZERO);
    }

    #[tokio::test(start_paused = true)]
    async fn session_cancellation_discards_queued_requests_and_marks_it_offline() {
        let endpoint = Endpoint::default();
        let active = endpoint.activate();
        let request = endpoint.request(Instant::now() + LIMIT);
        tokio::pin!(request);
        // The request is admitted to A's queue but its writer has not consumed it.
        poll_pending(request.as_mut()).await;
        drop(active);
        assert!(!request.await);
        assert!(!endpoint.request(Instant::now() + LIMIT).await);
        let mut next = endpoint.activate();
        assert!(next.receiver.try_recv().is_err());
    }

    #[tokio::test(start_paused = true)]
    async fn capacity_and_completion_share_one_deadline() -> Result<(), Box<dyn std::error::Error>>
    {
        let endpoint = Endpoint::default();
        let mut active = endpoint.activate();
        let started = Instant::now();
        let first = endpoint.request(started + LIMIT);
        let second = endpoint.request(started + LIMIT);
        tokio::pin!(first, second);
        poll_pending(first.as_mut()).await;
        poll_pending(second.as_mut()).await; // First request occupies the one-slot queue.
        advance(LIMIT / 2).await;
        // Free capacity halfway through the common deadline, but do not acknowledge
        // the first request. The second can enqueue, yet still only has the original
        // remaining half-budget to wait for its own completion.
        let _first = active
            .receiver
            .recv()
            .await
            .ok_or("missing first request")?;
        poll_pending(second.as_mut()).await; // Capacity is available halfway through.
        assert!(!second.await);
        assert_eq!(started.elapsed(), LIMIT); // Not LIMIT + LIMIT / 2.
        // Timed-out/cancelled queued requests remain harmless until dequeued; the
        // writer's pending() check tells it to discard them without writing.
        let expired = active
            .receiver
            .recv()
            .await
            .ok_or("missing queued request")?;
        assert!(!expired.pending());
        assert!(!first.await);
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn cancellation_marks_a_pending_request_without_writing_it()
    -> Result<(), Box<dyn std::error::Error>> {
        let endpoint = Endpoint::default();
        let mut active = endpoint.activate();
        {
            // Dropping this caller closes its completion receiver while its request
            // may already be waiting in the session queue.
            let request = endpoint.request(Instant::now() + LIMIT);
            tokio::pin!(request);
            poll_pending(request.as_mut()).await;
        }
        let request = active
            .receiver
            .recv()
            .await
            .ok_or("missing cancelled request")?;
        assert!(!request.pending());
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn zero_budget_never_queues_a_request() {
        let endpoint = Endpoint::default();
        let mut active = endpoint.activate();
        // A deadline equal to now is expired and should not consume queue capacity.
        assert!(!endpoint.request(Instant::now()).await);
        assert!(active.receiver.try_recv().is_err());
    }
}
