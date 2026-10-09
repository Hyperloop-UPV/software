//! Translates bytes <-> typed packets ([`crate::model::Packet`] and
//! friends), using the shapes [`crate::adj`] already declared
//! (`PacketDef`, `Measurement`) as the schema. Never touches a real
//! socket — that's `core::net`'s job, which calls into this module's
//! functions and owns the actual `TcpStream`/`UdpSocket`.
//!
//! The TCP/UDP split lives in the *types* each submodule can produce:
//! [`crate::protocol::udp::decode_datagram`] can only ever return a
//! `DataPacket`, [`crate::protocol::tcp::decode_next`] only a
//! [`crate::protocol::tcp::TcpFrame`] (`Protection`/`Message`) — the
//! compiler enforces the separation the ADJ itself draws between what
//! travels over which transport, not runtime convention. `tcp`/`udp`
//! themselves are thin wrappers around [`crate::protocol::packet`], which
//! does the actual per-packet-kind work independent of transport.

mod error;
mod index;
pub mod packet;
pub mod tcp;
pub mod udp;
pub mod wire;

pub use error::{DecodeError, EncodeError};
pub use index::Index;
