use super::{
    branch_commit_info, checkout::switch_and_update_adj, clone_adj, list_remote_branches,
    local_repository_exists, resolve_adj_path, update_adj_with_connection,
};
use std::{cell::Cell, env, fs, io, path::Path, time::SystemTime};

// Build real Git objects with gix, without relying on a user's Git identity.
fn write_commit(
    repository: &gix::Repository,
    branch: &str,
    files: &[(&str, &[u8])],
    message: &str,
) -> io::Result<gix::ObjectId> {
    let reference = format!("refs/heads/{branch}");
    let parent = repository
        .try_find_reference(reference.as_str())
        .map_err(io::Error::other)?
        .map(|mut reference| reference.peel_to_id().map(|id| id.detach()))
        .transpose()
        .map_err(io::Error::other)?;
    let mut tree = repository.empty_tree().edit().map_err(io::Error::other)?;
    for (path, content) in files {
        let blob = repository
            .write_blob(*content)
            .map_err(io::Error::other)?
            .detach();
        tree.upsert(*path, gix::objs::tree::EntryKind::Blob, blob)
            .map_err(io::Error::other)?;
    }
    let tree = tree.write().map_err(io::Error::other)?.detach();
    let signature = gix::actor::SignatureRef {
        name: "ADJ Test".into(),
        email: "adj@example.com".into(),
        time: "1 +0000",
    };
    Ok(repository
        .commit_as(signature, signature, reference, message, tree, parent)
        .map_err(io::Error::other)?
        .detach())
}

struct UpdateFixture {
    root: std::path::PathBuf,
    remote: gix::Repository,
    repository: gix::Repository,
}

impl UpdateFixture {
    fn new() -> io::Result<Self> {
        let id = SystemTime::now()
            .duration_since(SystemTime::UNIX_EPOCH)
            .map_err(io::Error::other)?
            .as_nanos();
        let root = env::temp_dir().join(format!("adj-update-test-{}-{id}", std::process::id()));
        fs::create_dir(&root)?;
        let remote = gix::init_bare(root.join("origin.git")).map_err(io::Error::other)?;
        write_commit(
            &remote,
            "main",
            &[("one.txt", b"first")],
            "Initial\n\nMain body\n",
        )?;
        // Local transport may start git-upload-pack internally; no GitHub request is made.
        let url = remote
            .git_dir()
            .to_str()
            .ok_or_else(|| io::Error::other("test remote path is not UTF-8"))?;
        let mut clone = gix::prepare_clone(url, root.join("adj"))
            .map_err(io::Error::other)?
            .with_remote_name("origin")
            .map_err(io::Error::other)?
            .with_ref_name(Some("refs/heads/main"))
            .map_err(io::Error::other)?
            .with_in_memory_config_overrides(["user.name=ADJ Test", "user.email=adj@example.com"]);
        let interrupt = std::sync::atomic::AtomicBool::new(false);
        let (mut checkout, _) = clone
            .fetch_then_checkout(gix::progress::Discard, &interrupt)
            .map_err(io::Error::other)?;
        let (repository, outcome) = checkout
            .main_worktree(gix::progress::Discard, &interrupt)
            .map_err(io::Error::other)?;
        assert!(outcome.errors.is_empty() && outcome.collisions.is_empty());
        Ok(Self {
            root,
            remote,
            repository,
        })
    }

    fn workdir(&self) -> std::path::PathBuf {
        self.root.join("adj")
    }
}

impl Drop for UpdateFixture {
    fn drop(&mut self) {
        let _ = fs::remove_dir_all(&self.root);
    }
}

