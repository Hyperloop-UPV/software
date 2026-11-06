//! The TCP client: one connection per board, one task each.
//!
//! **Connection supervision not written yet.** Handles support board lookup,
//! routing, order encoding and byte queueing. In-memory framing, connection
//! attempts, session reading with reporting, queued frame/keep-alive writing and
//! coordinated session teardown are implemented. Task startup and reconnection
//! remain unimplemented. This module exposes the error type [`super::Error`]
//! aggregates and defines the transport contract.
//! See [`super`] and `net/README.md`.
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
//! [`spawn`], taking [`Config`], an `Arc<Index>` and a
//! [`super::Reporter`], and returning [`Handles`] — the API is written
//! out below, with its reasoning on the items themselves. One call opens
//! **every** connection: one task per entry in [`Config::boards`], so the
//! per-board bookkeeping stays here and `station` only ever asks for
//! "write this to that board".
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
//!   task is what [`super::Reporter`]-side callers reach through the
//!   board's channel in `Handles`.
//! - **Be ready to be told to propagate the fault.** `station` is what
//!   decides (it is the one consuming the error channel and reading
//!   [`Error::is_fatal`]); this module is what can actually write, so it
//!   exposes `Handles::propagate_fault`, which puts **the order with id
//!   0** — the fault, same as the Go backend's `SendFault` — into every
//!   board's writer channel at once, bounded by `write_timeout` per
//!   write. It reports back which boards it could not reach instead of
//!   collapsing them into one opaque error, since a fault that only
//!   half-landed is exactly what the operator has to know. The same path
//!   covers the other case the Go backend had under `propagate_fault`: a
//!   *received* packet with id 0 is a board announcing a fault, and
//!   `station` answers it by calling this, so that logic does not have to
//!   exist twice.
//! - Reconnection with exponential backoff and unlimited retries, the
//!   OS-level keep-alive disabled (there is an application-level one),
//!   `linger = 0` so a dropped connection frees its fixed local port
//!   immediately instead of sitting in `TIME_WAIT`.
//! - Report through [`super::Reporter`] only: [`super::Event::Connected`]
//!   and [`super::Event::Disconnected`] per connection,
//!   [`super::Event::Received`] per frame, and [`Error`] on the error
//!   channel. Never stamp a timestamp by hand — [`super::Reporter::notify`]
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
use crate::{model::BoardId, protocol::Index};
use std::{cmp::min, net::SocketAddr, sync::Arc, time::Duration};

mod board_handle;
mod connection;
mod error;
mod framing;
mod handles;
mod reader;
mod session;
mod writer;

pub use board_handle::BoardHandle;
pub use error::{Error, SendError, Unreachable};
pub use handles::Handles;

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
    pub local_port: u16,
}

/// How long to wait between reconnection attempts.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct Backoff {
    // The first wait after a connection fails or drops.
    initial: u64,
    // Times tried to backoff
    count: u64,
    // The ceiling the doubling stops at. Retries are unlimited: a board
    // that is not up yet is the normal state before a test, not an
    // error to give up on.
    max: u64,
}

impl Backoff {
    /// Creates an instance of Backoff
    /// Arguments:
    /// - initial: value for first backoff atempt
    /// - max: max value of backoff
    pub fn new(initial: u64, max: u64) -> Self {
        Self {
            initial,
            count: 0,
            max,
        }
    }

    /// Returns the backoff interval for each attempt
    pub fn get_interval(&mut self) -> Duration {
        let res = min(self.max, self.initial * 2u64.pow(self.count as u32));
        // Increments the count for the next get_interval
        self.count += 1;
        Duration::from_millis(res)
    }
}

/// How to run the TCP client.
///
/// Everything here is resolved by `station` before `net` is reached: this
/// module reads no config file, and it does not read the ADJ to find its
/// peers either. That is also what lets a test point it at a fake peer.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Config {
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
    /// The session writer implements this; startup through `spawn` is still pending.
    /// OS-level keep-alive remains disabled in favor of this application packet.
    pub keep_alive: Duration,
    /// Bound on each write, so that a peer that stops reading cannot park
    /// a writer task for good (1 s in the Go backend).
    pub write_timeout: Duration,
}

