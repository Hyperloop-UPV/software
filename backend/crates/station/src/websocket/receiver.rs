use std::time::Duration;

use axum::extract::ws::Message as Frame;
use futures_util::{Stream, StreamExt};
use serde::Deserialize;
use tokio::{
    sync::watch,
    time::{Instant, timeout_at},
};

use super::{CONNECTION_UPDATE, HEARTBEAT, WsMessage, error::Error};

const HEARTBEAT_TIMEOUT: Duration = Duration::from_secs(3);

#[derive(Deserialize)]
struct Subscription {
    subscribe: Option<bool>,
}

/// Handles subscriptions and renews the deadline on each valid JSON message.
pub(super) async fn run(
    mut read: impl Stream<Item = Result<Frame, axum::Error>> + Unpin,
    subscription: watch::Sender<bool>,
) -> Result<(), Error> {
    let mut deadline = Instant::now() + HEARTBEAT_TIMEOUT;
    loop {
        let frame = timeout_at(deadline, read.next())
            .await
            .map_err(|_| Error::HeartbeatTimeout)?;
        let Some(frame) = frame else {
            return Ok(());
        };
        match frame? {
            Frame::Text(text) => {
                let message: WsMessage = serde_json::from_str(&text)?;
                match message.topic.as_str() {
                    CONNECTION_UPDATE => {
                        let request: Subscription = serde_json::from_value(message.payload)?;
                        let subscribed = request.subscribe.unwrap_or(true);
                        subscription.send_if_modified(|current| {
                            let changed = *current != subscribed;
                            *current = subscribed;
                            changed
                        });
                    }
                    HEARTBEAT => {}
                    topic => tracing::warn!(topic, "unsupported WebSocket topic"),
                }
                deadline = Instant::now() + HEARTBEAT_TIMEOUT;
            }
            Frame::Close(_) => return Ok(()),
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use futures_util::stream;
    use tokio::time::advance;

    use super::*;

    #[tokio::test(start_paused = true)]
    async fn inactivity_expires() {
        let (subscription, _state) = watch::channel(false);
        assert!(matches!(
            run(stream::pending(), subscription).await,
            Err(Error::HeartbeatTimeout)
        ));
    }

    #[tokio::test(start_paused = true)]
    async fn subscription_messages_also_renew_the_deadline()
    -> Result<(), Box<dyn std::error::Error>> {
        let (input, mut frames) = tokio::sync::mpsc::channel(1);
        let read = stream::poll_fn(move |cx| frames.poll_recv(cx));
        let (subscription, mut state) = watch::channel(false);
        let worker = tokio::spawn(run(read, subscription));
        tokio::task::yield_now().await;

        advance(Duration::from_secs(2)).await;
        input
            .send(Ok(Frame::Text(
                r#"{"topic":"connection/update","payload":{"subscribe":true}}"#.into(),
            )))
            .await?;
        state.changed().await?;
        advance(Duration::from_secs(2)).await;
        assert!(!worker.is_finished());
        advance(Duration::from_secs(1)).await;
        assert!(matches!(worker.await?, Err(Error::HeartbeatTimeout)));
        Ok(())
    }

    #[tokio::test]
    async fn heartbeats_do_not_subscribe_or_publish() -> Result<(), Error> {
        let (subscription, state) = watch::channel(false);
        let frames = stream::iter([
            Ok(Frame::Text(
                r#"{"topic":"connection/heartbeat","payload":{}}"#.into(),
            )),
            Ok(Frame::Close(None)),
        ]);
        run(frames, subscription).await?;
        assert!(!*state.borrow());
        Ok(())
    }

    #[tokio::test]
    async fn subscription_requests_can_unsubscribe() -> Result<(), Error> {
        let (subscription, state) = watch::channel(false);
        let frames = stream::iter([
            Ok(Frame::Text(
                r#"{"topic":"connection/update","payload":{}}"#.into(),
            )),
            Ok(Frame::Text(
                r#"{"topic":"connection/update","payload":{"subscribe":false}}"#.into(),
            )),
            Ok(Frame::Close(None)),
        ]);
        run(frames, subscription).await?;
        assert!(!*state.borrow());
        Ok(())
    }
}
