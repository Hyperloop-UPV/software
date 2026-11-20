//! The TCP client: one connection per board, one task each.
//!
//! [`spawn`] starts one independent supervisor and bounded order queue per board.
//! BoardClients support board lookup, routing, encoding and queueing; each supervisor
//! reconnects with queued orders preserved and backoff reset on connection success.
//! Fault broadcast uses the same writers with priority at frame boundaries.
//! Explicit task shutdown/joining remains pending. This module
//! exposes the error type [`super::Error`] aggregates and defines the transport contract.
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
//! **every** connection: one task per entry in [`TcpConfig::boards`], so the
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
//!   is permanently misaligned. A failed parse means "not enough bytes
//!   yet"; the one safeguard is that no frame can exceed 374 bytes
//!   (`2 + 4 + 48 + 320`), so a buffer that grows past that without
//!   yielding a frame is out of step rather than waiting, and the
//!   connection should be dropped and reopened.
//! - **One writer task per connection.** Orders, the keep-alive and the
//!   fault all share the socket, so a single task must own the write
//!   half, or two half-written frames can interleave on the wire. That
//!   task receives requests through the board's channels in `BoardClients`.
//! - **Be ready to be told to propagate the fault.** The application
//!   decides when; this module is what can actually write, so it
//!   exposes [`BoardClients::broadcast_fault`], which puts **the order with id
//!   0** — the fault, same as the Go backend's `SendFault` — into every
//!   board's control channel at once, bounded by `write_timeout` for the
//!   whole attempt. It reports which writes could not be confirmed instead of
//!   collapsing them into one opaque error, since a fault that only
//!   half-landed is exactly what the operator has to know. The same path
//!   can be used by application policies for received protections or errors.
//!   No automatic trigger or once-per-incident guard is implemented here.
//! - Reconnection with exponential backoff and unlimited retries, the
//!   OS-level keep-alive disabled (there is an application-level one),
//!   `linger = 0` so a dropped connection frees its fixed local port
//!   immediately instead of sitting in `TIME_WAIT`.
//! - Report through [`super::Reporter`] only: [`super::Event::Connected`]
//!   and [`super::Event::Disconnected`] per connection,
//!   [`super::Event::Received`] per frame, and [`Error`] on the error
//!   channel. Never stamp a timestamp by hand — the reporter
//!   does it. Never touch disk, WebSocket or aggregation.
//! - **A terminal decode failure is fatal**: see [`Error::is_fatal`]. An
//!   unsuccessful attempt on at most 374 pending bytes is not terminal;
//!   it only means "wait for more" under the framing rule above. Log a
//!   terminal failure and report it on the error channel, which is all this
//!   module does about it. Sending the pod to fault is not `net`'s call to make:
//!   whoever consumes the error channel reads [`Error::is_fatal`] and
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
use tokio::sync::mpsc;

mod board_clients;
mod board_handle;
mod connection;
mod error;
mod fault;
mod framing;
mod reader;
mod session;
mod supervisor;
mod writer;

// Queue capacity counts encoded frames, not bytes. Keep it bounded while
// disconnected; configuration of this limit can be added separately.
const ORDER_QUEUE_CAPACITY: usize = 64;

pub use board_clients::BoardClients;
pub use board_handle::BoardHandle;
pub use error::{Error, SendError, Unreachable};

/// One board to keep a connection to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct BoardLink {
    /// Whose connection this is. Every report about it names this board,
    /// which is the whole identity of a link.
    pub board: BoardId,
    /// Where to connect: the board's `ip` + its `ports["TCP_SERVER"]`.
    pub addr: SocketAddr,
    /// The fixed local port to bind the client side to (`TCP_CLIENT + i`
    /// in the Go backend). Being fixed is why `linger = 0` matters: a
    /// dropped connection must not leave this port in `TIME_WAIT`.
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
    /// Bound on each normal frame write, so a stalled peer cannot park a writer.
    /// Also bounds each entire fault attempt, including queue/frame-boundary waits.
    pub write_timeout: Duration,
}

/// Opens a connection to every board in `config.boards`.
///
/// One call, one task per board: the per-connection bookkeeping stays in
/// this module, and the application submits orders through the [`BoardClients`]
/// that come back, letting the index select their destination.
///
/// `adj` is the only part of the ADJ this module needs: it decodes
/// inbound frames and encodes outbound orders against it. The application owns
/// it and hands out clones; it is read-only here, and a reload of the ADJ
/// is a new [`Index`] with new tasks, never a mutation of this one.
///
/// Connecting is *not* done before spawning, unlike [`super::udp`]: a
/// board that is not up yet is normal, so a failed attempt is a report
/// and a retry, never a startup failure.
///
/// Each board gets a queue of 64 encoded frames and a supervisor with independent
/// backoff state, sharing the immutable index and Reporter channels. Repeated
/// board IDs keep their first link and log a warning; no duplicate task is started.
/// An empty board list returns empty handles without opening a connection.
///
/// Tasks are detached for now: this API does not return join handles or implement
/// explicit shutdown. Closing either Reporter consumer stops the supervisors;
/// consume both channels concurrently while running. Dropping BoardClients closes the
/// order senders but does not promise immediate stop during offline retries.
/// No application handshake or hash exchange is performed. Fault broadcast is
/// explicit through [`BoardClients::broadcast_fault`], never triggered automatically.
///
/// # Panics
///
/// Starting a nonempty configuration outside a Tokio runtime panics, as does
/// [`tokio::spawn`].
pub fn spawn(config: TcpConfig, index: Arc<Index>, reporter: Reporter) -> BoardClients {
    let mut boards = HashMap::with_capacity(config.boards.len());
    let config = Arc::new(config);
    for &link in &config.boards {
        if boards.contains_key(&link.board) {
            tracing::warn!(board = ?link.board, "ignoring duplicate TCP board link");
            continue;
        }
        let (orders, mut receiver) = mpsc::channel(ORDER_QUEUE_CAPACITY);
        let fault = fault::Endpoint::default();
        boards.insert(
            link.board,
            BoardHandle {
                board: link.board,
                index: Arc::clone(&index),
                orders,
                fault: fault.clone(),
            },
        );

        let index = Arc::clone(&index);
        let config = Arc::clone(&config);
        let reporter = reporter.clone();
        // Deliberately detached: explicit task ownership/joining is a later step.
        let _task = tokio::spawn(async move {
            let _ = supervisor::supervise(
                &link,
                &config,
                &index,
                &reporter,
                &mut receiver,
                &fault,
            )
            .await;
        });
    }
    BoardClients::new(boards, index, config.write_timeout)
}

#[cfg(test)]
mod tests;

#[cfg(test)]
mod manual_tests;
