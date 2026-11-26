//! Shared test-only ADJ, socket, event and scripted-write fixtures.
use super::*;
use crate::protocol::{
    packet::{message, protection},
    tcp::TcpFrame,
};
use crate::{
    model::{
        AdjId, Board, MacAddress, Measurement, MeasurementKind, MessageLevel, MessagePacket,
        NumericKind, OrderPacket, PacketDef, PacketType, PodData, ProtectionPacket, ShortTimestamp,
        Value,
    },
    net::{Event, Notification, Sinks},
};
use std::{
    future::Future,
    net::{IpAddr, Ipv4Addr},
};
use tokio::{
    io::AsyncReadExt,
    net::{TcpListener, TcpStream},
    time::timeout,
};

pub(super) type TestResult<T = ()> = Result<T, Box<dyn std::error::Error>>;
pub(super) const LIMIT: Duration = Duration::from_secs(4);
pub(super) const BOARD: BoardId = BoardId(7);

pub(super) fn index() -> Arc<Index> {
    let parameter = Measurement {
        id: AdjId(100),
        alias: "v".into(),
        name: "Value".into(),
        display_units: String::new(),
        kind: MeasurementKind::Numeric {
            wire_type: NumericKind::U8,
        },
        protections: vec![],
    };
    let boards = [(7, 600), (9, 601)]
        .into_iter()
        .map(|(board, id)| {
            let id = AdjId(id);
            let board = Board {
                id: BoardId(board),
                name: "TEST".into(),
                ip: Ipv4Addr::LOCALHOST.into(),
                mac: MacAddress([0; 6]),
                packets: HashMap::from([
                    (
                        id,
                        PacketDef {
                            id,
                            board: BoardId(board),
                            name: "order".into(),
                            packet_type: PacketType::Order(vec![parameter.clone()]),
                        },
                    ),
                    (
                        AdjId(id.0 + 1000),
                        PacketDef {
                            id: AdjId(id.0 + 1000),
                            board: BoardId(board),
                            name: "data".into(),
                            packet_type: PacketType::Data(vec![]),
                        },
                    ),
                ]),
            };
            (board.id, board)
        })
        .collect();
    Arc::new(Index::new(&PodData { boards }, None))
}
pub(super) fn order(id: u16, value: f64) -> OrderPacket {
    OrderPacket::new(AdjId(id), vec![Value::Number(value)])
}
pub(super) fn config(addr: SocketAddr) -> TcpConfig {
    TcpConfig {
        boards: vec![BoardLink {
            board: BOARD,
            addr,
            local_port: Port(0),
        }],
        connect_timeout: Duration::from_millis(50),
        backoff: Backoff::new(50, 100),
        keep_alive: Duration::ZERO,
        write_timeout: Duration::from_millis(100),
    }
}
pub(super) async fn event(sinks: &mut Sinks) -> TestResult<Notification> {
    timeout(LIMIT, sinks.notifications.recv())
        .await?
        .ok_or_else(|| "reporting stopped".into())
}
pub(super) async fn connected(sinks: &mut Sinks) -> TestResult {
    assert!(matches!(event(sinks).await?.event, Event::Connected));
    Ok(())
}
pub(super) async fn peer_closed(peer: &mut TcpStream) -> TestResult {
    let mut byte = [0];
    match timeout(LIMIT, peer.read(&mut byte)).await? {
        Ok(0) => (),
        Err(error) if error.kind() == std::io::ErrorKind::ConnectionReset => (),
        other => return Err(format!("expected closed socket, got {other:?}").into()),
    }
    Ok(())
}
pub(super) async fn bounded(test: impl Future<Output = TestResult>) -> TestResult {
    timeout(LIMIT, test).await?
}

/// Client and mock peer, both bounded by the caller's existing test deadline.
pub(super) async fn socket_pair(budget: Duration) -> TestResult<(TcpStream, TcpStream)> {
    let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
    let client = timeout(budget, TcpStream::connect(listener.local_addr()?)).await??;
    let (peer, _) = timeout(budget, listener.accept()).await??;
    Ok((client, peer))
}

pub(super) fn inbound_frames() -> (Index, Vec<(TcpFrame, Vec<u8>)>) {
    let packets = [
        (100, MeasurementKind::Boolean),
        (
            101,
            MeasurementKind::Numeric {
                wire_type: NumericKind::F64,
            },
        ),
    ]
    .into_iter()
    .map(|(id, kind)| {
        let id = AdjId(id);
        let definition = PacketDef {
            id: AdjId((1 << 13) | id.0),
            board: BoardId(1),
            name: "protection".to_string(),
            packet_type: PacketType::Protection(Measurement {
                id,
                alias: "watched".to_string(),
                name: "Watched".to_string(),
                display_units: String::new(),
                kind,
                protections: vec![],
            }),
        };
        (definition.id, definition)
    })
    .collect();
    let board = Board {
        id: BoardId(1),
        name: "MOCK".to_string(),
        ip: IpAddr::from([127, 0, 0, 1]),
        mac: MacAddress([0; 6]),
        packets,
    };
    let pod = PodData {
        boards: HashMap::from([(board.id, board)]),
    };
    let levels = HashMap::from([(AdjId(10), MessageLevel::Fault)]);
    let index = Index::new(&pod, Some(&levels));
    let timestamp = ShortTimestamp {
        hour: 12,
        minute: 30,
        second: 0,
        subsecond: 0,
    };
    let frames = [
        TcpFrame::Protection(ProtectionPacket {
            id: AdjId((1 << 13) | 100),
            timestamp,
            value: Value::Bool(true),
        }),
        TcpFrame::Message(MessagePacket {
            id: AdjId(10),
            timestamp,
            origin: "LCU".to_string(),
            message: "temperature \u{00b0}C".to_string(),
        }),
        TcpFrame::Protection(ProtectionPacket {
            id: AdjId((1 << 13) | 101),
            timestamp,
            value: Value::Number(42.25),
        }),
        TcpFrame::Message(MessagePacket {
            id: AdjId(10),
            timestamp,
            origin: String::new(),
            message: String::new(),
        }),
    ]
    .into_iter()
    .map(|frame| {
        let encoded = match &frame {
            TcpFrame::Protection(packet) => protection::encode(packet, &index),
            TcpFrame::Message(packet) => message::encode(packet, &index),
        };
        let Ok(bytes) = encoded else {
            unreachable!("the sample frames match their index definitions");
        };
        (frame, bytes)
    })
    .collect();

    (index, frames)
}

