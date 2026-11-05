use super::{BoardHandle, SendError};
use crate::model::{BoardId, OrderPacket, PacketType};
use crate::protocol::Index;
use std::{collections::HashMap, sync::Arc};

/// Access to the configured boards' TCP clients.
///
/// A board remains in this collection while disconnected. Connection state
/// belongs to its task, not to the presence of its handle in this map.
/// The shared, read-only index resolves order IDs to their destination boards.
#[derive(Debug)]
pub struct Handles {
    boards: HashMap<BoardId, BoardHandle>,
    index: Arc<Index>,
}

impl Handles {
    /// Returns the handle for a configured board, regardless of connection state.
    #[must_use]
    pub fn board(&self, board: BoardId) -> Option<&BoardHandle> {
        self.boards.get(&board)
    }

    /// Resolves an order's destination through the index and queues it there.
    ///
    /// Only IDs declared as orders are accepted. The destination handle validates
    /// and encodes the parameters before queueing the bytes. Like
    /// [`BoardHandle::send`], this waits for queue capacity and returns once the
    /// bytes are queued, not written to TCP.
    /// It does not broadcast reserved IDs or send anything to other boards.
    ///
    /// # Errors
    ///
    /// Returns [`SendError::UnknownId`] if the ID is absent or declared as a
    /// different packet type, [`SendError::NoClient`] if the destination board
    /// has no configured handle, [`SendError::Encode`] if encoding fails, or
    /// [`SendError::Gone`] if encoding succeeds but its receiver is closed.
    pub async fn send(&self, order: OrderPacket) -> Result<(), SendError> {
        let definition = self
            .index
            .packet(order.id)
            .filter(|definition| matches!(&definition.packet_type, PacketType::Order(_)))
            .ok_or(SendError::UnknownId(order.id))?;
        let handle = self
            .board(definition.board)
            .ok_or(SendError::NoClient(definition.board))?;

        handle.send(order).await
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        model::{
            AdjId, Board, MacAddress, Measurement, MeasurementKind, MessageLevel, NumericKind,
            PacketDef, PodData, Value,
        },
        protocol::EncodeError,
    };
    use std::net::IpAddr;
    use tokio::sync::mpsc;

    /// Shares one index between routing and both boards' encoding channels.
    fn sample_handles() -> (Handles, mpsc::Receiver<Vec<u8>>, mpsc::Receiver<Vec<u8>>) {
        let boards = [(1, 600), (3, 601)]
            .into_iter()
            .map(|(board_id, order_id)| {
                let order = PacketDef {
                    id: AdjId(order_id),
                    board: BoardId(board_id),
                    name: "order".to_string(),
                    packet_type: PacketType::Order(if board_id == 1 {
                        vec![Measurement {
                            id: AdjId(100),
                            alias: "value".to_string(),
                            name: "Value".to_string(),
                            display_units: String::new(),
                            kind: MeasurementKind::Numeric {
                                wire_type: NumericKind::U8,
                            },
                            protections: vec![],
                        }]
                    } else {
                        vec![]
                    }),
                };
                let data = PacketDef {
                    id: AdjId(order_id + 1000),
                    board: BoardId(board_id),
                    name: "data".to_string(),
                    packet_type: PacketType::Data(vec![]),
                };
                let board = Board {
                    id: BoardId(board_id),
                    name: "MOCK".to_string(),
                    ip: IpAddr::from([127, 0, 0, 1]),
                    mac: MacAddress([0; 6]),
                    packets: HashMap::from([(order.id, order), (data.id, data)]),
                };
                (board.id, board)
            })
            .collect();
        let message_levels = HashMap::from([(AdjId(2), MessageLevel::Fault)]);
        let index = Arc::new(Index::new(&PodData { boards }, Some(&message_levels)));
        let (first_orders, first_receiver) = mpsc::channel(2);
        let (third_orders, third_receiver) = mpsc::channel(2);
        let handles = Handles {
            index: Arc::clone(&index),
            boards: HashMap::from([
                (
                    BoardId(1),
                    BoardHandle {
                        board: BoardId(1),
                        index: Arc::clone(&index),
                        orders: first_orders,
                    },
                ),
                (
                    BoardId(3),
                    BoardHandle {
                        board: BoardId(3),
                        index: Arc::clone(&index),
                        orders: third_orders,
                    },
                ),
            ]),
        };

        (handles, first_receiver, third_receiver)
    }

