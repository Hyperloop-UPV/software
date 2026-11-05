//! Real sockets, on top of tokio (feature `net`).
//!
//! Two submodules do the actual I/O: [`crate::net::tcp`], a client that
//! keeps one task per board and recovers frames out of a byte stream,
//! and [`crate::net::udp`], a single shared receive-only socket. This module opens nothing. It defines only what
//! both of them need to agree on: [`crate::net::Event`] (what happened on
//! a link, carried by a [`crate::net::Notification`]) and
//! [`crate::net::Reporter`] (the two sinks they report through — one for
//! notifications, one for errors).
//!
//! Everything that reaches a [`crate::net::Reporter`] has already been
//! decoded by [`crate::protocol`], which this module layers on top of:
//! `protocol` turns bytes into packets and never touches a socket, `net`
//! owns the socket and calls into it. A sniffer or a simulator can use
//! `protocol` on its own, against a capture, without any of this.
//!
//! # Identity
//!
//! Everything that travels down the notification channel carries its
//! board: [`crate::net::Notification`] holds a
//! [`crate::model::BoardId`] next to the timestamp, whatever the event
//! is. No consumer ever has to go and look up whose packet it just got.
//!
//! It is never a second source of truth, though — it is resolved from
//! what the ADJ already says, once, here. A TCP task was spawned for one
//! board and knows it without asking; [`crate::net::udp`] resolves it
//! from the decoded packet's id through [`crate::protocol::Index`] (every
//! [`crate::model::PacketDef`] carries its `board`), which is one
//! `HashMap` lookup per datagram instead of one per consumer downstream.
//!
//! A board id is all the identity there is: one connection per board, and
//! one shared socket for UDP, so nothing needs telling apart beyond it.
//!
//! Addresses are for the operator, not for the domain types: they show
//! up interpolated in each submodule's error messages (`tcp::Error`,
//! `udp::Error`), which is where somebody actually reads them.

mod error;
mod report;

pub mod tcp;
pub mod udp;

pub use error::Error;
pub use report::{Closed, ErrorReport, Event, Notification, Reporter, Sinks};
