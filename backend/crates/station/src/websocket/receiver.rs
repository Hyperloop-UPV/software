use axum::extract::ws::Message as Frame;
use futures_util::{Stream, StreamExt};
use serde::Deserialize;
use std::{collections::HashSet, time::Duration};
use tokio::{
    sync::{broadcast, mpsc, watch},
    time::{Instant, timeout_at},
};

use super::{
    HEARTBEAT, ORDER_SEND, OrderForwarder, Topic, WsMessage,
    broker::BrokerClient,
    error::{Error, OrderError},
    payload::{
        ConnectionUpdate, DataUpdate, LoggerResponse, MessageUpdate, ProtectionUpdate,
        StateOrdersUpdate,
    },
};

const HEARTBEAT_TIMEOUT: Duration = Duration::from_secs(3);

#[derive(Deserialize)]
struct Subscription {
    subscribe: Option<bool>,
}

/// Carries a new topic receiver, or `None` to unsubscribe.
#[derive(Debug)]
pub(super) enum SubscriptionChange {
    Connections(Option<watch::Receiver<ConnectionUpdate>>),
    StateOrders(Option<watch::Receiver<StateOrdersUpdate>>),
    Logger(Option<watch::Receiver<LoggerResponse>>),
    Data(Option<watch::Receiver<DataUpdate>>),
    Messages(Option<broadcast::Receiver<MessageUpdate>>),
    Protections(Option<broadcast::Receiver<ProtectionUpdate>>),
}

impl SubscriptionChange {
    fn new(broker: &BrokerClient, topic: Topic, enabled: bool) -> Result<Self, Error> {
        Ok(match topic {
            Topic::Connections => {
                Self::Connections(enabled.then(|| broker.subscribe_connections()))
            }
            Topic::StateOrders => {
                Self::StateOrders(enabled.then(|| broker.subscribe_state_orders()))
            }
            Topic::Logger => Self::Logger(enabled.then(|| broker.subscribe_logger())),
            Topic::Data => Self::Data(enabled.then(|| broker.subscribe_data())),
            Topic::Messages => {
                Self::Messages(enabled.then(|| broker.subscribe_messages()).transpose()?)
            }
            Topic::Protections => Self::Protections(
                enabled
                    .then(|| broker.subscribe_protections())
                    .transpose()?,
            ),
        })
    }
}

