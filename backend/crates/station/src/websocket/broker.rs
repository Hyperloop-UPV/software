//! Publishes current state and forwards messages and protection events.

use std::time::Duration;

use super::payload::{
    Connection, ConnectionUpdate, DataPacketUpdate, DataUpdate, LoggerResponse, MessageUpdate,
    ProtectionUpdate, StateOrdersUpdate,
};
use tokio::{
    sync::{broadcast, mpsc, watch},
    time::{Instant, MissedTickBehavior, interval_at},
};

pub use super::error::Error;

const EVENT_CAPACITY: usize = 128;

#[derive(Debug)]
enum Update {
    Connection(Connection),
    StateOrders(StateOrdersUpdate),
    Logger(LoggerResponse),
    Data(DataPacketUpdate),
    Message(MessageUpdate),
    Protection(ProtectionUpdate),
}

/// Owns the topic states and processes incoming updates.
#[derive(Debug)]
pub struct Broker {
    updates: mpsc::Receiver<Update>,
    connections: watch::Sender<ConnectionUpdate>,
    state_orders: watch::Sender<StateOrdersUpdate>,
    logger: watch::Sender<LoggerResponse>,
    data: watch::Sender<DataUpdate>,
    messages: broadcast::Sender<MessageUpdate>,
    protections: broadcast::Sender<ProtectionUpdate>,
}

/// Clonable access to publication and subscriptions.
#[derive(Debug, Clone)]
pub struct BrokerClient {
    updates: mpsc::Sender<Update>,
    connections: watch::Receiver<ConnectionUpdate>,
    state_orders: watch::Receiver<StateOrdersUpdate>,
    logger: watch::Receiver<LoggerResponse>,
    data: watch::Receiver<DataUpdate>,
    messages: broadcast::WeakSender<MessageUpdate>,
    protections: broadcast::WeakSender<ProtectionUpdate>,
}

impl Broker {
    /// Starts with empty state maps and a stopped logger.
    pub fn new() -> (Self, BrokerClient) {
        let (updates, receiver) = mpsc::channel(32);
        let (connections, state) = watch::channel(ConnectionUpdate::new());
        let (state_orders, orders) = watch::channel(StateOrdersUpdate::new());
        let (logger, recording) = watch::channel(false);
        let (data, telemetry) = watch::channel(DataUpdate::new());
        let (messages, _) = broadcast::channel(EVENT_CAPACITY);
        let (protections, _) = broadcast::channel(EVENT_CAPACITY);
        let message_topic = messages.downgrade();
        let protection_topic = protections.downgrade();
        (
            Self {
                updates: receiver,
                connections,
                state_orders,
                logger,
                data,
                messages,
                protections,
            },
            BrokerClient {
                updates,
                connections: state,
                state_orders: orders,
                logger: recording,
                data: telemetry,
                messages: message_topic,
                protections: protection_topic,
            },
        )
    }

    /// Processes updates until all publishing clients have been dropped.
    pub async fn run(mut self) {
        let period = Duration::from_millis(100);
        let mut tick = interval_at(Instant::now() + period, period);
        tick.set_missed_tick_behavior(MissedTickBehavior::Skip);
        let mut pending = DataUpdate::new();
        loop {
            tokio::select! {
                update = self.updates.recv() => {
                    match update {
                        Some(Update::Connection(connection)) => self.connections.send_modify(|state| {
                            state.insert(connection.name.clone(), connection);
                        }),
                        Some(Update::StateOrders(orders)) => { self.state_orders.send_replace(orders); }
                        Some(Update::Logger(recording)) => { self.logger.send_replace(recording); }
                        Some(Update::Data(packet)) => { pending.insert(packet.id.0, packet); }
                        Some(Update::Message(message)) => { let _ = self.messages.send(message); }
                        Some(Update::Protection(protection)) => { let _ = self.protections.send(protection); }
                        None => {
                            self.flush_data(&mut pending);
                            return;
                        }
                    }
                }
                _ = tick.tick() => self.flush_data(&mut pending),
            }
        }
    }

