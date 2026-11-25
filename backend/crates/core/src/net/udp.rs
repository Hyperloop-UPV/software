//! The shared UDP socket: one socket, receive-only, every board's
//! telemetry.
//!
//! # What this module is
//!
//! One socket bound to the backend's own address, carrying `Data` packets
//! from every board, and the fault (packet id 0) any of them may send.
//! Nothing is ever sent from it.
//!
//! # Entry point
//!
//! [`spawn_udp`], taking [`UdpConfig`], an `Arc<Index>` and a
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
//!   [`crate::protocol::udp::decode_datagram`], resolve the board, report
//!   (a fault skips the first two, see below). No disk, no WebSocket, no
//!   aggregation.
//! - **Packet id 0 is a fault** ([`UdpError::Fault`]): what a board sends
//!   when it has detected an error. It is recognised by its id alone,
//!   **before** decoding: it is not in the ADJ, the [`crate::protocol::Index`]
//!   is not consulted and nothing after the id is read. It goes down the
//!   error channel with the address it came from, the only thing that
//!   says which board sent it.
//! - [`super::Notification::board`] comes from the decoded packet's id,
//!   through [`crate::protocol::Index`] — every
//!   [`crate::model::PacketDef`] carries its `board` — so that a
//!   notification looks the same whichever transport brought it. That is
//!   one `HashMap` lookup per datagram, done here once rather than
//!   repeated by every consumer downstream.
//! - **A decode failure is reported as fatal** (see [`UdpError::is_fatal`]),
//!   but acting on it is not this module's call. Nothing corrupts a
//!   datagram in flight — UDP checksums it and the pod's network does not
//!   fragment it — so a datagram that will not decode most likely means
//!   the ADJ this backend loaded does not describe what the boards are
//!   actually sending. This module traces it and reports it on the error
//!   channel, exactly as [`super::tcp`] does — and that is all. Whoever
//!   consumes the error channel decides what happens next (sending the
//!   pod to fault, shutting down), which also keeps the "fault once" guard
//!   in one place rather than one per transport.
//! - **Every failure is reported, but the trace is rate-limited.** A
//!   mismatched ADJ fails on every datagram that follows, several thousand
//!   a second. Each one still goes down the error channel, so the consumer
//!   sees them all; the trace gets the first one and then at most one line
//!   a second, carrying how many were left out since the previous line.
//!   Decode failures and faults are limited separately, so a burst of one
//!   never hides the other.
//! - [`super::Event::Connected`]/[`super::Event::Disconnected`] are never
//!   emitted: there is no connection to come up or go down.
//! - Binding happens **before** the task is spawned, so a bad address is
//!   a startup failure returned to whoever is composing the backend
//!   (`station`), not something reported once
//!   everything is already running. Hence the entry point returns
//!   `Result<JoinHandle<()>, UdpError>`.
//!
//! # Stopping
//!
//! The loop stops on its own when a report fails because the consumer is
//! gone — but it only finds out the next time it has something to report,
//! that is, on the next datagram. With no telemetry arriving (boards off,
//! cable out), closing the [`super::Sinks`] alone leaves the task waiting
//! on the socket.
//!
//! To stop it at a moment of the caller's choosing (a shutdown), call
//! [`JoinHandle::abort`] on the handle [`spawn_udp`] returns. That is safe:
//! the task holds nothing that needs flushing, and all that is lost is
//! whatever was still sitting in the kernel's receive buffer.
//!
//! # Tests
//!
//! Kept out of this file, next to it in `udp/`:
//!
//! - `tests.rs` — unit tests, and tests through a real socket on loopback.
//! - `test_support.rs` — the fixtures both share: a minimal ADJ index,
//!   loopback sockets, and waits on the reporter's channels that fail
//!   instead of hanging.
//! - `manual_tests.rs` — `manual_udp_load`, an ignored load probe that
//!   checks the loop keeps up with 25 Mbit/s of 76-byte datagrams:
//!
//! ```sh
//! cargo test -p software-core --features net --release manual_udp_load -- --ignored --nocapture
//! ```

