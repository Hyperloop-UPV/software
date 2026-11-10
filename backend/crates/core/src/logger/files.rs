//! Copying, moving and removing files.
//!
//! Plain [`std::fs`] with two things added, which is all this is for:
//! the destination's parent directories get created instead of the
//! operation failing, and every error names the file — both files, for
//! the operations that have two — which is what makes it actionable by
//! the time it has travelled up to whoever decides what to do about it.
//!
//! No dependencies, on purpose: a tool that wants to copy a file
//! shouldn't have to take anything else with it.
//!
//! Copying is also what makes the types in [`crate::logger`] usable on a
//! file that already exists: copy it, then open the copy and carry on
//! writing to it.
//!
//! ```no_run
//! use software_core::logger::files;
//! use software_core::logger::{CsvFile, JsonDocument};
//!
//! // A recording that starts from the previous session's layout.
//! files::copy_file("sessions/12/session.json", "sessions/13/session.json")?;
//!
//! let mut session = JsonDocument::open("sessions/13/session.json")?;
//! session.set("started", true)?;
//! session.save()?;
//!
//! // And a CSV that is continued rather than started over.
//! files::copy_file("sessions/12/data/speed.csv", "sessions/13/data/speed.csv")?;
//! let mut speed = CsvFile::append("sessions/13/data/speed.csv", &["t_us", "value"])?;
//! speed.row().int(1_024).num(37.5).end()?;
//! speed.close()?;
//! # Ok::<(), Box<dyn std::error::Error>>(())
//! ```
//!
//! Not wrapped: asking whether a file is there. That is
//! [`std::path::Path::exists`], and a wrapper around it would only add a
//! name to learn.
//!
//! Not here at all: anything that walks a tree looking for something,
//! rotation, quotas, watching for changes, and anything asynchronous. A
//! recording copies a handful of files at the start and at the end; when
//! that stops being true, whatever needs more can say so then.

mod error;

pub use error::Error;

use std::fs;
use std::path::Path;
use tracing::debug;

/// Copies `from` over `to`, creating `to`'s parent directories, and
/// returns how many bytes were copied.
///
/// An existing `to` is replaced. The copy is not atomic: an interrupted
/// copy leaves a partial file behind, so a reader that could see the
/// destination mid-copy should be given a finished file under a
/// different name and then [`move_file`]d into place.
///
/// # Example
///
/// ```no_run
/// use software_core::logger::files;
///
/// let bytes = files::copy_file("settings.json", "backup/settings.json")?;
/// # Ok::<(), software_core::logger::files::Error>(())
/// ```
pub fn copy_file(from: impl AsRef<Path>, to: impl AsRef<Path>) -> Result<u64, Error> {
    let (from, to) = (from.as_ref(), to.as_ref());
    create_parents(to)?;

    let bytes = fs::copy(from, to).map_err(|source| Error::Copy {
        from: from.to_path_buf(),
        to: to.to_path_buf(),
        source,
    })?;

    debug!(from = %from.display(), to = %to.display(), bytes, "file copied");
    Ok(bytes)
}

/// Copies everything under `from` into `to`, recursively, and returns
/// how many files were copied.
///
/// Directories are recreated as needed; existing files in `to` are
/// replaced. A symbolic link is followed and its target copied as a
/// plain file, so the result is a directory of real files rather than a
/// tree of links pointing back at the original.
pub fn copy_dir(from: impl AsRef<Path>, to: impl AsRef<Path>) -> Result<usize, Error> {
    let (from, to) = (from.as_ref(), to.as_ref());
    let copied = copy_dir_inner(from, to)?;

    debug!(from = %from.display(), to = %to.display(), files = copied, "directory copied");
    Ok(copied)
}

