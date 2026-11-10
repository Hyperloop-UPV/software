# Logger Module (`logger`)

Everything a recording needs on disk: writing CSV, text and JSON files
without knowing what is in them, moving those files around, and the
snapshot of the machine that produced them.

Deliberately boring, and deliberately small. It knows nothing about the
vehicle — no `model` types, no ADJ, no boards, no session, no notion of a
timestamp or of a log level. Deciding **what** to write, **when**, and
under which name is the job of the backend's own `station::logging`,
which owns the subloggers (data, protections, messages and orders), the
session directory and the hot enable/disable. This module only answers
*"how do I write this file"*.

Everything here blocks. A caller inside a `tokio` task is the one that
decides whether to run it on a thread of its own.

---

## Directory Structure

```
logger/
├── error.rs        # `Error`: one variant per failure, every one naming its file
├── target.rs       # private: the handle discipline the three formats share
├── csv.rs          # `CsvFile`, `Row`  — a CSV file that knows its header
├── text.rs         # `TextFile`        — one line at a time, verbatim
├── json.rs         # `write_json`, `read_json`, `JsonDocument`
├── files.rs        # `files` (feature `files`): copy, move, remove, size
│   └── error.rs    #   its own `Error`, naming both paths when there are two
└── host.rs         # `host` (feature `host`): `HostInfo`, `open_file_limit`
```

Public API, re-exported at the module root: `CsvFile`, `Row`, `TextFile`,
`JsonDocument`, `read_json`, `write_json`, `Error`. The two submodules
stay namespaced (`logger::files`, `logger::host`) because they are used
far less often than the formats and read better qualified.

---

## What It Buys Over Calling `std::fs`

- **Flushing is explicit.** `close` and `flush` return a `Result`. A
  fatal error in the backend ends in `std::process::exit`, which runs no
  destructor, so a file that only flushes when it is dropped loses its
  tail exactly in the case the log was there to explain. `Drop` is kept
  as a courtesy flush that traces its own failure, never as the plan.
  *When* to flush stays the caller's decision, but it doesn't have to
  keep its own tally to make it: every file reports its
  `bytes_since_flush`, so "flush every so many kilobytes, or every so
  often" is a couple of lines over a map of open files.
- **Errors name the file.** A bare `std::io::Error` says what went wrong
  but not where; every `Error` here carries the path or the label of the
  file it happened on.
- **A row can't silently go out of step.** A `CsvFile` knows its header,
  so a row with one field too few is an error, not a file whose columns
  are shifted from that line on.
- **Quoting is done once, here.** A board's free-text message and the
  path it came from can both contain commas, quotes and newlines;
  `Row::text` quotes per RFC 4180. Four subloggers formatting their own
  lines would each get a chance to get that wrong.
- **A row allocates nothing.** Fields are formatted into a buffer the
  file reuses, not into a `Vec<String>` built and thrown away per row —
  at telemetry rates that is tens of thousands of rows a second.

Nothing is traced per row, on purpose: that would be tens of thousands
of events per second. Only opening a file (`debug`), a copy or a move
(`debug`), and a failed flush on drop (`error`) are traced.

---

## `target.rs` — The Shared Handle Discipline

Private, and **not a trait**. `CsvFile` and `TextFile` differ in what
they put *in* a file (columns and quoting versus lines), not in how they
hold one, so the holding lives here once:

| Behaviour | What it means |
| --- | --- |
| `label` | The name the file answers to in every `Error` — its path, or whatever a caller of `new` passed for an in-memory destination. |
| Poisoning | The first failed write or flush poisons the file: every later call returns `Error::Poisoned` instead of appending to something already inconsistent, or repeating the same I/O error once per row. |
| Explicit flush | `flush`/`close` report failure; `bytes_written` and `bytes_since_flush` are the counters a flush policy is built on. |
| Courtesy flush on drop | A file dropped without `close` is flushed best-effort, and a failure is traced (it cannot be returned, and the workspace lints rule out panicking). |

It also owns the two ways a file is opened:

- `create_file` — creates or truncates, creating parent directories,
  behind a `BufWriter` of the default capacity (a bigger buffer is less
  I/O but more lost if the process dies before the next flush, and that
  trade is the caller's).
- `append_file` — opens for appending, creating the file and its parents
  if needed, and reports how many bytes it already held. If that content
  doesn't end in a newline, one is written first, so what gets appended
  starts on its own line. That is the **only** thing looked at: what the
  existing content *says* is never read or checked.

---

## `csv.rs` — `CsvFile` and `Row`

A CSV file written one row at a time, generic over its destination
(`CsvFile<W: Write>`, defaulting to `BufWriter<File>`) so the format can
be exercised against an in-memory buffer.

```rust
use software_core::logger::CsvFile;

let mut csv = CsvFile::create("sessions/13/data/speed.csv", &["t_us", "origin", "value"])?;
csv.row().int(1_250).text("LCU, bay 2").num(53.2).end()?;
csv.flush()?;
csv.close()?;
```

**Constructors:** `create` (truncates, writes the header), `append`
(adds to the end; the header is written only if the file is new or
empty), `new` (wraps an already-open `W` with a label of its own).

**A row:** `row()` starts one, then `int`, `num`, `bool` and `text`
append fields and `end()` validates and writes it. Every field method
keeps the first error it hits and returns `Self`, so a row reads as one
expression without a `?` per field; `end` is where that error — and the
field count — is reported. Nothing reaches the file until `end`, and a
row dropped without it writes nothing, so a row lands whole or not at
all, as a single `write_all`.

**The header is the contract.** With a non-empty header, a row with a
different number of fields is an `Error::FieldCount` and is rejected
whole. An empty header writes no header line and leaves rows unchecked,
for a file whose columns aren't known up front. On `append`, the header
is *not* compared against what the file already holds — it is only taken
as a statement of how many fields a row has. The caller is the one who
knows that the file it opens is the file it thinks it is.

**Formatting:** numbers and booleans are written with their `Display`,
i.e. the shortest form that round-trips (`1.0` is written `1`, and `NaN`,
`inf` and `-inf` are written as such rather than blanked — if a board
sent one, the log should say so). Only `text` can need quoting, and it is
the only one that does any: a field containing `,`, `"`, `\r` or `\n` is
wrapped in double quotes with inner quotes doubled, per RFC 4180. The
header goes through `Row` too, so a column name with a comma in it is
quoted the same way.

**Also on the handle:** `flush`, `close`, `get_ref`, `is_poisoned`,
`label`, `bytes_written`, `bytes_since_flush` (see `target.rs` above).

---

## `text.rs` — `TextFile`

The same vocabulary as `CsvFile` — `create`, `append`, `new`, `flush`,
`close`, `get_ref`, `is_poisoned`, `label`, the byte counters, the same
`Error`, the same poisoning and the same courtesy flush — so there is
nothing to relearn moving between the two. `new` is the one that
differs: it can't fail, because there is no header to write.

`write_line(line)` writes the line and its `\n` as a single write, so a
line lands whole or not at all. What `TextFile` does *not* have is
everything that only means something for columns: no header, no field
count, no quoting. A line is written exactly as given, and a line with a
comma or a quote in it is not special in any way — which also means a
text file can't tell you a line came out malformed. If the content has
fields in it, it wants `CsvFile` instead.

---

## `json.rs` — Documents Written Whole

Two ways in, for two different jobs:

- **One-shot and typed.** `write_json(path, &value)` writes any
  `Serialize` as pretty-printed JSON with a trailing newline, and
  `read_json(path)` parses a whole document back as a `T`. Pretty,
  because these are the files a person opens to find out what a
  recording was.
- **A document that grows.** `JsonDocument` is for the file written when
  a recording starts and added to when it stops: `new`/`open`/
  `open_or_new`, then `set`, `get`, `contains`, `remove`, `properties`,
  `path` and `save`. It is held in memory as a `serde_json::Map`, so
  properties this crate knows nothing about survive the round trip — the
  document is edited, not rebuilt from a struct that would have dropped
  them. `set` returns `&mut Self`, so several can be chained.
  `open_or_new` forgives only a *missing* file; one that exists and is
  broken still errors rather than quietly starting over and overwriting
  it on the next save.

```rust
use software_core::logger::JsonDocument;

let mut session = JsonDocument::new("sessions/13/session.json");
session.set("adj_commit", "4f1c3b0")?.set("time_unit", "us")?;
session.save()?;

// Later, when the recording stops.
let mut session = JsonDocument::open("sessions/13/session.json")?;
session.set("rows", 128_000u64)?.set("stopped", true)?;
session.save()?;
```

**Every save is atomic.** The document is serialized into a `<name>.tmp`
sibling, flushed, `sync_all`ed and then renamed over the destination, so
the file is never seen half-written: either the old contents or the new
ones. That matters more here than anywhere else in the module — a fatal
error in the backend ends in `std::process::exit`, and a session's
metadata truncated at that moment is what makes every CSV next to it
unreadable. The rename needs both files on one filesystem, which they
are by construction, being siblings. Not covered: the directory entry
isn't synced, so a power cut in the instant after the rename can still
lose it.

**Properties come out in alphabetical order**, which is `serde_json`'s
own ordering for an object rather than something imposed here: the same
document always serializes the same way, which is what makes it readable
in a diff.

Nothing is kept open between calls, which is why this file doesn't use
`Target` at all. Reading is in for JSON **only**, and for one reason: a
document that gains properties over time can't be added to without being
read first. A CSV or a text log is appended to and never revisited, and
nothing here will read one back.

---

## `error.rs` — `logger::Error`

One enum for the three formats. `Create`, `Read`, `Parse`,
`NotAnObject`, `Replace` and `Serialize` carry a `PathBuf`, since they
can only happen to a real file on disk; `Write`, `Flush`, `FieldCount`
and `Poisoned` carry a plain `label`, because a `CsvFile` can wrap any
`std::io::Write` and an in-memory buffer has no path.

| Variant | When |
| --- | --- |
| `Create` | The file, or one of its parent directories, couldn't be created. |
| `Write` | A write to the file failed. The file is now poisoned. |
| `Flush` | The buffer couldn't be flushed, so what was written since the last flush may not have reached the disk. |
| `FieldCount` | A row didn't have as many fields as the header declares. Nothing was written. |
| `Poisoned` | An earlier write failed, so the file is no longer written to at all. |
| `Read` | The file couldn't be read (`read_json`, `JsonDocument::open`). |
| `Parse` | Not valid JSON, or a property isn't the type it was asked for. |
| `NotAnObject` | Valid JSON whose root isn't an object, so it has no properties. |
| `Replace` | The finished temporary file couldn't be renamed over its destination. |
| `Serialize` | A value couldn't be serialized as JSON, or its bytes couldn't be written. |

`logger::files` has an `Error` of its own, listed below: a copy that
fails is not a failure of a file this module holds open, and its
variants name two paths rather than one.

---

## `files.rs` — Moving Files Around *(feature `files`)*

Plain `std::fs` with two things added, which is all it is for: the
destination's parent directories get created instead of the operation
failing, and every error names the file — both files, for the operations
that have two.

| Function | Notes |
| --- | --- |
| `copy_file(from, to)` → `u64` | Replaces an existing `to` and returns the bytes copied. **Not atomic**: an interrupted copy leaves a partial file, so a reader that could see the destination mid-copy should be given a finished file under another name and then `move_file`d into place. |
| `copy_dir(from, to)` → `usize` | Recursive, returning how many files were copied. Directories are recreated as needed; a symbolic link is followed and its target copied as a plain file, so the result is real files rather than links pointing back at the original. |
| `move_file(from, to)` | A rename, atomic and free whatever the file's size. Across filesystems — a log directory on a USB stick — a rename is impossible, so it falls back to copy-then-remove, which is neither. |
| `remove_file(path)` | A file that isn't there is an error, as in `std::fs`: the caller is the one who knows whether that was expected. |
| `size(path)` → `u64` | How many bytes the file holds. |

Its `Error` has `Copy`, `Move`, `CreateDir`, `Read` and `Remove`;
`Copy` and `Move` name both paths, since "couldn't copy" without saying
where to leaves the caller with nothing to act on.

This is also what makes `CsvFile` and `JsonDocument` usable on a file
that already exists: copy it, then open the copy and carry on writing.

```rust
use software_core::logger::{CsvFile, files};

files::copy_file("sessions/12/data/speed.csv", "sessions/13/data/speed.csv")?;
let mut speed = CsvFile::append("sessions/13/data/speed.csv", &["t_us", "value"])?;
speed.row().int(1_024).num(37.5).end()?;
speed.close()?;
```

Not wrapped: asking whether a file is there — that is `Path::exists`,
and a wrapper would only add a name to learn. Not here at all: anything
that walks a tree looking for something, rotation, quotas, watching for
changes, and anything asynchronous.

---

## `host.rs` — Who Produced This *(feature `host`)*

`HostInfo::collect()` takes one snapshot of the machine, the user and
the build, meant to be serialized straight into a recording's metadata
so that months later it is still possible to answer *which machine
produced this, running which build, and with whose clock and locale*.

It is part of `logger` because it is part of a recording, but not of how
one is written: this is the **content** of a metadata file, not a way of
putting bytes on a disk. Nothing in `csv`, `text`, `json` or `files`
uses it; they still write files without knowing what is in them.

**Nothing in it fails.** Every field is attempted on its own and left
empty if the system won't say, `collect` returns no `Result` and nothing
panics — a recording must never fail to start over a missing user name.
`Option` fields are skipped when serializing, so an unknown value is
absent from the JSON rather than `null`.

What it reads: `user`, `real_name`, `git_name`, `email`, `host`, `os`,
`arch`, `distro`, `cpus`, `core_version`, `debug_build`, `pid`, `exe`,
`args`, `working_dir`, `timezone`, `locale`, `started_at_unix`,
`open_file_limit`.

Three of those are worth their own note:

- **`email`** is looked for in four places, in order: `user.email` in
  the global git configuration, `$GIT_AUTHOR_EMAIL`, `$EMAIL`, then the
  account name if it happens to look like an address. No operating
  system exposes an email address portably, so git's own identity is
  used instead — reliable on a developer's machine, and the identity the
  person is already known by. The git configuration is only read with
  the `git` feature on (global and system files only, never a
  repository, so the result can't depend on which directory the backend
  was started from); without it, the environment variables are all that
  is left.
- **`timezone`** is a zone *name* (`Europe/Madrid`), not an offset,
  because the offset depends on the date and a recording may straddle
  the day summer time changes. It comes from `$TZ`, or from the target
  of the `/etc/localtime` link. It is worth more than it looks:
  protections and messages carry a time of day with no date or zone, so
  without the recording machine's zone they can't be placed on a real
  timeline or lined up against video.
- **`open_file_limit`** is also a free function,
  `host::open_file_limit()`, worth calling before opening a file per
  measurement: the soft limit is **256** by default on macOS and usually
  1024 on Linux, and past it opening a file starts failing in the middle
  of a recording, which looks like a disk problem and isn't one. `None`
  on Windows, honestly rather than as a failure — it has no equivalent
  limit for the handles `std::fs::File` uses.

`HostInfo::without_identity()` returns the same snapshot with the user
name, real name, git name, email and machine name removed, for a
recording that is going to be shared outside the team.

`HostInfo` is `Serialize` only, on purpose: reading one back is reading
JSON, not rebuilding this struct, and a field like `os` is a
compile-time constant of the build that wrote it rather than something
to parse. Deliberately absent: free disk space and memory (another
dependency, and the disk is better checked by whoever is about to fill
it), the battery, and the network interfaces the backend bound to —
that last one belongs to whatever opened the sockets, the only thing
that actually knows.

---

## Features

| Feature | Enables | Dependencies |
| --- | --- | --- |
| `logger` | `CsvFile`, `TextFile`, the JSON API, `Error` | none beyond the crate's own `serde`/`serde_json`/`tracing` |
| `files` | `logger::files` (implies `logger`) | none of its own |
| `host` | `logger::host` (implies `logger`) | `whoami`, plus `rlimit` on unix |

`files` and `host` are separate features because neither is needed to
write a file: a tool that only wants to put CSV rows on a disk shouldn't
have to take `whoami` with it. With the `git` feature also on,
`HostInfo` fills in the git identity as described above.

---

## Why There Is No Trait Over The Three Formats

What the formats share is how a file is **held**, and that is
`target.rs`. What they don't share is how a file is **written**, because
it genuinely isn't the same operation: a CSV row is typed fields
validated against a header, a text line is a string taken verbatim, and
a JSON document is a whole value serialized in one go with no handle to
keep. That is why `CsvFile` and `TextFile` expose the same vocabulary
while `write_json` stays a free function.

A trait would only pay for itself once some caller needs to be generic
over the format — the same code path writing either CSV or JSON lines,
say — and no caller does today. Reaching for one now would mean either
flattening the API down to "write these bytes", which throws away the
field validation and the quoting that are the point, or inventing an
open/write/close lifecycle for JSON that it doesn't have. Adding the
trait later is backwards compatible, so it can wait for the second
caller.

---

## Not Here, On Purpose

Reading a CSV or a text log back, sessions, timestamps, file rotation,
quotas, keeping a registry of many open files (a `HashMap<K, CsvFile>`
with `entry().or_insert_with(...)` in the caller is shorter and clearer
than anything this module could wrap it in), and anything asynchronous.

---

## Verification

```bash
cargo test -p software-core -F logger,files,host
cargo clippy -p software-core --features logger,files,host --all-targets -- -D warnings
cargo doc --open -p software-core -F logger,files,host --no-deps
```

The tests write into temporary directories (`tempfile`, a dev
dependency) and against in-memory buffers; none of them needs a network
or a real session directory.