    fn flush_data(&self, pending: &mut DataUpdate) {
        if !pending.is_empty() {
            self.data.send_modify(|state| state.extend(pending.drain()));
        }
    }
}

impl BrokerClient {
    /// Queues a board connection update, waiting if the input channel is full.
    pub async fn publish_connection(&self, connection: Connection) -> Result<(), Error> {
        self.publish(Update::Connection(connection)).await
    }

    /// Queues the complete map of enabled orders, replacing the previous map.
    pub async fn publish_state_orders(&self, orders: StateOrdersUpdate) -> Result<(), Error> {
        self.publish(Update::StateOrders(orders)).await
    }

    /// Queues the actual logger state reported by the backend.
    pub async fn publish_logger(&self, recording: LoggerResponse) -> Result<(), Error> {
        self.publish(Update::Logger(recording)).await
    }

    /// Queues a complete, prepared packet update for the next 100 ms batch.
    pub async fn publish_data(&self, packet: DataPacketUpdate) -> Result<(), Error> {
        self.publish(Update::Data(packet)).await
    }

    /// Queues a message for current subscribers.
    pub async fn publish_message(&self, message: MessageUpdate) -> Result<(), Error> {
        self.publish(Update::Message(message)).await
    }

    /// Queues a protection event for current subscribers.
    pub async fn publish_protection(&self, protection: ProtectionUpdate) -> Result<(), Error> {
        self.publish(Update::Protection(protection)).await
    }

    async fn publish(&self, update: Update) -> Result<(), Error> {
        self.updates
            .send(update)
            .await
            .map_err(|_| Error::BrokerClosed)
    }

    /// Subscribes to the complete connection map, starting at its current state.
    /// Read that state with `borrow_and_update()`, then wait on `changed()`.
    pub fn subscribe_connections(&self) -> watch::Receiver<ConnectionUpdate> {
        subscribe(&self.connections)
    }

    /// Subscribes to the complete map of enabled order ids by board name.
    pub fn subscribe_state_orders(&self) -> watch::Receiver<StateOrdersUpdate> {
        subscribe(&self.state_orders)
    }

    /// Subscribes to the actual recording state, initially `false`.
    pub fn subscribe_logger(&self) -> watch::Receiver<LoggerResponse> {
        subscribe(&self.logger)
    }

    /// Subscribes to the complete telemetry map, initially empty.
    pub fn subscribe_data(&self) -> watch::Receiver<DataUpdate> {
        subscribe(&self.data)
    }

    /// Subscribes to future messages.
    pub fn subscribe_messages(&self) -> Result<broadcast::Receiver<MessageUpdate>, Error> {
        let sender = self.messages.upgrade().ok_or(Error::BrokerClosed)?;
        Ok(sender.subscribe())
    }

    /// Subscribes to future protection events.
    pub fn subscribe_protections(&self) -> Result<broadcast::Receiver<ProtectionUpdate>, Error> {
        let sender = self.protections.upgrade().ok_or(Error::BrokerClosed)?;
        Ok(sender.subscribe())
    }
}

fn subscribe<T>(state: &watch::Receiver<T>) -> watch::Receiver<T> {
    let mut receiver = state.clone();
    receiver.borrow_and_update();
    receiver
}

#[cfg(test)]
mod tests {
    use std::time::Duration;

