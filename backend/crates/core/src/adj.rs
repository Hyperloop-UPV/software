//! Parses an ADJ (Architecture Description JSON) directory into
//! [`crate::model::PodData`], plus backend-session metadata not modeled as
//! vehicle data ([`crate::adj::AdjInfo`]).
//!
//! Loading (and if `git` feature is enabled also downloading) is not specific to `station`: a sniffer, a
//! simulator, or any other tool that reads an ADJ needs exactly the same
//! parsing. Scope for this iteration: no `sockets.json`, no
//! `period`/`period_type`/`socket` packet fields (matches
//! [`crate::model::PacketDef`]'s own omission), and no schema validation
//! (`adj::validate` is a separate, deliberately out-of-scope concern for
//! now) — this module only surfaces structural errors it cannot avoid,
//! e.g. a packet referencing a measurement alias that doesn't exist.

mod error;
mod info;
mod raw;

pub use error::{LoadError, MeasurementError, ProtectionError};
pub use info::{AdjInfo, ProtectionTypeInfo};
pub use raw::load_from_dir;

use crate::model::PodData;

/// The result of loading an ADJ: the vehicle's data (as [`crate::model`]
/// describes it) plus backend-session metadata. Built by
/// [`raw::load_from_dir`].
#[derive(Debug, Clone, PartialEq, Default)]
pub struct Adj {
    /// Every board and packet defined by the ADJ.
    pub pod_data: PodData,
    /// Backend-session metadata from `general_info.json`.
    pub info: AdjInfo,
}
