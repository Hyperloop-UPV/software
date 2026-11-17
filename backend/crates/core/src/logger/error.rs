//! Errors produced while writing a file.
//!
//! Every variant names the file it happened on. A bare
//! [`std::io::Error`] says what went wrong but never where, and by the
//! time it reaches whoever decides whether to keep logging, the file is
//! the only thing that makes it actionable.
//!
//! [`Error::Create`] and [`Error::Serialize`] carry a [`PathBuf`], since
//! they can only happen to a real file on disk. The rest carry a plain
//! `label`, because a [`super::CsvFile`] can wrap any
//! [`std::io::Write`] — an in-memory buffer in a test has no path, just
//! the name its caller gave it.

use std::path::PathBuf;

/// An error writing a file.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// Couldn't create the file, or one of its parent directories.
    #[error("couldn't create {path:?}")]
    Create {
        /// The file that couldn't be created.
        path: PathBuf,
        /// The underlying I/O error.
        #[source]
        source: std::io::Error,
    },

    /// Couldn't write to the file.
    #[error("couldn't write to {label}")]
    Write {
        /// The file that couldn't be written to.
        label: String,
        /// The underlying I/O error.
        #[source]
        source: std::io::Error,
    },

    /// Couldn't flush the file's buffer, so what was written since the
    /// last flush may not have reached the disk.
    #[error("couldn't flush {label}")]
    Flush {
        /// The file that couldn't be flushed.
        label: String,
        /// The underlying I/O error.
        #[source]
        source: std::io::Error,
    },

    /// A row didn't have as many fields as the file's header declares.
    ///
    /// Nothing was written: the row is rejected whole, instead of
    /// shifting every column of the file from that point on.
    #[error("{label}: row needs {expected} field(s), got {got}")]
    FieldCount {
        /// The file the row was meant for.
        label: String,
        /// How many fields the header declares.
        expected: usize,
        /// How many fields the row actually had.
        got: usize,
    },

    /// An earlier write to this file failed, so it is no longer written
    /// to at all.
    ///
    /// Returned instead of retrying, because a write that failed halfway
    /// already left the file inconsistent — and because a failing file
    /// written at telemetry rates would otherwise report the same error
    /// thousands of times per second.
    #[error("{label} was left in a failed state by an earlier write")]
    Poisoned {
        /// The file that failed earlier.
        label: String,
    },

    /// Couldn't read the file.
    #[error("couldn't read {path:?}")]
    Read {
        /// The file that couldn't be read.
        path: PathBuf,
        /// The underlying I/O error.
        #[source]
        source: std::io::Error,
    },

    /// Couldn't parse the file as JSON, or couldn't read one of its
    /// properties as the type it was asked for.
    #[error("couldn't parse {path:?} as JSON")]
    Parse {
        /// The file that failed to parse.
        path: PathBuf,
        /// The underlying `serde_json` error, which says where in the
        /// document the problem is.
        #[source]
        source: serde_json::Error,
    },

    /// The file is valid JSON, but its root isn't an object, so it has
    /// no properties to read or add to.
    #[error("{path:?} is valid JSON but its root is not an object")]
    NotAnObject {
        /// The file whose root isn't an object.
        path: PathBuf,
    },

    /// Couldn't put the finished file in place of the old one.
    ///
    /// A JSON document is built in a temporary file next to its
    /// destination and renamed over it, so this is the last step of
    /// [`super::write_json`] — and the only one that can fail with the
    /// new content already complete on disk, under the temporary name
    /// this error reports as its source path's sibling.
    #[error("couldn't put the finished file in place of {path:?}")]
    Replace {
        /// The destination that couldn't be replaced.
        path: PathBuf,
        /// The underlying I/O error.
        #[source]
        source: std::io::Error,
    },

    /// Couldn't serialize the value as JSON, or couldn't write the
    /// serialized bytes out.
    #[error("couldn't write {path:?} as JSON")]
    Serialize {
        /// The file being written.
        path: PathBuf,
        /// The underlying `serde_json` error — which wraps the I/O error
        /// too, when the failure was in writing rather than in
        /// serializing.
        #[source]
        source: serde_json::Error,
    },
}