use super::Reporter;
use crate::model::Packet;
use crate::protocol::{DecodeError, Index};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::task::JoinHandle;
use tracing::{error, info, warn};

/// How to set the shared socket up.
///
/// Everything here is resolved by `station` before `net` is reached: this
/// module reads no config file and no ADJ of its own.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct UdpConfig {
    /// Where to bind: the backend's own address, `addresses["backend"]`
    /// and `ports["UDP"]` in the ADJ's `general_info.json`.
    pub addr: SocketAddr,
    /// `SO_RCVBUF` to request, in bytes.
    ///
    /// The only thing absorbing a stall of the receive loop, since the
    /// kernel drops the tail silently once it is full.
    ///
    /// The margin it buys is counted in **datagrams**, not bytes: the
    /// kernel charges each datagram its bookkeeping on top of its payload.
    /// Measured on Linux over loopback, a 76-byte datagram (the average of
    /// the H11 packets) takes about 960 bytes of buffer, so 2 MiB requested
    /// (4 MiB granted, see below) holds about 4,400 datagrams — roughly
    /// 0.1 s at 25 Mbit/s of 76-byte datagrams (~41,000 a second). A real
    /// network card's driver may charge a different amount; measure on the
    /// station's own machine.
    ///
    /// **This margin can be widened** by requesting more and raising the OS
    /// limit so that the request is granted. On Linux, with
    /// `sudo sysctl -w net.core.rmem_max=16777216` (16 MiB) and 16 MiB
    /// requested here, 32 MiB are granted: by the figure above about 35,000
    /// datagrams, roughly 0.8 s at that rate. `sysctl -w` is lost on reboot;
    /// to keep it, put `net.core.rmem_max = 16777216` in a file under
    /// `/etc/sysctl.d/`. The limits on Windows and macOS have not been checked.
    ///
    /// The operating system may grant less than this — Linux silently caps
    /// it at `net.core.rmem_max` — so [`spawn_udp`] reads the granted size back
    /// and warns when it is smaller than requested.
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
/// The returned handle is also how to stop the task: see the module's
/// "Stopping" section.
///
/// # Errors
///
/// [`UdpError::Bind`] only — every later failure goes out through
/// `reporter`, since by then there is nobody left to return it to.
pub fn spawn_udp(
    config: UdpConfig,
    adj: Arc<Index>,
    reporter: Reporter,
) -> Result<JoinHandle<()>, UdpError> {
    let socket = bind_telemetry_socket(config)?;
    let handle = tokio::spawn(receive_telemetry(socket, adj, reporter));
    Ok(handle)
}

/// Binds a UDP socket and configures its OS-level receive buffer size (`SO_RCVBUF`).
fn bind_telemetry_socket(config: UdpConfig) -> Result<tokio::net::UdpSocket, UdpError> {
    // Bind using the standard library socket first so we can configure non-blocking mode.
    let std_socket = std::net::UdpSocket::bind(config.addr).map_err(|source| UdpError::Bind {
        addr: config.addr,
        source,
    })?;

    // Tokio requires the underlying std socket to be in non-blocking mode.
    std_socket
        .set_nonblocking(true)
        .map_err(|source| UdpError::Bind {
            addr: config.addr,
            source,
        })?;

    // Convert the standard socket into an async Tokio UdpSocket.
    let socket = tokio::net::UdpSocket::from_std(std_socket).map_err(|source| UdpError::Bind {
        addr: config.addr,
        source,
    })?;

    // Asking is not getting: Linux caps the request at `net.core.rmem_max`
    // without returning an error, so the size actually granted has to be
    // read back. Linux also reports back twice what it granted (it reserves
    // the other half for bookkeeping, see socket(7)): with `rmem_max` at
    // 4 MiB, asking for 2 MiB reads back 4 MiB and asking for 16 MiB reads
    // back 8 MiB. So on Linux a full grant reads back as twice the request,
    // and anything less means the request was capped. Elsewhere the value
    // read back is compared with the request as is.
    let full_grant = if cfg!(target_os = "linux") {
        config.recv_buffer.saturating_mul(2)
    } else {
        config.recv_buffer
    };
    let sock_ref = socket2::SockRef::from(&socket);
    let granted = sock_ref
        .set_recv_buffer_size(config.recv_buffer)
        .and_then(|()| sock_ref.recv_buffer_size());
    match granted {
        Ok(granted) if granted >= full_grant => {
            info!(
                addr = %config.addr,
                requested = config.recv_buffer,
                granted,
                "SO_RCVBUF set"
            );
        }
        Ok(granted) => {
            warn!(
                addr = %config.addr,
                requested = config.recv_buffer,
                granted,
                "SO_RCVBUF is smaller than requested, so a stall loses datagrams sooner; \
                 raise the OS limit (net.core.rmem_max on Linux) for more margin"
            );
        }
        Err(e) => {
            warn!(
                addr = %config.addr,
                requested = config.recv_buffer,
                %e,
                "could not set SO_RCVBUF, using system default"
            );
        }
    }

    Ok(socket)
}

