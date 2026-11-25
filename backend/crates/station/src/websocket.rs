//! Connects upgraded HTTP sockets to station's broker and command queues.
//!
//! Each connection has a reader that accepts subscriptions and commands and a
//! writer that turns the subscribed broker updates into JSON messages.

use std::time::Duration;

use axum::extract::ws::WebSocket;
use serde::{Deserialize, Serialize};
use tokio::sync::mpsc;

use self::broker::BrokerClient;
pub(crate) use self::order::OrderForwarder;
use self::payload::{LoggerEnable, LoggerVariables};

pub mod broker;
mod error;
mod handler;
mod order;
pub(super) mod payload;
mod receiver;
mod sender;

const CONNECTION_UPDATE: &str = "connection/update";
const STATE_ORDERS: &str = "order/stateOrders";
const LOGGER_ENABLE: &str = "logger/enable";
const LOGGER_RESPONSE: &str = "logger/response";
const LOGGER_VARIABLES: &str = "logger/variables";
const DATA_UPDATE: &str = "podData/update";
const MESSAGE_UPDATE: &str = "message/update";
const PROTECTION_UPDATE: &str = "protection/update";
const ORDER_SEND: &str = "order/send";
const HEARTBEAT: &str = "connection/heartbeat";

/// Requests queued for the logger. The logger publishes its applied state separately.
#[derive(Debug, PartialEq, Eq)]
pub(crate) enum LoggerCommand {
    Enable(LoggerEnable),
    Variables(LoggerVariables),
}

/// Destinations for requests received over WebSocket.
#[derive(Debug, Clone, Default)]
pub(crate) struct Commands {
    /// Validates frontend orders before queuing them for the vehicle.
    pub(crate) orders: Option<OrderForwarder>,
    /// Queues recording and variable selection requests for the logger.
    pub(crate) logger: Option<mpsc::Sender<LoggerCommand>>,
}

/// Topics a frontend can subscribe to. Commands and heartbeats are routed by the reader.
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
    /// Wire name used to route the message, such as `connection/update`.
    pub topic: String,
    /// Topic-specific JSON payload.
    pub payload: serde_json::Value,
}

/// Runs one task per upgraded socket so a slow client stays isolated.
/// Closing the HTTP handoff channel ends socket intake. Existing sessions end independently.
pub(crate) async fn run(
    mut connections: mpsc::Receiver<WebSocket>,
    broker: BrokerClient,
    commands: Commands,
    heartbeat_timeout: Duration,
) {
    while let Some(socket) = connections.recv().await {
        let broker = broker.clone();
        let commands = commands.clone();
        tokio::spawn(async move {
            if let Err(error) = handler::handle(socket, broker, &commands, heartbeat_timeout).await {
                tracing::warn!(%error, "WebSocket connection ended with an error");
            }
        });
    }
}
