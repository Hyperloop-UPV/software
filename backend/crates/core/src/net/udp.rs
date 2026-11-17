//! The shared UDP socket: one socket, receive-only, every board's
//! telemetry.
//!
//! # What this module is
//!
//! One socket bound to the backend's own address, carrying `Data` packets
//! from every board. Nothing is ever sent from it.
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
//! - The loop does three things and nothing else: decode with
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

/// Binds the shared socket and spawns the receive loop.
///
/// Binding happens here, **before** the task, so that a bad address is a
/// startup failure handed back to whoever is composing the backend rather
/// than something reported once everything is already running.
///
/// `adj` is the only part of the ADJ this module needs: it maps a decoded
/// id to its [`crate::model::PacketDef`], for the decode itself and for
/// the `board` every [`super::Notification`] carries. `station` owns it
/// and hands out clones; it is read-only here, and a reload of the ADJ is
/// a new [`Index`] with a new task, never a mutation of this one.
///
/// # Errors
///
/// [`Error::Bind`] only — every later failure goes out through
/// `reporter`, since by then there is nobody left to return it to.
pub fn spawn(config: Config, adj: Arc<Index>, reporter: Reporter) -> Result<JoinHandle<()>, Error> {
    let socket = bind_socket(config)?;
    let handle = tokio::spawn(run_loop(socket, adj, reporter));
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

/// Main UDP loop: reads datagrams into a reusable 64 KiB buffer, decodes in-place, and reports.
async fn run_loop(
    socket: tokio::net::UdpSocket,
    adj: Arc<Index>,
    reporter: Reporter,
) {
    // Reusable 64 KiB buffer — a datagram can never be silently truncated.
    let mut buf = vec![0u8; 64 * 1024];

    loop {
        match socket.recv_from(&mut buf).await {
            Ok((len, from)) => {
                if !handle_datagram(&buf[..len], from, &adj, &reporter).await {
                    // Downstream channels closed; exit cleanly.
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

/// Decodes a single datagram slice against `adj` and forwards the result or error to `reporter`.
///
/// Returns `false` if the downstream `reporter` channels have closed and the loop should stop.
async fn handle_datagram(
    bytes: &[u8],
    from: SocketAddr,
    adj: &Index,
    reporter: &Reporter,
) -> bool {
    let packet = match crate::protocol::udp::decode_datagram(bytes, adj) {
        Ok(p) => p,
        Err(source) => {
            let error = Error::Decode { from, source };
            error!(%error, "UDP decode error");
            return reporter.report(error).await.is_ok();
        }
    };

    let Some(packet_def) = adj.packet(packet.id) else {
        warn!(id = ?packet.id, "decoded packet id not in index");
        return true;
    };

    let board = packet_def.board;

    reporter
        .notify(board, super::Event::Received(Packet::Data(packet)))
        .await
        .is_ok()
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
    ///
    /// "Fatal" is about the **pod**, not about this process: the backend
    /// stays up — still reading, still serving the frontend, still
    /// recording — so that whoever is operating the pod can see what
    /// happened. Nothing here ever calls `std::process::exit`.
    ///
    /// Both runtime failures of this socket qualify, and for the same
    /// reason: neither can be true of a single datagram.
    /// [`Error::Decode`] means the loaded ADJ does not describe what the
    /// boards are sending, and [`Error::Recv`] means the socket itself is
    /// no longer usable, which is every board's telemetry gone at once.
    /// Neither is something a retry fixes.
    ///
    /// [`Error::Bind`] never reaches this: binding happens before the
    /// task is spawned, so it is a startup failure handed back to
    /// whoever composes the backend.
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

    fn peer() -> SocketAddr {
        SocketAddr::new(IpAddr::from([192, 168, 1, 3]), 50400)
    }

    #[test]
    fn a_datagram_that_will_not_decode_faults_the_pod() {
        let error = Error::Decode {
            from: peer(),
            source: crate::protocol::DecodeError::UnknownId(AdjId(9999)),
        };

        assert!(error.is_fatal());
    }

    #[test]
    fn losing_the_socket_faults_the_pod_too() {
        let error = Error::Recv {
            source: std::io::Error::from(std::io::ErrorKind::ConnectionReset),
        };

        assert!(error.is_fatal());
    }

    #[test]
    fn a_decode_failure_says_where_it_came_from() {
        let error = Error::Decode {
            from: peer(),
            source: crate::protocol::DecodeError::UnknownId(AdjId(9999)),
        };

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
        Index::new(&pod_data, None)
    }

    #[tokio::test]
    async fn handle_datagram_decodes_valid_packet_and_notifies() {
        let (reporter, mut sinks) = Reporter::channels(16, 16);
        let index = sample_index();

        // 1000 in little-endian u16 is [0xE8, 0x03], with 0 measurements.
        let keep_going = handle_datagram(&[0xE8, 0x03], peer(), &index, &reporter).await;
        assert!(keep_going);

        let notification = sinks.notifications.recv().await;
        assert!(notification.is_some(), "should have emitted a packet event");
        assert!(sinks.errors.try_recv().is_err(), "should not have reported an error");
    }

    #[tokio::test]
    async fn handle_datagram_reports_error_on_unknown_id() {
        let (reporter, mut sinks) = Reporter::channels(16, 16);
        let index = sample_index();

        // Unknown ID 0xFFFF (65535)
        let keep_going = handle_datagram(&[0xFF, 0xFF], peer(), &index, &reporter).await;
        assert!(keep_going);

        let error_report = sinks.errors.recv().await;
        assert!(error_report.is_some(), "should have reported a decode error");
    }

    #[tokio::test]
    async fn handle_datagram_stops_when_sinks_are_dropped() {
        let (reporter, sinks) = Reporter::channels(16, 16);
        let index = sample_index();
        drop(sinks);

        // With receivers dropped, reporting should signal the loop to exit (false).
        let keep_going = handle_datagram(&[0xFF, 0xFF], peer(), &index, &reporter).await;
        assert!(!keep_going);
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