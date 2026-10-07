//! Connectivity, paths, cloning, and branch updates for ADJ repositories.

use std::{
    env, fs,
    io::{self, ErrorKind},
    net::{Ipv4Addr, SocketAddr, TcpStream},
    path::{Path, PathBuf},
    sync::atomic::AtomicBool,
    time::Duration,
};

mod checkout;
#[cfg(test)]
mod tests;

const ADJ_URL: &str = "https://github.com/Hyperloop-UPV/adj.git";

/// Opens or clones ADJ, selects a branch, and returns `(commit ID, full commit message)`.
///
/// `route` is an absolute parent directory of `adj`; `None` uses the user's cache.
/// With connectivity, only the requested branch is updated from `origin`.
/// Without it, a local branch or cached `origin/<branch>` is used without fetching.
/// This operation blocks. Updates to the same checkout must not run concurrently.
///
/// # Errors
///
/// Returns an error for a missing repository while offline, an unavailable branch,
/// local changes, invalid paths, or Git/filesystem failures. Online failures are not
/// retried offline. Callers must propagate fatal errors rather than use another branch.
/// A checkout failure can leave partially updated files.
#[tracing::instrument(skip(route), fields(path), err(level = "warn"))]
pub fn update_adj(route: Option<&Path>, branch: &str) -> io::Result<(String, String)> {
    update_adj_with_connection(route, branch, check_internet_connection)
}

/// Returns `(commit ID, full UTF-8 commit message)` from the tip of a local branch.
///
/// Does not fetch, switch branches, or modify the repository. The checkout may be dirty.
/// Only `refs/heads/<branch>` is consulted, with no fallback to cached remote references.
///
/// # Errors
///
/// Returns `InvalidInput` for an invalid branch name, `NotFound` for a missing local
/// branch, `InvalidData` for a non-UTF-8 message, or an error if Git objects cannot be read.
#[tracing::instrument(skip(repository), err(level = "warn"))]
pub fn branch_commit_info(
    repository: &gix::Repository,
    branch: &str,
) -> io::Result<(String, String)> {
    use gix::bstr::ByteSlice;

    let name = format!("refs/heads/{branch}");
    if branch.is_empty() || branch.starts_with('-') {
        return Err(io::Error::new(
            ErrorKind::InvalidInput,
            "invalid ADJ branch",
        ));
    }
    gix::validate::reference::branch_name(name.as_bytes().as_bstr())
        .map_err(|error| io::Error::new(ErrorKind::InvalidInput, error))?;

    // Use the exact local reference, not HEAD, a tag, or origin's cached branch.
    let mut reference = repository
        .try_find_reference(name.as_str())
        .map_err(io::Error::other)?
        .ok_or_else(|| {
            io::Error::new(
                ErrorKind::NotFound,
                format!("local ADJ branch '{branch}' does not exist"),
            )
        })?;
    let target = reference.peel_to_id().map_err(io::Error::other)?.detach();
    let commit = repository.find_commit(target).map_err(io::Error::other)?;
    // Preserve the subject, body, and trailing newlines without a lossy conversion.
    let message = commit
        .message_raw()
        .map_err(io::Error::other)?
        .to_str()
        .map_err(|error| io::Error::new(ErrorKind::InvalidData, error))?
        .to_owned();
    let id = commit.id.to_string();
    tracing::debug!(commit = %id, "local ADJ branch commit read");
    Ok((id, message))
}

// Runs the workflow with a supplied connectivity probe so tests do not access the Internet.
fn update_adj_with_connection(
    route: Option<&Path>,
    branch: &str,
    check_connection: impl FnOnce() -> bool,
) -> io::Result<(String, String)> {
    let (path, base) = resolve_adj_path(route)?;
    tracing::Span::current().record("path", tracing::field::display(path.display()));
    let exists = local_repository_exists(&path)?;
    // Probe once and use the same mode for cloning and branch selection.
    let online = check_connection();
    let repository = if exists {
        gix::open(&path).map_err(io::Error::other)?
    } else if online {
        // clone_adj expects the parent, and creates exactly base/adj.
        clone_adj(&base)?
    } else {
        return Err(io::Error::new(
            ErrorKind::NotFound,
            "ADJ repository is missing and no Internet connection is available",
        ));
    };
    checkout::switch_and_update_adj(&repository, branch, online)
}

