//! Connects upgraded HTTP sockets to broker subscriptions.

use axum::extract::ws::WebSocket;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

use self::broker::BrokerClient;
pub(crate) use self::order::OrderForwarder;

pub mod broker;
mod error;
mod handler;
mod order;
pub(super) mod payload;
mod receiver;
mod sender;

const CONNECTION_UPDATE: &str = "connection/update";
const STATE_ORDERS: &str = "order/stateOrders";
const LOGGER_RESPONSE: &str = "logger/response";
const DATA_UPDATE: &str = "podData/update";
const MESSAGE_UPDATE: &str = "message/update";
const PROTECTION_UPDATE: &str = "protection/update";
const ORDER_SEND: &str = "order/send";
const HEARTBEAT: &str = "connection/heartbeat";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash)]
enum Topic {
    Connections,
    StateOrders,
    Logger,
    Data,
    Messages,
    Protections,
}

impl Topic {
    fn from_name(name: &str) -> Option<Self> {
        match name {
            CONNECTION_UPDATE => Some(Self::Connections),
            STATE_ORDERS => Some(Self::StateOrders),
            LOGGER_RESPONSE => Some(Self::Logger),
            DATA_UPDATE => Some(Self::Data),
            MESSAGE_UPDATE => Some(Self::Messages),
            PROTECTION_UPDATE => Some(Self::Protections),
            _ => None,
        }
    }

    fn name(self) -> &'static str {
        match self {
            Self::Connections => CONNECTION_UPDATE,
            Self::StateOrders => STATE_ORDERS,
            Self::Logger => LOGGER_RESPONSE,
            Self::Data => DATA_UPDATE,
            Self::Messages => MESSAGE_UPDATE,
            Self::Protections => PROTECTION_UPDATE,
        }
    }
}

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
pub async fn run(
    mut connections: mpsc::Receiver<WebSocket>,
    broker: BrokerClient,
    orders: Option<OrderForwarder>,
) {
    // Spawn one tokio task per Websocket connection
    while let Some(socket) = connections.recv().await {
        let broker = broker.clone();
        let orders = orders.clone();
        tokio::spawn(async move {
            if let Err(error) = handler::handle(socket, broker, orders.as_ref()).await {
                tracing::warn!(%error, "WebSocket connection ended with an error");
            }
        });
    }
}
