//! Plain, synchronous file writing: the one place that knows how to put
//! a CSV row, a line of text or a JSON document on disk without
//! corrupting it.
//!
//! Deliberately boring, and deliberately small. It knows nothing about
//! the vehicle — no [`crate::model`] types, no ADJ, no boards, no
//! recording session, no notion of a timestamp or of a log level.
//! Deciding *what* to write, *when*, and under which name is the job of
//! the backend's own `station::logging`, which will own the four
//! subloggers (data, protections, messages and orders), the session
//! directory and the hot enable/disable. This module only answers "how
//! do I write this file".
//!
//! What it buys over calling [`std::fs`] from each of those subloggers:
//!
//! - **Flushing is explicit.** [`crate::logger::CsvFile::close`] and [`crate::logger::CsvFile::flush`]
//!   return a `Result`. A fatal error in the backend ends in
//!   `std::process::exit`, which runs no destructor, so a file that only
//!   flushes when it is dropped loses its tail exactly in the case the
//!   log was there to explain. [`Drop`] is kept as a courtesy flush that
//!   traces its own failure, never as the plan. *When* to flush stays
//!   the caller's decision, but it doesn't have to keep its own tally to
//!   make it: every file reports its `bytes_since_flush`, so "flush
//!   every so many kilobytes, or every so often" is a couple of lines
//!   over a map of open files.
//! - **Errors name the file.** A bare [`std::io::Error`] says what went
//!   wrong but not where; every [`crate::logger::Error`] here carries the path or the
//!   label of the file it happened on.
//! - **A row can't silently go out of step.** A [`crate::logger::CsvFile`] knows its
//!   header, so a row with one field too few is an error, not a file
//!   whose columns are shifted from that line on.
//! - **Quoting is done once, here.** A board's free-text message and the
//!   path it came from can both contain commas, quotes and newlines.
//!   [`crate::logger::Row::text`] quotes per RFC 4180; four subloggers formatting their
//!   own lines would each get a chance to get that wrong.
//! - **A row allocates nothing.** Fields are formatted into a buffer the
//!   file reuses, not into a `Vec<String>` built and thrown away per
//!   row — at telemetry rates that is tens of thousands of rows a
//!   second.
//!
//! The three formats are *not* one abstraction, and that is deliberate.
//! What they share is how a file is **held** — the label it answers to
//! in its errors, the poisoning after a failed write, the explicit
//! flush, the courtesy flush on drop — and that lives in one private
//! place (`target`), so it is one behaviour instead of three copies of
//! it that drift apart. What they don't share is how a file is
//! **written**, because it genuinely isn't the same operation: a CSV row
//! is typed fields validated against a header, a text line is a string
//! taken verbatim, and a JSON document is a whole value serialized in
//! one go with no handle to keep. [`crate::logger::CsvFile`] and
//! [`crate::logger::TextFile`] therefore expose the same vocabulary —
//! `create`, `new`, `flush`, `close`, `get_ref`, `is_poisoned` — while
//! [`crate::logger::write_json`] stays a free function, since a file
//! written once and closed has no handle to give back.
//!
//! There is no public trait over the three. A trait would only pay for
//! itself once some caller needs to be generic over the format — the
//! same code path writing either CSV or JSON lines, say — and no caller
//! does today; reaching for one now would mean either flattening the
//! API down to "write these bytes", which throws away the field
//! validation and the quoting that are the point, or inventing an
//! open/write/close lifecycle for JSON that it doesn't have. Adding the
//! trait later is backwards compatible, so it can wait for the second
//! caller.
//!
//! Reading is in for JSON only ([`crate::logger::read_json`],
//! [`crate::logger::JsonDocument`]), and for one reason: a document that
//! gains properties over time can't be added to without being read
//! first. A CSV or a text log is appended to and never revisited, and
//! nothing here will read one back.
//!
//! Not here, on purpose: reading a CSV or a text log back, sessions, timestamps, file
//! rotation, copying files around, keeping a registry of many open files
//! (a `HashMap<K, CsvFile>` with `entry().or_insert_with(...)` in the
//! caller is shorter and clearer than anything this module could wrap it
//! in), and anything asynchronous. These functions block; a caller
//! inside a `tokio` task is the one that decides whether to run them on
//! a thread of their own.

mod csv;
mod error;
mod json;
mod target;
mod text;

pub use csv::{CsvFile, Row};
pub use error::Error;
pub use json::{JsonDocument, read_json, write_json};
pub use text::TextFile;
