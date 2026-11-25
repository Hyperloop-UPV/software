//! What each error means: the decision table of the README's "Errors"
//! section, as functions that keep no state, so it can be tested on its own.

use std::error::Error;
use std::net::IpAddr;

use software_core::model::BoardId;
use software_core::net::{self, tcp, udp::UdpError};

use super::ProblemKind;

/// What the routing loop does about an error.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) enum Action {
    /// Procedure 3: show it, send the fault, stop.
    Fatal,
    /// A board sent a fault: show the first one from that board, forward
    /// it to the others if configured, keep running.
    BoardFault,
    /// Procedure 2: show it, keep running.
    Show,
    /// Procedure 1: only written to the trace; not shown, keep running.
    Silent,
}

/// Decides what a `net` error means. `is_fatal()` is not consulted: the
/// decision is `event`'s, and it is made here, from the error itself.
pub(super) fn classify(error: &net::Error) -> Action {
    match error {
        net::Error::Udp(error) => match error {
            // Nothing corrupts a datagram in flight, so any decode failure
            // means the loaded ADJ does not match the firmware, whatever the
            // variant: an unknown id, a truncated datagram, an enum value out
            // of range.
            UdpError::Decode { .. } => Action::Fatal,
            // The socket is gone: every board's telemetry at once.
            UdpError::Recv { .. } => Action::Fatal,
            UdpError::Fault { .. } => Action::BoardFault,
            // Never reaches the error queue (binding happens before the task
            // starts). If it ever did, there would be no telemetry at all.
            UdpError::Bind { .. } => Action::Fatal,
        },
        net::Error::Tcp(error) => match error {
            tcp::Error::Decode { .. } => Action::Fatal,
            // A board not up yet: what the reconnection backoff is for.
            tcp::Error::Connect { .. } => Action::Silent,
            tcp::Error::Write { .. } => Action::Show,
        },
    }
}

/// Decides what a [`super::Problem`] from a station module means: whatever
/// the module that sent it says.
pub(super) fn for_problem(kind: ProblemKind) -> Action {
    match kind {
        ProblemKind::Fatal => Action::Fatal,
        ProblemKind::Shown => Action::Show,
        ProblemKind::Silent => Action::Silent,
    }
}

/// Where an error comes from, as far as the error itself says.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub(super) struct Source {
    /// The board, when the error names it (TCP errors do).
    pub(super) board: Option<BoardId>,
    /// The address a datagram came from, when that is all there is (UDP).
    pub(super) ip: Option<IpAddr>,
}

/// Reads [`Source`] off an error.
pub(super) fn source(error: &net::Error) -> Source {
    match error {
        net::Error::Udp(error) => match error {
            UdpError::Decode { from, .. } | UdpError::Fault { from } => Source {
                board: None,
                ip: Some(from.ip()),
            },
            UdpError::Recv { .. } | UdpError::Bind { .. } => Source {
                board: None,
                ip: None,
            },
        },
        net::Error::Tcp(error) => match error {
            tcp::Error::Connect { board, .. }
            | tcp::Error::Decode { board, .. }
            | tcp::Error::Write { board, .. } => Source {
                board: Some(*board),
                ip: None,
            },
        },
    }
}

/// The error with all its causes: "could not X: because Y: because Z".
///
/// Some errors already include their cause in their own message and others
/// do not, so a cause that already appears is not repeated.
pub fn full_message(error: &dyn Error) -> String {
    let mut message = error.to_string();
    let mut source = error.source();
    while let Some(cause) = source {
        let text = cause.to_string();
        if !message.contains(&text) {
            message.push_str(": ");
            message.push_str(&text);
        }
        source = cause.source();
    }
    message
}

#[cfg(test)]
mod tests {
    use super::*;
    use software_core::model::AdjId;
    use software_core::protocol::DecodeError;
    use std::net::SocketAddr;

    fn from() -> SocketAddr {
        SocketAddr::new(IpAddr::from([127, 0, 0, 7]), 50400)
    }

    fn io_error() -> std::io::Error {
        std::io::Error::from(std::io::ErrorKind::ConnectionReset)
    }

    fn udp(error: UdpError) -> net::Error {
        net::Error::Udp(error)
    }

    fn tcp(error: tcp::Error) -> net::Error {
        net::Error::Tcp(error)
    }

    #[test]
    fn every_udp_decode_error_is_fatal_not_only_an_unknown_id() {
        for source in [
            DecodeError::UnknownId(AdjId(9999)),
            DecodeError::UnexpectedEof,
            DecodeError::InvalidEnumValue {
                index: 7,
                options: 2,
            },
        ] {
            let error = udp(UdpError::Decode {
                from: from(),
                source,
            });
            assert_eq!(classify(&error), Action::Fatal, "{error}");
        }
    }

    #[test]
    fn losing_the_udp_socket_is_fatal() {
        let error = udp(UdpError::Recv { source: io_error() });
        assert_eq!(classify(&error), Action::Fatal);
    }

    #[test]
    fn a_fault_from_a_board_does_not_stop_the_backend() {
        let error = udp(UdpError::Fault { from: from() });
        assert_eq!(classify(&error), Action::BoardFault);
    }

    #[test]
    fn tcp_errors_follow_the_three_procedures() {
        let decode = tcp(tcp::Error::Decode {
            board: BoardId(3),
            source: DecodeError::UnknownId(AdjId(9999)),
        });
        let connect = tcp(tcp::Error::Connect {
            board: BoardId(3),
            source: io_error(),
        });
        let write = tcp(tcp::Error::Write {
            board: BoardId(3),
            source: io_error(),
        });

        assert_eq!(classify(&decode), Action::Fatal);
        assert_eq!(classify(&connect), Action::Silent);
        assert_eq!(classify(&write), Action::Show);
    }

    #[test]
    fn a_problem_means_what_its_module_says() {
        assert_eq!(for_problem(ProblemKind::Fatal), Action::Fatal);
        assert_eq!(for_problem(ProblemKind::Shown), Action::Show);
        assert_eq!(for_problem(ProblemKind::Silent), Action::Silent);
    }

    #[test]
    fn udp_errors_carry_an_address_and_tcp_errors_a_board() {
        let fault = udp(UdpError::Fault { from: from() });
        assert_eq!(
            source(&fault),
            Source {
                board: None,
                ip: Some(from().ip())
            }
        );

        let recv = udp(UdpError::Recv { source: io_error() });
        assert_eq!(
            source(&recv),
            Source {
                board: None,
                ip: None
            }
        );

        let write = tcp(tcp::Error::Write {
            board: BoardId(3),
            source: io_error(),
        });
        assert_eq!(
            source(&write),
            Source {
                board: Some(BoardId(3)),
                ip: None
            }
        );
    }

    #[test]
    fn the_full_message_carries_every_cause_once() {
        let error = udp(UdpError::Decode {
            from: from(),
            source: DecodeError::UnknownId(AdjId(9999)),
        });

        let message = full_message(&error);
        assert!(message.contains("127.0.0.7:50400"), "{message}");
        assert!(message.contains("unknown packet id"), "{message}");
        assert_eq!(message.matches("unknown packet id").count(), 1);
    }
}
