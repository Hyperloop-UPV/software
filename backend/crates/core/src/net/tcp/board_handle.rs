use super::SendError;
use crate::model::{BoardId, OrderPacket};
use crate::protocol::{Index, tcp};
use std::sync::Arc;
use tokio::sync::mpsc;

/// Access to one board's TCP client, independent of its current socket.
///
/// Orders are validated and encoded against the shared index before their bytes
/// are queued through a bounded channel. The future connection task owns the
/// receiving end and the socket; this handle owns neither of them.
/// A session writer is implemented; task startup and supervision are still pending.
#[derive(Debug)]
pub struct BoardHandle {
    pub(super) board: BoardId,
    pub(super) index: Arc<Index>,
    pub(super) orders: mpsc::Sender<Vec<u8>>,
}

impl BoardHandle {
    /// The board this handle belongs to.
    #[must_use]
    pub fn board(&self) -> BoardId {
        self.board
    }

    /// Validates, encodes and queues an order, waiting if the channel is full.
    ///
    /// Returns once the encoded bytes are queued, not once they are written to
    /// the socket or received by the board. Encoding runs before waiting for
    /// capacity and uses the existing protocol checks, not application safety
    /// rules. This method does not resolve or check the destination: callers
    /// select the board.
    /// Use [`super::Handles::send`] to resolve the destination by order ID.
    ///
    /// # Errors
    ///
    /// Returns [`SendError::Encode`] if the protocol encoder rejects the ID,
    /// packet type or parameters. No bytes are queued on encoding failure,
    /// even if the channel is full or closed.
    /// Returns [`SendError::Gone`] if encoding succeeds but the receiver has been
    /// closed or dropped, including while this call was waiting for queue capacity.
    /// This indicates an unavailable consumer, not a TCP disconnection.
    pub async fn send(&self, order: OrderPacket) -> Result<(), SendError> {
        let bytes = tcp::encode_order(&order, &self.index).map_err(|source| SendError::Encode {
            board: self.board,
            source,
        })?;
        self.orders
            .send(bytes)
            .await
            .map_err(|_| SendError::Gone(self.board))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        model::{
            AdjId, Board, MacAddress, Measurement, MeasurementKind, NumericKind, PacketDef,
            PacketType, PodData, Value,
        },
        protocol::EncodeError,
    };
    use std::{
        collections::HashMap,
        error::Error as _,
        future::{Future, poll_fn},
        net::Ipv4Addr,
        task::Poll,
    };

    /// Builds a socket-free channel with empty orders, one u8 order and a data ID.
    fn board_channel(capacity: usize) -> (BoardHandle, mpsc::Receiver<Vec<u8>>) {
        let parameter = Measurement {
            id: AdjId(100),
            alias: "value".to_string(),
            name: "Value".to_string(),
            display_units: String::new(),
            kind: MeasurementKind::Numeric {
                wire_type: NumericKind::U8,
            },
            protections: vec![],
        };
        let packets = [
            (600, PacketType::Order(vec![])),
            (601, PacketType::Order(vec![])),
            (602, PacketType::Order(vec![parameter])),
            (1600, PacketType::Data(vec![])),
        ]
        .into_iter()
        .map(|(id, packet_type)| {
            let packet = PacketDef {
                id: AdjId(id),
                board: BoardId(3),
                name: "sample".to_string(),
                packet_type,
            };
            (packet.id, packet)
        })
        .collect();
        let board = Board {
            id: BoardId(3),
            name: "MOCK".to_string(),
            ip: Ipv4Addr::LOCALHOST.into(),
            mac: MacAddress([0; 6]),
            packets,
        };
        let index = Arc::new(Index::new(
            &PodData {
                boards: HashMap::from([(board.id, board)]),
            },
            None,
        ));
        let (orders, receiver) = mpsc::channel(capacity);
        (
            BoardHandle {
                board: BoardId(3),
                index,
                orders,
            },
            receiver,
        )
    }

