//! The shared UDP socket: one socket, receive-only, every board's
//! telemetry.
//!
//! # What this module is
//!
//! One socket bound to the backend's own address, carrying `Data` packets
//! from every board. Nothing is ever sent from it.
//!
//! # Architecture: two-stage receive with bounded channel
//!
//! Boards send thousands of packets per second, sometimes in bursts that
//! overwhelm a single processing loop. To handle this, the module uses a
//! two-stage design:
//!
//! 1. **Receive loop** — a fast task that only reads datagrams from the
//!    socket and pushes them into a bounded `mpsc` channel.
//! 2. **Processing loop** — drains the channel, decodes each datagram
//!    using [`crate::protocol::udp::decode_datagram`], resolves the board
//!    id, and reports through [`super::Reporter`].
//!
//! The channel (`RING_CAPACITY` = 8192) absorbs bursts so the receive
//! loop stays responsive. If the channel fills, the receive loop waits for
//! space rather than dropping — the kernel socket buffer (`SO_RCVBUF`) is
//! the first line of defense, and this channel is the second.
//!
//! # Entry point
//!
//! [`spawn`], taking [`Config`], an `Arc<Index>` and a
//! [`super::Reporter`] — written out with its reasoning on the items
//! themselves. No handle comes back beyond the `JoinHandle`: there is no
//! writing side.
//!
//! # Contract
//!
//! - **No framing.** A datagram arrives whole or not at all, so
//!   `recv_from` already delivers exactly one packet and its length —
//!   none of [`super::tcp`]'s buffer applies here. Read into one reused
//!   64 KiB buffer and a datagram can never be silently truncated,
//!   whatever the ADJ grows to.
//! - The processing loop does three things and nothing else: decode with
//!   [`crate::protocol::udp::decode_datagram`], resolve the board, report.
//!   No disk, no WebSocket, no aggregation.
//! - [`super::Notification::board`] comes from the decoded packet's id,
//!   through [`crate::protocol::Index`] — every
//!   [`crate::model::PacketDef`] carries its `board` — so that a
//!   notification looks the same whichever transport brought it. That is
//!   one `HashMap` lookup per datagram, done here once rather than
//!   repeated by every consumer downstream.
//! - **A decode failure is fatal**: see [`Error::is_fatal`]. Nothing
//!   corrupts a datagram in flight — UDP checksums it and the pod's
//!   network does not fragment it — so a datagram that will not decode
//!   means the ADJ this backend loaded does not describe what the boards
//!   are actually sending, and every datagram after it is suspect for the
//!   same reason. So: log it and report it on the error channel, exactly
//!   as [`super::tcp`] does — and that is all. This socket writes
//!   nothing, and sending the pod to fault is not `net`'s call anyway:
//!   whoever consumes the error channel reads [`Error::is_fatal`] and
//!   decides, which also keeps the "fault once" guard in one place
//!   rather than one per transport. Keep receiving meanwhile: a
//!   mismatched ADJ fails on every datagram that follows, several
//!   thousand a second, and each one is reported, not acted on.
//! - [`super::Event::Connected`]/[`super::Event::Disconnected`] are never
//!   emitted: there is no connection to come up or go down.
//! - Binding happens **before** the task is spawned, so a bad address is
//!   a startup failure returned to whoever is composing the backend
//!   (`station::vehicle::bootstrap`), not something reported once
//!   everything is already running. Hence the entry point returns
//!   `Result<JoinHandle<()>, Error>`.

use super::Reporter;
use crate::model::Packet;
use crate::protocol::{DecodeError, Index};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::sync::mpsc;
use tokio::task::JoinHandle;
use tracing::{error, warn};

