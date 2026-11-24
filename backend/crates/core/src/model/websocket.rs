//! JSON payloads for frontend WebSocket topics (feature `websocket`).
//!
//! Existing topics preserve the Go backend's JSON shapes; `protection/update`
//! adds a compact event. Socket handling, subscriptions and publication belong
//! to `station`. See `websocket/README.md`.

mod connection;
mod data;
mod message;
mod order;
mod protection;

pub use connection::{Connection, ConnectionUpdate};
pub use data::{DataPacketUpdate, DataUpdate, MeasurementUpdate};
pub use message::{MessageKind, MessagePayload, MessageTimestamp, MessageUpdate};
pub use order::{OrderField, OrderSend, StateOrdersUpdate};
pub use protection::{ProtectionPayload, ProtectionUpdate};

/// Payload of `logger/enable`: the requested recording state.
pub type LoggerEnable = bool;

/// Payload of `logger/response`: the actual recording state.
pub type LoggerResponse = bool;

/// Payload of `logger/variables`: selected measurement names.
pub type LoggerVariables = Vec<String>;
