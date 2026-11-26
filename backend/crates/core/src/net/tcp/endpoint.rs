//! Shared access point to one board's current TCP session writer.
//!
//! An `Endpoint` is created once per configured board and shared between its
//! handle and connection supervisor. It holds an optional `Arc<SessionWriter>`:
//! `None` before a connection is registered or after its registration is removed,
//! and `Some(writer)` while that session is registered. Cloning the endpoint
//! shares this same slot, so every clone observes registration changes.
//!
//! Each new connection registers a fresh writer. `current_writer()` captures a
//! reference for an order; `request_fault()` captures one and sends the reserved
//! fault frame. The endpoint lock is released before any socket I/O. Connection
//! establishment and retries belong to the supervisor and connection module.
//!
//! The returned `Registration` guard ties the writer to the session's lifetime.
//! Dropping it closes the writer and clears the slot, invalidating references
//! retained by pending sends. The endpoint survives reconnections, but a captured
//! writer always belongs to its original session: pending writes never move to
//! the next connection.

use super::writer::{SessionWriter, lock};
use std::sync::{Arc, Mutex};
use tokio::{io::AsyncWrite, net::tcp::OwnedWriteHalf, time::Instant};

#[derive(Debug)]
pub(super) struct Endpoint<W = OwnedWriteHalf> {
    current: Arc<Mutex<Option<Arc<SessionWriter<W>>>>>,
}

impl<W> Default for Endpoint<W> {
    fn default() -> Self {
        Self {
            current: Arc::new(Mutex::new(None)),
        }
    }
}

impl<W> Clone for Endpoint<W> {
    fn clone(&self) -> Self {
        Self {
            current: Arc::clone(&self.current),
        }
    }
}

impl<W> Endpoint<W> {
    /// Capture the current writer without holding the endpoint lock during I/O.
    pub(super) fn current_writer(&self) -> Option<Arc<SessionWriter<W>>> {
        lock(&self.current).clone()
    }

    /// The supervisor drops the previous registration before installing another.
    pub(super) fn register(&self, writer: Arc<SessionWriter<W>>) -> Registration<W> {
        *lock(&self.current) = Some(Arc::clone(&writer));
        tracing::trace!(writer = ?Arc::as_ptr(&writer), "TCP session writer registered");
        Registration {
            writer,
            endpoint: self.clone(),
        }
    }
}

impl<W: AsyncWrite + Unpin + Send + 'static> Endpoint<W> {
    /// Request a fault on the session captured now; true confirms a complete local write.
    /// Keep this capture outside the future so delayed polling cannot target a reconnect.
    pub(super) fn request_fault(
        &self,
        deadline: Instant,
    ) -> impl Future<Output = bool> + Send + 'static {
        let writer = self.current_writer();
        async move {
            let Some(writer) = writer else { return false };
            writer.write_control(&[0, 0], deadline).await.is_ok()
        }
    }
}

/// Removing a session also invalidates all references retained by pending callers.
#[derive(Debug)]
pub(super) struct Registration<W> {
    writer: Arc<SessionWriter<W>>,
    endpoint: Endpoint<W>,
}

