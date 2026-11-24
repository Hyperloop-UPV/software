//! Central routing and fan-out stage between `net` and downstream consumers.
//!
//! # What this module is
//!
//! The single consumer of [`crate::net::Sinks`]. Everything that comes off the
//! wire (UDP telemetry, TCP orders/messages, connection transitions, and
//! transport errors) enters here once and is distributed to whoever needs it:
//! live observers (WebSocket/frontend, protection checks), optional disk
//! recording, and the pod fault supervisor.
//!
//! # Entry point
//!
//! [`spawn`], taking [`Config`], [`crate::net::Sinks`], and an optional
//! recorder channel. Returns a [`Pipeline`] handle exposing live telemetry
//! subscriptions, the single-shot fault receiver, and the task's `JoinHandle`.
//!
//! # Contract
//!
//! - **Never backpressure `net`.** Both `sinks.notifications` and
//!   `sinks.errors` are drained continuously in a single `tokio::select!` loop.
//!   A slow frontend or stalled disk writer must never block UDP/TCP ingestion:
//!   live consumers use a [`tokio::sync::broadcast`] channel (lagging receivers
//!   skip old frames), and optional disk recording uses non-blocking `try_send`.
//! - **Single "fault once" guard.** Transport modules (`net::udp`, `net::tcp`)
//!   report every error and keep running without acting on it. This module
//!   checks [`NetError::is_fatal`] and emits **at most one** fault trigger on
//!   [`Pipeline::faults`] so `station` sends the pod to fault once—even if a
//!   mismatched ADJ produces thousands of decode errors per second.
//! - **Stay alive after fault.** Faulting is about the **pod**, not this
//!   process. After emitting a fault trigger, the loop keeps routing packets
//!   and draining errors so operators can inspect telemetry and logs.
//! - **Zero-copy fan-out.** Each [`Notification`] is wrapped in an `Arc` once
//!   and shared across all subscribers rather than cloned per consumer.
//! - **Clean shutdown.** Disables closed `select!` branches to avoid busy
//!   spinning and exits once both upstream `net` channels have closed.

use crate::net::{Error as NetError, Notification, Sinks};
use std::sync::Arc;
use tokio::sync::mpsc::error::TrySendError;
use tokio::sync::{broadcast, mpsc};
use tokio::task::JoinHandle;
use tracing::{error, warn};

/// Sizing parameters for the pipeline's internal channels.
///
/// Resolved by `station` before spawning; this module reads no config files.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Config {
    /// Capacity of the live [`broadcast`] channel shared by subscribers
    /// (WebSocket server, state aggregator, protections).
    ///
    /// A subscriber falling more than this many notifications behind receives
    /// `RecvError::Lagged` and jumps to the latest frame instead of stalling
    /// the network receive loops.
    pub broadcast_capacity: usize,
}

impl Default for Config {
    fn default() -> Self {
        Self {
            broadcast_capacity: 1024,
        }
    }
}

/// Handle to a running pipeline task.
pub struct Pipeline {
    telemetry_tx: broadcast::Sender<Arc<Notification>>,
    /// Fires at most once when the first fatal transport error arrives.
    ///
    /// `station` listens here to command the pod into fault state.
    pub faults: mpsc::Receiver<NetError>,
    /// Handle to the background routing task.
    pub handle: JoinHandle<()>,
}

impl Pipeline {
    /// Subscribes a new live consumer (e.g. WebSocket broadcaster or state
    /// cache) to every [`Notification`] flowing through the pipeline.
    pub fn subscribe(&self) -> broadcast::Receiver<Arc<Notification>> {
        self.telemetry_tx.subscribe()
    }
}

/// Spawns the pipeline routing task.
///
/// `recorder` is optional: pass `Some(tx)` when disk recording is enabled, or
/// `None` in lightweight demos/tests. Recording uses `try_send` so a full disk
/// buffer drops frames with a warning rather than stalling `net`.
///
/// TODO(review): Confirm whether protections (ADJv3 range/limit checks) should
/// run inline in `handle_notification` before fan-out, or as a separate task
/// calling `pipeline.subscribe()`.
pub fn spawn(
    config: Config,
    sinks: Sinks,
    recorder: Option<mpsc::Sender<Arc<Notification>>>,
) -> Pipeline {
    let (telemetry_tx, _) = broadcast::channel(config.broadcast_capacity);
    // Capacity 1 is enough: the fault-once guard sends at most one fatal error.
    let (fault_tx, fault_rx) = mpsc::channel(1);

    let handle = tokio::spawn(run_loop(sinks, telemetry_tx.clone(), fault_tx, recorder));

    Pipeline {
        telemetry_tx,
        faults: fault_rx,
        handle,
    }
}

/// Main routing loop: drains both `net` channels until upstream closes.
async fn run_loop(
    mut sinks: Sinks,
    telemetry_tx: broadcast::Sender<Arc<Notification>>,
    fault_tx: mpsc::Sender<NetError>,
    mut recorder: Option<mpsc::Sender<Arc<Notification>>>,
) {
    let mut faulted = false;
    let mut notifications_open = true;
    let mut errors_open = true;

    while notifications_open || errors_open {
        tokio::select! {
            res = sinks.notifications.recv(), if notifications_open => {
                match res {
                    Some(notification) => {
                        handle_notification(notification, &telemetry_tx, &mut recorder);
                    }
                    None => notifications_open = false,
                }
            }
            res = sinks.errors.recv(), if errors_open => {
                match res {
                    Some(err) => {
                        handle_error(err, &mut faulted, &fault_tx);
                    }
                    None => errors_open = false,
                }
            }
        }
    }
}