/// How to set the shared socket up.
///
/// Everything here is resolved by `station` before `net` is reached: this
/// module reads no config file and no ADJ of its own.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Config {
    /// Where to bind: the backend's own address, `backend_ip` +
    /// `ports["UDP"]` in the ADJ's general info.
    pub addr: SocketAddr,
    /// `SO_RCVBUF`, in bytes.
    ///
    /// The only thing absorbing a stall of the receive loop, since the
    /// kernel drops the tail silently once it is full: 2 MiB is about
    /// 0.8 s of margin at 20 Mbit/s.
    pub recv_buffer: usize,
}

/// A queued datagram entry: raw payload bytes and the sender's address.
#[derive(Debug)]
struct Datagram {
    /// The raw datagram bytes copied from the socket receive buffer.
    bytes: Box<[u8]>,
    /// The sender's socket address (used for error attribution if decoding fails).
    from: SocketAddr,
}

/// Channel capacity — the number of datagrams that can be queued
/// between the fast receive loop and the decode/report path.
///
/// Boards send thousands of packets per second. This buffer absorbs
/// bursts so the receive loop stays responsive while `SO_RCVBUF` acts
/// as the first line of defense in the OS kernel.
const RING_CAPACITY: usize = 8192;

/// Binds the shared socket and spawns the receive and processing loops.
///
/// Binding happens here, **before** the task, so that a bad address is a
/// startup failure handed back to whoever is composing the backend rather
/// than something reported once everything is already running.
///
/// # Errors
///
/// [`Error::Bind`] only — every later failure goes out through
/// `reporter`, since by then there is nobody left to return it to.
pub fn spawn(config: Config, adj: Arc<Index>, reporter: Reporter) -> Result<JoinHandle<()>, Error> {
    // 1. Bind the UDP socket synchronously before spawning async tasks.
    let socket = bind_socket(config)?;

    // 2. Create the bounded channel connecting the receive loop to the processor.
    let (ring_tx, ring_rx) = mpsc::channel(RING_CAPACITY);

    let recv_reporter = reporter.clone();

    // 3. Spawn a supervising task that runs both the receiver and processor,
    // ensuring clean shutdown of the processor when the receiver exits.
    let handle = tokio::spawn(async move {
        let processor = tokio::spawn(process_loop(ring_rx, adj, reporter));
        receive_loop(socket, ring_tx, recv_reporter).await;
        // Once receive_loop exits, `ring_tx` is dropped, causing `process_loop`
        // to drain remaining items and finish.
        let _ = processor.await;
    });

    Ok(handle)
}

/// Binds a UDP socket and configures its OS-level receive buffer size (`SO_RCVBUF`).
fn bind_socket(config: Config) -> Result<tokio::net::UdpSocket, Error> {
    // Bind using the standard library socket first so we can configure non-blocking mode.
    let std_socket = std::net::UdpSocket::bind(config.addr).map_err(|source| Error::Bind {
        addr: config.addr,
        source,
    })?;

    // Tokio requires the underlying std socket to be in non-blocking mode.
    std_socket.set_nonblocking(true).map_err(|source| Error::Bind {
        addr: config.addr,
        source,
    })?;

    // Convert the standard socket into an async Tokio UdpSocket.
    let socket = tokio::net::UdpSocket::from_std(std_socket).map_err(|source| Error::Bind {
        addr: config.addr,
        source,
    })?;

    // Attempt to enlarge the kernel's SO_RCVBUF to handle high-frequency telemetry bursts.
    let sock_ref = socket2::SockRef::from(&socket);
    if let Err(e) = sock_ref.set_recv_buffer_size(config.recv_buffer) {
        warn!(
            %config.addr,
            buffer = config.recv_buffer,
            %e,
            "could not set SO_RCVBUF, using system default"
        );
    }

    Ok(socket)
}

