//! The fault worker: sends the fault (order id 0) to every board, once per
//! session, whoever asks for it.

use std::sync::Arc;

use software_core::model::AdjId;
use tokio::sync::{mpsc, oneshot};
use tracing::{error, info, warn};

use super::{Boards, Problem, ProblemKind, TcpLink, ToPipeline};

/// The fault's id on the wire: what a board sends when it detects an error,
/// and what the backend sends to every board to put the pod in fault.
pub(super) const FAULT_ID: AdjId = AdjId(0);

/// Slots in the fault requests queue (⑧). Requests are rare, and once the
/// fault has been sent every later one is a no-op, so a full queue only
/// means a request is already pending.
pub(super) const FAULT_QUEUE: usize = 8;

/// A request to send the fault.
#[derive(Debug)]
pub(super) struct FaultRequest {
    /// Told once the fault has been sent, or was already sent before: the
    /// routing loop waits on it before stopping on a fatal error.
    pub(super) done: Option<oneshot::Sender<()>>,
}

/// Runs the worker until its queue closes (or `event` stops it).
///
/// The "only once" flag lives here and nowhere else: a fatal error, a board's
/// fault and the front all end up in this queue. A request that arrives while
/// the fault is being sent waits behind it, so it is only acknowledged once
/// the fault has really gone out.
pub(super) async fn run(
    mut requests: mpsc::Receiver<FaultRequest>,
    tcp: Option<Arc<dyn TcpLink>>,
    pipeline: mpsc::Sender<ToPipeline>,
    boards: Arc<Boards>,
) {
    let mut sent = false;
    while let Some(request) = requests.recv().await {
        if !sent {
            sent = true;
            send_fault(tcp.as_deref(), &pipeline, &boards).await;
        }
        if let Some(done) = request.done {
            // The one waiting may have given up already (its time limit).
            let _ = done.send(());
        }
    }
}

/// Sends the fault and tells the front about the boards it did not reach.
async fn send_fault(
    tcp: Option<&dyn TcpLink>,
    pipeline: &mpsc::Sender<ToPipeline>,
    boards: &Boards,
) {
    let Some(tcp) = tcp else {
        warn!("the fault was not sent to the boards: TCP not available");
        return;
    };

    match tcp.send_fault().await {
        Ok(()) => info!("fault sent to every board"),
        Err(unreached) => {
            let names: Vec<String> = unreached.iter().map(|&board| boards.name(board)).collect();
            let text = format!("the fault did not reach these boards: {}", names.join(", "));
            error!(%text);
            // A fault that only half landed is exactly what the operator has
            // to know. If pipeline is gone, event is stopping anyway.
            let problem = Problem::now(ProblemKind::Shown, None, text);
            let _ = pipeline.send(ToPipeline::Problem(problem)).await;
        }
    }
}
