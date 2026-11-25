use std::future::pending;

use axum::extract::ws::{Message as Frame, WebSocket};
use futures_util::{SinkExt, stream::SplitSink};
use serde::Serialize;
use tokio::sync::{broadcast, mpsc, watch};

use super::{Topic, WsMessage, error::Error, receiver::SubscriptionChange};

/// Sends subscribed state snapshots and events over the socket.
pub(super) async fn run(
    write: &mut SplitSink<WebSocket, Frame>,
    mut subscriptions: mpsc::Receiver<SubscriptionChange>,
) -> Result<(), Error> {
    let (mut connections, mut orders, mut logger, mut data) = (None, None, None, None);
    let (mut messages, mut protections) = (None, None);
    loop {
        let frame = tokio::select! {
            biased;
            change = subscriptions.recv() => {
                let Some(change) = change else { return Ok(()); };
                let snapshot = match change {
                    SubscriptionChange::Connections(next) => subscribe_state(Topic::Connections, &mut connections, next)?,
                    SubscriptionChange::StateOrders(next) => subscribe_state(Topic::StateOrders, &mut orders, next)?,
                    SubscriptionChange::Logger(next) => subscribe_state(Topic::Logger, &mut logger, next)?,
                    SubscriptionChange::Data(next) => subscribe_state(Topic::Data, &mut data, next)?,
                    SubscriptionChange::Messages(next) => { messages = next; None }
                    SubscriptionChange::Protections(next) => { protections = next; None }
                };
                let Some(snapshot) = snapshot else { continue; };
                snapshot
            }
            next = next_event(Topic::Protections, &mut protections) => next?,
            next = next_event(Topic::Messages, &mut messages) => next?,
            next = next_state(Topic::Connections, &mut connections) => next?,
            next = next_state(Topic::StateOrders, &mut orders) => next?,
            next = next_state(Topic::Logger, &mut logger) => next?,
            next = next_state(Topic::Data, &mut data) => next?,
        };
        write.send(frame).await?;
    }
}

fn subscribe_state<T: Serialize>(
    topic: Topic,
    state: &mut Option<watch::Receiver<T>>,
    subscription: Option<watch::Receiver<T>>,
) -> Result<Option<Frame>, Error> {
    *state = subscription;
    state
        .as_mut()
        .map(|state| state_frame(topic, state))
        .transpose()
}

async fn next_state<T: Serialize>(
    topic: Topic,
    state: &mut Option<watch::Receiver<T>>,
) -> Result<Frame, Error> {
    let Some(state) = state else {
        return pending().await;
    };
    state.changed().await.map_err(|_| Error::BrokerClosed)?;
    state_frame(topic, state)
}

fn state_frame<T: Serialize>(topic: Topic, state: &mut watch::Receiver<T>) -> Result<Frame, Error> {
    encode(topic, &*state.borrow_and_update())
}

async fn next_event<T: Clone + Serialize>(
    topic: Topic,
    events: &mut Option<broadcast::Receiver<T>>,
) -> Result<Frame, Error> {
    let Some(events) = events else {
        return pending().await;
    };
    let event = events.recv().await.map_err(|error| match error {
        broadcast::error::RecvError::Closed => Error::BrokerClosed,
        broadcast::error::RecvError::Lagged(missed) => Error::EventLagged {
            topic: topic.name(),
            missed,
        },
    })?;
    encode(topic, &event)
}

fn encode(topic: Topic, payload: &impl Serialize) -> Result<Frame, Error> {
    let message = WsMessage {
        topic: topic.name().into(),
        payload: serde_json::to_value(payload)?,
    };
    Ok(Frame::Text(serde_json::to_string(&message)?.into()))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn lagged_event_receiver_reports_its_loss_without_affecting_another_subscriber()
    -> Result<(), Box<dyn std::error::Error>> {
        let (events, stalled) = broadcast::channel(2);
        let mut stalled = Some(stalled);
        let mut current = Some(events.subscribe());

        for count in 1..=3 {
            events.send(count)?;
            let frame = next_event(Topic::Messages, &mut current).await?;
            let message: WsMessage = serde_json::from_str(frame.to_text()?)?;
            assert_eq!(message.payload, count);
        }

        assert!(matches!(
            next_event(Topic::Messages, &mut stalled).await,
            Err(Error::EventLagged {
                topic: "message/update",
                missed: 1
            })
        ));
        drop(stalled);
        events.send(4)?;
        let frame = next_event(Topic::Messages, &mut current).await?;
        let message: WsMessage = serde_json::from_str(frame.to_text()?)?;
        assert_eq!(message.payload, 4);
        Ok(())
    }
}