#[test]
fn reads_other_branch_commit_without_changing_dirty_checkout() -> io::Result<()> {
    // Create fixture and ensure we can read main's commit.
    let fixture = UpdateFixture::new()?;
    let original = fixture
        .repository
        .head_commit()
        .map_err(io::Error::other)?
        .id;
    assert_eq!(
        branch_commit_info(&fixture.repository, "main")?,
        (original.to_string(), "Initial\n\nMain body\n".into())
    );

    // Create a local feature branch and leave the working tree dirty.
    let message = "Feature title\n\nFull body\nSecond line\n";
    let feature = write_commit(
        &fixture.repository,
        "feature",
        &[("other.txt", b"other")],
        message,
    )?;
    fs::write(fixture.workdir().join("one.txt"), "unsaved local changes")?;

    // Detach origin so the query cannot use it.
    fs::rename(fixture.remote.git_dir(), fixture.root.join("offline.git"))?;

    // Capture repository state before querying.
    let head_before = fs::read(fixture.repository.git_dir().join("HEAD"))?;
    let index_before = fs::read(fixture.repository.index_path())?;
    let config_before = fs::read(fixture.repository.git_dir().join("config"))?;

    // Query should read feature's commit and never touch origin or change HEAD.
    assert_eq!(
        branch_commit_info(&fixture.repository, "feature")?,
        (feature.to_string(), message.into())
    );

    // Verify no side effects on repository state or dirty files.
    assert_eq!(
        fixture
            .repository
            .head_commit()
            .map_err(io::Error::other)?
            .id,
        original
    );
    assert_eq!(
        fs::read(fixture.repository.git_dir().join("HEAD"))?,
        head_before
    );
    assert_eq!(fs::read(fixture.repository.index_path())?, index_before);
    assert_eq!(
        fs::read(fixture.repository.git_dir().join("config"))?,
        config_before
    );
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("one.txt"))?,
        "unsaved local changes"
    );
    assert!(!fixture.workdir().join("other.txt").exists());
    Ok(())
}

#[test]
fn branch_commit_info_reads_local_tip_instead_of_tracking_tip() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;

    // Cached tracking ref points to the initial commit.
    let cached = fixture
        .repository
        .head_commit()
        .map_err(io::Error::other)?
        .id;

    // Write a new commit to the local main branch.
    let local = write_commit(
        &fixture.repository,
        "main",
        &[("one.txt", b"first")],
        "Local commit\n\nLocal body\n",
    )?;

    // Should return the local tip, not the cached tracking tip.
    assert_eq!(
        branch_commit_info(&fixture.repository, "main")?,
        (local.to_string(), "Local commit\n\nLocal body\n".into())
    );
    assert_ne!(local, cached);

    // Tracking ref must remain unchanged.
    assert_eq!(
        fixture
            .repository
            .find_reference("refs/remotes/origin/main")
            .map_err(io::Error::other)?
            .peel_to_id()
            .map_err(io::Error::other)?
            .detach(),
        cached
    );
    Ok(())
}

#[test]
fn branch_commit_info_rejects_missing_and_invalid_local_branches() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    let original = fixture
        .repository
        .head_commit()
        .map_err(io::Error::other)?
        .id;

    // Create non-local refs to ensure we don't fall back to them.
    fixture
        .repository
        .reference(
            "refs/remotes/origin/cached-only",
            original,
            gix::refs::transaction::PreviousValue::MustNotExist,
            "cached branch",
        )
        .map_err(io::Error::other)?;
    fixture
        .repository
        .reference(
            "refs/tags/tag-only",
            original,
            gix::refs::transaction::PreviousValue::MustNotExist,
            "tag",
        )
        .map_err(io::Error::other)?;

    // Missing local branches must return NotFound (no origin/cache fallback).
    for branch in ["missing", "cached-only", "tag-only"] {
        assert!(
            matches!(branch_commit_info(&fixture.repository, branch),
            Err(error) if error.kind() == io::ErrorKind::NotFound)
        );
    }

    // Invalid branch names must return InvalidInput.
    for branch in ["", "bad name", "-main", "HEAD", "main^{commit}"] {
        assert!(
            matches!(branch_commit_info(&fixture.repository, branch),
            Err(error) if error.kind() == io::ErrorKind::InvalidInput)
        );
    }
    Ok(())
}

#[test]
fn checks_local_repository_without_parent_discovery() -> io::Result<()> {
    // Isolate the test from the project's repository and from other test processes.
    let id = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_err(io::Error::other)?
        .as_nanos();
    let path = env::temp_dir().join(format!("adj-repository-test-{}-{id}", std::process::id()));
    fs::create_dir(&path)?;

    let result = (|| -> io::Result<()> {
        assert!(!local_repository_exists(&path.join("missing"))?);
        assert!(!local_repository_exists(&path)?);

        // A fresh repository is valid even before its first commit.
        let repo = gix::init(&path).map_err(io::Error::other)?;
        assert!(local_repository_exists(&path)?);
        let child = path.join("child");
        fs::create_dir(&child)?;
        assert!(!local_repository_exists(&child)?);

        // Broken configuration is an error, not permission to replace the repository.
        fs::write(repo.git_dir().join("config"), "[invalid\n")?;
        assert!(local_repository_exists(&path).is_err());
        Ok(())
    })();

    fs::remove_dir_all(&path)?;
    result
}

