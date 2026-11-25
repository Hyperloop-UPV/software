use axum::extract::ws::{Message as Frame, WebSocket};
use futures_util::{SinkExt, stream::SplitSink};
use tokio::sync::watch;

use super::{CONNECTION_UPDATE, WsMessage, broker::BrokerClient, error::Error};

/// Sends the current state on subscription, followed by complete state updates.
pub(super) async fn run(
    write: &mut SplitSink<WebSocket, Frame>,
    broker: &BrokerClient,
    mut subscribed: watch::Receiver<bool>,
) -> Result<(), Error> {
    let mut connections = broker.subscribe_connections();
    loop {
        if !*subscribed.borrow_and_update() {
            if subscribed.changed().await.is_err() {
                return Ok(());
            }
            continue;
        }

        let payload = serde_json::to_value(&*connections.borrow_and_update())?;
        let message = WsMessage {
            topic: CONNECTION_UPDATE.into(),
            payload,
        };
        write
            .send(Frame::Text(serde_json::to_string(&message)?.into()))
            .await?;

        tokio::select! {
            biased;
            result = subscribed.changed() => {
                if result.is_err() { return Ok(()); }
            }
            result = connections.changed() => {
                result.map_err(|_| Error::BrokerClosed)?;
            }
        }
    }
}
