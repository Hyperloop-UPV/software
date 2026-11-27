//! Message recording in the session's single `messages/messages.csv` file.
//!
//! Columns, in order: `instant,from,to,board,source,severity`.
//! `board` identifies the board that emitted the message; `source` combines
//! file and line in one field when applicable to the message type.
//!
//! This component will own a `software_core::logger::CsvFile` and format rows.
//! Header policy and the exact representation of `source` remain to be defined.
