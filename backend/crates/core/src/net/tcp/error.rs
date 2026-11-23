use crate::{
    model::{AdjId, BoardId},
    protocol::{DecodeError, EncodeError},
};

/// Why an order could not be written. Failures before writing transmit no bytes;
/// write failures/timeouts may have transmitted a prefix or the entire frame.
/// Routing and encoding errors are returned only. Validated transport attempts
/// also produce [`TcpError::Send`] on the reporting channel.
#[derive(Debug, thiserror::Error)]
pub enum SendError {
    /// The ID is absent from the index or is not an order.
    #[error("no order is declared with id {0:?}")]
    UnknownId(AdjId),
    /// The destination has no configured TCP client.
    #[error("board {0:?} has no configured TCP client")]
    NoClient(BoardId),
    /// The parameters cannot be represented by the protocol. No bytes were sent.
    #[error("board {board:?}: could not encode order")]
    Encode {
        /// Destination board.
        board: BoardId,
        /// Original protocol error.
        #[source]
        source: EncodeError,
    },
    /// No active session exists, or the selected session ended before completion.
    #[error("board {0:?}: TCP session is disconnected")]
    Disconnected(BoardId),
    /// Waiting for the writer or writing exceeded write_timeout.
    /// Expiry before writing leaves the session usable; expiry during writing closes it.
    #[error("board {0:?}: TCP order write timed out")]
    Timeout(BoardId),
    /// Socket write failure. The session is closed and the order is never replayed.
    #[error("board {board:?}: could not write order")]
    Write {
        /// Destination board.
        board: BoardId,
        /// Original I/O error, shared with the attempt's transport report.
        #[source]
        source: std::sync::Arc<std::io::Error>,
    },
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
/// Every variant names its board; send-attempt reports also identify the order.
/// One board has one active connection at a time.
/// [`crate::net::Error::Tcp`] wraps this type in a [`crate::net::ErrorReport`].
#[derive(Debug, thiserror::Error)]
pub enum TcpError {
    /// A validated order could not be sent. A timeout before writing does not
    /// imply a disconnected session.
    #[error("board {board:?}: order {order:?} could not be sent")]
    Send {
        /// Destination board resolved from the ADJ.
        board: BoardId,
        /// Order ID so the consumer can identify the rejected attempt.
        order: AdjId,
        /// NotConnected, TimedOut, or the underlying write failure.
        #[source]
        source: std::sync::Arc<std::io::Error>,
    },
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
    /// limit. This can indicate an ADJ mismatch or malformed firmware output.
    /// Classified as fatal for application policy: see [`TcpError::is_fatal`].
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

impl TcpError {
    /// Whether this error is classified as fatal for the application's fault policy.
    ///
    /// Only [`TcpError::Decode`] qualifies. An undecodable suffix beyond the
    /// framing limit can indicate an ADJ/firmware mismatch or malformed output;
    /// the error alone does not establish its cause. The transport reports the
    /// failure, closes the session and attempts to reconnect. Reconnecting alone
    /// cannot repair an ADJ/firmware mismatch.
    ///
    /// This method only classifies the error: it neither broadcasts a fault nor
    /// terminates the process. The application consumes the error report and
    /// decides whether to call [`super::BoardClients::broadcast_fault`]. The Go
    /// backend called `SendFault()` directly when `DecodeNext` returned an error,
    /// including read failures; this module leaves that reaction to the caller.
    ///
    /// [`TcpError::Connect`], [`TcpError::Read`], [`TcpError::Write`] and
    /// [`TcpError::Send`] return false. Connection and session failures use the
    /// reconnection path; a send timeout while waiting for the writer can leave
    /// the session usable. EOF within a partial frame is a read failure, not
    /// proof of an ADJ mismatch. `Disconnected` reports a session ending, not a
    /// determination that a board is permanently unavailable.
    pub fn is_fatal(&self) -> bool {
        match self {
            TcpError::Decode { .. } => true,
            TcpError::Connect { .. }
            | TcpError::Read { .. }
            | TcpError::Write { .. }
            | TcpError::Send { .. } => false,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    fn io_error() -> std::io::Error {
        std::io::Error::from(std::io::ErrorKind::ConnectionRefused)
    }

    #[test]
    fn a_frame_that_will_not_decode_faults_the_pod() {
        let error = TcpError::Decode {
            board: BoardId(3),
            source: DecodeError::UnknownId(crate::model::AdjId(9999)),
        };

        // Classification is available to application policy without sending a fault.
        assert!(error.is_fatal());
    }

    #[test]
    fn a_board_that_is_not_up_yet_does_not_fault_the_pod() {
        let connect = TcpError::Connect {
            board: BoardId(3),
            source: io_error(),
        };
        let write = TcpError::Write {
            board: BoardId(3),
            source: io_error(),
        };

        // That is what the reconnection backoff is for.
        assert!(!connect.is_fatal());
        assert!(!write.is_fatal());
    }

    #[test]
    fn an_error_says_which_board_it_was() {
        let error = TcpError::Write {
            board: BoardId(3),
            source: io_error(),
        };

        // The identity survives being formatted, which is what reaches
        // the operator.
        assert!(error.to_string().contains("BoardId(3)"));
    }
}