/// Deterministic partial-write and control scheduling fixtures.
pub(super) mod writes {
    //! Scripted writes exercise partial-frame failures without relying on OS buffers.
    use crate::model::BoardId;
    use crate::net::tcp::{
        endpoint::{Endpoint, Registration},
        keep_alive::Settings,
        writer::{SessionWriter, lock},
    };
    use std::sync::Mutex as StdMutex;
    use std::{
        collections::VecDeque,
        future::{Future, poll_fn},
        pin::Pin,
        task::{Context, Poll},
    };
    use std::{io, sync::Arc, time::Duration};
    use tokio::io::AsyncWrite;

    pub(in crate::net::tcp) const BOARD: BoardId = BoardId(7);
    pub(in crate::net::tcp) const BUDGET: Duration = Duration::from_millis(20);

    #[derive(Debug)]
    pub(in crate::net::tcp) enum Step {
        Write(usize),
        Fail(io::ErrorKind),
        Pending,
        Zero,
    }
    #[derive(Debug, Default)]
    pub(in crate::net::tcp) struct Trace {
        pub(in crate::net::tcp) bytes: Vec<u8>,
        pub(in crate::net::tcp) calls: usize,
        pub(in crate::net::tcp) dropped: bool,
        pub(in crate::net::tcp) resume: bool,
    }
    #[derive(Debug)]
    pub(in crate::net::tcp) struct Script {
        steps: VecDeque<Step>,
        trace: Arc<StdMutex<Trace>>,
    }
    impl Drop for Script {
        fn drop(&mut self) {
            lock(&self.trace).dropped = true;
        }
    }
    impl AsyncWrite for Script {
        fn poll_write(
            mut self: Pin<&mut Self>,
            _: &mut Context<'_>,
            bytes: &[u8],
        ) -> Poll<io::Result<usize>> {
            lock(&self.trace).calls += 1;
            match self.steps.pop_front() {
                Some(Step::Pending) if !lock(&self.trace).resume => {
                    self.steps.push_front(Step::Pending);
                    Poll::Pending
                }
                Some(Step::Fail(kind)) => Poll::Ready(Err(io::Error::from(kind))),
                Some(Step::Zero) => Poll::Ready(Ok(0)),
                step => {
                    let n = match step {
                        Some(Step::Write(n)) => n.min(bytes.len()),
                        _ => bytes.len(),
                    };
                    lock(&self.trace).bytes.extend_from_slice(&bytes[..n]);
                    Poll::Ready(Ok(n))
                }
            }
        }
        fn poll_flush(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<io::Result<()>> {
            Poll::Ready(Ok(()))
        }
        fn poll_shutdown(self: Pin<&mut Self>, _: &mut Context<'_>) -> Poll<io::Result<()>> {
            Poll::Ready(Ok(()))
        }
    }
    pub(in crate::net::tcp) fn setup(
        steps: impl IntoIterator<Item = Step>,
    ) -> (SessionWriter<Script>, Arc<StdMutex<Trace>>) {
        let trace = Arc::new(StdMutex::new(Trace::default()));
        (
            SessionWriter::new(Script {
                steps: steps.into_iter().collect(),
                trace: Arc::clone(&trace),
            }),
            trace,
        )
    }
    pub(in crate::net::tcp) async fn pending_once<F: Future>(future: Pin<&mut F>) {
        let mut future = future;
        poll_fn(|cx| {
            assert!(future.as_mut().poll(cx).is_pending());
            Poll::Ready(())
        })
        .await;
    }

    type RegisteredWriterSetup = (
        Arc<SessionWriter<Script>>,
        Arc<StdMutex<Trace>>,
        Endpoint<Script>,
        Registration<Script>,
    );

    /// Register the controlled writer through the same endpoint used in production.
    pub(in crate::net::tcp) fn setup_registered_writer(
        steps: impl IntoIterator<Item = Step>,
    ) -> RegisteredWriterSetup {
        let endpoint = Endpoint::default();
        let (writer, trace) = setup(steps);
        let writer = Arc::new(writer);
        let active = endpoint.register(Arc::clone(&writer));
        (writer, trace, endpoint, active)
    }

    /// Standard frame budget with an explicit heartbeat period (zero disables it).
    pub(in crate::net::tcp) fn keep_alive_settings(keep_alive: Duration) -> Settings {
        Settings {
            write_timeout: BUDGET,
            keep_alive,
        }
    }
}
