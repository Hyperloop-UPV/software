# ADJ Git helpers

This module provides Git utilities used to manage the local **ADJ** repository.

The implementation uses [`gix`](https://crates.io/crates/gix) exclusively and supports both online and offline operation. The public API returns errors to the caller instead of terminating the process, and the test suite does not require external network access.

## Workflow

The main workflow is handled by `update_adj`.

### Repository path

The ADJ repository path is resolved using `resolve_adj_path`.

If a custom path is provided, it is used as the parent directory of the `adj` repository. Otherwise, the module uses:

1. `$XDG_CACHE_HOME`, if available.
2. `$HOME/.cache` as fallback.

The resulting repository path is:

```text
<base>/adj
```

### Connectivity

Before updating the repository, `check_internet_connection` determines whether online operations are available.

The check performs a TCP connection to `1.1.1.1:443` with a 3-second timeout. It is only used to select between online and offline operation and does not perform any Git request.

### Repository update

If the local ADJ repository does not exist:

- **Online:** the repository is cloned into `<base>/adj`.
- **Offline:** the operation returns a `NotFound` error.

If the repository already exists, it is opened using `gix`.

The requested branch is then processed by `checkout::switch_and_update_adj`.

### Online mode

When a network connection is available, the requested branch is fetched from `origin`.

The module:

- Fetches only the requested branch.
- Requires the branch to exist remotely.
- Updates the local branch using fast-forward when possible.
- Rejects diverged branches instead of overwriting local history.
- Updates the working tree, index and `HEAD` when required.

A fetch error is returned directly and does not automatically fall back to offline mode.

### Offline mode

When operating offline, no remote Git operations are performed.

The module first tries to use the local branch. If it does not exist, it can create it from the cached `origin/<branch>` reference.

If neither reference exists, the operation returns `NotFound`.

Local commits that are ahead of the cached remote branch are never overwritten.

## Repository checks

Before changing branches or updating the checkout, the module verifies that the repository is in a safe state.

Operations are rejected when there are:

- Local modifications.
- Untracked or ignored files.
- Unsupported sparse or special index states.
- Busy or linked worktrees.

A working tree is required for checkout operations.

## Additional helpers

### `branch_commit_info`

Returns the commit ID and full commit message of a local branch.

This operation is read-only and does not:

- Fetch from the network.
- Fall back to `origin/<branch>`.
- Modify the checkout.

It can also be used when the working tree contains local changes.

### `list_remote_branches`

Queries `origin` and returns the available remote branch names.

The result:

- Contains short branch names.
- Is sorted.
- Excludes tags and local-only references.
- Does not fetch repository objects.

The operation returns an error if `origin` is missing or unreachable.

## Implementation

Git operations are implemented using the [`gix`](https://crates.io/crates/gix) crate with its blocking HTTPS transport.

When Git identity information is required for reflog entries and no user identity is configured, the module uses an in-memory fallback:

```text
user.name = ADJ backend
user.email = adj@localhost
```

This fallback is not written to the user's Git configuration.

## Notes

Some filesystem, index and reflog operations cannot be guaranteed to be jointly atomic in every failure scenario.

A checkout error may therefore leave part of the working tree updated. Callers should always propagate and handle errors returned by this module.

## Documentation

The module documentation can be generated and opened with:

```bash
cargo doc --open -p software-core -F git --no-deps
```