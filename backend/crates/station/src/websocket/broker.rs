//! Publishes the current board connection state to subscribers.

use super::payload::{Connection, ConnectionUpdate};
use tokio::sync::{mpsc, watch};

pub use super::error::Error;

/// Owns the connection state and processes incoming updates.
#[derive(Debug)]
pub struct Broker {
    updates: mpsc::Receiver<Connection>,
    connections: watch::Sender<ConnectionUpdate>,
}

/// Clonable access to connection publication and subscriptions.
#[derive(Debug, Clone)]
pub struct BrokerClient {
    updates: mpsc::Sender<Connection>,
    connections: watch::Receiver<ConnectionUpdate>,
}

impl Broker {
    /// Creates a broker and its client, initially with no known connections.
    pub fn new() -> (Self, BrokerClient) {
        let (updates, receiver) = mpsc::channel(32);
        let (connections, state) = watch::channel(ConnectionUpdate::new());
        (
            Self {
                updates: receiver,
                connections,
            },
            BrokerClient {
                updates,
                connections: state,
            },
        )
    }

    /// Processes updates until all publishing clients have been dropped.
    pub async fn run(mut self) {
        while let Some(connection) = self.updates.recv().await {
            self.connections.send_modify(|state| {
                state.insert(connection.name.clone(), connection);
            });
        }
    }
}

impl BrokerClient {
    /// Queues a board connection update, waiting if the input channel is full.
    pub async fn publish_connection(&self, connection: Connection) -> Result<(), Error> {
        self.updates
            .send(connection)
            .await
            .map_err(|_| Error::BrokerClosed)
    }

    /// Subscribes to the complete connection map, starting at its current state.
    /// Read that state with `borrow_and_update()`, then wait on `changed()`.
    pub fn subscribe_connections(&self) -> watch::Receiver<ConnectionUpdate> {
        let mut receiver = self.connections.clone();
        receiver.borrow_and_update();
        receiver
    }
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use tokio::time::timeout;

    use super::*;

    #[tokio::test]
    async fn subscribers_receive_complete_state_and_late_subscribers_start_current()
    -> Result<(), Box<dyn std::error::Error>> {
        let (broker, client) = Broker::new();
        let publisher = client.clone();
        let mut first = client.subscribe_connections();
        let mut second = client.subscribe_connections();
        assert!(first.borrow_and_update().is_empty());
        assert!(second.borrow_and_update().is_empty());
        let worker = tokio::spawn(broker.run());

        for (name, is_connected) in [("LCU", true), ("HVBMS", true), ("LCU", false)] {
            publisher
                .publish_connection(Connection {
                    name: name.into(),
                    is_connected,
                })
                .await?;
            timeout(Duration::from_secs(1), first.changed()).await??;
            timeout(Duration::from_secs(1), second.changed()).await??;
            let state = first.borrow_and_update().clone();
            assert_eq!(state, *second.borrow_and_update());
            assert_eq!(state[name].is_connected, is_connected);
            assert_eq!(state[name].name, name);
        }

        let mut late = client.subscribe_connections();
        assert!(!late.has_changed()?);
        let state = late.borrow_and_update().clone();
        assert_eq!(state.len(), 2);
        assert!(!state["LCU"].is_connected);
        assert!(state["HVBMS"].is_connected);

        drop(publisher);
        drop(client);
        timeout(Duration::from_secs(1), worker).await??;
        assert!(late.changed().await.is_err());
        Ok(())
    }

    #[tokio::test]
    async fn publication_fails_when_broker_is_closed() {
        let (broker, client) = Broker::new();
        drop(broker);
        let result = client
            .publish_connection(Connection {
                name: "LCU".into(),
                is_connected: true,
            })
            .await;
        assert!(matches!(result, Err(Error::BrokerClosed)));
    }

    #[tokio::test]
    async fn broker_drains_queued_updates_before_stopping() -> Result<(), Box<dyn std::error::Error>>
    {
        let (broker, client) = Broker::new();
        let state = client.subscribe_connections();
        client
            .publish_connection(Connection {
                name: "LCU".into(),
                is_connected: true,
            })
            .await?;
        drop(client);

        timeout(Duration::from_secs(1), broker.run()).await?;
        assert!(state.borrow()["LCU"].is_connected);
        Ok(())
    }
}