// Checks external TCP connectivity with a three-second timeout, not GitHub availability.
#[tracing::instrument]
fn check_internet_connection() -> bool {
    // Use a fixed IPv4 address to avoid a separate DNS lookup and its timeout.
    let address = SocketAddr::from((Ipv4Addr::new(1, 1, 1, 1), 443));
    let timeout = Duration::from_secs(3);

    // Attempt only the TCP handshake; no application data is sent.
    match TcpStream::connect_timeout(&address, timeout) {
        Ok(_stream) => {
            tracing::debug!(%address, "connectivity probe succeeded");
            // The temporary stream closes automatically when this branch ends.
            true
        }
        Err(error) => {
            // Record why the probe failed without treating it as an application error.
            tracing::debug!(%address, %error, "connectivity probe failed");
            false
        }
    }
}

// Resolves the absolute ADJ path without checking or creating directories.
// Input -> Parent directory
#[tracing::instrument]
fn resolve_adj_path(route: Option<&Path>) -> io::Result<(PathBuf, PathBuf)> {
    let base = match route {
        // The supplied path is the parent directory, not the ADJ checkout itself.
        Some(route) => route.to_path_buf(),
        None => {
            // Preserve OS-native path values and treat empty variables as unset.
            env::var_os("XDG_CACHE_HOME")
                .filter(|value| !value.is_empty())
                .map(PathBuf::from)
                // Fall back to the user's .cache directory only when XDG_CACHE_HOME is unset.
                .or_else(|| {
                    env::var_os("HOME")
                        .filter(|value| !value.is_empty())
                        .map(|home| PathBuf::from(home).join(".cache"))
                })
                .ok_or_else(|| {
                    io::Error::new(
                        ErrorKind::NotFound,
                        "XDG_CACHE_HOME and HOME are unset or empty",
                    )
                })?
        }
    };

    // Reject relative paths so the result does not depend on the working directory.
    if !base.is_absolute() {
        return Err(io::Error::new(
            ErrorKind::InvalidInput,
            "ADJ parent directory must be absolute",
        ));
    }

    let path = base.join("adj");
    tracing::debug!(path = %path.display(), "ADJ path resolved");
    Ok((path, base))
}

// Checks for a Git repository at the supplied ADJ path without searching parent directories.
#[tracing::instrument]
fn local_repository_exists(path: &Path) -> io::Result<bool> {
    // Opening validates repository metadata, unlike checking for a directory named .git.
    match gix::open(path) {
        Ok(_) => {
            tracing::debug!("local ADJ repository exists");
            Ok(true)
        }
        // Missing paths and ordinary non-repository directories are expected results.
        Err(gix::open::Error::NotARepository { source, .. }) => {
            // Metadata failures other than absence must not trigger a clone attempt.
            if let gix::discover::is_git::Error::Metadata { source, .. } = source {
                if source.kind() != ErrorKind::NotFound {
                    tracing::debug!(%source, "could not inspect local ADJ path");
                    return Err(source);
                }
            }
            tracing::debug!("local ADJ repository does not exist");
            Ok(false)
        }
        // Preserve opening failures such as malformed configuration or unsafe ownership.
        Err(error) => {
            tracing::debug!(%error, "could not open local ADJ repository");
            Err(io::Error::other(error))
        }
    }
}

