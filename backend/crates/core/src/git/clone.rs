use super::{
    error::{CloneError, GitError},
    update::get_commit_hash,
};
use gix::Repository;
use std::{fs, path::Path, sync::atomic::AtomicBool};
use tracing::{debug, info, instrument, warn};

const GIT_REMOTE: &str = "origin";

// Fetch and check out the requested branch instead of switching an existing repo.
#[instrument(level = "debug", skip(url))]
fn git_clone(path: &Path, branch: &str, url: &str) -> Result<Repository, GitError> {
    // These synchronous startup operations do not currently expose cancellation.
    let interrupt = AtomicBool::new(false);

    debug!(?path, branch, "preparing shallow ADJ clone");
    // A depth of one keeps the current snapshot without downloading full history.
    let mut prepare = gix::prepare_clone(url, path)
        .map_err(CloneError::from)?
        .with_remote_name(GIT_REMOTE)
        .map_err(CloneError::from)?
        .with_ref_name(Some(branch))
        .map_err(CloneError::from)?
        .with_shallow(gix::remote::fetch::Shallow::DepthAtRemote(
            std::num::NonZeroU32::MIN,
        ));

    let (mut checkout, _) = prepare
        .fetch_then_checkout(gix::progress::Discard, &interrupt)
        .map_err(CloneError::from)?;
    debug!(
        ?path,
        branch, "ADJ fetch completed; checking out working tree"
    );
    let (repo, _) = checkout
        .main_worktree(gix::progress::Discard, &interrupt)
        .map_err(CloneError::from)?;

    debug!(?path, branch, "ADJ clone and checkout completed");
    Ok(repo)
}

