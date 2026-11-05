//! The shared UDP socket: one socket, receive-only, every board's
//! telemetry.
//!
//! **Not written yet.** This file currently holds only the error type
//! [`super::Error`] aggregates, plus the contract below, so that the rest
//! of `net` compiles and whoever implements this module knows what the
//! shared part expects of it. See [`super`] and `net/README.md`.
//!
//! # What this module is
//!
//! One socket bound to the backend's own address, carrying `Data` packets
//! from every board. Nothing is ever sent from it. One task is enough:
//! there is no per-board state to keep.
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
//! - The loop does three things and nothing else: receive, decode with
//!   [`crate::protocol::udp::decode_datagram`], report. No disk, no
//!   WebSocket, no aggregation — the socket's receive buffer is where
//!   packets get dropped if this task falls behind, and the kernel drops
//!   them silently, so this loop stays as short as it can be. Raising
//!   `SO_RCVBUF` is part of setting the socket up.
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
use crate::protocol::{DecodeError, Index};
use std::net::SocketAddr;
use std::sync::Arc;
use tokio::task::JoinHandle;

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
    let _ = (config, adj, reporter);
    todo!("the UDP socket is not written yet: see this module's contract")
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
        // Matched exhaustively rather than just returning `true`: a
        // variant added later has to say which it is instead of
        // inheriting this answer in silence.
        match self {
            Error::Bind { .. } | Error::Recv { .. } | Error::Decode { .. } => true,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::AdjId;
    use std::net::IpAddr;

    fn peer() -> SocketAddr {
        SocketAddr::new(IpAddr::from([192, 168, 1, 3]), 50400)
    }

    #[test]
    fn a_datagram_that_will_not_decode_faults_the_pod() {
        let error = Error::Decode {
            from: peer(),
            source: DecodeError::UnknownId(AdjId(9999)),
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
            source: DecodeError::UnknownId(AdjId(9999)),
        };

        // The only identity it has: there is no board to attribute an
        // undeclared id to.
        assert!(error.to_string().contains("192.168.1.3:50400"));
    }
}