    #[tokio::test]
    async fn queues_encoded_orders_in_send_order() {
        let (handle, mut receiver) = board_channel(2);
        let first = OrderPacket::new(AdjId(602), vec![Value::Number(42.0)]);
        let second = OrderPacket::new(AdjId(601), vec![]);

        // Check exact little-endian IDs and payload bytes, not just encoder equality.
        assert_eq!(handle.send(first).await, Ok(()));
        assert_eq!(handle.send(second).await, Ok(()));

        assert_eq!(receiver.try_recv(), Ok(vec![0x5a, 0x02, 42]));
        assert_eq!(receiver.try_recv(), Ok(vec![0x59, 0x02]));
        assert_eq!(receiver.try_recv(), Err(mpsc::error::TryRecvError::Empty));
    }

    #[tokio::test]
    async fn waits_for_capacity_without_dropping_orders() {
        let (handle, mut receiver) = board_channel(1);
        let first = OrderPacket::new(AdjId(600), vec![]);
        let second = OrderPacket::new(AdjId(601), vec![]);
        assert_eq!(handle.send(first).await, Ok(()));

        let blocked = handle.send(second);
        tokio::pin!(blocked);

        // Poll explicitly so the test proves backpressure without timing sleeps.
        poll_fn(|cx| {
            assert!(blocked.as_mut().poll(cx).is_pending());
            Poll::Ready(())
        })
        .await;

        assert_eq!(receiver.try_recv(), Ok(vec![0x58, 0x02]));
        assert_eq!(blocked.await, Ok(()));
        assert_eq!(receiver.try_recv(), Ok(vec![0x59, 0x02]));
    }

    #[tokio::test]
    async fn reports_the_board_when_the_receiver_is_dropped() {
        let (handle, receiver) = board_channel(1);
        // A valid order must report consumer loss rather than an encoding failure.
        drop(receiver);

        let order = OrderPacket::new(AdjId(600), vec![]);
        assert_eq!(handle.send(order).await, Err(SendError::Gone(BoardId(3))));
    }

