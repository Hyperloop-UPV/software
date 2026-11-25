use std::time::Duration;

use axum::extract::ws::WebSocket;
use futures_util::{SinkExt, StreamExt};
use tokio::{sync::mpsc, time::timeout};

use super::{Commands, broker::BrokerClient, error::Error, receiver, sender};

/// Runs reading and writing concurrently. The first side to finish ends the session.
pub(super) async fn handle(
    socket: WebSocket,
    broker: BrokerClient,
    commands: &Commands,
    heartbeat_timeout: Duration
) -> Result<(), Error> {
    let (mut write, read) = socket.split();
    let (changes, subscriptions) = mpsc::channel(16);
    let result = tokio::select! {
        result = receiver::run(read, &broker, commands, changes, heartbeat_timeout) => result,
        result = sender::run(&mut write, subscriptions) => result,
    };
    // Bound the socket close and preserve the result that ended the session.
    let _ = timeout(Duration::from_secs(1), write.close()).await;
    result
}
