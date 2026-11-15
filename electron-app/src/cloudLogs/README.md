# Cloud Logs integration

Desktop service shared by Logging View and Testing View via
`window.electronAPI.cloudLogs`. The typed contract is exported from
`@hyperloopupv/frontend-kit/core` (`CloudLogsAPI`). React never imports Node code.

## File map

| File                        | Responsibility                                                                                                                                                                                              | Change it when…                                                                              |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `client.js`                 | The remote HTTP adapter. Defines list, tag suggestions, upload, and ZIP download functions; currently these are explicit not-connected placeholders.                                                        | Implementing API endpoints, authentication, pagination, request fields, or response mapping. |
| `credentials.js`            | Reads, writes, encrypts, and clears the Cloud Logs user and API key. Only credential status is returned to the renderer.                                                                                    | Changing credential persistence, secure-storage policy, or validation.                       |
| `sessions.js`               | Resolves the configured `logger/` root, creates `cloud-logs/`, scans local launch folders, and validates a recording using its `logger_settings.json`.                                                      | Changing how backend recordings are laid out or what qualifies as a session.                 |
| `archive.js`                | Zips every regular file inside one recording and safely extracts downloaded archives. Reports compression and extraction progress.                                                                          | Changing archive layout, ZIP safety checks, limits, or progress.                             |
| `handlers.js`               | Connects renderer IPC calls to credentials, session discovery, archive operations, and the remote adapter. Checks the calling window, owns local path grants, scopes progress, and removes temporary files. | Adding renderer operations, changing authorization, or coordinating uploads and downloads.   |
| `__tests__/storage.test.js` | Tests local session discovery, ZIP round trips and safety, arbitrary logger subfolders, and credential storage using temporary files. It does not call the remote API.                                      | Adding regression coverage for session storage, ZIP handling, or credentials.                |
| `README.md`                 | This module guide and API handoff contract.                                                                                                                                                                 | Updating module behavior or integration instructions.                                        |

Related bridge files live outside this directory: `electron-app/preload.js`
exposes `window.electronAPI.cloudLogs`; `frontend/frontend-kit/kit/src/core/cloudLogs.ts`
defines the shared TypeScript contract; and
`frontend/logging-view/src/components/cloudLogs/CloudLogsDialog.tsx` implements
the Logging View dialog. Testing View can use the same preload bridge and types.

## Remote API: teammate handoff

**Only `client.js` is a placeholder.** Implement its four async functions:

| Function           | Input                                       | Result                                         |
| ------------------ | ------------------------------------------- | ---------------------------------------------- |
| `listLogs`         | credentials, optional cursor                | `{ items: CloudLog[], nextCursor?: string }`   |
| `autocompleteTags` | credentials, query (including empty string) | `string[]`                                     |
| `uploadLog`        | credentials, archivePath, metadata          | confirmed `CloudLog`                           |
| `downloadLog`      | credentials, id, destination, maxBytes      | resolves after ZIP is fully written and closed |

`CloudLog` has `{ id, user, notes, tags: string[], date }`. Normalize the remote
API's response to this contract; for example map a `description` field to `notes`.
The log date is the original `logger_settings.json.date`, not the upload date.
It may have the backend's `YYYY-MM-DDTHH-mm-ss` format; document any conversion
required by the remote API without inventing a timezone for these local dates.

Supply the endpoint URLs and authentication header/form fields according to the
real API contract; none are assumed here. Validate responses, bound request time,
and return useful sanitized errors (no API key, headers or raw request dumps).
Stream files instead of loading entire ZIPs into RAM. Enforce `maxBytes` while
downloading, even without Content-Length. Never forward authentication headers
to unrelated download/redirect origins. Do not blindly retry uploads unless the
API supports idempotency.

The stubs deliberately reject with an explicit "API is not connected" error.
There are no fake tags, cloud records or successful uploads. With configured
credentials, pressing upload really compresses the session and reports progress,
then reaches the upload stub. Temporary ZIPs are removed even on failure.

## Local service (implemented)

- Local discovery: `<logging_path>/logger/<app-launch>/<recording>/`.
- Native folder selection also permits recordings outside that root. The main
  process gives the renderer an opaque token scoped to its window, not a generic
  "upload any path" API.
- One recording per ZIP. `logger_settings.json` stays at the ZIP root, and every
  regular file inside that recording is included, even in unrecognized or future
  subfolders such as `orders/`, `protections/`, and `other/`. The parent app
  launch folder is never archived. The local `cloud-log.json` download marker is
  excluded. Upload only stopped recordings; compression rejects files whose
  size/mtime or membership changes during archiving.
- Upload ZIPs are created as `session.zip` inside an OS temporary directory named
  `cloud-logs-upload-*` (under Node's `os.tmpdir()`). Electron deletes that
  directory after the upload completes or fails; the ZIP is not retained.
- `logger/cloud-logs/` is created on first use, also with the Go backend stopped.
  Paths resolve against the same backend working directory and `logging_path`.
  `others/` remains inside each app launch, not beside the launch folders.
- Downloads extract into a private `.download-*` staging directory. After
  validation they are renamed into `cloud-logs/<sha256(remote-id)>/`. Hashing the
  ID avoids platform-invalid names and collisions from sanitizing IDs.
- The downloaded ZIP is temporarily named `session.zip` inside that staging
  directory. After extraction succeeds or fails, Electron removes the staging
  directory and ZIP; only the validated extracted session is kept.
- `cloud-log.json` stores the original ID and date beside the extracted session.
  Repeated downloads reuse a valid local copy. Staging files are removed on error;
  incomplete directories are excluded from the offline library.
- Extraction rejects traversal, symlinks, encrypted archives, duplicate file
  entries and oversized archives. It accepts arbitrary regular files in a
  downloaded recording so future logger subfolders remain usable. Limits: 4 GiB
  and 10,000 entries.
- Progress is scoped by requestId and sent only to the requesting window.
  Compression and extraction report file progress; network phases are
  indeterminate. One transfer at a time across the desktop app. The dialog stays
  open during transfers; closing the application still interrupts them.

## Credentials

`<Electron userData>/cloud-logs.json` holds the user and encrypted API key. With
no secure OS storage (including Linux `basic_text`/`unknown`), only the user is
persisted; the key stays in process memory. No key is returned to React. Blank
key on save preserves the current key; removing credentials requires the
explicit Remove action. Credentials updates are serialized across windows.

## UI and future consumers

Logging View's sidebar opens Library / Upload / Credentials. Tags are fetched
with a debounced API search. Recording date is read-only and comes from the
selected recording. Downloads open through the existing session-folder loader,
so CSV parsing, charts and recent sessions keep the same behavior. In a browser
without Electron the dialog explains that desktop integration is required.

Testing View can call the same bridge; its global interface already includes
`cloudLogs`. No backend lifecycle changes are required for cloud operations.

Run `pnpm --dir electron-app test -- src/cloudLogs/__tests__` and the Logging
View build/lint. The tests use real temporary files and ZIPs, mocked credentials
storage and no remote network.