/// The recursive half of [`copy_dir`], without the event per level.
fn copy_dir_inner(from: &Path, to: &Path) -> Result<usize, Error> {
    fs::create_dir_all(to).map_err(|source| Error::CreateDir {
        path: to.to_path_buf(),
        source,
    })?;

    let entries = fs::read_dir(from).map_err(|source| Error::Read {
        path: from.to_path_buf(),
        source,
    })?;

    let mut copied = 0;
    for entry in entries {
        let entry = entry.map_err(|source| Error::Read {
            path: from.to_path_buf(),
            source,
        })?;

        let source_path = entry.path();
        let destination = to.join(entry.file_name());

        // `file_type` is the entry's own kind, so a link to a directory
        // is not a directory here; `metadata` below follows it.
        let kind = entry.file_type().map_err(|source| Error::Read {
            path: source_path.clone(),
            source,
        })?;

        let is_dir = if kind.is_symlink() {
            fs::metadata(&source_path)
                .map_err(|source| Error::Read {
                    path: source_path.clone(),
                    source,
                })?
                .is_dir()
        } else {
            kind.is_dir()
        };

        if is_dir {
            copied += copy_dir_inner(&source_path, &destination)?;
        } else {
            fs::copy(&source_path, &destination).map_err(|source| Error::Copy {
                from: source_path.clone(),
                to: destination.clone(),
                source,
            })?;
            copied += 1;
        }
    }

    Ok(copied)
}

/// Moves `from` to `to`, creating `to`'s parent directories.
///
/// A rename when both paths are on the same filesystem, which is atomic
/// and costs nothing whatever the file's size. When they are not — a log
/// directory on a USB stick, say — a rename can't be done at all, so the
/// file is copied and the original removed, which is neither atomic nor
/// free.
pub fn move_file(from: impl AsRef<Path>, to: impl AsRef<Path>) -> Result<(), Error> {
    let (from, to) = (from.as_ref(), to.as_ref());
    create_parents(to)?;

    match fs::rename(from, to) {
        Ok(()) => {
            debug!(from = %from.display(), to = %to.display(), "file moved");
            Ok(())
        }
        Err(source) if source.kind() == std::io::ErrorKind::CrossesDevices => {
            copy_file(from, to)?;
            remove_file(from)?;
            debug!(
                from = %from.display(),
                to = %to.display(),
                "file moved across filesystems by copying"
            );
            Ok(())
        }
        Err(source) => Err(Error::Move {
            from: from.to_path_buf(),
            to: to.to_path_buf(),
            source,
        }),
    }
}

/// Removes the file at `path`.
///
/// A file that isn't there is an error, like it is in [`std::fs`]: the
/// caller is the one who knows whether that was expected.
pub fn remove_file(path: impl AsRef<Path>) -> Result<(), Error> {
    let path = path.as_ref();

    fs::remove_file(path).map_err(|source| Error::Remove {
        path: path.to_path_buf(),
        source,
    })?;

    debug!(path = %path.display(), "file removed");
    Ok(())
}

/// How many bytes the file at `path` holds.
pub fn size(path: impl AsRef<Path>) -> Result<u64, Error> {
    let path = path.as_ref();

    let metadata = fs::metadata(path).map_err(|source| Error::Read {
        path: path.to_path_buf(),
        source,
    })?;

    Ok(metadata.len())
}