/// Fast receive loop: reads raw datagrams from the socket and pushes them into the channel.
async fn receive_loop(
    socket: tokio::net::UdpSocket,
    ring_tx: mpsc::Sender<Datagram>,
    reporter: Reporter,
) {
    // Allocate a single 64 KiB buffer (maximum possible UDP datagram size)
    // so no incoming packet can ever be truncated.
    let mut buf = vec![0u8; 64 * 1024];

    loop {
        match socket.recv_from(&mut buf).await {
            Ok((len, from)) => {
                // Copy only the valid bytes of this datagram into a boxed slice.
                let datagram = Datagram {
                    bytes: buf[..len].into(),
                    from,
                };

                // Forward to the processing task. If the receiver dropped, exit cleanly.
                if ring_tx.send(datagram).await.is_err() {
                    break;
                }
            }
            Err(source) => {
                // Socket-level receive failure: log, report as fatal to the backend, and stop.
                let err = Error::Recv { source };
                error!(%err, "UDP receive error");
                let _ = reporter.report(err).await;
                break;
            }
        }
    }
}

/// Processing loop: drains the channel, decodes datagrams against the ADJ `Index`, and notifies downstream.
async fn process_loop(
    mut ring_rx: mpsc::Receiver<Datagram>,
    adj: Arc<Index>,
    reporter: Reporter,
) {
    // Pull datagrams one by one until `ring_tx` is closed and the queue is empty.
    while let Some(datagram) = ring_rx.recv().await {
        let Datagram { bytes, from } = datagram;

        // Decode raw bytes into a DataPacket using the ADJ lookup index.
        let packet = match crate::protocol::udp::decode_datagram(&bytes, &adj) {
            Ok(p) => p,
            Err(source) => {
                // A decode failure indicates an ADJ mismatch; report it to the error channel
                // and continue draining subsequent packets.
                let error = Error::Decode { from, source };
                error!(%error, "UDP decode error");
                if reporter.report(error).await.is_err() {
                    break;
                }
                continue;
            }
        };

        // Look up the packet definition to find out which board sent this packet.
        let Some(packet_def) = adj.packet(packet.id) else {
            warn!(id = ?packet.id, "decoded packet id not in index");
            continue;
        };

        let board = packet_def.board;

        // Broadcast the decoded telemetry packet to the event bus.
        if reporter
            .notify(board, super::Event::Received(Packet::Data(packet)))
            .await
            .is_err()
        {
            // Downstream event receiver closed; exit loop.
            break;
        }
    }
}

/// Something that went wrong on the shared UDP socket.
///
/// No [`crate::model::BoardId`] in any variant, on purpose: the socket
/// belongs to no board, and a datagram that fails to decode may not
/// resolve to one at all — [`Error::Decode`] carries the address it came
/// from, which is the only identity that always exists.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// The socket could not be bound, so no telemetry will arrive at all.
    #[error("could not bind the shared UDP socket to {addr}")]
    Bind {
        /// The address it was being bound to.
        addr: SocketAddr,
        /// The underlying I/O failure.
        #[source]
        source: std::io::Error,
    },

    /// Receiving on the socket failed.
    #[error("could not receive on the shared UDP socket")]
    Recv {
        /// The underlying I/O failure.
        #[source]
        source: std::io::Error,
    },

    /// A datagram could not be decoded, which means the loaded ADJ does
    /// not describe what the boards are sending. Fatal: see
    /// [`Error::is_fatal`].
    #[error("could not decode a datagram from {from}")]
    Decode {
        /// Where the datagram came from — there may be no board to
        /// attribute it to.
        from: SocketAddr,
        /// What [`crate::protocol`] said about it.
        #[source]
        source: DecodeError,
    },
}

