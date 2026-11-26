//! The TCP client: one connection per board, one task each.
//!
//! [`spawn`] starts one independent supervisor per board without a background order queue.
//! BoardClients route and encode orders, then write only to the current session.
//! Offline sends fail; connected callers wait for the writer within write_timeout.
//! Success confirms write_all, not firmware ACK.
//! Orders, heartbeats and faults share the same complete-frame writer.
//! Explicit task shutdown/joining remains pending. This module
//! exposes [`TcpError`], which [`super::Error::Tcp`] wraps, and defines the transport contract.
//! See [`super`] and `net/tcp/README.md`.
//!
//! # What this module is
//!
//! The backend is the **client**: it connects out to each board's
//! `TCP_SERVER` port, and never listens. One connection per board, each
//! one its own task with its own framing buffer and its own reconnection
//! state. That connection carries protections and messages inbound, and
//! orders and the keep-alive outbound.
//!
//! # Entry point
//!
//! [`spawn`], taking [`TcpConfig`], an `Arc<Index>` and a
//! [`super::Reporter`], and returning [`BoardClients`] — the API is written
//! out below, with its reasoning on the items themselves. One call opens
//! **every** configured connection: one task per distinct board ID, so the
//! per-board bookkeeping stays here. The application submits orders through
//! [`BoardClients::send`], which resolves their destination from the index.
//!
//! # Contract
//!
//! - **Framing is this module's job.** TCP is a byte stream: a frame can
//!   arrive split across reads, and two frames can arrive glued together
//!   in one read — both are normal, and the second is the common case.
//!   So: accumulate into a per-connection buffer, run
//!   [`crate::protocol::tcp::decode_next`] against a `&mut Cursor` over
//!   it, and on success advance the buffer by `cursor.position()`. Never
//!   consume from the buffer unless a frame parsed in full, or the stream
//!   is permanently misaligned. All decode errors are deferred while at most
//!   374 bytes remain, including errors that do not mean incomplete input.
//!   The largest supported inbound frame is 374 bytes (`2 + 4 + 48 + 320`),
//!   so an undecodable suffix beyond that limit ends the session and triggers
//!   reconnection. Complete frames are extracted before applying this limit.
//! - **One exclusive writer per connection.** Normal orders write in their
//!   callers, waiting for the same mutex as heartbeats and faults. One deadline
//!   covers waiting and writing. No frames interleave, and there are no per-kind
//!   priorities. Cancelling before writing leaves the session usable; cancelling
//!   an unfinished write closes it.
//! - **Be ready to be told to propagate the fault.** The application
//!   decides when; this module is what can actually write, so it
//!   exposes [`BoardClients::broadcast_fault`], which puts **the order with id
//!   0** — the fault, same as the Go backend's `SendFault` — into every
//!   board's current writer concurrently, bounded by `write_timeout` for the
//!   whole attempt. It reports which writes could not be confirmed instead of
//!   collapsing them into one opaque error, since a fault that only
//!   half-landed is exactly what the operator has to know. The same path
//!   can be used by application policies for received protections or errors.
//!   No automatic trigger or once-per-incident guard is implemented here.
//! - Reconnection with exponential backoff and unlimited retries, the
//!   OS-level keep-alive disabled (there is an application-level one),
//!   `linger = 0` for abortive close when a socket is dropped. This may discard
//!   unsent bytes; socket write completion does not guarantee firmware receipt.
//! - Report through [`super::Reporter`] only: [`super::Event::Connected`]
//!   and [`super::Event::Disconnected`] per connection,
//!   [`super::Event::Received`] per frame, and [`TcpError`] on the error
//!   channel. Never stamp a timestamp by hand — the reporter
//!   does it. Never touch disk, WebSocket or aggregation.
//! - **A terminal decode failure is fatal**: see [`TcpError::is_fatal`]. An
//!   unsuccessful attempt on at most 374 pending bytes is deferred;
//!   the framing rule waits for more bytes without proving the suffix valid. Log a
//!   terminal failure and report it on the error channel, which is all this
//!   module does about it. Sending the pod to fault is not `net`'s call to make:
//!   whoever consumes the error channel reads [`TcpError::is_fatal`] and
//!   decides, which also keeps the "fault once" guard in one place
//!   instead of one per transport. The stream cannot be resynchronised
//!   mid-frame, though, so this module does close the connection and let
//!   the reconnection loop reopen it — reconnecting will not fix a
//!   mismatched ADJ, so expect the same frame to fail again.
//! - Everything else is decided here, locally: a failed connect or write
//!   is what the backoff is for, and only the report goes up.

use super::Reporter;
use crate::{
    model::{BoardId, Port},
    protocol::Index,
};
use std::{collections::HashMap, net::SocketAddr, sync::Arc, time::Duration};

mod board_clients;
mod board_handle;
mod connection;
mod keep_alive;
mod endpoint;
mod error;
mod framing;
mod reader;
mod session;
mod supervisor;
mod writer;

pub use board_clients::BoardClients;
pub use board_handle::BoardHandle;
pub use error::{SendError, TcpError, Unreachable};

