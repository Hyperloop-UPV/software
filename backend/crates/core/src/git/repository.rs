use super::{
    error::{GitError, RepositoryError},
    update::unwrap_repo_path,
};
use gix::Repository;
use std::path::PathBuf;
use tracing::{debug, instrument};

/// Opens an existing repository without fetching or changing its checkout.
///
/// `path` is the repository directory. If omitted, it defaults to
/// `<cache directory>/hyperloop-control-station/adj`. This does not create ADJ.
///
/// # Errors
///
/// Returns [`GitError::Path`] if the cache directory cannot be resolved, or
/// [`GitError::Repository`] if the repository is missing, invalid, or inaccessible.
#[instrument(level = "debug", err(level = "warn"))]
pub fn open_repo(path: Option<PathBuf>) -> Result<Repository, GitError> {
    let path = unwrap_repo_path(path)?;

    let repo = gix::open(path).map_err(RepositoryError::from)?;

    debug!(git_dir = ?repo.path(), "opened repository");
    Ok(repo)
}

/// Lists the branch names advertised by the repository's default fetch remote.
///
/// `repo` supplies the configuration used to select the default fetch remote.
/// Returns sorted short names such as `main` or `feature/example`, excluding tags
/// and `HEAD`. Queries the remote without downloading objects or updating local
/// references. Configured fetch refspecs do not limit the advertised branches.
/// This is a blocking operation and requires access to the remote.
///
/// # Errors
///
/// Returns [`GitError::Repository`] if no default remote can be determined, or
/// remote configuration, connection, or reference discovery fails. Does not fall
/// back to cached branches on failure.
#[instrument(level = "debug", skip(repo), err(level = "warn"))]
pub fn list_remote_branches(repo: &Repository) -> Result<Vec<String>, GitError> {
    let remote = repo
        .find_default_remote(gix::remote::Direction::Fetch)
        .ok_or(RepositoryError::NoDefaultRemote)?
        .map_err(RepositoryError::from)?;

    debug!(
        git_dir = ?repo.path(),
        "querying branches advertised by the default fetch remote"
    );
    let conexion = remote
        .connect(gix::remote::Direction::Fetch)
        .map_err(RepositoryError::from)?;
    let (mapa, _handshake) = conexion
        .ref_map(
            gix::progress::Discard,
            gix::remote::ref_map::Options {
                // Protocol v2 must not restrict ls-refs to a single-branch refspec.
                prefix_from_spec_as_filter_on_remote: false,
                ..Default::default()
            },
        )
        .map_err(RepositoryError::from)?;

    let mut ramas: Vec<String> = mapa
        .remote_refs
        .iter()
        .filter_map(|r| {
            let (nombre, _, _) = r.unpack();
            nombre
                .to_string()
                .strip_prefix("refs/heads/")
                .map(str::to_string)
        })
        .collect();

    ramas.sort();
    debug!(
        git_dir = ?repo.path(),
        count = ramas.len(),
        "listed advertised remote branches"
    );
    Ok(ramas)
}

