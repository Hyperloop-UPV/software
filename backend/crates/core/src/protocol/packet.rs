//! Encode/decode for one specific kind of packet, independent of which
//! transport carries it — that mapping lives in [`super::tcp`]/
//! [`super::udp`], which are thin wrappers around these. Each kind only
//! implements whichever direction it actually needs: a `Data` packet is
//! only ever received (over UDP), an `Order` only ever sent (over TCP),
//! so there's no `encode` for the former or `decode` for the latter.

pub mod data;
pub mod message;
pub mod order;
pub mod protection;