// Clones ADJ directly into base/adj, checking out the remote's default branch.
#[tracing::instrument(err(level = "warn"))]
fn clone_adj(base: &Path) -> io::Result<gix::Repository> {
    if !base.is_absolute() {
        return Err(io::Error::new(
            ErrorKind::InvalidInput,
            "ADJ parent directory must be absolute",
        ));
    }

    // gix uses this exact destination; it does not append another repository name.
    let destination = base.join("adj");
    match fs::symlink_metadata(&destination) {
        // Refuse all existing entries, including empty directories and dangling symlinks.
        Ok(_) => {
            return Err(io::Error::new(
                ErrorKind::AlreadyExists,
                "ADJ destination already exists",
            ));
        }
        Err(error) if error.kind() == ErrorKind::NotFound => {}
        Err(error) => return Err(error),
    }
    fs::create_dir_all(base)?;

    tracing::info!(path = %destination.display(), "cloning ADJ repository");
    // prepare_clone uses the destination to put the repo
    // unlike the cli action (git clone) which creates a new directory with everything in it.
    let mut clone = gix::prepare_clone(ADJ_URL, &destination)
        .map_err(io::Error::other)?
        .with_remote_name("origin")
        .map_err(io::Error::other)?;

    // gix requires an interruption flag; this helper does not request cancellation.
    let interrupt = AtomicBool::new(false);
    let (mut checkout, _) = clone
        .fetch_then_checkout(gix::progress::Discard, &interrupt)
        .map_err(io::Error::other)?;
    // Fetching objects alone is not enough; materialize the default branch's files and index.
    let (repository, outcome) = checkout
        .main_worktree(gix::progress::Discard, &interrupt)
        .map_err(io::Error::other)?;
    if !outcome.errors.is_empty()
        || !outcome.collisions.is_empty()
        || !outcome.delayed_paths_unknown.is_empty()
        || !outcome.delayed_paths_unprocessed.is_empty()
    {
        return Err(io::Error::other("ADJ checkout was incomplete"));
    }

    tracing::info!(path = %destination.display(), "ADJ repository cloned");
    Ok(repository)
}

/// Lists sorted branch names on `origin` without fetching objects or changing the checkout.
///
/// Returns an error if `origin` is missing or unreachable, or a branch name is not UTF-8.
#[tracing::instrument(skip(repository), err(level = "warn"))]
pub fn list_remote_branches(repository: &gix::Repository) -> io::Result<Vec<String>> {
    use gix::{
        bstr::ByteSlice,
        remote::{Direction, fetch::Tags},
    };

    let mut remote = repository.find_remote("origin").map_err(io::Error::other)?;
    // Ignore configured fetch filters and ask for every remote branch, excluding tags.
    remote
        .replace_refspecs(
            [b"refs/heads/*:refs/remotes/origin/*".as_bstr()],
            Direction::Fetch,
        )
        .map_err(io::Error::other)?;
    let remote = remote.with_fetch_tags(Tags::None);
    tracing::info!("listing remote ADJ branches");
    // ref_map only queries advertised refs; receive() would also download objects.
    let (map, _) = remote
        .connect(Direction::Fetch)
        .map_err(io::Error::other)?
        .ref_map(gix::progress::Discard, Default::default())
        .map_err(io::Error::other)?;
    let mut branches = map
        .remote_refs
        .iter()
        .filter_map(|reference| {
            let (name, id, _) = reference.unpack();
            name.as_bytes()
                .strip_prefix(b"refs/heads/")
                .filter(|_| id.is_some())
        })
        .map(|name| {
            // Return short UTF-8 branch names, rather than full refs or lossy conversions.
            std::str::from_utf8(name)
                .map(str::to_owned)
                .map_err(|error| io::Error::new(ErrorKind::InvalidData, error))
        })
        .collect::<io::Result<Vec<_>>>()?;
    branches.sort_unstable();
    branches.dedup();
    tracing::debug!(count = branches.len(), "remote ADJ branches listed");
    Ok(branches)
}