/// One board to keep a connection to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BoardLink {
    /// Whose connection this is. Every report about it names this board,
    /// which is the whole identity of a link.
    pub board: BoardId,
    /// Where to connect: the board's `ip` + its `ports["TCP_SERVER"]`.
    pub addr: SocketAddr,
    /// The fixed local port to bind the client side to (`TCP_CLIENT + i`
    /// in the Go backend). Socket setup uses abortive close (`linger = 0`)
    /// when tearing down a connection; subsequent bind failures are reported
    /// and retried through the normal connection path.
    /// Zero requests an OS-assigned port, useful for isolated local tests.
    pub local_port: Port,
}

/// How long to wait between reconnection attempts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Backoff {
    // The bounded initial interval restored after a successful connection.
    initial: u64,
    // The next wait in milliseconds, always bounded by max.
    next: u64,
    // The ceiling the doubling stops at. Retries are unlimited: a board
    // that is not up yet is the normal state before a test, not an
    // error to give up on.
    max: u64,
}

impl Backoff {
    /// Creates an exponential backoff with millisecond intervals.
    ///
    /// The first interval is `initial.min(max)`. A zero initial interval or
    /// maximum produces zero intervals throughout, with no deliberate retry delay.
    pub fn new(initial: u64, max: u64) -> Self {
        Self {
            initial: initial.min(max),
            next: initial.min(max),
            max,
        }
    }

    /// Returns the next interval, doubling subsequent intervals up to the maximum.
    ///
    /// Saturating arithmetic allows unlimited attempts without overflow. Once
    /// reached, the maximum is returned on every subsequent call until [`Self::reset`].
    fn get_interval(&mut self) -> Duration {
        let interval = Duration::from_millis(self.next);
        self.next = self.next.saturating_mul(2).min(self.max);
        interval
    }

    /// Restores the first interval without changing the configured maximum.
    ///
    /// Call after a successful connection so a later disconnection starts a new
    /// retry sequence. Repeated resets are harmless and do not consume an interval.
    fn reset(&mut self) {
        self.next = self.initial;
    }
}

/// How to run the TCP client.
///
/// Everything here is resolved by the application before `net` is reached: this
/// module reads no config file, and it does not read the ADJ to find its
/// peers either. That is also what lets a test point it at a fake peer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct TcpConfig {
    /// One entry per board to connect to, already filtered by what the
    /// config file lists: a board the ADJ declares but the config does
    /// not name gets no client at all.
    pub boards: Vec<BoardLink>,
    /// Bound on each connection attempt.
    pub connect_timeout: Duration,
    /// What to wait between attempts.
    pub backoff: Backoff,
    /// Period of the application-level keep-alive: an empty order with ID 1.
    /// Zero disables it. The first send waits one period; subsequent periods
    /// start when the previous keep-alive finishes. Ordinary orders do not reset
    /// the timer, and overdue sends never accumulate into a catch-up burst.
    /// Each spawned supervisor supplies this period to its session writer.
    /// OS-level keep-alive remains disabled in favor of this application packet.
    pub keep_alive: Duration,
    /// Bound on waiting for the writer and writing a complete frame.
    /// Also bounds each entire fault attempt, including its wait for the writer.
    /// Expiry before writing leaves the session usable; expiry during writing closes it.
    pub write_timeout: Duration,
}

/// Opens a connection to every board in `config.boards`.
///
/// One call, one task per board: the per-connection bookkeeping stays in
/// this module, and the application submits orders through the [`BoardClients`]
/// that come back, letting the index select their destination.
///
/// `index` is the only part of the ADJ this module needs: it decodes
/// inbound frames and encodes outbound orders against it. The application owns
/// it and hands out clones; it is read-only here, and a reload of the ADJ
/// is a new [`Index`] with new tasks, never a mutation of this one.
///
/// Connecting is *not* done before spawning, unlike [`super::udp`]: a
/// board that is not up yet is normal, so a failed attempt is a report
/// and a retry, never a startup failure.
///
/// Each board gets an active-session endpoint and a supervisor with independent
/// backoff state, sharing the immutable index and Reporter channels. Repeated
/// board IDs keep their first link and log a warning; no duplicate task is started.
/// An empty board list returns empty handles without opening a connection.
///
/// Tasks are detached for now: this API does not return join handles or implement
/// explicit shutdown. Closing either Reporter consumer stops the supervisors;
/// consume both channels concurrently while running. Dropping BoardClients alone
/// does not stop supervisors; close a Reporter consumer to cancel them.
/// No application handshake or hash exchange is performed. Fault broadcast is
/// explicit through [`BoardClients::broadcast_fault`], never triggered automatically.
///
/// # Panics
///
/// Starting a nonempty configuration outside a Tokio runtime panics, as does
/// [`tokio::spawn`].
pub fn spawn(config: TcpConfig, index: Arc<Index>, reporter: Reporter) -> BoardClients {
    tracing::debug!(
        configured_boards = config.boards.len(),
        connect_timeout = ?config.connect_timeout,
        write_timeout = ?config.write_timeout,
        keep_alive = ?config.keep_alive,
        backoff = ?config.backoff,
        "Starting TCP clients"
    );
    let mut boards = HashMap::with_capacity(config.boards.len());
    let config = Arc::new(config);
    for &link in &config.boards {
        if boards.contains_key(&link.board) {
            tracing::warn!(board = ?link.board, "ignoring duplicate TCP board link");
            continue;
        }
        let endpoint = endpoint::Endpoint::default();
        boards.insert(
            link.board,
            BoardHandle {
                board: link.board,
                index: Arc::clone(&index),
                endpoint: endpoint.clone(),
                write_timeout: config.write_timeout,
                reporter: reporter.clone(),
            },
        );

        let index = Arc::clone(&index);
        let config = Arc::clone(&config);
        let reporter = reporter.clone();
        // Deliberately detached: explicit task ownership/joining is a later step.
        let _task = tokio::spawn(async move {
            let _ = supervisor::supervise(&link, &config, &index, &reporter, &endpoint).await;
        });
    }
    BoardClients::new(boards, index, config.write_timeout)
}