    #[test]
    fn finds_each_configured_board_without_a_socket() {
        let (handles, _first_receiver, _third_receiver) = sample_handles();

        // Lookup and encoding share one immutable index, without opening sockets.
        assert_eq!(
            handles.board(BoardId(1)).map(BoardHandle::board),
            Some(BoardId(1))
        );
        assert_eq!(
            handles.board(BoardId(3)).map(BoardHandle::board),
            Some(BoardId(3))
        );
        for handle in handles.boards.values() {
            assert!(Arc::ptr_eq(&handles.index, &handle.index));
        }
    }

    #[test]
    fn returns_none_for_an_unconfigured_board() {
        let (handles, _first_receiver, _third_receiver) = sample_handles();

        // The index alone does not create handles for unconfigured boards.
        assert!(handles.board(BoardId(2)).is_none());
    }

    #[tokio::test]
    async fn routes_each_order_only_to_its_declared_board() {
        let (handles, mut first_receiver, mut third_receiver) = sample_handles();
        let first = OrderPacket::new(AdjId(600), vec![Value::Number(42.0)]);
        let third = OrderPacket::new(AdjId(601), vec![]);

        // Routing must deliver encoded bytes only to the declared destination.
        assert_eq!(handles.send(first).await, Ok(()));
        assert_eq!(first_receiver.try_recv(), Ok(vec![0x58, 0x02, 42]));
        assert_eq!(
            third_receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Empty)
        );

        assert_eq!(handles.send(third).await, Ok(()));
        assert_eq!(third_receiver.try_recv(), Ok(vec![0x59, 0x02]));
        assert_eq!(
            first_receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Empty)
        );
    }

    #[tokio::test]
    async fn rejects_an_unknown_id_without_queueing_anything() {
        let (handles, mut first_receiver, mut third_receiver) = sample_handles();
        let order = OrderPacket::new(AdjId(999), vec![]);

        // Unknown IDs fail during routing, before any board channel is touched.
        assert_eq!(
            handles.send(order).await,
            Err(SendError::UnknownId(AdjId(999)))
        );
        assert_eq!(
            first_receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Empty)
        );
        assert_eq!(
            third_receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Empty)
        );
    }

    #[tokio::test]
    async fn rejects_non_order_ids_without_queueing_anything() {
        let (handles, mut first_receiver, mut third_receiver) = sample_handles();

        // Message IDs also resolve through Index, but are not outbound orders.
        for id in [AdjId(1600), AdjId(1601), AdjId(2)] {
            let order = OrderPacket::new(id, vec![]);
            assert_eq!(handles.send(order).await, Err(SendError::UnknownId(id)));
        }

        assert_eq!(
            first_receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Empty)
        );
        assert_eq!(
            third_receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Empty)
        );
    }

    #[tokio::test]
    async fn reports_an_unconfigured_destination_without_using_another_board() {
        let (mut handles, mut first_receiver, mut third_receiver) = sample_handles();
        handles.boards.remove(&BoardId(3));
        let order = OrderPacket::new(AdjId(601), vec![]);

        // A missing destination must not fall back to an unrelated board's queue.
        assert_eq!(
            handles.send(order).await,
            Err(SendError::NoClient(BoardId(3)))
        );
        assert_eq!(
            first_receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Empty)
        );
        assert_eq!(
            third_receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Disconnected)
        );
    }

    #[tokio::test]
    async fn reports_the_destination_when_its_receiver_is_gone() {
        let (handles, mut first_receiver, third_receiver) = sample_handles();
        drop(third_receiver);
        let order = OrderPacket::new(AdjId(601), vec![]);

        // Valid encoding must preserve Gone from the selected board's closed channel.
        assert_eq!(handles.send(order).await, Err(SendError::Gone(BoardId(3))));
        assert_eq!(
            first_receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Empty)
        );
    }

    #[tokio::test]
    async fn returns_the_destination_encoding_error_without_queueing_anything() {
        let (handles, mut first_receiver, mut third_receiver) = sample_handles();

        // Handles must propagate protocol validation failures from the destination handle.
        let order = OrderPacket::new(AdjId(600), vec![Value::Bool(true)]);
        assert_eq!(
            handles.send(order).await,
            Err(SendError::Encode {
                board: BoardId(1),
                source: EncodeError::TypeMismatch,
            })
        );
        assert_eq!(
            first_receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Empty)
        );
        assert_eq!(
            third_receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Empty)
        );
    }
}