#[test]
fn clone_rejects_relative_path_and_preserves_existing_destination() -> io::Result<()> {
    // All cases fail before fetching, so this test does not access the ADJ remote.
    assert!(matches!(
        clone_adj(Path::new("relative")),
        Err(error) if error.kind() == io::ErrorKind::InvalidInput
    ));
    let id = SystemTime::now()
        .duration_since(SystemTime::UNIX_EPOCH)
        .map_err(io::Error::other)?
        .as_nanos();
    let base = env::temp_dir().join(format!("adj-clone-test-{}-{id}", std::process::id()));
    assert!(!base.exists());

    let (destination, _) = resolve_adj_path(Some(&base))?;
    fs::create_dir_all(&destination)?;
    let result = (|| -> io::Result<()> {
        assert!(matches!(
            clone_adj(&base),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists
        ));
        fs::write(destination.join("local.txt"), "preserve")?;
        assert!(matches!(
            clone_adj(&base),
            Err(error) if error.kind() == io::ErrorKind::AlreadyExists
        ));
        assert_eq!(
            fs::read_to_string(destination.join("local.txt"))?,
            "preserve"
        );
        assert!(!destination.join("adj").exists());
        Ok(())
    })();

    fs::remove_dir_all(&base)?;
    result
}

#[test]
fn switches_updates_and_returns_full_commit_message() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    let original = fixture
        .repository
        .head_commit()
        .map_err(io::Error::other)?
        .id;
    assert_eq!(
        switch_and_update_adj(&fixture.repository, "main", true)?,
        (original.to_string(), "Initial\n\nMain body\n".to_owned())
    );

    fixture
        .remote
        .reference(
            "refs/heads/feature",
            original,
            gix::refs::transaction::PreviousValue::MustNotExist,
            "new branch",
        )
        .map_err(io::Error::other)?;
    let feature = write_commit(
        &fixture.remote,
        "feature",
        &[("nested/two.txt", b"second")],
        "Feature\n\nComplete message\n",
    )?;
    assert_eq!(
        switch_and_update_adj(&fixture.repository, "feature", true)?,
        (
            feature.to_string(),
            "Feature\n\nComplete message\n".to_owned()
        )
    );
    assert_eq!(
        fixture
            .repository
            .head()
            .map_err(io::Error::other)?
            .referent_name()
            .map(ToString::to_string),
        Some("refs/heads/feature".into())
    );
    assert!(!fixture.workdir().join("one.txt").exists());
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("nested/two.txt"))?,
        "second"
    );

    let updated = write_commit(
        &fixture.remote,
        "feature",
        &[("nested/two.txt", b"updated")],
        "Update\n\nDetails\n",
    )?;
    assert_eq!(
        switch_and_update_adj(&fixture.repository, "feature", true)?,
        (updated.to_string(), "Update\n\nDetails\n".to_owned())
    );
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("nested/two.txt"))?,
        "updated"
    );
    assert_eq!(
        switch_and_update_adj(&fixture.repository, "main", true)?.0,
        original.to_string()
    );
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("one.txt"))?,
        "first"
    );
    assert!(!fixture.workdir().join("nested").exists());
    Ok(())
}

#[test]
fn rejects_missing_branch_without_using_stale_tracking_ref() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    let original = fixture
        .repository
        .head_commit()
        .map_err(io::Error::other)?
        .id;
    assert!(
        matches!(switch_and_update_adj(&fixture.repository, "missing", true), Err(error) if error.kind() == io::ErrorKind::NotFound)
    );
    // Keep a remote branch, but delete main after it was cloned and tracked locally.
    fixture
        .remote
        .reference(
            "refs/heads/other",
            original,
            gix::refs::transaction::PreviousValue::MustNotExist,
            "new branch",
        )
        .map_err(io::Error::other)?;
    fixture
        .remote
        .edit_reference(gix::refs::transaction::RefEdit {
            name: "refs/heads/main".try_into().map_err(io::Error::other)?,
            deref: false,
            change: gix::refs::transaction::Change::Delete {
                expected: gix::refs::transaction::PreviousValue::MustExist,
                log: gix::refs::transaction::RefLog::AndReference,
            },
        })
        .map_err(io::Error::other)?;
    assert!(
        matches!(switch_and_update_adj(&fixture.repository, "main", true), Err(error) if error.kind() == io::ErrorKind::NotFound)
    );
    assert_eq!(
        fixture
            .repository
            .head_commit()
            .map_err(io::Error::other)?
            .id,
        original
    );
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("one.txt"))?,
        "first"
    );
    Ok(())
}

