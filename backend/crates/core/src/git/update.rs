use super::{GitError, RepositoryError, clone::git_replace};
use gix::Repository;
use std::{
    io,
    net::{Ipv4Addr, SocketAddr, TcpStream},
    path::PathBuf,
    time::Duration,
};
use tracing::{debug, info, instrument, warn};

const ADJ_URL: &str = "https://github.com/Hyperloop-UPV/adj.git";

/// Downloads the requested ADJ branch, replacing the application-managed cache.
///
/// `path` is the repository directory, not its parent. If omitted, it defaults to
/// `<cache directory>/hyperloop-control-station/adj`. `branch` selects the branch
/// to clone when the connectivity probe succeeds.
///
/// Online, local edits and commits are discarded only after a fresh checkout
/// succeeds. Offline, the current cached checkout is used without switching
/// branches, so it may differ from `branch`. Returns its full commit hash.
///
/// This performs blocking network and filesystem operations. Call during startup,
/// before readers use ADJ, with only one updater at a time. Replacement uses two
/// renames and is not atomic across a process crash.
///
/// # Errors
///
/// Returns [`GitError::UnavailableOffline`] if ADJ is missing offline. Other
/// variants identify path, repository, cloning, checkout, or replacement failures.
/// Clone errors do not automatically fall back to the cache. If restoration fails,
/// [`GitError::Replacement`] preserves both errors and the backup's location.
// Log returned errors at the public boundary; helpers trace progress without duplicate warnings.
#[instrument(level = "debug", err(level = "warn"))]
pub fn update_adj(path: Option<PathBuf>, branch: &str) -> Result<String, GitError> {
    let (repo, dir) = adj_exists_repo(path)?;

    if check_internet_connection() {
        info!(path = ?dir, branch, "starting ADJ update");
        // Release repository handles before moving the existing cache directory.
        drop(repo);
        git_replace(&dir, branch, ADJ_URL)
    } else if let Some(repo) = repo {
        warn!(path = ?dir, requested_branch = branch,
            "connectivity probe failed; using cached ADJ without switching branches");
        get_commit_hash(&repo)
    } else {
        Err(GitError::UnavailableOffline)
    }
}

// Checks external TCP connectivity with a three-second timeout, not GitHub availability.
#[instrument(level = "info")]
fn check_internet_connection() -> bool {
    // Use a fixed IPv4 address to avoid a separate DNS lookup and its timeout.
    let address = SocketAddr::from((Ipv4Addr::new(1, 1, 1, 1), 443));
    let timeout = Duration::from_secs(3);

    // Attempt only the TCP handshake; no application data is sent.
    match TcpStream::connect_timeout(&address, timeout) {
        Ok(_stream) => {
            info!(%address, "connectivity probe succeeded");
            true
        }
        Err(error) => {
            // Record why the probe failed without treating it as an application error.
            info!(%address, %error, "connectivity probe failed");
            false
        }
    }
}

// Preserve explicit paths; otherwise use the platform's user cache directory.
pub(crate) fn unwrap_repo_path(path: Option<PathBuf>) -> Result<PathBuf, GitError> {
    let dir = match path {
        Some(path) => path,
        None => {
            let path = dirs::cache_dir().ok_or_else(|| {
                GitError::Path(io::Error::new(
                    io::ErrorKind::NotFound,
                    "cache directory not found",
                ))
            })?;

            path.join("hyperloop-control-station").join("adj")
        }
    };

    debug!(path = ?dir, "resolved ADJ repository path");
    Ok(dir)
}

// Only an absent directory is a cache miss; invalid repositories remain errors.
pub(crate) fn adj_exists_repo(
    path: Option<PathBuf>,
) -> Result<(Option<Repository>, PathBuf), GitError> {
    let dir = unwrap_repo_path(path)?;

    let res = if dir.try_exists().map_err(GitError::Path)? {
        Some(gix::open(&dir).map_err(RepositoryError::from)?)
    } else {
        None
    };

    debug!(path = ?dir, exists = res.is_some(), "checked local ADJ repository");
    Ok((res, dir))
}

// Report the checked-out HEAD, which can differ from the requested branch offline.
pub(crate) fn get_commit_hash(repo: &Repository) -> Result<String, GitError> {
    let hash = repo.head_id().map_err(RepositoryError::from)?.to_string();

    // Log only the commit ID, not potentially large or sensitive message text.
    debug!(commit = %hash, "read checked-out ADJ commit");
    Ok(hash)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    // Distinguish missing, invalid, and valid local repositories.
    #[test]
    fn detects_missing_and_invalid_repositories() -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("adj");
        assert!(adj_exists_repo(Some(path.clone()))?.0.is_none());
        fs::create_dir(&path)?;
        assert!(adj_exists_repo(Some(path.clone())).is_err());
        gix::init(&path)?;
        assert!(adj_exists_repo(Some(path))?.0.is_some());
        Ok(())
    }
}
