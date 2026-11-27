//! Backend recording policy, built on `software_core::logger`.
//!
//! This is the module scaffold; recording and frontend integration are not
//! implemented yet. The file writers stay in `software_core::logger`; this
//! module will decide what to record, where it belongs and when to flush it.
//!
//! Planned lifecycle:
//! - At backend startup, create a `YYYY-MM-DDTHH-MM-SS` directory and its
//!   `others/` directory for the ADJ validator output, settings and JSONL trace.
//! - `play` prepares a new recording session and enables event admission.
//! - `stop` stops admission, drains accepted events and closes session files.
//! - `emergency_stop` performs the same drain during backend shutdown, then
//!   finishes the writer and flushes the backend trace.
//!
//! Session state, event admission and stop ordering must be coordinated so
//! that an accepted event cannot leak into a later session. The frontend
//! receives success only after the requested transition has completed.

mod data;
mod error;
mod event;
mod messages;
mod order;
mod protections;
mod session;
mod settings;
mod writer;