#[test]
fn rejects_local_changes_and_divergent_commits() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    fs::write(fixture.workdir().join("one.txt"), "local edit")?;
    assert!(switch_and_update_adj(&fixture.repository, "main", true).is_err());
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("one.txt"))?,
        "local edit"
    );
    fs::write(fixture.workdir().join("one.txt"), "first")?;
    fs::write(fixture.workdir().join("untracked.txt"), "local")?;
    assert!(switch_and_update_adj(&fixture.repository, "main", true).is_err());
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("untracked.txt"))?,
        "local"
    );
    fs::remove_file(fixture.workdir().join("untracked.txt"))?;
    fs::create_dir_all(fixture.repository.git_dir().join("info"))?;
    fs::write(
        fixture.repository.git_dir().join("info/exclude"),
        "ignored.txt\n",
    )?;
    fs::write(fixture.workdir().join("ignored.txt"), "keep")?;
    assert!(switch_and_update_adj(&fixture.repository, "main", true).is_err());
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("ignored.txt"))?,
        "keep"
    );
    fs::remove_file(fixture.workdir().join("ignored.txt"))?;

    let local = write_commit(
        &fixture.repository,
        "main",
        &[("one.txt", b"first")],
        "Local commit\n",
    )?;
    assert!(switch_and_update_adj(&fixture.repository, "main", true).is_err());
    assert_eq!(
        fixture
            .repository
            .head_commit()
            .map_err(io::Error::other)?
            .id,
        local
    );
    Ok(())
}

#[test]
fn rejects_unavailable_origin_without_changing_checkout() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    let original = fixture
        .repository
        .head_commit()
        .map_err(io::Error::other)?
        .id;
    fs::rename(fixture.remote.git_dir(), fixture.root.join("offline.git"))?;
    assert!(switch_and_update_adj(&fixture.repository, "main", true).is_err());
    assert_eq!(
        fixture
            .repository
            .head_commit()
            .map_err(io::Error::other)?
            .id,
        original
    );
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("one.txt"))?,
        "first"
    );
    Ok(())
}

#[test]
fn handles_file_directory_transitions() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    write_commit(
        &fixture.remote,
        "main",
        &[("one.txt/child.txt", b"nested")],
        "Directory\n",
    )?;
    switch_and_update_adj(&fixture.repository, "main", true)?;
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("one.txt/child.txt"))?,
        "nested"
    );
    write_commit(&fixture.remote, "main", &[("one.txt", b"flat")], "File\n")?;
    switch_and_update_adj(&fixture.repository, "main", true)?;
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("one.txt"))?,
        "flat"
    );
    Ok(())
}

#[test]
fn updates_reopened_checkout_without_user_identity() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    let mut permissions = gix::open::Permissions::default();
    permissions.config = gix::open::permissions::Config::isolated();
    permissions.env.identity = gix::sec::Permission::Deny;
    let reopened = gix::open_opts(
        fixture.workdir(),
        gix::open::Options::default().permissions(permissions),
    )
    .map_err(io::Error::other)?;
    assert!(
        reopened
            .committer()
            .transpose()
            .map_err(io::Error::other)?
            .is_none()
    );
    let config_before = fs::read(reopened.git_dir().join("config"))?;
    let updated = write_commit(
        &fixture.remote,
        "main",
        &[("one.txt", b"new")],
        "Reopened\n\nDetails\n",
    )?;
    assert_eq!(
        switch_and_update_adj(&reopened, "main", true)?,
        (updated.to_string(), "Reopened\n\nDetails\n".into())
    );
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("one.txt"))?,
        "new"
    );
    assert_eq!(fs::read(reopened.git_dir().join("config"))?, config_before);
    assert!(
        reopened
            .committer()
            .transpose()
            .map_err(io::Error::other)?
            .is_none()
    );
    Ok(())
}