    use tokio::time::{advance, timeout};

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
        assert!(matches!(
            client.publish_state_orders(StateOrdersUpdate::new()).await,
            Err(Error::BrokerClosed)
        ));
        assert!(matches!(
            client.publish_logger(true).await,
            Err(Error::BrokerClosed)
        ));
        assert!(matches!(
            client.publish_data(packet(1000, 1)).await,
            Err(Error::BrokerClosed)
        ));
    }

    #[tokio::test(start_paused = true)]
    async fn telemetry_batches_latest_packets_and_keeps_the_complete_state()
    -> Result<(), Box<dyn std::error::Error>> {
        let (broker, client) = Broker::new();
        let mut data = client.subscribe_data();
        let mut logger = client.subscribe_logger();
        assert!(data.borrow_and_update().is_empty());
        let worker = tokio::spawn(broker.run());
        tokio::task::yield_now().await;

        client.publish_data(packet(1000, 1)).await?;
        client.publish_data(packet(2000, 1)).await?;
        client.publish_data(packet(1000, 2)).await?;
        // The logger update is a barrier: the preceding inputs have been processed.
        client.publish_logger(true).await?;
        logger.changed().await?;
        assert!(!data.has_changed()?);
        advance(Duration::from_millis(99)).await;
        assert!(!data.has_changed()?);
        advance(Duration::from_millis(1)).await;
        timeout(Duration::from_millis(1), data.changed()).await??;
        let snapshot = data.borrow_and_update().clone();
        assert_eq!(snapshot.len(), 2);
        assert_eq!(snapshot[&1000].count, 2);
        assert_eq!(snapshot[&2000].count, 1);

        let late = client.subscribe_data();
        assert_eq!(*late.borrow(), snapshot);
        assert!(!late.has_changed()?);
        advance(Duration::from_millis(100)).await;
        tokio::task::yield_now().await;
        assert!(!data.has_changed()?, "idle ticks must not publish");

        client.publish_data(packet(2000, 2)).await?;
        client.publish_logger(false).await?;
        logger.changed().await?;
        advance(Duration::from_millis(100)).await;
        timeout(Duration::from_millis(1), data.changed()).await??;
        assert_eq!(data.borrow()[&1000].count, 2);
        assert_eq!(data.borrow()[&2000].count, 2);

        drop(client);
        timeout(Duration::from_secs(1), worker).await??;
        Ok(())
    }

    #[tokio::test]
    async fn orders_and_logger_keep_independent_current_states()
    -> Result<(), Box<dyn std::error::Error>> {
        let (broker, client) = Broker::new();
        let mut orders = client.subscribe_state_orders();
        let mut logger = client.subscribe_logger();
        assert!(orders.borrow_and_update().is_empty());
        assert!(!*logger.borrow_and_update());
        let worker = tokio::spawn(broker.run());

        let initial = StateOrdersUpdate::from([("LCU".into(), vec![1001, 1002])]);
        client.publish_state_orders(initial.clone()).await?;
        timeout(Duration::from_secs(1), orders.changed()).await??;
        assert_eq!(*orders.borrow_and_update(), initial);
        assert!(!logger.has_changed()?);

        client.publish_logger(true).await?;
        timeout(Duration::from_secs(1), logger.changed()).await??;
        assert!(*logger.borrow_and_update());
        assert!(!orders.has_changed()?);

        // A full snapshot replaces previous boards and can clear enabled orders.
        let current = StateOrdersUpdate::from([("HVBMS".into(), vec![])]);
        client.publish_state_orders(current.clone()).await?;
        timeout(Duration::from_secs(1), orders.changed()).await??;
        assert_eq!(*orders.borrow_and_update(), current);
        let late_orders = client.subscribe_state_orders();
        let late_logger = client.subscribe_logger();
        assert_eq!(*late_orders.borrow(), current);
        assert!(*late_logger.borrow());
        assert!(!late_orders.has_changed()?);
        assert!(!late_logger.has_changed()?);

        drop(client);
        timeout(Duration::from_secs(1), worker).await??;
        Ok(())
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
        let orders = client.subscribe_state_orders();
        let logger = client.subscribe_logger();
        client
            .publish_state_orders(StateOrdersUpdate::from([("LCU".into(), vec![1001])]))
            .await?;
        client.publish_logger(true).await?;
        let data = client.subscribe_data();
        client.publish_data(packet(1000, 1)).await?;
        drop(client);

        timeout(Duration::from_secs(1), broker.run()).await?;
        assert!(state.borrow()["LCU"].is_connected);
        assert_eq!(orders.borrow()["LCU"], [1001]);
        assert!(*logger.borrow());
        assert_eq!(data.borrow()[&1000].count, 1);
        Ok(())
    }

    fn packet(id: u16, count: u64) -> DataPacketUpdate {
        DataPacketUpdate {
            id: software_core::model::AdjId(id),
            hex_value: String::new(),
            count,
            cycle_time: 100_000_000,
            measurement_updates: Default::default(),
        }
    }
}