/// Creates the directories a file is going to live in.
fn create_parents(path: &Path) -> Result<(), Error> {
    let Some(parent) = path.parent() else {
        return Ok(());
    };

    // An empty parent is what `Path::parent` gives for a bare file name:
    // the current directory, which already exists.
    if parent.as_os_str().is_empty() {
        return Ok(());
    }

    fs::create_dir_all(parent).map_err(|source| Error::CreateDir {
        path: parent.to_path_buf(),
        source,
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    type TestResult<T = ()> = Result<T, Box<dyn std::error::Error + Send + Sync>>;

    #[test]
    fn copying_creates_the_directories_the_destination_needs() -> TestResult {
        let temp = tempfile::tempdir()?;
        let from = temp.path().join("settings.json");
        let to = temp.path().join("backup/2026/settings.json");
        fs::write(&from, "{}\n")?;

        let bytes = copy_file(&from, &to)?;

        assert_eq!(bytes, 3);
        assert_eq!(fs::read_to_string(&to)?, "{}\n");
        Ok(())
    }

    #[test]
    fn copying_over_an_existing_file_replaces_it() -> TestResult {
        let temp = tempfile::tempdir()?;
        let from = temp.path().join("new.csv");
        let to = temp.path().join("old.csv");
        fs::write(&from, "new\n")?;
        fs::write(&to, "a much longer old file\n")?;

        copy_file(&from, &to)?;

        assert_eq!(fs::read_to_string(&to)?, "new\n");
        Ok(())
    }

    #[test]
    fn a_failed_copy_names_both_paths() -> TestResult {
        let temp = tempfile::tempdir()?;
        let from = temp.path().join("missing.csv");
        let to = temp.path().join("copy.csv");

        let Err(error) = copy_file(&from, &to) else {
            unreachable!("the source was never written");
        };

        let Error::Copy {
            from: named_from,
            to: named_to,
            ..
        } = &error
        else {
            unreachable!("a failed copy is an Error::Copy, got {error:?}");
        };
        assert_eq!(named_from, &from);
        assert_eq!(named_to, &to);
        Ok(())
    }

    #[test]
    fn copying_a_directory_walks_into_its_subdirectories() -> TestResult {
        let temp = tempfile::tempdir()?;
        let from = temp.path().join("session");
        let to = temp.path().join("copy");
        fs::create_dir_all(from.join("data/lcu"))?;
        fs::write(from.join("session.json"), "{}\n")?;
        fs::write(from.join("data/lcu/speed.csv"), "t,value\n")?;
        fs::write(from.join("data/lcu/current.csv"), "t,value\n")?;

        let copied = copy_dir(&from, &to)?;

        assert_eq!(copied, 3);
        assert_eq!(fs::read_to_string(to.join("session.json"))?, "{}\n");
        assert_eq!(
            fs::read_to_string(to.join("data/lcu/speed.csv"))?,
            "t,value\n"
        );
        Ok(())
    }

    #[test]
    fn copying_a_directory_that_is_not_there_names_it() -> TestResult {
        let temp = tempfile::tempdir()?;
        let from = temp.path().join("not-a-session");

        let Err(error) = copy_dir(&from, temp.path().join("copy")) else {
            unreachable!("that directory was never created");
        };

        assert!(matches!(&error, Error::Read { path, .. } if path == &from));
        Ok(())
    }

    #[test]
    fn moving_leaves_nothing_behind() -> TestResult {
        let temp = tempfile::tempdir()?;
        let from = temp.path().join("session.json");
        let to = temp.path().join("done/session.json");
        fs::write(&from, "{}\n")?;

        move_file(&from, &to)?;

        assert!(!from.exists());
        assert_eq!(fs::read_to_string(&to)?, "{}\n");
        Ok(())
    }

    #[test]
    fn size_and_remove_report_which_file_was_missing() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("data.csv");
        fs::write(&path, "t,value\n")?;

        assert_eq!(size(&path)?, 8);
        remove_file(&path)?;

        let Err(error) = size(&path) else {
            unreachable!("the file was just removed");
        };
        assert!(matches!(&error, Error::Read { path: named, .. } if named == &path));

        let Err(error) = remove_file(&path) else {
            unreachable!("the file was just removed");
        };
        assert!(matches!(&error, Error::Remove { path: named, .. } if named == &path));
        Ok(())
    }

    #[test]
    fn a_bare_file_name_has_no_directory_to_create() -> TestResult {
        // `Path::parent` of a bare name is an empty path, which must not
        // reach `create_dir_all` — it would fail, and the directory the
        // file is going into (the current one) is already there.
        create_parents(Path::new("bare.txt"))?;
        Ok(())
    }
}