#[test]
fn rejects_sparse_checkout_before_mutation() -> io::Result<()> {
    let mut fixture = UpdateFixture::new()?;
    let original = fixture
        .repository
        .head_commit()
        .map_err(io::Error::other)?
        .id;
    let mut config = fixture.repository.config_snapshot_mut();
    config
        .append_config(["core.sparseCheckout=true"], gix::config::Source::Api)
        .map_err(io::Error::other)?;
    config.commit().map_err(io::Error::other)?;
    write_commit(
        &fixture.remote,
        "main",
        &[("excluded.txt", b"outside")],
        "Excluded\n",
    )?;
    assert!(
        matches!(switch_and_update_adj(&fixture.repository, "main", true), Err(error) if error.kind() == io::ErrorKind::Unsupported)
    );
    assert_eq!(
        fixture
            .repository
            .head_commit()
            .map_err(io::Error::other)?
            .id,
        original
    );
    assert!(!fixture.workdir().join("excluded.txt").exists());
    Ok(())
}

#[test]
fn lists_live_remote_branches_without_fetching_or_changing_checkout() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    let original = fixture
        .repository
        .head_commit()
        .map_err(io::Error::other)?
        .id;
    let index_before = fs::read(fixture.repository.index_path())?;
    let config_before = fs::read(fixture.repository.git_dir().join("config"))?;
    assert_eq!(list_remote_branches(&fixture.repository)?, ["main"]);

    // These refs are created after the clone, so they cannot come from cached tracking refs.
    fixture
        .remote
        .reference(
            "refs/heads/zeta",
            original,
            gix::refs::transaction::PreviousValue::MustNotExist,
            "new branch",
        )
        .map_err(io::Error::other)?;
    let new_tip = write_commit(
        &fixture.remote,
        "alpha/nested",
        &[("new.txt", b"remote")],
        "Remote only\n",
    )?;
    fixture
        .remote
        .reference(
            "refs/tags/v1",
            original,
            gix::refs::transaction::PreviousValue::MustNotExist,
            "new tag",
        )
        .map_err(io::Error::other)?;
    fixture
        .repository
        .reference(
            "refs/heads/local-only",
            original,
            gix::refs::transaction::PreviousValue::MustNotExist,
            "local branch",
        )
        .map_err(io::Error::other)?;

    assert_eq!(
        list_remote_branches(&fixture.repository)?,
        ["alpha/nested", "main", "zeta"]
    );
    assert!(fixture.repository.find_object(new_tip).is_err());
    assert!(
        fixture
            .repository
            .try_find_reference("refs/remotes/origin/zeta")
            .map_err(io::Error::other)?
            .is_none()
    );
    assert_eq!(
        fixture
            .repository
            .head_commit()
            .map_err(io::Error::other)?
            .id,
        original
    );
    assert_eq!(fs::read(fixture.repository.index_path())?, index_before);
    assert_eq!(
        fs::read(fixture.repository.git_dir().join("config"))?,
        config_before
    );
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("one.txt"))?,
        "first"
    );
    Ok(())
}

#[test]
fn branch_listing_reports_missing_or_unavailable_origin() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    let without_origin = gix::init(fixture.root.join("no-origin")).map_err(io::Error::other)?;
    assert!(list_remote_branches(&without_origin).is_err());
    fs::rename(fixture.remote.git_dir(), fixture.root.join("offline.git"))?;
    assert!(list_remote_branches(&fixture.repository).is_err());
    Ok(())
}

