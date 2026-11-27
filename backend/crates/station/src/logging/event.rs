//! Typed recording events for measurements, orders, protections and messages.
//!
//! Events will carry their recording session identity and the elapsed time
//! captured at reception or order execution, before entering the writer queue.
//! Queue latency must not become part of the recorded `instant`.
//!
//! Order events also capture wall-clock time for the timestamp column. Event
//! types and the concrete producer API remain to be implemented.