/// Fans a single notification out to live subscribers and the optional recorder.
fn handle_notification(
    notification: Notification,
    telemetry_tx: &broadcast::Sender<Arc<Notification>>,
    recorder: &mut Option<mpsc::Sender<Arc<Notification>>>,
) {
    let shared = Arc::new(notification);

    // TODO(review): If state aggregation / rate throttling for the frontend
    // belongs inside `pipeline` rather than downstream, hook it in here.

    // Broadcast returns Err only when there are zero active subscribers, which
    // is expected during startup or headless runs.
    let _ = telemetry_tx.send(Arc::clone(&shared));

    if let Some(tx) = recorder.as_ref() {
        match tx.try_send(shared) {
            Ok(()) => {}
            Err(TrySendError::Full(_)) => {
                // TODO(review): Consider rate-limiting this warning or tracking
                // a dropped-frame counter if high-rate telemetry overflows disk.
                warn!("recorder channel full, dropping notification to avoid stalling net");
            }
            Err(TrySendError::Closed(_)) => {
                warn!("recorder channel closed, disabling recording sink");
                *recorder = None;
            }
        }
    }
}

/// Evaluates a transport error against the fault-once guard.
fn handle_error(err: NetError, faulted: &mut bool, fault_tx: &mpsc::Sender<NetError>) {
    if !err.is_fatal() {
        warn!(%err, "non-fatal network error");
        return;
    }

    if *faulted {
        // Already triggered a pod fault; keep draining silently so `sinks.errors`
        // never fills up and deadlocks the transport tasks.
        return;
    }

    *faulted = true;
    error!(%err, "fatal network error — triggering pod fault");

    if let Err(send_err) = fault_tx.try_send(err) {
        error!(%send_err, "could not deliver fault trigger to supervisor");
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{AdjId, BoardId, DataOrderPacket, Packet};
    use crate::net::{udp, Event, Reporter};
    use crate::protocol::DecodeError;
    use std::net::{IpAddr, SocketAddr};

    fn sample_notification() -> (BoardId, Event) {
        let packet = DataOrderPacket::new(AdjId(551), vec![]);
        (BoardId(5), Event::Received(Packet::Data(packet)))
    }

    fn fatal_udp_error() -> udp::Error {
        udp::Error::Decode {
            from: SocketAddr::new(IpAddr::from([192, 168, 1, 3]), 50400),
            source: DecodeError::UnknownId(AdjId(9999)),
        }
    }

    #[tokio::test]
    async fn fans_out_notifications_to_multiple_subscribers_and_recorder() {
        let (reporter, sinks) = Reporter::channels(16, 16);
        let (rec_tx, mut rec_rx) = mpsc::channel(16);

        let pipeline = spawn(Config::default(), sinks, Some(rec_tx));
        let mut sub_a = pipeline.subscribe();
        let mut sub_b = pipeline.subscribe();

        let (board, event) = sample_notification();
        reporter.notify(board, event).await.unwrap();

        let a = sub_a.recv().await.unwrap();
        let b = sub_b.recv().await.unwrap();
        let rec = rec_rx.recv().await.unwrap();

        assert_eq!(a.board, BoardId(5));
        assert_eq!(b.board, BoardId(5));
        assert_eq!(rec.board, BoardId(5));

        drop(reporter);
        pipeline.handle.await.unwrap();
    }

    #[tokio::test]
    async fn fatal_errors_trigger_fault_only_once_and_keep_draining() {
        let (reporter, sinks) = Reporter::channels(16, 4);
        let mut pipeline = spawn(Config::default(), sinks, None);
        let mut sub = pipeline.subscribe();

        // Flood more fatal errors than the error channel capacity (4) to verify
        // the pipeline keeps draining without deadlocking.
        for _ in 0..20 {
            reporter.report(fatal_udp_error()).await.unwrap();
        }

        // Exactly one fault trigger should be emitted.
        let first_fault = pipeline.faults.recv().await;
        assert!(first_fault.is_some());

        // Telemetry must still flow after faulting.
        let (board, event) = sample_notification();
        reporter.notify(board, event).await.unwrap();
        let received = sub.recv().await.unwrap();
        assert_eq!(received.board, BoardId(5));

        drop(reporter);
        pipeline.handle.await.unwrap();

        // No second fault trigger was queued.
        assert!(pipeline.faults.try_recv().is_err());
    }

    #[tokio::test]
    async fn full_recorder_does_not_block_live_subscribers() {
        let (reporter, sinks) = Reporter::channels(16, 16);
        // Recorder with capacity 1 that nobody reads from.
        let (rec_tx, _rec_rx) = mpsc::channel(1);

        let pipeline = spawn(Config::default(), sinks, Some(rec_tx));
        let mut sub = pipeline.subscribe();

        for _ in 0..5 {
            let (board, event) = sample_notification();
            reporter.notify(board, event).await.unwrap();
        }

        for _ in 0..5 {
            let msg = sub.recv().await.unwrap();
            assert_eq!(msg.board, BoardId(5));
        }

        drop(reporter);
        pipeline.handle.await.unwrap();
    }
}