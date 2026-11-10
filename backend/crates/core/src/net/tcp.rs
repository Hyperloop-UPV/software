//! The TCP client: one connection per board, one task each.
//!
//! [`spawn`] starts one independent supervisor and bounded order queue per board.
//! Handles support board lookup, routing, encoding and queueing; [`supervise`]
//! reconnects with queued orders preserved and backoff reset on connection success.
//! Fault broadcast uses the same writers with priority at frame boundaries.
//! Explicit task shutdown/joining remains pending. This module
//! exposes the error type [`super::Error`] aggregates and defines the transport contract.
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
//!   exposes [`Handles::propagate_fault`], which puts **the order with id
//!   0** — the fault, same as the Go backend's `SendFault` — into every
//!   board's control channel at once, bounded by `write_timeout` for the
//!   whole attempt. It reports which writes could not be confirmed instead of
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
use std::{collections::HashMap, net::SocketAddr, sync::Arc, time::Duration};
use tokio::sync::mpsc;

mod board_handle;
mod connection;
mod error;
mod fault;
mod framing;
mod handles;
mod reader;
mod session;
mod supervisor;
mod writer;

// Queue capacity counts encoded frames, not bytes. Keep it bounded while
// disconnected; configuration of this limit can be added separately.
const ORDER_QUEUE_CAPACITY: usize = 64;

