# ADJ Git helpers

This module downloads and updates the local [ADJ repository](https://github.com/Hyperloop-UPV/adj) using [`gix`](https://crates.io/crates/gix), with [`tracing`](https://crates.io/crates/tracing) for logging. It supports branch selection and offline use of an existing local checkout.

## Workflow

`update_adj(path, branch)` returns the full hash of the checked-out commit.
A custom path identifies the ADJ repository itself. The default is
`<cache directory>/hyperloop-control-station/adj`, using `dirs::cache_dir()`.
An existing invalid repository or inaccessible path returns an error.

The existing connectivity check attempts a TCP connection to `1.1.1.1:443`
with a three-second timeout. This checks external TCP connectivity, not GitHub
availability.

### Online

Online updates replace the local checkout and do not preserve local edits or commits.

- Shallow-clone the requested branch into a temporary directory beside ADJ.
- Complete checkout and read its commit hash before touching the cache.
- Move the old cache aside and install the new checkout.
- Restore the old cache if installation fails. If restoration also fails,
  preserve the backup and include its location in the error.
- Remove the old cache after successful installation.

A clone error leaves the old cache untouched and is returned directly; it does
not automatically fall back to offline operation. No separate fetch of the
existing cache, merge, or branch switch is needed because the checkout is replaced.

### Offline

- If ADJ exists, return its current commit hash without updating or switching branches.
- Otherwise, return `ADJ is not available locally and cannot be downloaded`.

The cached branch may differ from the requested branch when offline.

## Other Helpers

- `open_repo` opens the custom or default repository path.
- `list_remote_branches(repo)` queries the default fetch remote and returns sorted short
  branch names, without downloading objects or updating local references. It
  requires remote access and does not fall back to cached branches on failure.
- `branch_exists(repo, name)` uses that listing to check an exact short branch
  name. Query errors are propagated; `false` means a successful query did not
  find the branch, not that the remote was unreachable.

## Limitations

Replacement is intended for startup, before the backend reads ADJ, with one
updater at a time. The backup and installation renames are not jointly atomic
across a process crash. The connectivity probe can succeed when GitHub is
unreachable, or fail when GitHub is reachable.

## Errors

Public helpers return `GitError` with five categories: `Path`, `Repository`,
`Clone`, `Replacement`, and `UnavailableOffline`. `RepositoryError` and
`CloneError` group the concrete `gix` causes inside the corresponding categories.
If rollback fails, `Replacement` also retains the restoration error and backup
path for recovery.

## Verification

Tests use temporary local Git repositories and the Git CLI to create fixtures;
they do not require external network access. Production Git operations use `gix`.

```bash
cargo test -p software-core -F git
cargo doc --open -p software-core -F git --no-deps
```
