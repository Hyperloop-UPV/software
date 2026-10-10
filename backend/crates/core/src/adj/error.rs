//! Errors produced while loading an ADJ.
//!
//! Layered on purpose: [`LoadError`] is the only public error type here —
//! the one a composition root's own aggregate error would `#[from]`-chain
//! into — while [`MeasurementError`] and [`ProtectionError`] stay
//! crate-private. Nothing outside this crate needs to match past
//! `LoadError` into them; `.source()` still returns `&dyn Error` for
//! logging regardless of the concrete type's visibility.

use std::net::AddrParseError;
use std::path::PathBuf;

/// An error produced while loading an ADJ directory into an [`crate::adj::Adj`].
#[derive(Debug, thiserror::Error)]
pub enum LoadError {
    /// Couldn't read a file.
    #[error("couldn't read {path:?}")]
    ReadFile {
        /// The file that couldn't be read.
        path: PathBuf,
        /// The underlying I/O error.
        #[source]
        source: std::io::Error,
    },

    /// A file's contents weren't valid JSON for the shape expected there.
    #[error("couldn't parse {path:?} as JSON")]
    ParseJson {
        /// The file that failed to parse.
        path: PathBuf,
        /// The underlying JSON error.
        #[source]
        source: serde_json::Error,
    },

    /// A board's `board_ip` isn't a valid IP address.
    #[error("board {board:?}: invalid IP address {raw:?}")]
    InvalidIp {
        /// The board whose IP address is invalid.
        board: String,
        /// The text that failed to parse.
        raw: String,
        /// The underlying parse error.
        #[source]
        source: AddrParseError,
    },

    /// An address in `general_info.json`'s `addresses` isn't a valid IP
    /// address.
    #[error("address {name:?}: invalid IP address {raw:?}")]
    InvalidAddress {
        /// The address's name (e.g. `"backend"`).
        name: String,
        /// The text that failed to parse.
        raw: String,
        /// The underlying parse error.
        #[source]
        source: AddrParseError,
    },

    /// A board's `mac` isn't a valid MAC address.
    #[error("board {board:?}: invalid MAC address {raw:?}")]
    InvalidMac {
        /// The board whose MAC address is invalid.
        board: String,
        /// The text that failed to parse.
        raw: String,
    },

    /// A board has no `mac` field at all.
    #[error("board {board:?}: missing MAC address")]
    MissingMac {
        /// The board missing its MAC address.
        board: String,
    },

    /// A packet or order declares a `type` other than `"data", `"order"`, `"message"` or `"protection"`.
    #[error("board {board:?}, packet {name:?}: unknown packet type {type_name:?}")]
    UnknownPacketType {
        /// The board the packet belongs to.
        board: String,
        /// The packet's name.
        name: String,
        /// The unrecognized type string.
        type_name: String,
    },

    /// A packet or order references a measurement alias that doesn't exist
    /// among that board's own measurements.
    #[error("board {board:?}, packet {name:?}: unknown measurement alias {alias:?}")]
    UnknownAlias {
        /// The board the packet belongs to.
        board: String,
        /// The packet's name.
        name: String,
        /// The alias that couldn't be resolved.
        alias: String,
    },

    /// A measurement couldn't be converted into [`crate::model::Measurement`].
    #[error("board {board:?}, measurement {alias:?}: {source}")]
    Measurement {
        /// The board the measurement belongs to.
        board: String,
        /// The measurement's alias.
        alias: String,
        /// The underlying conversion error.
        #[source]
        source: MeasurementError,
    },
}

/// An error converting a raw measurement into [`crate::model::Measurement`].
#[derive(Debug, thiserror::Error)]
pub enum MeasurementError {
    /// The measurement has more than 7 protections.
    #[error("measurement has {count} protections, maximum allowed is 7")]
    TooManyProtections {
        /// How many protections were declared.
        count: usize,
    },

    /// The measurement's `type` isn't a recognized wire type, `"bool"` or
    /// `"enum"`.
    #[error("unknown measurement type {0:?}")]
    UnknownType(String),

    /// The measurement's `type` is `"enum"` but no `enumValues` were given.
    #[error("type is \"enum\" but no enumValues were given")]
    MissingEnumValues,

    /// One of the measurement's declared protections failed to convert.
    #[error("protection #{index}: {source}")]
    Protection {
        /// The protection's 1-based position within the measurement's list.
        index: usize,
        /// The underlying conversion error.
        #[source]
        source: ProtectionError,
    },
}

/// An error converting a raw protection into [`crate::model::Protection`].
#[derive(Debug, thiserror::Error)]
pub enum ProtectionError {
    /// The protection's `type` isn't one of the five known kinds.
    #[error("unknown protection type {0:?}")]
    UnknownType(String),

    /// The protection's `value` array doesn't have the number of bounds its
    /// `type` requires.
    #[error("type {kind:?} needs {expected} bound(s), got {got}")]
    WrongBoundCount {
        /// The protection's type string.
        kind: String,
        /// How many bounds that type requires.
        expected: u8,
        /// How many bounds were actually given.
        got: usize,
    },

    /// The protection's `time` string couldn't be parsed as a duration.
    #[error("couldn't parse time {0:?}")]
    InvalidTime(String),
}
