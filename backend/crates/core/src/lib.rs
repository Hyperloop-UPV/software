//! Componentes reutilizables de Hyperloop UPV.

pub mod hello_world;

/// # Git module
/// Handles updates and changes within the ADJ.  
/// Checks the ADJ Github repository and
#[cfg(feature = "git")]
pub mod git;

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

/// Translates bytes into typed packets and back, using the shapes
/// [`adj`] declares as the schema. See [`protocol::wire`],
/// [`protocol::tcp`], [`protocol::udp`].
pub mod protocol;

/// Everything a recording needs on disk: writing CSV, text and JSON
/// files without knowing what is in them ([`logger::CsvFile`]), moving
/// those files around ([`logger::files`], feature `files`) and the
/// snapshot of the machine that produced them ([`logger::host`],
/// feature `host`). The policy — which files a recording has, what goes
/// in each row — belongs to whoever calls this.
#[cfg(feature = "logger")]
pub mod logger;