#[cfg(test)]
mod manual_tests;

#[cfg(test)]
mod test_support;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn backoff_doubles_in_milliseconds_and_stays_at_the_cap() {
        // A non-power-of-two cap must be reached without rounding or wrapping.
        let mut backoff = Backoff::new(100, 700);
        for expected in [100, 200, 400, 700] {
            assert_eq!(backoff.get_interval(), Duration::from_millis(expected));
        }
        // Staying capped must not leave an ever-growing exponent or counter.
        for _ in 0..10_000 {
            assert_eq!(backoff.get_interval(), Duration::from_millis(700));
        }
    }

    #[test]
    fn backoff_bounds_the_first_interval() {
        // Equal and excessive initial values both start at the configured cap.
        for initial in [700, 701, u64::MAX] {
            let mut backoff = Backoff::new(initial, 700);
            for _ in 0..100 {
                assert_eq!(backoff.get_interval(), Duration::from_millis(700));
            }
        }
    }

    #[test]
    fn backoff_preserves_zero_intervals_without_overflow() {
        // Preserve zero-valued configuration, including after the old exponent
        // calculation would overflow even with an initial interval of zero.
        for (initial, max) in [(0, 0), (0, 700), (0, u64::MAX), (100, 0)] {
            let mut backoff = Backoff::new(initial, max);
            for _ in 0..1_000 {
                assert_eq!(backoff.get_interval(), Duration::ZERO);
            }
        }
    }

    #[test]
    fn backoff_saturates_before_applying_a_large_cap() {
        // Doubling the initial interval exceeds u64::MAX, but a lower cap must
        // still win over saturation. Also cover the largest representable cap.
        let initial = u64::MAX / 2 + 1;
        for max in [u64::MAX - 1, u64::MAX] {
            let mut backoff = Backoff::new(initial, max);
            assert_eq!(backoff.get_interval(), Duration::from_millis(initial));
            for _ in 0..100 {
                assert_eq!(backoff.get_interval(), Duration::from_millis(max));
            }
        }
    }

    #[test]
    fn backoff_reaches_the_largest_cap_from_one() {
        // Exercise every representable power of two before saturation; merely
        // capping the attempt counter would incorrectly stop at 2^63.
        let mut backoff = Backoff::new(1, u64::MAX);
        for exponent in 0..64 {
            assert_eq!(
                backoff.get_interval(),
                Duration::from_millis(1u64 << exponent)
            );
        }
        for _ in 0..100 {
            assert_eq!(backoff.get_interval(), Duration::from_millis(u64::MAX));
        }
    }

    #[test]
    fn backoff_reset_restarts_growth_even_after_reaching_the_cap() {
        let mut backoff = Backoff::new(100, 700);
        // Reset before the first wait, during growth and at the cap. None of
        // these operations should consume the initial interval or change max.
        for consumed in [0, 2, 20] {
            backoff.reset();
            for _ in 0..consumed {
                backoff.get_interval();
            }
            backoff.reset();
            backoff.reset();
            for expected in [100, 200, 400, 700, 700] {
                assert_eq!(backoff.get_interval(), Duration::from_millis(expected));
            }
        }
    }

    #[test]
    fn backoff_reset_preserves_bounded_zero_and_extreme_initial_intervals() {
        // Reset retains the constructor's clamping and zero semantics, without
        // reintroducing overflow when an extreme sequence grows again.
        for (initial, max) in [
            (0, 0),
            (0, u64::MAX),
            (100, 0),
            (900, 700),
            (u64::MAX / 2 + 1, u64::MAX),
            (u64::MAX, u64::MAX),
        ] {
            let mut backoff = Backoff::new(initial, max);
            for _ in 0..100 {
                backoff.get_interval();
            }
            backoff.reset();
            assert_eq!(
                backoff.get_interval(),
                Duration::from_millis(initial.min(max))
            );
            assert_eq!(
                backoff.get_interval(),
                Duration::from_millis(initial.min(max).saturating_mul(2).min(max))
            );
        }
    }
}
