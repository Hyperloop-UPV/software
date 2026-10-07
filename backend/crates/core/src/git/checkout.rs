use std::{
    fs,
    io::{self, ErrorKind},
    path::PathBuf,
    sync::atomic::AtomicBool,
};

// Selects a branch, optionally updates it, and returns its commit ID and full UTF-8 message.
// Callers must serialize updates; checkout failures can leave a partial worktree.
#[tracing::instrument(skip(repository), fields(path), err(level = "warn"))]
pub(super) fn switch_and_update_adj(
    repository: &gix::Repository,
    branch: &str,
    online: bool,
) -> io::Result<(String, String)> {
    use gix::{
        bstr::ByteSlice,
        refs::{
            Target,
            transaction::{Change, LogChange, PreviousValue, RefEdit},
        },
        remote::{
            Direction,
            fetch::{Status, Tags, refs::update::Mode},
        },
    };
    use std::collections::HashSet;

    // Validate the branch and ensure the local checkout can be updated safely.
    let local_name = format!("refs/heads/{branch}");
    if branch.is_empty() || branch.starts_with('-') {
        return Err(io::Error::new(
            ErrorKind::InvalidInput,
            "invalid ADJ branch",
        ));
    }
    gix::validate::reference::branch_name(local_name.as_bytes().as_bstr())
        .map_err(|error| io::Error::new(ErrorKind::InvalidInput, error))?;
    // Reflogs need an identity even after reopening a clone. Apply a fallback only
    // to this handle, without changing the caller's configuration or writing it to disk.
    let mut repository = repository.clone();
    if repository
        .committer()
        .transpose()
        .map_err(io::Error::other)?
        .is_none()
    {
        let mut config = repository.config_snapshot_mut();
        config
            .append_config(
                ["user.name=ADJ backend", "user.email=adj@localhost"],
                gix::config::Source::Api,
            )
            .map_err(io::Error::other)?;
        config.commit().map_err(io::Error::other)?;
    }
    let workdir = repository.workdir().ok_or_else(|| {
        io::Error::new(
            ErrorKind::InvalidInput,
            "ADJ repository has no working directory",
        )
    })?;
    tracing::Span::current().record("path", tracing::field::display(workdir.display()));
    // Avoid modifying a checkout involved in a merge/rebase or shared with linked worktrees.
    if repository.state().is_some()
        || repository.kind() == gix::repository::Kind::LinkedWorkTree
        || !repository.worktrees()?.is_empty()
    {
        return Err(io::Error::new(
            ErrorKind::Unsupported,
            "ADJ checkout is busy or uses linked worktrees",
        ));
    }

    let previous_head = repository
        .find_reference("HEAD")
        .map_err(io::Error::other)?
        .target()
        .into_owned();
    if !matches!(previous_head, Target::Symbolic(_)) {
        return Err(io::Error::new(
            ErrorKind::InvalidData,
            "ADJ HEAD is detached",
        ));
    }
    let old_index = repository.open_index().map_err(io::Error::other)?;
    if old_index.is_sparse()
        || repository
            .config_snapshot()
            .try_boolean("core.sparseCheckout")
            .map_err(io::Error::other)?
            .unwrap_or(false)
    {
        return Err(io::Error::new(
            ErrorKind::Unsupported,
            "ADJ sparse checkouts are unsupported",
        ));
    }
    // Both snapshots must contain ordinary tracked files with safe relative paths.
    let index_paths = |index: &gix::index::File| -> io::Result<HashSet<PathBuf>> {
        index.entries().iter().map(|entry| {
            if !matches!(entry.mode, gix::index::entry::Mode::FILE | gix::index::entry::Mode::FILE_EXECUTABLE | gix::index::entry::Mode::SYMLINK)
                || entry.flags.intersects(gix::index::entry::Flags::SKIP_WORKTREE | gix::index::entry::Flags::ASSUME_VALID)
            {
                return Err(io::Error::new(ErrorKind::Unsupported, "ADJ sparse checkouts, submodules, and hidden index changes are unsupported"));
            }
            let name = entry.path(index).to_str().map_err(|error| io::Error::new(ErrorKind::InvalidData, error))?;
            let path = PathBuf::from(name);
            if path.as_os_str().is_empty() || path.components().any(|component| {
                !matches!(component, std::path::Component::Normal(_))
                    || component.as_os_str().to_str().is_some_and(|name| name.eq_ignore_ascii_case(".git"))
            }) {
                return Err(io::Error::new(ErrorKind::InvalidData, "unsafe ADJ index path"));
            }
            Ok(path)
        }).collect()
    };
    let old_paths = index_paths(&old_index)?;
    let status = repository
        .status(gix::progress::Discard)
        .map_err(io::Error::other)?
        .untracked_files(gix::status::UntrackedFiles::Files)
        .into_iter(Vec::<gix::bstr::BString>::new())
        .map_err(io::Error::other)?;
    for item in status {
        // Ignore stat-cache housekeeping, but reject staged, unstaged, and untracked changes.
        let dirty = match item.map_err(io::Error::other)? {
            gix::status::Item::TreeIndex(_) => true,
            gix::status::Item::IndexWorktree(item) => item.summary().is_some(),
        };
        if dirty {
            return Err(io::Error::new(
                ErrorKind::InvalidData,
                "ADJ checkout has local changes",
            ));
        }
    }
    // Status omits ignored files. This no-follow walk protects those files as well.
    let mut pending = vec![workdir.to_path_buf()];
    while let Some(dir) = pending.pop() {
        for entry in fs::read_dir(&dir)? {
            let entry = entry?;
            if dir == workdir && entry.file_name() == ".git" {
                continue;
            }
            let path = entry.path();
            if entry.file_type()?.is_dir() {
                pending.push(path);
            } else if !old_paths.contains(path.strip_prefix(workdir).map_err(io::Error::other)?) {
                return Err(io::Error::new(
                    ErrorKind::InvalidData,
                    "ADJ checkout contains untracked or ignored files",
                ));
            }
        }
    }

    // Save the raw local-ref value for compare-and-swap when publishing the update.
    let previous_local = repository
        .try_find_reference(local_name.as_str())
        .map_err(io::Error::other)?
        .map(|reference| reference.target().into_owned());
    let tracking_name = format!("refs/remotes/origin/{branch}");
    let interrupt = AtomicBool::new(false);
    let (target, tracking_assertion) = if online {
        // Fetch the requested branch without changing working files or the local branch.
        let mut remote = repository.find_remote("origin").map_err(io::Error::other)?;
        // '+' follows rewritten remote history in the tracking ref, not the local branch.
        let refspec = format!("+{local_name}:{tracking_name}");
        // Replace configured refspecs so only the requested branch is fetched.
        remote
            .replace_refspecs([refspec.as_bytes().as_bstr()], Direction::Fetch)
            .map_err(io::Error::other)?;
        let remote = remote.with_fetch_tags(Tags::None);
        tracing::info!("fetching ADJ branch");
        let prepared = remote
            .connect(Direction::Fetch)
            .map_err(io::Error::other)?
            .prepare_fetch(gix::progress::Discard, Default::default())
            .map_err(io::Error::other)?;
        let (mapping_index, target) = prepared
            .ref_map()
            .mappings
            .iter()
            .enumerate()
            .find_map(|(index, mapping)| {
                if mapping.remote.as_name() == Some(local_name.as_bytes().as_bstr())
                    && mapping.local.as_ref().map(|name| name.as_bstr())
                        == Some(tracking_name.as_bytes().as_bstr())
                {
                    mapping.remote.as_id().map(|id| (index, id.to_owned()))
                } else {
                    None
                }
            })
            .ok_or_else(|| {
                io::Error::new(
                    ErrorKind::NotFound,
                    format!("ADJ branch '{branch}' does not exist on origin"),
                )
            })?;

        // A missing branch stops above; online failures never fall back to cached data.
        let fetched = prepared
            .receive(gix::progress::Discard, &interrupt)
            .map_err(io::Error::other)?;
        let updates = match &fetched.status {
            Status::NoPackReceived { update_refs, .. } | Status::Change { update_refs, .. } => {
                update_refs
            }
        };
        let update = updates
            .updates
            .get(mapping_index)
            .ok_or_else(|| io::Error::other("missing ADJ fetch update report"))?;
        if !matches!(
            update.mode,
            Mode::NoChangeNeeded | Mode::FastForward | Mode::Forced | Mode::New
        ) {
            return Err(io::Error::other(format!(
                "ADJ fetch was rejected: {}",
                update.mode
            )));
        }
        if repository
            .find_reference(tracking_name.as_str())
            .map_err(io::Error::other)?
            .target()
            .try_id()
            != Some(target.as_ref())
        {
            return Err(io::Error::other(
                "ADJ tracking reference does not match origin",
            ));
        }
        (target, Some(Target::Object(target)))
    } else {
        // Prefer the local branch. Consult cached tracking refs only when it is absent.
        let selected = match &previous_local {
            Some(previous) => previous.clone(),
            None => repository
                .try_find_reference(tracking_name.as_str())
                .map_err(io::Error::other)?
                .map(|reference| reference.target().into_owned())
                .ok_or_else(|| {
                    io::Error::new(
                        ErrorKind::NotFound,
                        format!("ADJ branch '{branch}' is not available locally"),
                    )
                })?,
        };
        let target = selected
            .try_id()
            .ok_or_else(|| {
                io::Error::new(
                    ErrorKind::Unsupported,
                    "symbolic ADJ branches are unsupported",
                )
            })?
            .to_owned();
        tracing::info!(
            cached = previous_local.is_none(),
            "using available ADJ branch without fetching"
        );
        // Assert a cached source remains unchanged when creating a new local branch.
        let assertion = previous_local.is_none().then_some(selected);
        (target, assertion)
    };
    // Resolve the target commit and reject divergent local history.
    if let Some(previous) = &previous_local {
        let local = previous.try_id().ok_or_else(|| {
            io::Error::new(
                ErrorKind::Unsupported,
                "symbolic ADJ branches are unsupported",
            )
        })?;
        // Online updates must fast-forward; offline selection keeps the local tip as-is.
        if online
            && repository
                .merge_base(local.to_owned(), target)
                .map_err(io::Error::other)?
                .detach()
                != local
        {
            return Err(io::Error::new(
                ErrorKind::InvalidData,
                "local ADJ branch has diverged from origin",
            ));
        }
    }

    let commit = repository.find_commit(target).map_err(io::Error::other)?;
    // Validate the full message before making filesystem changes; keep body and newlines.
    let message = commit
        .message_raw()
        .map_err(io::Error::other)?
        .to_str()
        .map_err(|error| io::Error::new(ErrorKind::InvalidData, error))?
        .to_owned();
    // Update working files and the index to match the target commit's snapshot.
    let tree = commit.tree_id().map_err(io::Error::other)?;
    let mut next_index = repository
        .index_from_tree(&tree)
        .map_err(io::Error::other)?;
    let new_paths = index_paths(&next_index)?;
    let mut options = repository
        .checkout_options(gix::worktree::stack::state::attributes::Source::IdMapping)
        .map_err(io::Error::other)?;
    // Only overwrite after the cleanliness checks; other writers must not race this call.
    options.overwrite_existing = true;
    let objects = repository
        .objects
        .clone()
        .into_arc()
        .map_err(io::Error::other)?;
    let local_ref: gix::refs::FullName =
        local_name.as_str().try_into().map_err(io::Error::other)?;
    let tracking_ref: gix::refs::FullName = tracking_name
        .as_str()
        .try_into()
        .map_err(io::Error::other)?;

    // Checkout does not delete paths absent from the new tree; remove only old tracked files.
    let mut removed = old_paths.difference(&new_paths).collect::<Vec<_>>();
    removed.sort_unstable_by_key(|path| std::cmp::Reverse(path.components().count()));
    tracing::info!("checking out ADJ branch");
    for relative in removed {
        let path = workdir.join(relative);
        fs::remove_file(&path)?;
        let mut parent = path.parent();
        while let Some(dir) = parent.filter(|dir| *dir != workdir) {
            // Empty parents may be removed, but never recursively delete a directory.
            match fs::remove_dir(dir) {
                Ok(()) => {}
                Err(error)
                    if matches!(
                        error.kind(),
                        ErrorKind::DirectoryNotEmpty | ErrorKind::NotFound
                    ) =>
                {
                    break;
                }
                Err(error) => return Err(error),
            }
            parent = dir.parent();
        }
    }
    let outcome = gix::worktree::state::checkout(
        &mut next_index,
        workdir,
        objects,
        &gix::progress::Discard,
        &gix::progress::Discard,
        &interrupt,
        options,
    )
    .map_err(io::Error::other)?;
    if !outcome.errors.is_empty()
        || !outcome.collisions.is_empty()
        || !outcome.delayed_paths_unknown.is_empty()
        || !outcome.delayed_paths_unprocessed.is_empty()
    {
        return Err(io::Error::other(
            "ADJ checkout was incomplete; local branch was not updated",
        ));
    }
    next_index
        .write(Default::default())
        .map_err(io::Error::other)?;

    // Update the local branch and symbolic HEAD only after checkout and index writing succeed.
    // This transaction does not make files, index, and refs jointly atomic.
    let expected_local = previous_local
        .map(PreviousValue::MustExistAndMatch)
        .unwrap_or(PreviousValue::MustNotExist);
    let mut edits = vec![
        RefEdit {
            name: local_ref.clone(),
            deref: false,
            change: Change::Update {
                new: Target::Object(target),
                expected: expected_local,
                log: LogChange {
                    message: "update ADJ branch".into(),
                    ..Default::default()
                },
            },
        },
        RefEdit {
            name: "HEAD".try_into().map_err(io::Error::other)?,
            deref: false,
            change: Change::Update {
                // Symbolic HEAD points at the branch, rather than detaching at the commit.
                new: Target::Symbolic(local_ref),
                expected: PreviousValue::MustExistAndMatch(previous_head),
                log: LogChange {
                    message: "switch ADJ branch".into(),
                    ..Default::default()
                },
            },
        },
    ];
    if let Some(previous) = tracking_assertion {
        edits.push(RefEdit {
            name: tracking_ref,
            deref: false,
            change: Change::Update {
                // Check the source without advancing or creating an offline tracking ref.
                new: previous.clone(),
                expected: PreviousValue::MustExistAndMatch(previous),
                log: LogChange::default(),
            },
        });
    }
    repository
        .edit_references(edits)
        .map_err(io::Error::other)?;
    // Return the selected commit's ID and full message without trimming its body or newlines.
    let id = target.to_string();
    tracing::info!(commit = %id, online, "ADJ branch ready");
    Ok((id, message))
}
