use std::time::Duration;

use axum::extract::ws::WebSocket;
use futures_util::{SinkExt, StreamExt};
use tokio::{
    sync::mpsc,
    time::{Instant, timeout},
};

use super::{Commands, broker::BrokerClient, error::Error, receiver, sender};

/// Reports why a session ended before the handler closes the socket.
pub(super) enum SessionEnd {
    /// The full heartbeat timeout elapsed while waiting for an application message.
    HeartbeatTimeout,
    /// The session ended at this instant. For the last session, this starts the reconnect window.
    Closed(Instant),
}

/// Runs reading and writing concurrently. The first side to finish ends the session.
pub(super) async fn handle(
    socket: WebSocket,
    broker: BrokerClient,
    commands: &Commands,
    heartbeat_timeout: Duration,
    session_ends: mpsc::Sender<SessionEnd>,
) {
    let (mut write, read) = socket.split();
    let (changes, subscriptions) = mpsc::channel(16);
    let result = tokio::select! {
        result = receiver::run(read, &broker, commands, changes, heartbeat_timeout) => result,
        result = sender::run(&mut write, subscriptions) => result,
    };
    let end = match result {
        Err(Error::HeartbeatTimeout) => SessionEnd::HeartbeatTimeout,
        _ => SessionEnd::Closed(Instant::now()),
    };
    // Report the end of the session before waiting on socket I/O.
    let _ = session_ends.send(end).await;
    if let Err(error) = result {
        tracing::warn!(%error, "WebSocket connection ended with an error");
    }
    let _ = timeout(Duration::from_secs(1), write.close()).await;
}