impl<W> Drop for Registration<W> {
    fn drop(&mut self) {
        self.writer.close();
        *lock(&self.endpoint.current) = None;
        tracing::trace!(writer = ?Arc::as_ptr(&self.writer), "TCP session writer unregistered");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::net::tcp::{SendError, test_support::writes::*};

    #[tokio::test]
    async fn registration_invalidates_orders_and_faults_and_never_retargets_a_reconnect() {
        let endpoint = Endpoint::default();
        let (writer, trace) = setup([]);
        let writer = Arc::new(writer);
        let active = endpoint.register(Arc::clone(&writer));
        assert!(
            endpoint
                .current_writer()
                .is_some_and(|current| Arc::ptr_eq(&writer, &current))
        );
        let old_fault = endpoint.request_fault(Instant::now() + BUDGET);
        drop(active);
        assert!(endpoint.current_writer().is_none());
        let (next, next_trace) = setup([]);
        let _next = endpoint.register(Arc::new(next));
        assert!(!old_fault.await);
        assert!(matches!(
            writer.write_order(BOARD, &[2, 3], BUDGET).await,
            Err(SendError::Disconnected(BOARD))
        ));
        assert!(lock(&trace).dropped);
        assert!(lock(&next_trace).bytes.is_empty());
        assert!(endpoint.request_fault(Instant::now() + BUDGET).await);
        assert_eq!(lock(&next_trace).bytes, [0, 0]);
    }

    #[tokio::test(start_paused = true)]
    async fn waiting_fault_expiry_or_cancellation_never_interrupts_an_order() {
        let (writer, trace, endpoint, _active) =
            setup_registered_writer([Step::Write(1), Step::Pending]);
        let mut order = Box::pin(writer.write_order(BOARD, &[2, 3], BUDGET * 3));
        pending_once(order.as_mut()).await;
        let mut cancelled = Box::pin(endpoint.request_fault(Instant::now() + BUDGET));
        pending_once(cancelled.as_mut()).await;
        drop(cancelled);
        assert!(!endpoint.request_fault(Instant::now() + BUDGET).await);
        assert!(!lock(&trace).dropped);
        lock(&trace).resume = true;
        assert!(order.await.is_ok());
        assert_eq!(lock(&trace).bytes, [2, 3]);
        assert!(endpoint.request_fault(Instant::now() + BUDGET).await);
        assert_eq!(lock(&trace).bytes, [2, 3, 0, 0]);
    }

    #[tokio::test]
    async fn faults_wait_for_complete_orders_and_orders_wait_for_faults() {
        let (writer, trace, endpoint, _active) =
            setup_registered_writer([Step::Write(1), Step::Pending]);
        let mut order = Box::pin(writer.write_order(BOARD, &[2, 3], BUDGET));
        pending_once(order.as_mut()).await;
        let mut fault = Box::pin(endpoint.request_fault(Instant::now() + BUDGET));
        pending_once(fault.as_mut()).await;
        lock(&trace).resume = true;
        assert!(order.await.is_ok());
        assert!(fault.await);
        assert_eq!(lock(&trace).bytes, [2, 3, 0, 0]);

        let (writer, trace, endpoint, _active) =
            setup_registered_writer([Step::Write(1), Step::Pending]);
        let mut fault = Box::pin(endpoint.request_fault(Instant::now() + BUDGET));
        pending_once(fault.as_mut()).await;
        let mut order = Box::pin(writer.write_order(BOARD, &[2, 3], BUDGET));
        pending_once(order.as_mut()).await;
        assert_eq!(lock(&trace).bytes, [0]);
        lock(&trace).resume = true;
        assert!(fault.await);
        assert!(order.await.is_ok());
        assert_eq!(lock(&trace).bytes, [0, 0, 2, 3]);
    }

    #[tokio::test]
    async fn cancelling_a_partial_fault_closes_and_reports_the_session() {
        let (writer, trace, endpoint, _active) =
            setup_registered_writer([Step::Write(1), Step::Pending]);
        let mut fault = Box::pin(endpoint.request_fault(Instant::now() + BUDGET));
        pending_once(fault.as_mut()).await;
        drop(fault);
        assert!(lock(&trace).dropped);
        assert_eq!(lock(&trace).bytes, [0]);
        assert_eq!(
            writer.take_unreported_failure().map(|error| error.kind()),
            Some(std::io::ErrorKind::Interrupted)
        );
        assert!(!endpoint.request_fault(Instant::now() + BUDGET).await);
    }

    #[tokio::test(start_paused = true)]
    async fn offline_and_expired_faults_write_nothing() {
        let endpoint = Endpoint::<tokio::io::Sink>::default();
        assert!(!endpoint.request_fault(Instant::now() + BUDGET).await);
        let (_writer, trace, endpoint, _active) = setup_registered_writer([]);
        assert!(!endpoint.request_fault(Instant::now()).await);
        assert_eq!(lock(&trace).calls, 0);
        assert!(endpoint.request_fault(Instant::now() + BUDGET).await);
        assert_eq!(lock(&trace).bytes, [0, 0]);
    }
}