impl Error {
    /// Whether this error means the pod has to be sent to fault.
    pub fn is_fatal(&self) -> bool {
        match self {
            Error::Bind { .. } | Error::Recv { .. } | Error::Decode { .. } => true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{AdjId, Board, BoardId, MacAddress, MessageLevel, PacketDef, PacketType, PodData};
    use std::collections::HashMap;
    use std::net::IpAddr;

    /// Helper returning a dummy sender SocketAddr for tests.
    fn peer() -> SocketAddr {
        SocketAddr::new(IpAddr::from([192, 168, 1, 3]), 50400)
    }

    #[test]
    fn a_datagram_that_will_not_decode_faults_the_pod() {
        let error = Error::Decode {
            from: peer(),
            source: crate::protocol::DecodeError::UnknownId(AdjId(9999)),
        };

        // Nothing corrupts a datagram in flight, so this is a mismatched
        // ADJ, not noise to skip over.
        assert!(error.is_fatal());
    }

    #[test]
    fn losing_the_socket_faults_the_pod_too() {
        let error = Error::Recv {
            source: std::io::Error::from(std::io::ErrorKind::ConnectionReset),
        };

        // Every board's telemetry at once.
        assert!(error.is_fatal());
    }

    #[test]
    fn a_decode_failure_says_where_it_came_from() {
        let error = Error::Decode {
            from: peer(),
            source: crate::protocol::DecodeError::UnknownId(AdjId(9999)),
        };

        // The only identity it has: there is no board to attribute an
        // undeclared id to.
        assert!(error.to_string().contains("192.168.1.3:50400"));
    }

    /// Builds a minimal Index with one empty Data packet (ID 1000) on Board 1.
    fn sample_index() -> Index {
        let packet = PacketDef {
            id: AdjId(1000),
            board: BoardId(1),
            name: "test_data".to_string(),
            packet_type: PacketType::Message(MessageLevel::Info),// I don't know what packet type to use here
        };
        let board = Board {
            id: BoardId(1),
            name: "TEST".to_string(),
            ip: IpAddr::from([192, 168, 0, 10]),
            mac: MacAddress([0; 6]),
            packets: HashMap::from([(packet.id, packet)]),
        };
        let pod_data = PodData {
            boards: HashMap::from([(board.id, board)]),
        };
        Index::new(&pod_data) // I am not sure what to do here
    }

    #[test]
    fn ring_capacity_is_positive() {
        // Sanity: the channel must hold at least one entry.
        assert!(RING_CAPACITY > 0);
    }

    #[tokio::test]
    async fn process_loop_reports_error_on_unknown_id() {
        let (reporter, mut sinks) = Reporter::channels(16, 16);
        let index = Arc::new(sample_index());
        let (ring_tx, ring_rx) = mpsc::channel(RING_CAPACITY);

        let processor = tokio::spawn(process_loop(ring_rx, index, reporter));

        // Send a datagram with an unknown id (0xFFFF = 65535) — should trigger a decode error.
        let datagram = Datagram {
            bytes: vec![0xFF, 0xFF].into(),
            from: peer(),
        };
        ring_tx.send(datagram).await.expect("processor is alive");

        // Drop the sender so the processor exits.
        drop(ring_tx);
        processor.await.expect("processor should finish");

        // The processor should have reported a decode error.
        let error_report = sinks.errors.recv().await;
        assert!(error_report.is_some(), "should have reported a decode error");
    }

    #[tokio::test]
    async fn process_loop_exits_when_ring_closes() {
        let (reporter, sinks) = Reporter::channels(16, 16);
        let index = Arc::new(sample_index());
        let (ring_tx, ring_rx) = mpsc::channel(RING_CAPACITY);

        let processor = tokio::spawn(process_loop(ring_rx, index, reporter));

        // Send an incomplete 1-byte datagram (fails with UnexpectedEof), then close the channel.
        let datagram = Datagram {
            bytes: vec![0x00].into(),
            from: peer(),
        };
        ring_tx.send(datagram).await.expect("processor is alive");
        drop(ring_tx);

        // Wait for the processor to finish cleanly.
        processor.await.expect("processor should finish cleanly");
        drop(sinks);
    }

    #[test]
    fn config_is_copy() {
        let config = Config {
            addr: SocketAddr::new(IpAddr::from([127, 0, 0, 1]), 0),
            recv_buffer: 2 * 1024 * 1024,
        };
        let _copy = config;
        // Config is still usable after assignment — it implements Copy.
        let _addr = config.addr;
        let _buf = config.recv_buffer;
    }
}