/// Checks whether the default fetch remote advertises the requested branch.
///
/// `repo` selects the remote and `name` is its exact short branch name, such as
/// `main` or `feature/example`, without an `origin/` prefix. Calls
/// [`list_remote_branches`] and returns `true` if the name is in the result.
/// `false` means the query succeeded but the remote did not advertise that name.
/// This is a blocking remote query, not a check of cached references.
///
/// # Errors
///
/// Propagates the original [`GitError`] from [`list_remote_branches`]. A missing
/// remote or failed connection is an error, never `Ok(false)`.
// The delegated listing logs failures; do not emit the same warning twice.
#[instrument(level = "debug", skip(repo))]
pub fn branch_exists(repo: &Repository, name: &str) -> Result<bool, GitError> {
    let branches = list_remote_branches(repo)?;
    let exists = branches.iter().any(|branch| branch == name);
    debug!(name, exists, "checked advertised remote branch");
    Ok(exists)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{fs, io, path::Path, process::Command};

    type TestResult<T = ()> = Result<T, Box<dyn std::error::Error + Send + Sync>>;

    fn git(path: &Path, args: &[&str]) -> TestResult {
        // Provide fixture identity and disable user signing, hooks, and templates.
        let output = Command::new("git")
            .current_dir(path)
            .args([
                "-c",
                "user.name=ADJ tests",
                "-c",
                "user.email=adj@example.test",
                "-c",
                "commit.gpgSign=false",
                "-c",
                "tag.gpgSign=false",
                "-c",
                "core.hooksPath=",
                "-c",
                "init.templateDir=",
            ])
            .args(args)
            .output()?;
        if !output.status.success() {
            return Err(io::Error::other(String::from_utf8_lossy(&output.stderr)).into());
        }
        Ok(())
    }

    fn local_remote() -> TestResult<(tempfile::TempDir, Repository)> {
        let temp = tempfile::tempdir()?;
        let remote = temp.path().join("remote");
        let client = temp.path().join("client");
        fs::create_dir(&remote)?;
        fs::create_dir(&client)?;
        git(&remote, &["init", "--initial-branch=main"])?;
        fs::write(remote.join("data.txt"), "ADJ fixture")?;
        git(&remote, &["add", "."])?;
        git(&remote, &["commit", "-m", "fixture data"])?;
        git(&remote, &["branch", "software"])?;
        git(&remote, &["branch", "feature/example"])?;
        git(&remote, &["tag", "v1"])?;

        // No clone or fetch: only main is tracked, and no remote refs are cached.
        git(&client, &["init", "--initial-branch=main"])?;
        git(
            &client,
            &[
                "remote",
                "add",
                "-t",
                "main",
                "origin",
                remote.to_str().ok_or("non-UTF-8 test path")?,
            ],
        )?;
        // Exercise ls-refs prefix filtering rather than protocol v1's full advertisement.
        git(&client, &["config", "protocol.version", "2"])?;
        let repo = gix::open(&client)?;
        Ok((temp, repo))
    }

    // List all advertised branches despite a main-only refspec, without fetching.
    #[test]
    fn lists_all_remote_branches_without_fetching() -> TestResult {
        let (temp, repo) = local_remote()?;
        assert_eq!(
            list_remote_branches(&repo)?,
            ["feature/example", "main", "software"]
        );
        for name in ["feature/example", "main", "software"] {
            let reference = format!("refs/remotes/origin/{name}");
            assert!(repo.try_find_reference(reference.as_str())?.is_none());
        }
        let remote_commit = gix::open(temp.path().join("remote"))?.head_id()?.detach();
        assert!(repo.find_object(remote_commit).is_err());
        Ok(())
    }

    // Remote existence must not depend on having the branch cached locally.
    #[test]
    fn finds_uncached_remote_branch() -> TestResult {
        let (_temp, repo) = local_remote()?;
        assert!(
            repo.try_find_reference("refs/remotes/origin/feature/example")?
                .is_none()
        );
        assert!(branch_exists(&repo, "feature/example")?);
        Ok(())
    }

    // Only exact short names match after a successful remote query.
    #[test]
    fn rejects_missing_and_remote_prefixed_branch_names() -> TestResult {
        let (_temp, repo) = local_remote()?;
        assert!(!branch_exists(&repo, "missing-branch")?);
        assert!(!branch_exists(&repo, "origin/main")?);
        Ok(())
    }

    // Missing remote configuration is an explicit error for both helpers.
    #[test]
    fn propagates_missing_default_remote() -> TestResult {
        let temp = tempfile::tempdir()?;
        let repo = gix::init(temp.path())?;
        for result in [
            list_remote_branches(&repo).map(|_| ()),
            branch_exists(&repo, "main").map(|_| ()),
        ] {
            assert!(matches!(result, Err(GitError::Repository(error))
                if matches!(*error, RepositoryError::NoDefaultRemote)));
        }
        Ok(())
    }

    // An unreachable source must remain an error, not false or an empty listing.
    #[test]
    fn propagates_inaccessible_remote() -> TestResult {
        let (temp, _) = local_remote()?;
        let client = temp.path().join("client");
        let missing = temp.path().join("missing-remote");
        git(
            &client,
            &[
                "remote",
                "set-url",
                "origin",
                missing.to_str().ok_or("non-UTF-8 test path")?,
            ],
        )?;
        // Reopen to pick up the changed remote URL instead of the old config snapshot.
        let repo = gix::open(&client)?;
        for result in [
            list_remote_branches(&repo).map(|_| ()),
            branch_exists(&repo, "main").map(|_| ()),
        ] {
            assert!(matches!(result, Err(GitError::Repository(error))
                if matches!(*error,
                    RepositoryError::RemoteConnect(_) | RepositoryError::RemoteRefMap(_))));
        }
        Ok(())
    }
}
