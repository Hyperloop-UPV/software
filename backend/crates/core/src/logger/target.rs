//! The handle discipline every file in this module shares: the label
//! that names it in its errors, the poisoning after a failed write, the
//! explicit flush, and the courtesy flush on drop.
//!
//! Private, and not a trait: [`super::CsvFile`] and [`super::TextFile`]
//! differ in what they put *in* a file (columns and quoting versus
//! lines), not in how they hold one. Keeping that part here is what
//! makes "flushing is explicit, and a failed write stops the file" one
//! behaviour rather than two copies of it that can drift.

use super::Error;
use std::fs::{self, File};
use std::io::{BufWriter, Write};
use std::path::Path;
use tracing::error;

/// An open destination, plus the name it answers to in errors.
#[derive(Debug)]
pub(super) struct Target<W: Write> {
    inner: W,         // The actual file or buffer being written to.
    label: String,    //
    poisoned: bool,   // Whether a write or flush failed, so all future writes fail too.
    closed: bool,     // Whether the caller has called `close()`, so `Drop` doesn't flush again.
    written: u64,     // Total bytes written to the destination so far.
    since_flush: u64, // Bytes written since the last successful flush, for the caller to decide when to flush.
}

impl<W: Write> Target<W> {
    /// Takes over an already-open destination, to be called `label` in
    /// any [`Error`] about it.
    pub(super) fn new(inner: W, label: String) -> Self {
        Self {
            inner,
            label,
            poisoned: false,
            closed: false,
            written: 0,
            since_flush: 0,
        }
    }

    /// What this destination is called in its errors.
    pub(super) fn label(&self) -> &str {
        &self.label
    }

    /// Borrows the destination itself.
    pub(super) fn get_ref(&self) -> &W {
        &self.inner
    }

    /// Whether an earlier write or flush failed.
    pub(super) fn is_poisoned(&self) -> bool {
        self.poisoned
    }

    /// Every byte handed to the destination so far.
    pub(super) fn bytes_written(&self) -> u64 {
        self.written
    }

    /// The bytes handed over since the last successful flush.
    pub(super) fn bytes_since_flush(&self) -> u64 {
        self.since_flush
    }

    /// The error to return instead of touching a poisoned destination.
    pub(super) fn poisoned_error(&self) -> Error {
        Error::Poisoned {
            label: self.label.clone(),
        }
    }

    /// Writes `bytes` in one call, poisoning the destination if it
    /// fails: a write that failed halfway already left the file
    /// inconsistent.
    pub(super) fn write_all(&mut self, bytes: &[u8]) -> Result<(), Error> {
        if self.poisoned {
            return Err(self.poisoned_error());
        }

        match self.inner.write_all(bytes) {
            Ok(()) => {
                let bytes = bytes.len() as u64;
                self.written += bytes;
                self.since_flush += bytes;
                Ok(())
            }
            Err(source) => {
                self.poisoned = true;
                Err(Error::Write {
                    label: self.label.clone(),
                    source,
                })
            }
        }
    }

    /// Flushes everything written so far.
    pub(super) fn flush(&mut self) -> Result<(), Error> {
        if self.poisoned {
            return Err(self.poisoned_error());
        }

        match self.inner.flush() {
            Ok(()) => {
                self.since_flush = 0;
                Ok(())
            }
            Err(source) => {
                self.poisoned = true;
                Err(Error::Flush {
                    label: self.label.clone(),
                    source,
                })
            }
        }
    }

    /// Flushes and marks the destination closed, so [`Drop`] neither
    /// flushes again nor traces an error the caller is already getting.
    pub(super) fn close(&mut self) -> Result<(), Error> {
        let result = self.flush();
        self.closed = true;
        result
    }
}

impl<W: Write> Drop for Target<W> {
    fn drop(&mut self) {
        if self.closed || self.poisoned {
            return;
        }

        // A courtesy flush, nothing more: `Drop` can't return the error
        // and the workspace lints rule out panicking, so all it can do
        // is leave a trace saying this file's tail may be missing.
        if let Err(source) = self.inner.flush() {
            error!(
                file = %self.label,
                error = %source,
                "file dropped without close() and its final flush failed"
            );
        }
    }
}

/// Creates (or truncates) the file at `path`, creating its parent
/// directories, and wraps it in a buffer.
///
/// The default [`BufWriter`] capacity is deliberate: a bigger buffer is
/// less I/O but more lost if the process dies before the next flush, and
/// how often to flush is a decision for whoever is writing.
pub(super) fn create_file(path: &Path) -> Result<BufWriter<File>, Error> {
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent).map_err(|source| Error::Create {
            path: path.to_path_buf(),
            source,
        })?;
    }

    let file = File::create(path).map_err(|source| Error::Create {
        path: path.to_path_buf(),
        source,
    })?;

    Ok(BufWriter::new(file))
}
