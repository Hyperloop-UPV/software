use crate::{
    model::{AdjId, BoardId},
    protocol::{DecodeError, EncodeError},
};

/// Why an order could not be handed to a writer.
///
/// Returned to the caller, not reported through [`crate::net::Reporter`]: it
/// says something about the order that was asked for, not about the state
/// of a connection. [`Error`] is the one that travels on the error
/// channel.
#[derive(Debug, PartialEq, thiserror::Error)]
pub enum SendError {
    /// No order with this id is declared in the loaded ADJ: the id is absent
    /// or belongs to another packet type. Returned by [`super::Handles::send`]
    /// during routing, before encoding or queueing.
    #[error("no order is declared with id {0:?}")]
    UnknownId(AdjId),
    /// The order resolves to a board the config did not list, so no
    /// client was ever opened for it.
    #[error("board {0:?} has no TCP client: the config does not list it")]
    NoClient(BoardId),
    /// The order could not be encoded against the shared index.
    /// No bytes were queued; this is not a connection failure.
    #[error("board {board:?}: could not encode order")]
    Encode {
        /// The board selected for this send.
        board: BoardId,
        /// The original protocol validation or encoding error.
        #[source]
        source: EncodeError,
    },
    /// The order channel's receiver has been closed or dropped.
    /// This is not the same as a disconnected TCP socket.
    #[error("board {0:?}: its connection task is gone")]
    Gone(BoardId),
}

/// Boards whose fault-frame write completion could not be confirmed.
///
/// Produced nonempty by a failed broadcast. Success confirms write_all, not
/// firmware execution; failure may still have transmitted some or all bytes.
#[derive(Debug, Clone, PartialEq, Eq, thiserror::Error)]
#[error("fault write completion was not confirmed for these boards: {0:?}")]
pub struct Unreachable(pub Vec<BoardId>);

/// Something that went wrong on a board's TCP connection.
///
/// Every variant names its board, which is the whole identity of a link:
/// one connection per board.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// The connection could not be opened.
    #[error("board {board:?}: could not connect")]
    Connect {
        /// The board that was being connected to.
        board: BoardId,
        /// The underlying I/O failure.
        #[source]
        source: std::io::Error,
    },

    /// A socket read failed, or the peer closed in the middle of a frame.
    #[error("board {board:?}: could not read")]
    Read {
        /// The board whose connection could not be read.
        board: BoardId,
        /// The underlying I/O failure, including an incomplete-frame EOF.
        #[source]
        source: std::io::Error,
    },

    /// The pending frame could not be decoded after exceeding the framing
    /// limit. Under the protocol assumptions this indicates an ADJ mismatch.
    /// Fatal: see [`Error::is_fatal`].
    #[error("board {board:?}: could not decode a frame")]
    Decode {
        /// The board whose frame failed.
        board: BoardId,
        /// What [`crate::protocol`] said about it.
        #[source]
        source: DecodeError,
    },

    /// An order, keep-alive or fault could not be written.
    #[error("board {board:?}: could not write")]
    Write {
        /// The board that was being written to.
        board: BoardId,
        /// The underlying I/O failure, including `TimedOut` for an elapsed frame deadline.
        #[source]
        source: std::io::Error,
    },
}

impl Error {
    /// Whether this error means the pod has to be sent to fault.
    ///
    /// "Fatal" is about the **pod**, not about this process: the backend
    /// stays up — still reading its other connections, still serving the
    /// frontend, still recording — so that whoever is operating the pod
    /// can see what happened. Nothing here ever calls
    /// `std::process::exit`.
    ///
    /// Only [`Error::Decode`] qualifies, and this is the one place where
    /// the behaviour deliberately departs from the Go backend. Go treated
    /// an undecodable frame as a connection that had fallen out of step,
    /// and reconnecting was the remedy. But nothing corrupts a frame in
    /// flight — TCP checksums and retransmits — so a frame that will not
    /// decode means the loaded ADJ does not match what the firmware is
    /// sending, and reopening the connection cannot fix that. The stream
    /// still cannot be resynchronised mid-frame, so the connection is
    /// closed and reopened anyway; what changes is that the pod is also
    /// sent to fault instead of carrying on as if a retry would help.
    ///
    /// [`Error::Connect`], [`Error::Read`] and [`Error::Write`] are not fatal: a board
    /// that is not up yet, or a write that failed on a connection that
    /// just dropped, is exactly what the reconnection loop with its
    /// backoff is for. Losing a board for good is reported through
    /// [`crate::net::Event::Disconnected`], not through this.
    /// EOF within a partial frame is a read failure, not proof of an ADJ mismatch.
    pub fn is_fatal(&self) -> bool {
        match self {
            Error::Decode { .. } => true,
            Error::Connect { .. } | Error::Read { .. } | Error::Write { .. } => false,
        }
    }
}
