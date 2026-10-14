/// Errors produced while reading, downloading, or replacing the ADJ cache.
///
/// Five categories identify the failed operation and preserve its underlying
/// error as [`std::error::Error::source`]. [`RepositoryError`] and [`CloneError`]
/// retain concrete `gix` causes and are boxed to keep this enum small.
///
/// A failed connectivity probe is not itself an error when cached ADJ exists.
/// If no cache exists, the operation returns [`GitError::UnavailableOffline`].
#[derive(Debug, thiserror::Error)]
pub enum GitError {
    /// Resolving, inspecting, or preparing the cache directory failed.
    #[error("ADJ path operation failed: {0}")]
    Path(#[source] std::io::Error),

    /// Opening the repository, reading HEAD, or querying local or remote refs failed.
    /// A branch missing from a successful remote listing is not an error.
    #[error("ADJ repository operation failed: {0}")]
    Repository(#[source] Box<RepositoryError>),

    /// Preparing, downloading, or checking out the requested branch failed.
    ///
    /// This can indicate a network, configuration, or remote-reference failure;
    /// it does not necessarily mean that internet connectivity is unavailable.
    #[error("ADJ clone failed: {0}")]
    Clone(#[source] Box<CloneError>),

    /// Moving the old cache aside or installing the new checkout failed.
    ///
    /// When restoration also fails, `rollback` holds its error and the preserved
    /// backup's location. Otherwise, the old cache was restored or never moved.
    #[error(
        "ADJ cache replacement failed: {source}{recovery}",
        recovery = .rollback.as_ref().map(|(error, path)| {
            format!("; rollback failed: {error}; backup kept at {}", path.display())
        }).unwrap_or_default()
    )]
    Replacement {
        /// The original error moving the old cache or installing the new checkout.
        #[source]
        source: std::io::Error,
        /// Restoration error and preserved backup path, if rollback failed.
        rollback: Option<(std::io::Error, std::path::PathBuf)>,
    },

    /// The connectivity probe failed and no local ADJ cache was available.
    #[error("ADJ is not available locally and cannot be downloaded")]
    UnavailableOffline,
}

// Convert repository errors for '?' propagation, boxing the concrete error to keep GitError small.
impl From<RepositoryError> for GitError {
    fn from(error: RepositoryError) -> Self {
        Self::Repository(Box::new(error))
    }
}

// Convert clone errors for '?' propagation, boxing the concrete error to keep GitError small.
impl From<CloneError> for GitError {
    fn from(error: CloneError) -> Self {
        Self::Clone(Box::new(error))
    }
}

/// Concrete clone failures wrapped by [`GitError::Clone`].
///
/// Preparation, name validation, fetching, and checkout expose different `gix`
/// error types. These variants retain each original error as their source.
#[derive(Debug, thiserror::Error)]
pub enum CloneError {
    /// Clone preparation failed before downloading repository data.
    #[error("clone preparation failed: {0}")]
    Prepare(#[from] gix::clone::Error),

    /// The configured remote name was invalid.
    #[error("remote name is invalid: {0}")]
    RemoteName(#[from] gix::remote::name::Error),

    /// The requested branch name was not a valid Git reference name.
    #[error("branch name is invalid: {0}")]
    BranchName(#[from] gix::validate::reference::name::Error),

    /// Fetching failed, including a missing requested branch.
    /// This can indicate network, configuration, or remote-reference failures.
    #[error("fetch failed: {0}")]
    Fetch(#[from] gix::clone::fetch::Error),

    /// Downloaded data could not be checked out into the working tree.
    #[error("checkout failed: {0}")]
    Checkout(#[from] gix::clone::checkout::main_worktree::Error),
}

/// Concrete repository failures wrapped by [`GitError::Repository`].
///
/// Variants identify local reads or remote-reference queries and preserve the
/// original `gix` error as their source.
#[derive(Debug, thiserror::Error)]
pub enum RepositoryError {
    /// An existing repository could not be opened or validated.
    #[error("repository could not be opened: {0}")]
    Open(#[from] gix::open::Error),

    /// HEAD could not be resolved to a commit ID, including an unborn HEAD.
    #[error("HEAD could not be resolved: {0}")]
    Head(#[from] gix::reference::head_id::Error),

    /// No default fetch remote could be determined, including ambiguous configurations.
    #[error("no default fetch remote could be determined")]
    NoDefaultRemote,

    /// The selected default remote could not be loaded from repository configuration.
    #[error("default fetch remote could not be loaded: {0}")]
    FindDefaultRemote(#[from] gix::remote::find::existing::Error),

    /// A transport connection to the selected remote could not be prepared.
    #[error("remote connection failed: {0}")]
    RemoteConnect(#[from] gix::remote::connect::Error),

    /// The remote handshake or query of advertised references failed.
    #[error("remote reference query failed: {0}")]
    RemoteRefMap(#[from] gix::remote::ref_map::Error),
}
