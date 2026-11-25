use std::time::Duration;

use axum::extract::ws::WebSocket;
use futures_util::{SinkExt, StreamExt};
use tokio::{sync::watch, time::timeout};

use super::{broker::BrokerClient, error::Error, receiver, sender};

/// Runs reading and writing together; either side finishing ends the session.
pub(super) async fn handle(socket: WebSocket, broker: BrokerClient) -> Result<(), Error> {
    let (mut write, read) = socket.split();
    let (subscription, subscribed) = watch::channel(false);
    let result = tokio::select! {
        result = receiver::run(read, subscription) => result,
        result = sender::run(&mut write, &broker, subscribed) => result,
    };
    let _ = timeout(Duration::from_secs(1), write.close()).await;
    result
}
