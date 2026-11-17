//! Errors produced by the operations in [`crate::logger::files`].
//!
//! Every variant names the file it happened on, and the two that work on
//! a pair of paths name **both**: "couldn't copy" without saying where to
//! leaves the caller with nothing to act on, and the destination is the
//! half that is usually wrong.

use std::path::PathBuf;

/// An error working with a file.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// Couldn't copy the file.
    #[error("couldn't copy {from:?} to {to:?}")]
    Copy {
        /// The file being copied.
        from: PathBuf,
        /// Where it was being copied to.
        to: PathBuf,
        /// The underlying I/O error.
        #[source]
        source: std::io::Error,
    },

    /// Couldn't move the file.
    #[error("couldn't move {from:?} to {to:?}")]
    Move {
        /// The file being moved.
        from: PathBuf,
        /// Where it was being moved to.
        to: PathBuf,
        /// The underlying I/O error.
        #[source]
        source: std::io::Error,
    },

    /// Couldn't create a directory.
    #[error("couldn't create the directory {path:?}")]
    CreateDir {
        /// The directory that couldn't be created.
        path: PathBuf,
        /// The underlying I/O error.
        #[source]
        source: std::io::Error,
    },

    /// Couldn't read the file, the directory, or their metadata.
    #[error("couldn't read {path:?}")]
    Read {
        /// The file or directory that couldn't be read.
        path: PathBuf,
        /// The underlying I/O error.
        #[source]
        source: std::io::Error,
    },

    /// Couldn't remove the file.
    #[error("couldn't remove {path:?}")]
    Remove {
        /// The file that couldn't be removed.
        path: PathBuf,
        /// The underlying I/O error.
        #[source]
        source: std::io::Error,
    },
}
