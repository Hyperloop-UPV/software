use std::time::Duration;

use axum::extract::ws::WebSocket;
use futures_util::{SinkExt, StreamExt};
use tokio::{sync::mpsc, time::timeout};

use super::{OrderForwarder, broker::BrokerClient, error::Error, receiver, sender};

/// Runs reading and writing together; either side finishing ends the session.
pub(super) async fn handle(
    socket: WebSocket,
    broker: BrokerClient,
    orders: Option<&OrderForwarder>,
) -> Result<(), Error> {
    let (mut write, read) = socket.split();
    let (changes, subscriptions) = mpsc::channel(16);
    let result = tokio::select! {
        result = receiver::run(read, &broker, orders, changes) => result,
        result = sender::run(&mut write, subscriptions) => result,
    };
    let _ = timeout(Duration::from_secs(1), write.close()).await;
    result
}