// Stage beside ADJ so both installation and rollback use same-filesystem renames.
#[instrument(level = "debug", skip(url))]
pub(crate) fn git_replace(path: &Path, branch: &str, url: &str) -> Result<String, GitError> {
    // A relative path like "adj" has an empty parent; stage in the current directory.
    let parent = path
        .parent()
        .filter(|p| !p.as_os_str().is_empty())
        .unwrap_or(Path::new("."));
    fs::create_dir_all(parent).map_err(GitError::Path)?;
    let staging = tempfile::Builder::new()
        .prefix(".adj-")
        .tempdir_in(parent)
        .map_err(GitError::Path)?;
    let checkout = staging.path().join("new");
    let backup = staging.path().join("old");
    debug!(?checkout, ?backup, "created ADJ staging directory");

    // Validate the new checkout and commit before touching the current cache.
    // Early errors drop the staging directory, removing any incomplete clone.
    let repo = git_clone(&checkout, branch, url)?;
    let commit = get_commit_hash(&repo)?;
    // The repository contains paths into staging and must not survive the move.
    drop(repo);

    let had_cache = path.try_exists().map_err(GitError::Path)?;
    if had_cache {
        fs::rename(path, &backup).map_err(|source| GitError::Replacement {
            source,
            rollback: None,
        })?;
        debug!(?path, ?backup, "moved cached ADJ aside for replacement");
    }
    if let Err(error) = fs::rename(&checkout, path) {
        debug!(?path, %error, had_cache, "ADJ installation failed; restoring cache if present");
        if had_cache && let Err(rollback) = fs::rename(&backup, path) {
            // Do not let temporary-directory cleanup delete the only remaining cache.
            let saved = staging.keep();
            debug!(?backup, %rollback, "preserved ADJ backup after failed rollback");
            return Err(GitError::Replacement {
                source: error,
                rollback: Some((rollback, saved.join("old"))),
            });
        }
        if had_cache {
            debug!(?path, "restored cached ADJ after installation failure");
        }
        return Err(GitError::Replacement {
            source: error,
            rollback: None,
        });
    }

    // Installation succeeded; cleanup now discards the old cache. A cleanup
    // failure does not turn a successfully installed checkout into an error.
    if let Err(error) = staging.close() {
        warn!(?path, %error, "ADJ updated, but temporary directory cleanup failed");
    }
    info!(?path, branch, commit = %commit, "ADJ updated");
    Ok(commit)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{io, process::Command};

    fn git(path: &Path, args: &[&str]) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        // Fixture commits need identity; disable signing, hooks, and templates
        // so tests do not depend on the user's normal Git setup.
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

    fn source_repo(path: &Path) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        fs::create_dir(path)?;
        git(path, &["init", "--initial-branch=main"])?;
        fs::write(path.join("data.txt"), "main")?;
        git(path, &["add", "."])?;
        git(path, &["commit", "-m", "main data"])?;
        // Leave HEAD on another branch to verify explicit clone branch selection.
        git(path, &["checkout", "-b", "testing"])?;
        fs::write(path.join("data.txt"), "testing")?;
        git(path, &["commit", "-am", "testing data"])
    }

    // Verify branch selection, newer commits, and removal of stale cache files.
    #[test]
    fn clones_and_replaces_with_requested_branch()
    -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let temp = tempfile::tempdir()?;
        let source = temp.path().join("source");
        let cache = temp.path().join("cache").join("adj");
        source_repo(&source)?;
        let url = source.to_str().ok_or("non-UTF-8 test path")?;

        let first = git_replace(&cache, "main", url)?;
        let main_hash = gix::open(&source)?
            .find_reference("refs/heads/main")?
            .id()
            .to_string();
        assert_eq!(first, main_hash);
        assert_eq!(fs::read_to_string(cache.join("data.txt"))?, "main");
        // Replacement must discard old cache files, not just update tracked ones.
        fs::write(cache.join("stale.txt"), "discard this cache file")?;

        // Add a newer remote commit and request a different branch on replacement.
        fs::write(source.join("data.txt"), "latest testing")?;
        git(&source, &["commit", "-am", "updated testing data"])?;
        let expected = get_commit_hash(&gix::open(&source)?)?;
        assert_eq!(git_replace(&cache, "testing", url)?, expected);
        assert_ne!(first, expected);
        assert_eq!(get_commit_hash(&gix::open(&cache)?)?, expected);
        assert_eq!(
            fs::read_to_string(cache.join("data.txt"))?,
            "latest testing"
        );
        assert!(!cache.join("stale.txt").exists());
        // Successful replacement must also remove staging and backup directories.
        assert_eq!(
            fs::read_dir(cache.parent().ok_or("missing parent")?)?.count(),
            1
        );
        Ok(())
    }

    // Verify clone failures preserve cached ADJ and leave no staging debris.
    #[test]
    fn failed_clone_preserves_existing_cache()
    -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let temp = tempfile::tempdir()?;
        let source = temp.path().join("source");
        let cache = temp.path().join("adj");
        source_repo(&source)?;
        let url = source.to_str().ok_or("non-UTF-8 test path")?;

        // A failed first clone must not install a partial checkout.
        assert!(git_replace(&cache, "missing-branch", url).is_err());
        assert!(!cache.exists());
        let expected = git_replace(&cache, "main", url)?;
        fs::write(cache.join("stale.txt"), "keep on failure")?;
        // Both an invalid branch and an unavailable source must leave ADJ intact.
        assert!(git_replace(&cache, "missing-branch", url).is_err());
        let missing = temp.path().join("missing-source");
        assert!(
            git_replace(
                &cache,
                "main",
                missing.to_str().ok_or("non-UTF-8 test path")?
            )
            .is_err()
        );
        assert_eq!(get_commit_hash(&gix::open(&cache)?)?, expected);
        assert_eq!(fs::read_to_string(cache.join("data.txt"))?, "main");
        assert_eq!(
            fs::read_to_string(cache.join("stale.txt"))?,
            "keep on failure"
        );
        assert_eq!(fs::read_dir(temp.path())?.count(), 2);
        Ok(())
    }
}
