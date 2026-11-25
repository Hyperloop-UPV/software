//! Connects upgraded HTTP sockets to station's broker and command queues.
//!
//! Each connection has a reader that accepts subscriptions and commands and a
//! writer that turns the subscribed broker updates into JSON messages.

use std::time::Duration;

use axum::extract::ws::WebSocket;
use serde::{Deserialize, Serialize};
use tokio::{
    sync::mpsc,
    time::{Instant, sleep_until},
};

use self::broker::BrokerClient;
use self::handler::SessionEnd;
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
pub struct Commands {
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

/// The last frontend's heartbeat or reconnect deadline expired.
#[derive(Debug, PartialEq, Eq, thiserror::Error)]
#[error("lost connection to the last frontend")]
pub struct FrontendDisconnected;

/// Runs one task per upgraded socket so a slow client stays isolated.
///
/// Returns `FrontendDisconnected` after the last session times out or the
/// reconnect window expires. Closing the HTTP handoff channel ends socket
/// intake. Existing sessions end independently.
///
/// The caller should report `FrontendDisconnected` to `event` when station
/// wires the two modules together.
pub async fn run(
    mut connections: mpsc::Receiver<WebSocket>,
    broker: BrokerClient,
    commands: Commands,
    heartbeat_timeout: Duration,
) -> Result<(), FrontendDisconnected> {
    let (session_ends, mut ended) = mpsc::channel(16);
    let mut sessions = FrontendSessions::default();

    loop {
        tokio::select! {
            biased;
            _ = async {
                if let Some(deadline) = sessions.reconnect_deadline {
                    sleep_until(deadline).await;
                }
            }, if sessions.reconnect_deadline.is_some() => return Err(FrontendDisconnected),
            socket = connections.recv() => {
                let Some(socket) = socket else { return Ok(()); };
                sessions.connected();
                let broker = broker.clone();
                let commands = commands.clone();
                let session_ends = session_ends.clone();
                tokio::spawn(async move {
                    handler::handle(socket, broker, &commands, heartbeat_timeout, session_ends).await;
                });
            }
            Some(end) = ended.recv() => {
                sessions.ended(end, heartbeat_timeout)?;
            }
        }
    }
}

/// Tracks the active frontend sessions and the reconnect window after the last one ends.
#[derive(Default)]
struct FrontendSessions {
    /// Sessions accepted by the supervisor whose handlers have yet to report an end.
    active: usize,
    /// Set after the last session reports `SessionEnd::Closed` and cleared on reconnect.
    reconnect_deadline: Option<Instant>,
}

impl FrontendSessions {
    fn connected(&mut self) {
        self.active += 1;
        self.reconnect_deadline = None;
    }

    fn ended(
        &mut self,
        end: SessionEnd,
        reconnect_window: Duration,
    ) -> Result<(), FrontendDisconnected> {
        self.active -= 1;
        if self.active > 0 {
            return Ok(());
        }
        match end {
            SessionEnd::HeartbeatTimeout => Err(FrontendDisconnected),
            SessionEnd::Closed(at) => {
                self.reconnect_deadline = Some(at + reconnect_window);
                Ok(())
            }
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    const HEARTBEAT_TIMEOUT: Duration = Duration::from_secs(3);

    #[test]
    fn reconnect_cancels_the_deadline_after_the_last_socket_closes()
    -> Result<(), FrontendDisconnected> {
        let mut sessions = FrontendSessions::default();
        let at = Instant::now();

        assert_eq!(sessions.reconnect_deadline, None);
        sessions.connected();
        sessions.connected();
        sessions.ended(SessionEnd::Closed(at), HEARTBEAT_TIMEOUT)?;
        assert_eq!(sessions.reconnect_deadline, None);
        sessions.ended(SessionEnd::Closed(at), HEARTBEAT_TIMEOUT)?;
        assert_eq!(sessions.reconnect_deadline, Some(at + HEARTBEAT_TIMEOUT));

        sessions.connected();
        assert_eq!(sessions.reconnect_deadline, None);
        Ok(())
    }

    #[test]
    fn the_last_heartbeat_timeout_is_fatal_immediately() -> Result<(), FrontendDisconnected> {
        let mut sessions = FrontendSessions::default();
        sessions.connected();
        sessions.connected();

        sessions.ended(SessionEnd::HeartbeatTimeout, HEARTBEAT_TIMEOUT)?;
        assert_eq!(
            sessions.ended(SessionEnd::HeartbeatTimeout, HEARTBEAT_TIMEOUT),
            Err(FrontendDisconnected)
        );
        Ok(())
    }
}
