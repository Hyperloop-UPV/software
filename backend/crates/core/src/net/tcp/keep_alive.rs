//! Periodic keep-alive writes through the same writer as orders and faults.
use super::writer::SessionWriter;
use std::time::Duration;
use tokio::{
    io::AsyncWrite,
    time::{Instant, sleep},
};

#[derive(Debug, Clone, Copy)]
pub(super) struct Settings {
    pub(super) write_timeout: Duration,
    pub(super) keep_alive: Duration,
}

const KEEP_ALIVE_FRAME: [u8; 2] = [1, 0];

/// Wait one period after each heartbeat; never accumulate overdue sends.
/// Faults are written directly through the session writer, without a control queue.
pub(super) async fn run_keep_alive<W: AsyncWrite + Unpin>(
    writer: &SessionWriter<W>,
    settings: Settings,
) {
    if settings.keep_alive.is_zero() {
        writer.closed().await;
        return;
    }
    loop {
        tokio::select! {
            biased;
            () = writer.closed() => return,
            () = sleep(settings.keep_alive) => {},
        }
        let deadline = Instant::now() + settings.write_timeout;
        tracing::trace!(writer = ?std::ptr::from_ref(writer), "Attempting TCP keep-alive write");
        let result = writer.write_control(&KEEP_ALIVE_FRAME, deadline).await;
        tracing::trace!(writer = ?std::ptr::from_ref(writer), ?result,
            "TCP keep-alive write attempt finished");
        // An expired mutex wait skips this heartbeat; an incomplete write closes the session.
        if result.is_err() && writer.is_closed() {
            return;
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::net::tcp::{
        test_support::writes::*,
        writer::{FrameError, lock},
    };
    use tokio::time::advance;

    #[tokio::test(start_paused = true)]
    async fn heartbeat_waits_one_period_and_rearms_without_catchup() {
        let (writer, trace) = setup([]);
        let mut keep_alive = Box::pin(run_keep_alive(&writer, keep_alive_settings(BUDGET)));
        pending_once(keep_alive.as_mut()).await;
        assert!(lock(&trace).bytes.is_empty());
        assert!(writer.write_order(BOARD, &[2, 3], BUDGET).await.is_ok());
        advance(BUDGET * 3).await;
        pending_once(keep_alive.as_mut()).await;
        assert_eq!(lock(&trace).bytes, [2, 3, 1, 0]);
        pending_once(keep_alive.as_mut()).await;
        assert_eq!(lock(&trace).bytes, [2, 3, 1, 0]);
        advance(BUDGET).await;
        pending_once(keep_alive.as_mut()).await;
        assert_eq!(lock(&trace).bytes, [2, 3, 1, 0, 1, 0]);
    }

    #[tokio::test(start_paused = true)]
    async fn orders_wait_for_a_partial_heartbeat_without_interleaving() {
        let (writer, trace) = setup([Step::Write(1), Step::Pending]);
        let mut keep_alive = Box::pin(run_keep_alive(
            &writer,
            Settings {
                write_timeout: BUDGET * 3,
                keep_alive: BUDGET,
            },
        ));
        pending_once(keep_alive.as_mut()).await;
        advance(BUDGET).await;
        pending_once(keep_alive.as_mut()).await;
        assert_eq!(lock(&trace).bytes, [1]);
        let mut order = Box::pin(writer.write_order(BOARD, &[2, 3], BUDGET * 3));
        pending_once(order.as_mut()).await;
        lock(&trace).resume = true;
        pending_once(keep_alive.as_mut()).await;
        assert!(order.await.is_ok());
        assert_eq!(lock(&trace).bytes, [1, 0, 2, 3]);
        advance(BUDGET).await;
        pending_once(keep_alive.as_mut()).await;
        assert_eq!(lock(&trace).bytes, [1, 0, 2, 3, 1, 0]);
    }

    #[tokio::test(start_paused = true)]
    async fn heartbeat_wait_timeout_leaves_the_active_order_untouched() {
        let (writer, trace) = setup([Step::Write(1), Step::Pending]);
        let mut order = Box::pin(writer.write_order(BOARD, &[2, 3], BUDGET * 4));
        pending_once(order.as_mut()).await;
        let mut keep_alive = Box::pin(run_keep_alive(&writer, keep_alive_settings(BUDGET)));
        pending_once(keep_alive.as_mut()).await;
        advance(BUDGET).await;
        pending_once(keep_alive.as_mut()).await;
        advance(BUDGET).await;
        pending_once(keep_alive.as_mut()).await;
        assert!(!lock(&trace).dropped);
        lock(&trace).resume = true;
        assert!(order.await.is_ok());
        assert_eq!(lock(&trace).bytes, [2, 3]);
    }

    #[tokio::test(start_paused = true)]
    async fn partial_control_timeout_closes_and_reports_the_session() {
        let (writer, trace) = setup([Step::Write(1), Step::Pending]);
        assert!(matches!(
            writer.write_control(&[1, 0], Instant::now() + BUDGET).await,
            Err(FrameError::Timeout)
        ));
        assert!(writer.take_unreported_failure().is_some());
        assert!(lock(&trace).dropped);
        assert_eq!(lock(&trace).bytes, [1]);
    }

    #[tokio::test(start_paused = true)]
    async fn disabled_heartbeat_writes_nothing_and_stops_on_session_close() {
        let (writer, trace) = setup([]);
        let mut keep_alive = Box::pin(run_keep_alive(&writer, keep_alive_settings(Duration::ZERO)));
        pending_once(keep_alive.as_mut()).await;
        advance(BUDGET * 10).await;
        pending_once(keep_alive.as_mut()).await;
        assert!(lock(&trace).bytes.is_empty());
        writer.close();
        keep_alive.await;
    }
}
