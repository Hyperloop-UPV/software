//! Blocking Git helpers for ADJ, an application-owned, replaceable data cache.

mod clone;
mod error;
mod repository;
mod update;

pub use error::{CloneError, GitError, RepositoryError};
pub use repository::{branch_exists, list_remote_branches, open_repo};
pub(crate) use update::unwrap_repo_path;
pub use update::update_adj;
