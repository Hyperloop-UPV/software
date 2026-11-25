//! Connects upgraded HTTP sockets to broker subscriptions.

use axum::extract::ws::WebSocket;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

use self::broker::BrokerClient;

pub mod broker;
mod error;
mod handler;
mod receiver;
mod sender;
pub(super) mod payload;

const CONNECTION_UPDATE: &str = "connection/update";
const HEARTBEAT: &str = "connection/heartbeat";

/// JSON envelope shared with the frontend.
#[derive(Debug, Serialize, Deserialize)]
pub struct WsMessage {
    /// Topic of the message, can be:
    /// - order/send
    /// - podData/update
    /// - connection/update
    /// - order/stateOrders
    /// - message/update
    /// - protection/update
    /// - logger/enable
    /// - logger/response
    /// - logger/variables
    pub topic: String,
    /// Topic-specific JSON payload
    pub payload: serde_json::Value,
}

/// Handles each connection independently while HTTP keeps accepting sockets.
pub async fn run(mut connections: mpsc::Receiver<WebSocket>, broker: BrokerClient) {
    // Spawn one tokio task per Websocket connection
    while let Some(socket) = connections.recv().await {
        let broker = broker.clone();
        tokio::spawn(async move {
            if let Err(error) = handler::handle(socket, broker).await {
                tracing::warn!(%error, "WebSocket connection ended with an error");
            }
        });
    }
}
