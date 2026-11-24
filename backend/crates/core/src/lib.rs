//! Componentes reutilizables de Hyperloop UPV.

pub mod hello_world;

/// Basic domain types: identifiers, values, measurements, protections,
/// packets and boards.
pub mod model;
/// NTP server
#[cfg(feature = "ntp")]
pub mod ntp;

/// Parses an ADJ (Architecture Description JSON) directory into
/// [`model::PodData`], plus backend-session metadata not modeled as
/// vehicle data. See [`adj::load_from_dir`].
pub mod adj;

/// Translates bytes into typed packets and back, using the shapes
/// [`adj`] declares as the schema. See [`protocol::wire`],
/// [`protocol::tcp`], [`protocol::udp`].
pub mod protocol;

/// Owns the real tokio sockets and reports what arrives on them, calling
/// into [`protocol`] to decode. See [`net::tcp`], [`net::udp`].
#[cfg(feature = "net")]
pub mod net;
pub mod pipeline;