pub use board_handle::BoardHandle;
pub use connection::{connect, connect_with_backoff};
pub use error::{Error, SendError, Unreachable};
pub use handles::Handles;
pub use session::{SessionEnd, run};
pub use supervisor::supervise;

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
    /// maximum produces zero intervals throughout; the caller decides when to wait.
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
    pub fn get_interval(&mut self) -> Duration {
        let interval = Duration::from_millis(self.next);
        self.next = self.next.saturating_mul(2).min(self.max);
        interval
    }

    /// Restores the first interval without changing the configured maximum.
    ///
    /// Call after a successful connection so a later disconnection starts a new
    /// retry sequence. Repeated resets are harmless and do not consume an interval.
    pub fn reset(&mut self) {
        self.next = self.initial;
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
///
/// Each board gets a queue of 64 encoded frames and a supervisor with independent
/// backoff state, sharing the immutable index and Reporter channels. Repeated
/// board IDs keep their first link and log a warning; no duplicate task is started.
/// An empty board list returns empty handles without opening a connection.
///
/// Tasks are detached for now: this API does not return join handles or implement
/// explicit shutdown. Closing either Reporter consumer stops the supervisors;
/// consume both channels concurrently while running. Dropping Handles closes the
/// order senders but does not promise immediate stop during offline retries.
/// No application handshake or hash exchange is performed. Fault broadcast is
/// explicit through [`Handles::propagate_fault`], never triggered automatically.
///
/// # Panics
///
/// Starting a nonempty configuration outside a Tokio runtime panics, as does
/// [`tokio::spawn`].
pub fn spawn(config: Config, adj: Arc<Index>, reporter: Reporter) -> Handles {
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
                index: Arc::clone(&adj),
                orders,
                fault: fault.clone(),
            },
        );

        let index = Arc::clone(&adj);
        let config = Arc::clone(&config);
        let reporter = reporter.clone();
        // Deliberately detached: explicit task ownership/joining is a later step.
        let _task = tokio::spawn(async move {
            let _ = supervisor::supervise_with_faults(
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
    Handles::new(boards, adj, config.write_timeout)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::{
        model::{AdjId, OrderPacket, Value},
        protocol::DecodeError,
    };
    use std::{io, path::Path};

    fn io_error() -> std::io::Error {
        std::io::Error::from(std::io::ErrorKind::ConnectionRefused)
    }

    #[tokio::test]
    async fn broadcasts_faults_over_active_clients_without_replaying_after_reconnect()
    -> Result<(), Box<dyn std::error::Error>> {
        use crate::net::Event;
        use std::net::Ipv4Addr;
        use tokio::{io::AsyncReadExt, net::TcpListener, time::timeout};

        timeout(Duration::from_secs(6), async {
            let first_listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
            let third_listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
            let config = Config {
                boards: vec![
                    BoardLink {
                        board: BoardId(1),
                        addr: first_listener.local_addr()?,
                        local_port: 0,
                    },
                    BoardLink {
                        board: BoardId(3),
                        addr: third_listener.local_addr()?,
                        local_port: 0,
                    },
                ],
                connect_timeout: Duration::from_millis(100),
                backoff: Backoff::new(1000, 1000),
                write_timeout: Duration::from_millis(200),
                keep_alive: Duration::ZERO,
            };
            let (reporter, mut sinks) = Reporter::channels(32, 16);
            // Reserved ID 0 must work with no ADJ orders declared at all.
            let handles = spawn(config, Arc::new(Index::default()), reporter);
            let (first, third) =
                tokio::try_join!(first_listener.accept(), third_listener.accept())?;
            let (mut first, mut third) = (first.0, third.0);
            for _ in 0..2 {
                let notification = sinks
                    .notifications
                    .recv()
                    .await
                    .ok_or("reporting stopped")?;
                assert!(matches!(notification.event, Event::Connected));
            }

            let (mut a, mut b) = ([0xff; 2], [0xff; 2]);
            let (broadcast, read_a, read_b) = tokio::join!(
                handles.propagate_fault(),
                first.read_exact(&mut a),
                third.read_exact(&mut b)
            );
            assert_eq!(broadcast, Ok(()));
            read_a?;
            read_b?;
            assert_eq!((a, b), ([0, 0], [0, 0]));

            drop(first);
            let notification = sinks
                .notifications
                .recv()
                .await
                .ok_or("missing disconnection")?;
            assert_eq!(notification.board, BoardId(1));
            assert!(matches!(notification.event, Event::Disconnected));
            // The offline board fails, without preventing the healthy board's write.
            b.fill(0xff);
            let (broadcast, read_b) =
                tokio::join!(handles.propagate_fault(), third.read_exact(&mut b));
            assert_eq!(broadcast, Err(Unreachable(vec![BoardId(1)])));
            read_b?;
            assert_eq!(b, [0, 0]);

            let (mut reconnected, _) = first_listener.accept().await?;
            let notification = sinks
                .notifications
                .recv()
                .await
                .ok_or("missing reconnection")?;
            assert_eq!(notification.board, BoardId(1));
            assert!(matches!(notification.event, Event::Connected));
            // Neither the successful first fault nor the offline request is replayed.
            assert!(
                timeout(Duration::from_millis(30), reconnected.read_exact(&mut a))
                    .await
                    .is_err()
            );
            a.fill(0xff);
            b.fill(0xff);
            let (broadcast, read_a, read_b) = tokio::join!(
                handles.propagate_fault(),
                reconnected.read_exact(&mut a),
                third.read_exact(&mut b)
            );
            assert_eq!(broadcast, Ok(()));
            read_a?;
            read_b?;
            assert_eq!((a, b), ([0, 0], [0, 0]));
            sinks.notifications.close();
            sinks.errors.close();
            Ok::<_, Box<dyn std::error::Error>>(())
        })
        .await??;
        Ok(())
    }

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

    /// Preserves station's original supervised probe, now driven through spawn/Handles.
    ///
    /// From backend/, with the ADJ matching the selected firmware:
    /// ```text
    /// ADJ_DIR=/path/to/adj TCP_BOARD=TEST \
    /// cargo test -p software-core --features net manual_tcp_supervisor -- --ignored --nocapture
    /// ```
    /// Optional TCP_LOCAL_PORT defaults to 0; TCP_KEEP_ALIVE_MS defaults to 1000
    /// (zero disables keep-alive). The board IP and TCP_SERVER port come from ADJ.
    /// For a local simulator, use a private ADJ copy with the board IP 127.0.0.1
    /// and start `nc -l 50500 | od -An -tx1 -v -w2` if TCP_SERVER is 50500.
    ///
    /// WARNING: this test sends order 1001 with numeric parameter 5.0 once. Use only
    /// the intended TEST board/firmware or simulator, not an arbitrary real board.
    /// For a float32 parameter, its bytes are e9 03 00 00 a0 40; keep-alive is 01 00.
    /// Closing and reopening the simulator should reconnect without repeating the
    /// order. Backoff grows from 500 to 5000 ms on failures and resets on success.
    ///
    /// Prints both Reporter channels until Ctrl+C, without a test-only read timeout.
    /// Ctrl+C closes the consumers; task joining and guaranteed final-event draining
    /// are not implemented. The existing manual_tcp_receive test remains unchanged.
    #[tokio::test]
    #[ignore = "manual probe: requires ADJ_DIR, TCP_BOARD and a real board or simulator; sends order 1001"]
    async fn manual_tcp_supervisor() -> Result<(), Box<dyn std::error::Error>> {
        let adj_path = std::env::var_os("ADJ_DIR").ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "set ADJ_DIR to the matching ADJ directory",
            )
        })?;
        let board_name = std::env::var("TCP_BOARD")?;
        let local_port = match std::env::var("TCP_LOCAL_PORT") {
            Ok(value) => value.parse::<u16>()?,
            Err(std::env::VarError::NotPresent) => 0,
            Err(error) => return Err(error.into()),
        };
        let keep_alive_ms = match std::env::var("TCP_KEEP_ALIVE_MS") {
            Ok(value) => value.parse::<u64>()?,
            Err(std::env::VarError::NotPresent) => 1000,
            Err(error) => return Err(error.into()),
        };
        let adj = crate::adj::load_from_dir(Path::new(&adj_path))?;
        let board = adj
            .pod_data
            .boards
            .values()
            .find(|board| board.name == board_name)
            .ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("board {board_name:?} is not declared in the supplied ADJ"),
                )
            })?;
        let port = adj.info.ports.get("TCP_SERVER").ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "the supplied ADJ has no TCP_SERVER port",
            )
        })?;
        let link = BoardLink {
            board: board.id,
            addr: SocketAddr::new(board.ip, port.0),
            local_port,
        };
        let index = Arc::new(Index::new(&adj.pod_data, Some(&adj.info.message_levels)));
        let config = Config {
            boards: vec![link],
            connect_timeout: Duration::from_secs(5),
            backoff: Backoff::new(500, 5000),
            write_timeout: Duration::from_secs(2),
            keep_alive: Duration::from_millis(keep_alive_ms),
        };
        println!(
            "Manual TCP probe: {board_name} at {}; order 1001(5.0) once; press Ctrl+C to stop",
            link.addr
        );
        let (reporter, mut sinks) = Reporter::channels(256, 16);
        let handles = spawn(config, index, reporter);
        let running = async {
            handles
                .send(OrderPacket::new(AdjId(1001), vec![Value::Number(-5.0)]))
                .await?;
            tokio::signal::ctrl_c().await?;
            Ok::<_, Box<dyn std::error::Error>>(())
        };
        let display = async {
            tokio::join!(
                async {
                    while let Some(notification) = sinks.notifications.recv().await {
                        println!("{notification:#?}");
                    }
                },
                async {
                    while let Some(report) = sinks.errors.recv().await {
                        eprintln!("{report:#?}");
                    }
                },
            );
        };
        let result = tokio::select! {
            result = running => result,
            () = display => Err(io::Error::new(io::ErrorKind::BrokenPipe, "TCP reporting stopped before Ctrl+C").into()),
        };
        sinks.notifications.close();
        sinks.errors.close();
        drop(handles);
        result
    }

    /// Runs the current station main probe through the public multi-board `spawn` API.
    ///
    /// From backend/, with an ADJ matching the selected firmware:
    /// ```text
    /// ADJ_DIR=/path/to/adj TCP_BOARD=TEST \
    /// cargo test -p software-core --features net manual_tcp_spawn -- --ignored --nocapture
    /// ```
    /// Optional TCP_LOCAL_PORT defaults to 0; TCP_KEEP_ALIVE_MS defaults to 1000
    /// (zero disables keep-alive). The selected board IP and TCP_SERVER port come
    /// from the supplied ADJ. This probe sends no orders; it prints both Reporter
    /// channels until Ctrl+C and exercises spawn, connect, receive and reconnect.
    /// For a loopback simulator, use a private ADJ copy with the board IP set to
    /// 127.0.0.1 and observe the configured port, e.g. `nc -l 50500`.
    ///
    /// Ctrl+C closes the reporting consumers and drops Handles. There is not yet an
    /// explicit task join, so this is a manual probe rather than a shutdown test.
    #[tokio::test]
    #[ignore = "manual spawn probe: requires ADJ_DIR, TCP_BOARD and a real board or simulator"]
    async fn manual_tcp_spawn() -> Result<(), Box<dyn std::error::Error>> {
        let adj_path = std::env::var_os("ADJ_DIR").ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "set ADJ_DIR to the matching ADJ directory",
            )
        })?;
        let board_name = std::env::var("TCP_BOARD")?;
        let local_port = match std::env::var("TCP_LOCAL_PORT") {
            Ok(value) => value.parse::<u16>()?,
            Err(std::env::VarError::NotPresent) => 0,
            Err(error) => return Err(error.into()),
        };
        let keep_alive_ms = match std::env::var("TCP_KEEP_ALIVE_MS") {
            Ok(value) => value.parse::<u64>()?,
            Err(std::env::VarError::NotPresent) => 1000,
            Err(error) => return Err(error.into()),
        };
        let adj = crate::adj::load_from_dir(Path::new(&adj_path))?;
        let board = adj
            .pod_data
            .boards
            .values()
            .find(|board| board.name == board_name)
            .ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("board {board_name:?} is not declared in the supplied ADJ"),
                )
            })?;
        let port = adj.info.ports.get("TCP_SERVER").ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "the supplied ADJ has no TCP_SERVER port",
            )
        })?;
        let link = BoardLink {
            board: board.id,
            addr: SocketAddr::new(board.ip, port.0),
            local_port,
        };
        let index = Arc::new(Index::new(&adj.pod_data, Some(&adj.info.message_levels)));
        let config = Config {
            boards: vec![link],
            connect_timeout: Duration::from_secs(5),
            backoff: Backoff::new(500, 5000),
            write_timeout: Duration::from_secs(2),
            keep_alive: Duration::from_millis(keep_alive_ms),
        };
        println!(
            "Manual TCP spawn probe: {board_name} at {}; no orders; press Ctrl+C to stop",
            link.addr
        );
        let (reporter, mut sinks) = Reporter::channels(256, 16);
        let handles = spawn(config, index, reporter);
        let running = tokio::signal::ctrl_c();
        let display = async {
            tokio::join!(
                async {
                    while let Some(notification) = sinks.notifications.recv().await {
                        println!("{notification:#?}");
                    }
                },
                async {
                    while let Some(report) = sinks.errors.recv().await {
                        eprintln!("{report:#?}");
                    }
                },
            );
        };
        let result = tokio::select! {
            stopped = running => stopped,
            () = display => Err(io::Error::new(
                io::ErrorKind::BrokenPipe,
                "TCP reporting stopped before Ctrl+C",
            )),
        };
        // As in station main, consumer closure asks detached supervisors to stop.
        sinks.notifications.close();
        sinks.errors.close();
        drop(handles);
        result?;
        Ok(())
    }

    /// Sends one real fault through spawn/Handles after the first connection.
    ///
    /// WARNING: this actively requests a firmware fault. Use only a safe test
    /// setup or simulator. From backend/:
    /// ```text
    /// ADJ_DIR=/path/to/adj TCP_BOARD=TEST \
    /// cargo test -p software-core --features net manual_tcp_fault -- --ignored --nocapture
    /// ```
    /// TCP_LOCAL_PORT defaults to 0 and TCP_KEEP_ALIVE_MS to 1000; zero disables
    /// keep-alive. The board IP and TCP_SERVER port come from the supplied ADJ.
    /// With a private loopback ADJ and port 50500, observe the fault bytes `00 00`
    /// using `nc -l 50500 | od -An -tx1 -v -w2`; keep-alive bytes are `01 00`.
    ///
    /// Both Reporter channels are consumed while waiting, writing and observing
    /// firmware afterwards. Success only confirms write_all, not firmware receipt
    /// or execution: verify the board's fault state separately. A failed broadcast
    /// fails the test. No normal order, hash, automatic retry of the fault, or
    /// second fault after reconnection is sent. Ctrl+C stops the probe even before
    /// connection; closing consumers cancels supervisors without explicit joining.
    #[tokio::test]
    #[ignore = "manual fault probe: sends a REAL fault; requires ADJ_DIR, TCP_BOARD and a safe board or simulator"]
    async fn manual_tcp_fault() -> Result<(), Box<dyn std::error::Error>> {
        use crate::net::Event;
        use tokio::sync::oneshot;

        let adj_path = std::env::var_os("ADJ_DIR").ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "set ADJ_DIR to the matching ADJ directory",
            )
        })?;
        let board_name = std::env::var("TCP_BOARD")?;
        let local_port = match std::env::var("TCP_LOCAL_PORT") {
            Ok(value) => value.parse::<u16>()?,
            Err(std::env::VarError::NotPresent) => 0,
            Err(error) => return Err(error.into()),
        };
        let keep_alive_ms = match std::env::var("TCP_KEEP_ALIVE_MS") {
            Ok(value) => value.parse::<u64>()?,
            Err(std::env::VarError::NotPresent) => 1000,
            Err(error) => return Err(error.into()),
        };
        let adj = crate::adj::load_from_dir(Path::new(&adj_path))?;
        let board = adj
            .pod_data
            .boards
            .values()
            .find(|board| board.name == board_name)
            .ok_or_else(|| {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("board {board_name:?} is not declared in the supplied ADJ"),
                )
            })?;
        let port = adj.info.ports.get("TCP_SERVER").ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                "the supplied ADJ has no TCP_SERVER port",
            )
        })?;
        let link = BoardLink {
            board: board.id,
            addr: SocketAddr::new(board.ip, port.0),
            local_port,
        };
        let index = Arc::new(Index::new(&adj.pod_data, Some(&adj.info.message_levels)));
        let config = Config {
            boards: vec![link],
            connect_timeout: Duration::from_secs(5),
            backoff: Backoff::new(500, 5000),
            write_timeout: Duration::from_secs(2),
            keep_alive: Duration::from_millis(keep_alive_ms),
        };
        println!(
            "WARNING: manual TCP fault probe: {board_name} at {}; sends 00 00 once after connecting; press Ctrl+C to stop",
            link.addr
        );
        let (reporter, mut sinks) = Reporter::channels(256, 16);
        let handles = spawn(config, index, reporter);
        let (connected, first_connection) = oneshot::channel();
        let running = async {
            // Wait outside the display loops so neither reporting channel is
            // blocked by admission or completion of the fault write.
            first_connection.await.map_err(|_| {
                io::Error::new(
                    io::ErrorKind::BrokenPipe,
                    "reporting stopped before connection",
                )
            })?;
            println!("First connection established; requesting fault once");
            if let Err(error) = handles.propagate_fault().await {
                eprintln!("Fault write NOT confirmed: {error}");
                return Err(error.into());
            }
            println!(
                "Fault write confirmed; NOT a firmware ACK. Verify the board's fault state; press Ctrl+C to stop"
            );
            // Keep the same handles and consumers alive for observation, without
            // creating another fault request when the supervisor reconnects.
            std::future::pending::<Result<(), Box<dyn std::error::Error>>>().await
        };
        let display = async {
            let mut connected = Some(connected);
            tokio::join!(
                async {
                    while let Some(notification) = sinks.notifications.recv().await {
                        let ready = notification.board == link.board
                            && matches!(&notification.event, Event::Connected);
                        println!("{notification:#?}");
                        // Taking the sender makes the trigger one-shot across all
                        // subsequent Connected events, including reconnections.
                        if ready && let Some(connected) = connected.take() {
                            let _ = connected.send(());
                        }
                    }
                },
                async {
                    while let Some(report) = sinks.errors.recv().await {
                        eprintln!("{report:#?}");
                    }
                },
            );
        };
        let result = tokio::select! {
            result = running => result,
            stopped = tokio::signal::ctrl_c() => stopped.map_err(Into::into),
            () = display => Err(io::Error::new(
                io::ErrorKind::BrokenPipe,
                "TCP reporting stopped before Ctrl+C",
            ).into()),
        };
        sinks.notifications.close();
        sinks.errors.close();
        drop(handles);
        result
    }
}