/// Opens a connection to every board in `config.boards`.
///
/// One call, one task per board: the per-connection bookkeeping stays in
/// this module, and `station` only ever asks for "write this to that
/// board" through the [`Handles`] that come back.
///
/// `adj` is the only part of the ADJ this module needs: it decodes
/// inbound frames and encodes outbound orders against it. `station` owns
/// it and hands out clones; it is read-only here, and a reload of the ADJ
/// is a new [`Index`] with new tasks, never a mutation of this one.
///
/// Connecting is *not* done before spawning, unlike [`super::udp`]: a
/// board that is not up yet is normal, so a failed attempt is a report
/// and a retry, never a startup failure.
pub fn spawn(config: Config, adj: Arc<Index>, reporter: Reporter) -> Handles {
    let _ = (config, adj, reporter);
    todo!("the TCP client is not written yet: see this module's contract")
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::protocol::DecodeError;
    use std::path::Path;

    fn io_error() -> std::io::Error {
        std::io::Error::from(std::io::ErrorKind::ConnectionRefused)
    }

    #[test]
    fn a_frame_that_will_not_decode_faults_the_pod() {
        let error = Error::Decode {
            board: BoardId(3),
            source: DecodeError::UnknownId(crate::model::AdjId(9999)),
        };

        // Not a desynchronised stream to retry: the ADJ does not match
        // the firmware, and reconnecting cannot fix that.
        assert!(error.is_fatal());
    }

    #[test]
    fn a_board_that_is_not_up_yet_does_not_fault_the_pod() {
        let connect = Error::Connect {
            board: BoardId(3),
            source: io_error(),
        };
        let write = Error::Write {
            board: BoardId(3),
            source: io_error(),
        };

        // That is what the reconnection backoff is for.
        assert!(!connect.is_fatal());
        assert!(!write.is_fatal());
    }

    #[test]
    fn an_error_says_which_board_it_was() {
        let error = Error::Write {
            board: BoardId(3),
            source: io_error(),
        };

        // The identity survives being formatted, which is what reaches
        // the operator.
        assert!(error.to_string().contains("BoardId(3)"));
    }

    #[tokio::test]
    #[ignore = "manual test: start the documented nc listener on 127.0.0.1:50500 first"]
    // THIS TEST IS SPECIAL:
    //
    // To try it, you need two terminals. Run these commands in this order,
    // one in each terminal:
    // 1. `{
    //        printf '\x03\x00\x0c\x1e\x00\x00nc\x00One\x00'
    //        printf '\x03\x00\x0c\x1e\x00\x00nc\x00Two\x00'
    //        printf '\x03\x00\x0c\x1e\x00\x00n'
    //        sleep 3
    //        printf 'c\x00Three\x00'
    //      } | nc -lN 127.0.0.1 50500`
    // 2. `cargo test -p software-core -F net manual_tcp_receive -- --ignored --nocapture`
    //
    // The first two frames are sent whole. The third frame is split across two
    // writes with a three-second delay. TCP may split or combine reads differently;
    // the framing code must not depend on write/read boundaries matching.
    // The test prints each complete frame, then finishes when nc closes the connection.
    //
    // This test checks connection, framing and reporting by displaying notifications.
    async fn manual_tcp_receive() -> Result<(), Box<dyn std::error::Error>> {
        // Load the fixture ADJ so the real protocol decoder can resolve message ID 3.
        let adj_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/adj/test/adj");
        let adj = crate::adj::load_from_dir(&adj_path)?;
        let index = Arc::new(Index::new(&adj.pod_data, Some(&adj.info.message_levels)));
        let addr = "127.0.0.1:50500".parse()?;
        let link = BoardLink {
            board: BoardId(1),
            addr,
            local_port: 0,
        };

        // Connect to netcat; this test is ignored by the normal automated suite.
        let stream = connection::connect(&link, Duration::from_secs(5)).await?;
        let (read_half, _write_half) = stream.into_split();
        let (reporter, mut sinks) = Reporter::channels(1, 1);
        let receiving = async {
            let result = reader::receive(read_half, link.board, &index, &reporter).await;
            // Close the notification channel after either success or failure so printing ends.
            drop(reporter);
            result
        };
        let displaying = async {
            let mut frames = 0;
            while let Some(notification) = sinks.notifications.recv().await {
                println!("Received notification: {notification:?}");
                frames += 1;
            }
            frames
        };

        // Drain concurrently to respect backpressure; only the manual test has a deadline.
        let (end, frames) = tokio::time::timeout(Duration::from_secs(30), async {
            tokio::join!(receiving, displaying)
        })
        .await?;
        assert_eq!(end?, reader::ReceiveEnd::PeerClosed);
        assert!(
            frames > 0,
            "the peer closed without sending a complete frame"
        );
        Ok(())
    }
}
