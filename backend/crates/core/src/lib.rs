//! Componentes reutilizables de Hyperloop UPV.

pub mod hello_world;

/// NTP server
#[cfg(feature = "ntp")]
pub mod ntp;
/// Basic domain types: identifiers, values, measurements, protections,
/// packets and boards.
pub mod model;

/// Parses an ADJ (Architecture Description JSON) directory into
/// [`model::PodData`], plus backend-session metadata not modeled as
/// vehicle data. See [`adj::load_from_dir`].
pub mod adj;