/// Handles frontend requests and renews the deadline on each valid JSON message.
pub(super) async fn run(
    mut read: impl Stream<Item = Result<Frame, axum::Error>> + Unpin,
    broker: &BrokerClient,
    orders: Option<&OrderForwarder>,
    changes: mpsc::Sender<SubscriptionChange>,
) -> Result<(), Error> {
    let mut subscriptions = HashSet::new();
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
                if message.topic == ORDER_SEND {
                    let result = orders
                        .ok_or(OrderError::VehicleUnavailable)
                        .and_then(|orders| orders.forward(message.payload));
                    if let Err(error) = result {
                        tracing::warn!(topic = ORDER_SEND, %error, "order rejected");
                    }
                } else if let Some(topic) = Topic::from_name(&message.topic) {
                    let request: Subscription = serde_json::from_value(message.payload)?;
                    let enabled = request.subscribe.unwrap_or(true);
                    let changed = if enabled {
                        subscriptions.insert(topic)
                    } else {
                        subscriptions.remove(&topic)
                    };
                    if changed {
                        // Start buffering events as soon as the request is accepted.
                        let change = SubscriptionChange::new(broker, topic, enabled)?;
                        match changes.try_send(change) {
                            Ok(()) => {}
                            Err(mpsc::error::TrySendError::Full(_)) => {
                                return Err(Error::SubscriptionQueueFull);
                            }
                            Err(mpsc::error::TrySendError::Closed(_)) => return Ok(()),
                        }
                    }
                } else if message.topic != HEARTBEAT {
                    tracing::warn!(topic = %message.topic, "unsupported WebSocket topic");
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
    use crate::websocket::broker::Broker;

    #[tokio::test(start_paused = true)]
    async fn inactivity_expires() {
        let (_broker, client) = Broker::new();
        let (changes, _subscriptions) = mpsc::channel(1);
        assert!(matches!(
            run(stream::pending(), &client, None, changes).await,
            Err(Error::HeartbeatTimeout)
        ));
    }

    #[tokio::test(start_paused = true)]
    async fn subscription_messages_also_renew_the_deadline()
    -> Result<(), Box<dyn std::error::Error>> {
        let (input, mut frames) = tokio::sync::mpsc::channel(1);
        let read = stream::poll_fn(move |cx| frames.poll_recv(cx));
        let (_broker, client) = Broker::new();
        let (changes, mut subscriptions) = mpsc::channel(1);
        let worker = tokio::spawn(async move { run(read, &client, None, changes).await });
        tokio::task::yield_now().await;

        advance(Duration::from_secs(2)).await;
        input
            .send(Ok(Frame::Text(
                r#"{"topic":"connection/update","payload":{"subscribe":true}}"#.into(),
            )))
            .await?;
        assert!(matches!(
            subscriptions.recv().await,
            Some(SubscriptionChange::Connections(Some(_)))
        ));
        advance(Duration::from_secs(2)).await;
        assert!(!worker.is_finished());
        advance(Duration::from_secs(1)).await;
        assert!(matches!(worker.await?, Err(Error::HeartbeatTimeout)));
        Ok(())
    }

    #[tokio::test]
    async fn heartbeats_do_not_subscribe_or_publish() -> Result<(), Error> {
        let (_broker, client) = Broker::new();
        let (changes, mut subscriptions) = mpsc::channel(1);
        let frames = stream::iter([
            Ok(Frame::Text(
                r#"{"topic":"connection/heartbeat","payload":{}}"#.into(),
            )),
            Ok(Frame::Close(None)),
        ]);
        run(frames, &client, None, changes).await?;
        assert!(subscriptions.recv().await.is_none());
        Ok(())
    }

    #[tokio::test]
    async fn subscription_requests_can_unsubscribe() -> Result<(), Error> {
        let (_broker, client) = Broker::new();
        let (changes, mut subscriptions) = mpsc::channel(2);
        let frames = stream::iter([
            Ok(Frame::Text(
                r#"{"topic":"connection/update","payload":{}}"#.into(),
            )),
            Ok(Frame::Text(
                r#"{"topic":"connection/update","payload":{"subscribe":false}}"#.into(),
            )),
            Ok(Frame::Close(None)),
        ]);
        run(frames, &client, None, changes).await?;
        assert!(matches!(
            subscriptions.recv().await,
            Some(SubscriptionChange::Connections(Some(_)))
        ));
        assert!(matches!(
            subscriptions.recv().await,
            Some(SubscriptionChange::Connections(None))
        ));
        assert!(subscriptions.recv().await.is_none());
        Ok(())
    }

    #[tokio::test]
    async fn repeated_event_subscriptions_keep_the_existing_receiver() -> Result<(), Error> {
        let (_broker, client) = Broker::new();
        let (changes, mut subscriptions) = mpsc::channel(4);
        let frames = stream::iter([
            Ok(Frame::Text(
                r#"{"topic":"message/update","payload":{}}"#.into(),
            )),
            Ok(Frame::Text(
                r#"{"topic":"protection/update","payload":{"subscribe":true}}"#.into(),
            )),
            Ok(Frame::Text(
                r#"{"topic":"message/update","payload":{"subscribe":true}}"#.into(),
            )),
            Ok(Frame::Text(
                r#"{"topic":"message/update","payload":{"subscribe":false}}"#.into(),
            )),
            Ok(Frame::Text(
                r#"{"topic":"message/update","payload":{"subscribe":true}}"#.into(),
            )),
            Ok(Frame::Close(None)),
        ]);
        run(frames, &client, None, changes).await?;
        assert!(matches!(
            subscriptions.recv().await,
            Some(SubscriptionChange::Messages(Some(_)))
        ));
        assert!(matches!(
            subscriptions.recv().await,
            Some(SubscriptionChange::Protections(Some(_)))
        ));
        assert!(matches!(
            subscriptions.recv().await,
            Some(SubscriptionChange::Messages(None))
        ));
        assert!(matches!(
            subscriptions.recv().await,
            Some(SubscriptionChange::Messages(Some(_)))
        ));
        assert!(subscriptions.recv().await.is_none());
        Ok(())
    }
}