    #[tokio::test]
    async fn a_waiting_send_fails_when_the_receiver_closes() {
        let (handle, mut receiver) = board_channel(1);
        let first = OrderPacket::new(AdjId(600), vec![]);
        // Closing the receiver must retain bytes queued before the blocked send.
        assert_eq!(handle.send(first).await, Ok(()));

        let blocked = handle.send(OrderPacket::new(AdjId(601), vec![]));
        tokio::pin!(blocked);
        poll_fn(|cx| {
            assert!(blocked.as_mut().poll(cx).is_pending());
            Poll::Ready(())
        })
        .await;

        receiver.close();
        assert_eq!(blocked.await, Err(SendError::Gone(BoardId(3))));
        assert_eq!(receiver.try_recv(), Ok(vec![0x58, 0x02]));
        assert_eq!(
            receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Disconnected)
        );
    }

    #[tokio::test]
    async fn rejects_unknown_and_non_order_ids_when_called_directly() {
        let (handle, mut receiver) = board_channel(1);

        // Bypassing Handles must not bypass the protocol's ID and packet-type checks.
        for (id, source) in [
            (AdjId(999), EncodeError::UnknownId(AdjId(999))),
            (
                AdjId(1600),
                EncodeError::WrongPacketType { id: AdjId(1600) },
            ),
        ] {
            assert_eq!(
                handle.send(OrderPacket::new(id, vec![])).await,
                Err(SendError::Encode {
                    board: BoardId(3),
                    source
                })
            );
            assert_eq!(receiver.try_recv(), Err(mpsc::error::TryRecvError::Empty));
        }
    }

    #[tokio::test]
    async fn rejects_missing_and_extra_parameters_without_queueing_bytes() {
        let (handle, mut receiver) = board_channel(1);

        // Both missing and extra parameters must fail before any frame enters the queue.
        for values in [vec![], vec![Value::Number(1.0), Value::Number(2.0)]] {
            let got = values.len();
            assert_eq!(
                handle.send(OrderPacket::new(AdjId(602), values)).await,
                Err(SendError::Encode {
                    board: BoardId(3),
                    source: EncodeError::WrongFieldCount { expected: 1, got },
                })
            );
            assert_eq!(receiver.try_recv(), Err(mpsc::error::TryRecvError::Empty));
        }
    }

    #[tokio::test]
    async fn rejects_a_wrong_parameter_type_without_queueing_bytes() {
        let (handle, mut receiver) = board_channel(1);

        // A boolean cannot stand in for the numeric field declared in the index.
        assert_eq!(
            handle
                .send(OrderPacket::new(AdjId(602), vec![Value::Bool(true)]))
                .await,
            Err(SendError::Encode {
                board: BoardId(3),
                source: EncodeError::TypeMismatch,
            })
        );
        assert_eq!(receiver.try_recv(), Err(mpsc::error::TryRecvError::Empty));
    }

    #[tokio::test]
    async fn preserves_numeric_range_errors_without_queueing_bytes() {
        let (handle, mut receiver) = board_channel(1);

        // Preserve the encoder's bounds and rejected value, including NaN and infinity.
        for number in [-1.0, 256.0, f64::NAN, f64::INFINITY] {
            let result = handle
                .send(OrderPacket::new(AdjId(602), vec![Value::Number(number)]))
                .await;
            let Err(SendError::Encode {
                board,
                source: EncodeError::OutOfRange { value, min, max },
            }) = result
            else {
                unreachable!("these values cannot be encoded as u8");
            };
            assert_eq!(board, BoardId(3));
            assert!(value == number || (value.is_nan() && number.is_nan()));
            assert_eq!((min, max), (0.0, 255.0));
            assert_eq!(receiver.try_recv(), Err(mpsc::error::TryRecvError::Empty));
        }
    }

    #[tokio::test]
    async fn rejects_an_invalid_order_before_waiting_for_capacity() {
        let (handle, mut receiver) = board_channel(1);
        assert_eq!(
            handle.send(OrderPacket::new(AdjId(600), vec![])).await,
            Ok(())
        );

        // Explicit polling proves validation returns immediately despite a full queue.
        let invalid = handle.send(OrderPacket::new(AdjId(602), vec![]));
        tokio::pin!(invalid);
        let result = poll_fn(|cx| match invalid.as_mut().poll(cx) {
            Poll::Ready(result) => Poll::Ready(result),
            Poll::Pending => unreachable!("invalid orders must not wait for queue capacity"),
        })
        .await;
        assert_eq!(
            result,
            Err(SendError::Encode {
                board: BoardId(3),
                source: EncodeError::WrongFieldCount {
                    expected: 1,
                    got: 0
                },
            })
        );
        assert_eq!(receiver.try_recv(), Ok(vec![0x58, 0x02]));
        assert_eq!(receiver.try_recv(), Err(mpsc::error::TryRecvError::Empty));
    }

    #[tokio::test]
    async fn reports_encoding_failure_before_a_closed_receiver() {
        let (handle, receiver) = board_channel(1);
        drop(receiver);

        // Encoding precedes channel access, so invalid input remains an input error.
        assert_eq!(
            handle.send(OrderPacket::new(AdjId(602), vec![])).await,
            Err(SendError::Encode {
                board: BoardId(3),
                source: EncodeError::WrongFieldCount {
                    expected: 1,
                    got: 0
                },
            })
        );
    }

    #[tokio::test]
    async fn encoding_errors_expose_the_original_protocol_source() {
        let (handle, _receiver) = board_channel(1);

        // Callers can inspect the original error through the standard error chain.
        let Err(error) = handle.send(OrderPacket::new(AdjId(602), vec![])).await else {
            unreachable!("the numeric parameter is missing");
        };
        let source = error
            .source()
            .and_then(|source| source.downcast_ref::<EncodeError>());
        assert_eq!(
            source,
            Some(&EncodeError::WrongFieldCount {
                expected: 1,
                got: 0
            })
        );
        assert!(error.to_string().contains("BoardId(3)"));
    }

    #[tokio::test]
    async fn direct_sends_keep_the_callers_selected_board() {
        let (mut handle, mut receiver) = board_channel(1);

        // Direct sends validate encoding, not destination ownership; routing stays in Handles.
        handle.board = BoardId(9);
        assert_eq!(
            handle.send(OrderPacket::new(AdjId(600), vec![])).await,
            Ok(())
        );
        assert_eq!(receiver.try_recv(), Ok(vec![0x58, 0x02]));
    }
}
