//! JSON payloads for station's frontend topics.
//!
//! Each model describes the `payload` inside a `{topic, payload}` message.
//! Serde adapters define the frontend JSON representation for shared domain types.
//! See `websocket/payload/README.md` for the wire shapes and examples.

mod connection;
mod data;
mod message;
mod order;
mod protection;
mod serialize;

pub use connection::{Connection, ConnectionUpdate};
pub use data::{DataPacketUpdate, DataUpdate};
pub use message::{MessageUpdate};
pub use order::{OrderField, OrderSend, StateOrdersUpdate};
pub use protection::{ProtectionPayload, ProtectionUpdate};

/// Payload of `logger/enable`: the requested recording state.
pub type LoggerEnable = bool;

/// Payload of `logger/response`: the actual recording state.
pub type LoggerResponse = bool;

/// Payload of `logger/variables`: selected measurement names.
pub type LoggerVariables = Vec<String>;