#[test]
fn switches_offline_to_local_branches_preferring_local_tip() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    let original = fixture
        .repository
        .head_commit()
        .map_err(io::Error::other)?
        .id;
    for name in ["refs/heads/local", "refs/remotes/origin/local"] {
        fixture
            .repository
            .reference(
                name,
                original,
                gix::refs::transaction::PreviousValue::MustNotExist,
                "local branch",
            )
            .map_err(io::Error::other)?;
    }
    // Advance a non-current branch so the main checkout stays clean.
    let local = write_commit(
        &fixture.repository,
        "local",
        &[("local.txt", b"ahead")],
        "Local ahead\n\nKeep local history\n",
    )?;
    let local_only = write_commit(
        &fixture.repository,
        "local-only",
        &[("local-only.txt", b"no tracking")],
        "Local only\n",
    )?;
    fs::rename(fixture.remote.git_dir(), fixture.root.join("offline.git"))?;

    // A local branch does not need an origin tracking ref to be checked out offline.
    assert_eq!(
        switch_and_update_adj(&fixture.repository, "local-only", false)?,
        (local_only.to_string(), "Local only\n".into())
    );
    assert!(
        fixture
            .repository
            .try_find_reference("refs/remotes/origin/local-only")
            .map_err(io::Error::other)?
            .is_none()
    );
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("local-only.txt"))?,
        "no tracking"
    );
    assert_eq!(
        switch_and_update_adj(&fixture.repository, "local", false)?,
        (
            local.to_string(),
            "Local ahead\n\nKeep local history\n".into()
        )
    );
    assert_eq!(
        fixture
            .repository
            .head()
            .map_err(io::Error::other)?
            .referent_name()
            .map(ToString::to_string),
        Some("refs/heads/local".into())
    );
    assert_eq!(
        fixture
            .repository
            .find_reference("refs/remotes/origin/local")
            .map_err(io::Error::other)?
            .peel_to_id()
            .map_err(io::Error::other)?
            .detach(),
        original
    );
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("local.txt"))?,
        "ahead"
    );
    assert!(!fixture.workdir().join("one.txt").exists());
    assert!(!fixture.workdir().join("local-only.txt").exists());
    Ok(())
}

#[test]
fn creates_offline_local_branch_from_cached_tracking() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    let feature = write_commit(
        &fixture.remote,
        "feature",
        &[("feature.txt", b"cached")],
        "Cached feature\n\nFull body\n",
    )?;
    // Populate tracking through the online helper, then remove only the local branch.
    switch_and_update_adj(&fixture.repository, "feature", true)?;
    switch_and_update_adj(&fixture.repository, "main", true)?;
    fixture
        .repository
        .edit_reference(gix::refs::transaction::RefEdit {
            name: "refs/heads/feature".try_into().map_err(io::Error::other)?,
            deref: false,
            change: gix::refs::transaction::Change::Delete {
                expected: gix::refs::transaction::PreviousValue::MustExist,
                log: gix::refs::transaction::RefLog::AndReference,
            },
        })
        .map_err(io::Error::other)?;
    assert!(
        fixture
            .repository
            .try_find_reference("refs/heads/feature")
            .map_err(io::Error::other)?
            .is_none()
    );
    assert_eq!(
        fixture
            .repository
            .find_reference("refs/remotes/origin/feature")
            .map_err(io::Error::other)?
            .peel_to_id()
            .map_err(io::Error::other)?
            .detach(),
        feature
    );
    fs::rename(fixture.remote.git_dir(), fixture.root.join("offline.git"))?;

    assert_eq!(
        switch_and_update_adj(&fixture.repository, "feature", false)?,
        (feature.to_string(), "Cached feature\n\nFull body\n".into())
    );
    assert_eq!(
        fixture
            .repository
            .find_reference("refs/heads/feature")
            .map_err(io::Error::other)?
            .peel_to_id()
            .map_err(io::Error::other)?
            .detach(),
        feature
    );
    assert_eq!(
        fixture
            .repository
            .head()
            .map_err(io::Error::other)?
            .referent_name()
            .map(ToString::to_string),
        Some("refs/heads/feature".into())
    );
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("feature.txt"))?,
        "cached"
    );
    assert!(!fixture.workdir().join("one.txt").exists());
    Ok(())
}

#[test]
fn rejects_missing_offline_branch_without_changing_checkout() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    let head_before = fs::read(fixture.repository.git_dir().join("HEAD"))?;
    let index_before = fs::read(fixture.repository.index_path())?;
    let file_before = fs::read(fixture.workdir().join("one.txt"))?;
    fs::rename(fixture.remote.git_dir(), fixture.root.join("offline.git"))?;

    assert!(matches!(
        switch_and_update_adj(&fixture.repository, "missing", false),
        Err(error) if error.kind() == io::ErrorKind::NotFound
    ));
    assert_eq!(
        fs::read(fixture.repository.git_dir().join("HEAD"))?,
        head_before
    );
    assert_eq!(fs::read(fixture.repository.index_path())?, index_before);
    assert_eq!(fs::read(fixture.workdir().join("one.txt"))?, file_before);
    assert_eq!(fs::read_dir(fixture.workdir())?.count(), 2);
    assert!(
        fixture
            .repository
            .try_find_reference("refs/heads/missing")
            .map_err(io::Error::other)?
            .is_none()
    );
    Ok(())
}

