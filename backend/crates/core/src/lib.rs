//! Componentes reutilizables de Hyperloop UPV.

pub mod hello_world;

/// Basic domain types: identifiers, values, measurements, protections,
/// packets and boards.
pub mod model;

/// Parses an ADJ (Architecture Description JSON) directory into
/// [`model::PodData`], plus backend-session metadata not modeled as
/// vehicle data. See [`adj::load_from_dir`].
pub mod adj;

/// Translates bytes into typed packets and back, using the shapes
/// [`adj`] declares as the schema. See [`protocol::wire`],
/// [`protocol::tcp`], [`protocol::udp`].
pub mod protocol;