/// Main UDP loop: reads datagrams into a reusable 64 KiB buffer, decodes in-place, and reports.
async fn receive_telemetry(socket: tokio::net::UdpSocket, adj: Arc<Index>, reporter: Reporter) {
    // Reusable 64 KiB buffer — a datagram can never be silently truncated.
    let mut buf = vec![0u8; 64 * 1024];
    let mut traces = ReceiveTraces::default();

    loop {
        match socket.recv_from(&mut buf).await {
            Ok((len, from)) => {
                if !decode_and_report(&buf[..len], from, &adj, &reporter, &mut traces).await {
                    // Downstream channels closed; exit cleanly.
                    break;
                }
            }
            Err(source) => {
                // Socket-level receive failure: log, report as fatal to the backend, and stop.
                let err = UdpError::Recv { source };
                error!(%err, "UDP receive error");
                let _ = reporter.report(err).await;
                break;
            }
        }
    }
}

/// The first two bytes of a fault datagram: packet id 0, little-endian
/// like every id on the wire.
///
/// A board that has detected an error sends it. It is not declared in the
/// ADJ, and the Go backend broadcasts the same id to every board when it
/// raises a fault itself (`SendFault`).
const FAULT_ID: [u8; 2] = 0u16.to_le_bytes();

/// Decodes a single datagram slice against `adj` and forwards the result or error to `reporter`.
///
/// A fault (packet id 0, see [`FAULT_ID`]) is reported before any of that,
/// without looking at `adj`.
///
/// Returns `false` if the downstream `reporter` channels have closed and the loop should stop.
async fn decode_and_report(
    bytes: &[u8],
    from: SocketAddr,
    adj: &Index,
    reporter: &Reporter,
    traces: &mut ReceiveTraces,
) -> bool {
    if bytes.starts_with(&FAULT_ID) {
        if let Some(suppressed) = traces.fault.should_trace(Instant::now()) {
            error!(%from, suppressed, "a board signalled a fault (packet id 0)");
        }
        return reporter.report(UdpError::Fault { from }).await.is_ok();
    }

    let packet = match crate::protocol::udp::decode_datagram(bytes, adj) {
        Ok(p) => p,
        Err(source) => {
            if let Some(suppressed) = traces.decode.should_trace(Instant::now()) {
                error!(%from, %source, suppressed, "UDP datagram could not be decoded");
            }
            let error = UdpError::Decode { from, source };
            return reporter.report(error).await.is_ok();
        }
    };

    // A second lookup of the id `decode_datagram` has just resolved: it
    // returns the packet, not its definition. Decoding already rejected
    // any id the index does not know, so this branch is not expected to
    // run; it is handled rather than unwrapped because the decode lives
    // in another module. One extra `HashMap` lookup per datagram is not
    // worth changing `protocol`'s API to avoid.
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

/// How often, at most, each kind of failure reaches the trace.
const TRACE_INTERVAL: Duration = Duration::from_secs(1);

/// The receive loop's trace rate limits, one per kind of failure, so that
/// a burst of decode failures never hides a fault from the trace, nor the
/// other way round.
#[derive(Debug, Default)]
struct ReceiveTraces {
    /// Datagrams that would not decode.
    decode: TraceRateLimit,
    /// Faults (packet id 0).
    fault: TraceRateLimit,
}

/// Rate limit for tracing one kind of failure.
///
/// Only the trace is limited: every failure is still reported down the
/// error channel. A burst that stops is summed up by the next failure
/// that gets traced, so if no further failure ever comes, its count is
/// only in the error channel — which already had every one of them.
#[derive(Debug, Default)]
struct TraceRateLimit {
    /// Failures not traced since the last one that was.
    suppressed: u64,
    /// When a failure was last traced.
    last: Option<Instant>,
}

impl TraceRateLimit {
    /// Decides whether the failure seen at `now` is traced.
    ///
    /// `Some(n)` means trace it, `n` being how many were left out since the
    /// previous traced one (`0` for the first). `None` means count it
    /// only. `now` is a parameter rather than read here so that the
    /// decision can be tested without waiting for real time to pass.
    fn should_trace(&mut self, now: Instant) -> Option<u64> {
        match self.last {
            Some(last) if now.saturating_duration_since(last) < TRACE_INTERVAL => {
                self.suppressed += 1;
                None
            }
            _ => {
                self.last = Some(now);
                Some(std::mem::take(&mut self.suppressed))
            }
        }
    }
}

/// Something that went wrong on the shared UDP socket, or that a board
/// says went wrong ([`UdpError::Fault`]).
///
/// No [`crate::model::BoardId`] in any variant, on purpose: the socket
/// belongs to no board, and a datagram that fails to decode may not
/// resolve to one at all — [`UdpError::Decode`] and [`UdpError::Fault`]
/// carry the address the datagram came from, which is the only identity
/// that always exists.
#[derive(Debug, thiserror::Error)]
pub enum UdpError {
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

    /// A datagram could not be decoded, which most likely means the loaded
    /// ADJ does not describe what the boards are sending. See
    /// [`UdpError::is_fatal`].
    #[error("could not decode a datagram from {from}")]
    Decode {
        /// Where the datagram came from — there may be no board to
        /// attribute it to.
        from: SocketAddr,
        /// What [`crate::protocol`] said about it.
        #[source]
        source: DecodeError,
    },

    /// A board has detected an error and said so with a fault: a datagram
    /// whose packet id is 0. Not a failure of this socket — the datagram
    /// arrived fine — but the pod telling the backend it is in trouble.
    #[error("the board at {from} signalled a fault (packet id 0)")]
    Fault {
        /// Where the fault came from: the board's address, since a fault
        /// carries nothing else that says which board sent it.
        from: SocketAddr,
    },
}

impl UdpError {
    /// Whether this module considers the error serious enough to send the
    /// pod to fault.
    ///
    /// A **hint** for whoever consumes the error channel, not a decision:
    /// `net` never raises the fault and never stops the process. What to
    /// do about a fatal error — sending the pod to fault, shutting the
    /// backend down, or something else — is decided by the application
    /// (`station`), which may also look at the error's details (such as
    /// the [`DecodeError`] variant) rather than at this answer alone.
    ///
    /// Both runtime failures of this socket qualify, and for the same
    /// reason: neither can be true of a single datagram.
    /// [`UdpError::Decode`] most likely means the loaded ADJ does not describe
    /// what the boards are sending, and [`UdpError::Recv`] means the socket
    /// itself is no longer usable, which is every board's telemetry gone
    /// at once. Neither is something a retry fixes.
    ///
    /// [`UdpError::Fault`] is fatal by definition: it is a board asking for
    /// the pod to go to fault.
    ///
    /// [`UdpError::Bind`] never reaches the error channel: binding happens
    /// before the task is spawned, so it is a startup failure handed back
    /// to whoever composes the backend.
    pub fn is_fatal(&self) -> bool {
        match self {
            UdpError::Bind { .. }
            | UdpError::Recv { .. }
            | UdpError::Decode { .. }
            | UdpError::Fault { .. } => true,
        }
    }
}

#[cfg(test)]
mod manual_tests;

#[cfg(test)]
mod test_support;

#[cfg(test)]
mod tests;