#[test]
fn updates_existing_repository_online_with_one_probe_and_only_requested_branch() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    let original = fixture
        .repository
        .head_commit()
        .map_err(io::Error::other)?
        .id;
    fixture
        .remote
        .reference(
            "refs/heads/feature",
            original,
            gix::refs::transaction::PreviousValue::MustNotExist,
            "new branch",
        )
        .map_err(io::Error::other)?;
    let feature = write_commit(
        &fixture.remote,
        "feature",
        &[("feature.txt", b"online")],
        "Online feature\n\nComplete body\n",
    )?;
    write_commit(
        &fixture.remote,
        "main",
        &[("one.txt", b"remote main")],
        "Unrequested main\n",
    )?;
    let probes = Cell::new(0);

    // The injected probe is deterministic; origin uses only local transport.
    assert_eq!(
        update_adj_with_connection(Some(&fixture.root), "feature", || {
            probes.set(probes.get() + 1);
            true
        })?,
        (
            feature.to_string(),
            "Online feature\n\nComplete body\n".into()
        )
    );
    assert_eq!(probes.get(), 1);
    for name in ["refs/heads/main", "refs/remotes/origin/main"] {
        assert_eq!(
            fixture
                .repository
                .find_reference(name)
                .map_err(io::Error::other)?
                .peel_to_id()
                .map_err(io::Error::other)?
                .detach(),
            original
        );
    }
    for name in ["refs/heads/feature", "refs/remotes/origin/feature"] {
        assert_eq!(
            fixture
                .repository
                .find_reference(name)
                .map_err(io::Error::other)?
                .peel_to_id()
                .map_err(io::Error::other)?
                .detach(),
            feature
        );
    }
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("feature.txt"))?,
        "online"
    );
    assert!(!fixture.workdir().join("one.txt").exists());
    Ok(())
}

#[test]
fn updates_existing_repository_offline_with_unavailable_origin() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    let original = fixture
        .repository
        .head_commit()
        .map_err(io::Error::other)?
        .id;
    fs::rename(fixture.remote.git_dir(), fixture.root.join("offline.git"))?;
    let probes = Cell::new(0);

    assert_eq!(
        update_adj_with_connection(Some(&fixture.root), "main", || {
            probes.set(probes.get() + 1);
            false
        })?,
        (original.to_string(), "Initial\n\nMain body\n".into())
    );
    assert_eq!(probes.get(), 1);
    assert_eq!(
        fs::read_to_string(fixture.workdir().join("one.txt"))?,
        "first"
    );
    Ok(())
}

#[test]
fn rejects_missing_offline_repository_without_creating_directories() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    let missing = fixture.root.join("missing");
    let base = missing.join("parent");
    let probes = Cell::new(0);

    assert!(matches!(
        update_adj_with_connection(Some(&base), "main", || {
            probes.set(probes.get() + 1);
            false
        }),
        Err(error) if error.kind() == io::ErrorKind::NotFound
    ));
    assert_eq!(probes.get(), 1);
    assert!(!missing.exists());
    assert!(!base.exists());
    assert!(!base.join("adj").exists());
    Ok(())
}

#[test]
fn rejects_occupied_online_destination_without_touching_files() -> io::Result<()> {
    let fixture = UpdateFixture::new()?;
    let base = fixture.root.join("occupied");
    let destination = base.join("adj");
    fs::create_dir_all(&destination)?;
    fs::write(destination.join("local.txt"), "preserve")?;
    let probes = Cell::new(0);

    // The occupied destination stops cloning before any public remote access.
    assert!(matches!(
        update_adj_with_connection(Some(&base), "main", || {
            probes.set(probes.get() + 1);
            true
        }),
        Err(error) if error.kind() == io::ErrorKind::AlreadyExists
    ));
    assert_eq!(probes.get(), 1);
    assert_eq!(
        fs::read_to_string(destination.join("local.txt"))?,
        "preserve"
    );
    assert_eq!(fs::read_dir(&destination)?.count(), 1);
    assert!(!destination.join(".git").exists());
    Ok(())
}
