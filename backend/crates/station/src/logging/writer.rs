//! Dedicated synchronous writer and its bounded event queue.
//!
//! One writer thread will own the session's four recording components and
//! perform their blocking `software_core::logger` operations away from the
//! async network tasks. Keep files open for the session and reuse their
//! existing buffers; flush periodically and according to bytes_since_flush.
//!
//! Admission and control commands must establish a session boundary: stop
//! rejects new events for that session, drains every accepted event, attempts
//! to close every session file and acknowledges completion. Queue saturation
//! must be reported explicitly rather than silently dropping events.
//!
//! Backend trace output has a separate lifetime from recording sessions. It
//! remains active between sessions and is flushed at the end of shutdown.
