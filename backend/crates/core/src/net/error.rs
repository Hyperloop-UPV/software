//! The one error type an [`super::ErrorReport`] can carry.

use super::{tcp, udp};

/// Anything that went wrong in `net`.
///
/// Aggregation only: this enum adds no identity and no message of its
/// own. Each submodule owns its own error type and puts the identity of
/// whatever failed — the board, or the peer address —
/// *inside* the variant, not just in its text, so that the identity
/// survives being sent down a channel. The Go backend lost it exactly
/// there: the log line before the send had the board, the error value
/// that travelled did not.
///
/// Both variants are `#[error(transparent)]`, so `to_string()` on this
/// enum is the submodule's own message, identity interpolated and all —
/// which is what gets shown to the operator — and `source()` still walks
/// down to the original `io::Error` or
/// [`crate::protocol::DecodeError`].
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// On a board's TCP connection.
    #[error(transparent)]
    Tcp(#[from] tcp::Error),
    /// On the shared UDP socket.
    #[error(transparent)]
    Udp(#[from] udp::Error),
}
