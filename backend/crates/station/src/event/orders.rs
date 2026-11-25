//! The orders worker: takes the front's orders (⑦) one at a time and writes
//! them to TCP, so that the routing loop never waits on a socket.

use std::sync::Arc;
use std::time::SystemTime;

use software_core::model::OrderPacket;
use tokio::sync::mpsc;
use tracing::{info, warn};

use super::fault::{FAULT_ID, FaultRequest};
use super::{TcpLink, ToLogging, ToPipeline};

/// The reason given for every order when no TCP client is running.
pub(super) const TCP_NOT_AVAILABLE: &str = "TCP not available";

/// Runs the worker until its queue closes (or `event` stops it).
///
/// - An order with id 0 is the fault: it goes to the fault worker (⑧).
/// - Any other order is written and waited for before the next one is
///   taken. Written: it goes to `logging` (⑤). Not written: it goes to
///   `pipeline` (⑥) with the reason, and to the trace.
pub(super) async fn run(
    mut orders: mpsc::Receiver<OrderPacket>,
    tcp: Option<Arc<dyn TcpLink>>,
    fault: mpsc::Sender<FaultRequest>,
    logging: mpsc::Sender<ToLogging>,
    pipeline: mpsc::Sender<ToPipeline>,
) {
    while let Some(order) = orders.recv().await {
        if order.id == FAULT_ID {
            info!("the front asked for the fault");
            if fault.send(FaultRequest { done: None }).await.is_err() {
                break;
            }
            continue;
        }

        let outcome = match &tcp {
            Some(tcp) => tcp.send(order.clone()).await,
            None => Err(TCP_NOT_AVAILABLE.to_string()),
        };

        // Stamped once the outcome is known: "sent" means written.
        let at = SystemTime::now();
        let delivered = match outcome {
            Ok(board) => logging
                .send(ToLogging::OrderSent { at, board, order })
                .await
                .is_ok(),
            Err(reason) => {
                warn!(id = ?order.id, %reason, "order not sent");
                pipeline
                    .send(ToPipeline::OrderFailed { at, order, reason })
                    .await
                    .is_ok()
            }
        };

        // Nobody left to tell: event is stopping.
        if !delivered {
            break;
        }
    }
}
