//! Errors for recording setup, lifecycle transitions and the writer.
//!
//! Errors will preserve file context from `software_core::logger` and report
//! queue saturation, writer failure and invalid session transitions. Shutdown
//! must attempt to close all files even if closing one of them fails, and
//! return failures to the caller rather than report a successful stop.
