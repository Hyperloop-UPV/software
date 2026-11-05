//! Parses an ADJ (Architecture Description JSON) directory into
//! [`crate::model::PodData`], plus backend-session metadata not modeled as
//! vehicle data ([`crate::adj::AdjInfo`]).
//!
//! [`load_from_dir`] loads an existing ADJ directory. With the `git` feature
//! enabled, `auto_adj` updates the ADJ repository before loading its data
//! and returns the checked-out commit hash.
//!
//! Loading is not specific to `station`: a sniffer, a simulator, or any
//! other tool that reads an ADJ needs exactly the same parsing.
//!
//! Scope for this iteration: no `sockets.json`, no
//! `period`/`period_type`/`socket` packet fields (matches
//! [`crate::model::PacketDef`]'s own omission), and no schema validation
//! (`adj::validate` is a separate, deliberately out-of-scope concern for
//! now). This module only surfaces structural errors it cannot avoid,
//! e.g. a packet referencing a measurement alias that doesn't exist.

mod error;
mod info;
mod raw;

#[cfg(feature = "git")]
use std::path::PathBuf;
#[cfg(feature = "git")]
use tracing::{info, instrument};

pub use error::{LoadError, MeasurementError, ProtectionError};
pub use info::{AdjInfo, ProtectionTypeInfo};
pub use raw::load_from_dir;

#[cfg(feature = "git")]
use crate::git::{unwrap_repo_path, update_adj};
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

/// The result of [`auto_adj`]: the loaded ADJ data and the checked-out commit hash.
#[cfg(feature = "git")]
#[derive(Debug, Clone)]
pub struct AutoAdj {
    /// Vehicle data
    pub adj: Adj,
    /// Full commit hash of the repository checkout used to load the ADJ.
    pub hash: String,
}

/// Updates the ADJ repository and returns an [`AutoAdj`] containing the loaded
/// data and the full commit hash of the checkout used to load it.
///
/// `path` identifies the repository directory, not its parent. If omitted,
/// the platform's user cache directory is used.
///
/// Online, the repository is replaced and local edits and commits are discarded.
/// Offline, the current cached checkout is loaded without switching branches,
/// so it may differ from `branch`; `hash` is the full commit hash of its HEAD.
/// If no cached repository is available offline, or a Git operation fails,
/// returns [`LoadError::Git`] instead of an [`AutoAdj`], so no hash is returned.
/// Clone failures do not fall back to the cache.
///
/// This performs blocking network and filesystem operations. Call during startup,
/// before readers use ADJ, with only one updater at a time.
///
/// # Errors
///
/// Returns [`LoadError::Git`] if path resolution or the update fails.
/// Other variants report failures loading the checked-out ADJ data.
/// Loading failures do not restore the previous cache.
#[cfg(feature = "git")]
#[instrument(level = "debug")]
pub fn auto_adj(path: Option<PathBuf>, branch: &str) -> Result<AutoAdj, LoadError> {
    let repo_path = unwrap_repo_path(path)?;
    let hash = update_adj(Some(repo_path.clone()), branch)?;
    let adj = load_from_dir(&repo_path)?;

    info!(path = ?repo_path, %hash, "ADJ loaded");
    Ok(AutoAdj { adj, hash })
}
