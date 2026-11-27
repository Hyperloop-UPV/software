//! Recording session paths, identity, clock and lifecycle state.
//!
//! Every successful `play` starts a separate session directory named
//! `YYYY-MM-DDTHH-MM-SS` below the backend startup directory. Each session has
//! `logger-settings.json` and `data/`, `protections/`, `order/`, `messages/`.
//!
//! A monotonic `std::time::Instant` will establish the session's zero point.
//! Recorded elapsed times use the configured time unit; the first event need
//! not occur at zero. Wall-clock time is used separately for directory names
//! and order timestamps. Directory creation must never overwrite an earlier
//! session when two starts fall in the same second.
//!
//! Planned states: inactive, starting, recording and stopping. A normal stop
//! preserves the backend-wide `others/` files for subsequent sessions.
