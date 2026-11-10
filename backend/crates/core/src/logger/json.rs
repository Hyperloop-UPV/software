//! JSON documents: written whole, read back whole, and updated by
//! being replaced.
//!
//! Two ways in, for two different jobs. [`write_json`] and [`read_json`]
//! are one-shot and typed: the caller has a type for the whole document
//! and hands it over, or gets it back. [`JsonDocument`] is for the file
//! that gains properties over time — a recording's metadata, written
//! when it starts and added to when it stops — which has to be read
//! before it can be added to, and whose properties this crate knows
//! nothing about have to survive the round trip all the same.
//!
//! Reading is deliberate here and nowhere else in the module: a JSON
//! document is small, whole and structured, so reading it back to change
//! it is the only way to change it. A CSV or a text log is appended to,
//! never revisited, and nothing here will read one back.
//!
//! None of this keeps a file open between calls, which is why nothing
//! here uses the `Target` that `csv` and `text` are built on: a document
//! lives in memory, and getting it onto the disk is one atomic
//! replacement, the same one [`write_json`] performs.

use super::Error;
use super::target::create_file;
use serde::Serialize;
use serde::de::DeserializeOwned;
use serde_json::{Map, Value};
use std::ffi::OsString;
use std::fs;
use std::io::Write;
use std::path::{Path, PathBuf};
use tracing::debug;

/// Writes `value` to `path` as pretty-printed JSON, creating its parent
/// directories and replacing whatever was there.
///
/// Pretty-printed, with a trailing newline, because these are the files
/// a person opens to find out what a recording was: a session's
/// metadata, the ADJ commit it ran against, a dump of the configuration
/// in use. Anything appended to over time wants a CSV
/// ([`super::CsvFile`]) instead — this function writes the file once and
/// closes it.
///
/// Written through a temporary file next to the destination, flushed to
/// the disk and then renamed over it, so `path` is never seen
/// half-written: either the old contents or the new ones, nothing in
/// between. That matters more here than anywhere else in this module —
/// a fatal error in the backend ends in `std::process::exit`, and a
/// session's metadata truncated at that moment is what makes every CSV
/// next to it unreadable. The rename needs both files on the same
/// filesystem, which they are by construction, being siblings. What
/// isn't covered: the directory entry itself isn't synced, so a power
/// cut in the instant after the rename can still lose it — surviving
/// that would mean syncing the directory too, which isn't worth it for
/// what this writes.
///
/// # Example
///
/// ```
/// use software_core::logger::write_json;
/// use std::collections::BTreeMap;
///
/// let path = std::env::temp_dir().join("software-core-logger-doc/write.json");
/// let settings = BTreeMap::from([("adj_commit", "4f1c3b0"), ("time_unit", "us")]);
///
/// write_json(&path, &settings)?;
///
/// assert_eq!(
///     std::fs::read_to_string(&path)?,
///     "{\n  \"adj_commit\": \"4f1c3b0\",\n  \"time_unit\": \"us\"\n}\n",
/// );
/// # std::fs::remove_file(&path)?;
/// # Ok::<(), Box<dyn std::error::Error>>(())
/// ```
pub fn write_json<T>(path: impl AsRef<Path>, value: &T) -> Result<(), Error>
where
    T: Serialize + ?Sized,
{
    let path = path.as_ref();
    let temporary = temporary_path(path);

    // Anything that fails from here on leaves the destination untouched,
    // so the temporary file is cleaned up and the error is about `path`,
    // which is the file the caller asked for and the only one it knows.
    match build(&temporary, path, value) {
        Ok(()) => {}
        Err(error) => {
            // Best effort: the write already failed, and failing to
            // remove the leftover is not what the caller needs to hear.
            let _ = fs::remove_file(&temporary);
            return Err(error);
        }
    }

    fs::rename(&temporary, path).map_err(|source| Error::Replace {
        path: path.to_path_buf(),
        source,
    })?;

    debug!(path = %path.display(), "json file written");
    Ok(())
}

/// Serializes `value` into `temporary` and gets it onto the disk, with
/// every error reported against `path`, the destination it is about to
/// be renamed to.
fn build<T>(temporary: &Path, path: &Path, value: &T) -> Result<(), Error>
where
    T: Serialize + ?Sized,
{
    // `create_file` reports the file it actually tried to make: the
    // temporary one, which the caller never named. Every error out of
    // here is about the destination, so put its path back.
    let mut writer = create_file(temporary).map_err(|error| match error {
        Error::Create { source, .. } => Error::Create {
            path: path.to_path_buf(),
            source,
        },
        other => other,
    })?;

    serde_json::to_writer_pretty(&mut writer, value).map_err(|source| Error::Serialize {
        path: path.to_path_buf(),
        source,
    })?;

    // `to_writer_pretty` leaves no terminator: add one so the file reads
    // well with `cat` and behaves for anything line-oriented.
    writer.write_all(b"\n").map_err(|source| Error::Write {
        label: path.display().to_string(),
        source,
    })?;

    // The buffer is dropped with this function, and a drop swallows the
    // flush error — so flush here, where it can still be reported.
    writer.flush().map_err(|source| Error::Flush {
        label: path.display().to_string(),
        source,
    })?;

    // Flushing only hands the bytes to the operating system. Syncing
    // before the rename is what makes the swap meaningful: otherwise the
    // rename can be on the disk while the contents it points at are
    // still only in the page cache. Affordable here, where it happens
    // once per file, in a way it wouldn't be per CSV row.
    writer.get_ref().sync_all().map_err(|source| Error::Flush {
        label: path.display().to_string(),
        source,
    })
}

/// The temporary name a document is built under: the destination's own
/// name plus `.tmp`, so it lands in the same directory — and therefore
/// the same filesystem, which [`fs::rename`] needs to be atomic.
fn temporary_path(path: &Path) -> PathBuf {
    let mut name = OsString::from(path);
    name.push(".tmp");
    PathBuf::from(name)
}

/// Reads `path` and parses the whole document as `T`.
///
/// The counterpart of [`write_json`], for a document whose shape the
/// caller has a type for. To read one property out of a document, or to
/// add properties to it, use [`JsonDocument`] instead.
///
/// # Example
///
/// ```
/// use software_core::logger::{read_json, write_json};
/// use std::collections::BTreeMap;
///
/// let path = std::env::temp_dir().join("software-core-logger-doc/read.json");
/// let written = BTreeMap::from([("time_unit".to_string(), "us".to_string())]);
/// write_json(&path, &written)?;
///
/// let read: BTreeMap<String, String> = read_json(&path)?;
/// assert_eq!(read, written);
/// # std::fs::remove_file(&path)?;
/// # Ok::<(), Box<dyn std::error::Error>>(())
/// ```
pub fn read_json<T>(path: impl AsRef<Path>) -> Result<T, Error>
where
    T: DeserializeOwned,
{
    let path = path.as_ref();
    let text = read_text(path)?;

    serde_json::from_str(&text).map_err(|source| Error::Parse {
        path: path.to_path_buf(),
        source,
    })
}

/// A JSON object held in memory, together with the file it came from.
///
/// For the document that is added to over time instead of written once:
/// open it, set the properties that are known now, save, and later open
/// it again and set the ones that weren't. Properties nobody here knows
/// about are kept as they were — the document is edited, not rebuilt
/// from a struct that would have dropped them.
///
/// Changes stay in memory until [`JsonDocument::save`], which replaces
/// the file atomically. Nothing is held open in between, so a document
/// can be opened, saved and forgotten without any flushing discipline.
///
/// Properties come out in alphabetical order, which is `serde_json`'s
/// own ordering for an object and not something this type imposes: the
/// same document always serializes the same way, which is what makes it
/// readable in a diff.
///
/// # Example
///
/// ```
/// use software_core::logger::JsonDocument;
///
/// let path = std::env::temp_dir().join("software-core-logger-doc/document.json");
///
/// let mut session = JsonDocument::new(&path);
/// session
///     .set("adj_commit", "4f1c3b0")?
///     .set("time_unit", "us")?;
/// session.save()?;
///
/// // Later, when the recording stops, by whoever has the path.
/// let mut session = JsonDocument::open(&path)?;
/// session.set("rows", 128_000u64)?.set("stopped", true)?;
/// session.save()?;
///
/// let session = JsonDocument::open(&path)?;
/// assert_eq!(session.get::<String>("adj_commit")?.as_deref(), Some("4f1c3b0"));
/// assert_eq!(session.get::<u64>("rows")?, Some(128_000));
/// # std::fs::remove_file(&path)?;
/// # Ok::<(), Box<dyn std::error::Error>>(())
/// ```
#[derive(Debug, Clone)]
pub struct JsonDocument {
    path: PathBuf,
    properties: Map<String, Value>,
}

impl JsonDocument {
    /// An empty document for `path`, which isn't touched until
    /// [`JsonDocument::save`].
    pub fn new(path: impl Into<PathBuf>) -> Self {
        Self {
            path: path.into(),
            properties: Map::new(),
        }
    }

    /// Reads the document at `path`.
    ///
    /// Errors if the file isn't there ([`Error::Read`]), isn't valid
    /// JSON ([`Error::Parse`]), or is valid JSON whose root isn't an
    /// object and therefore has no properties
    /// ([`Error::NotAnObject`]). Use [`JsonDocument::open_or_new`] when
    /// a missing file just means there is nothing in it yet.
    pub fn open(path: impl Into<PathBuf>) -> Result<Self, Error> {
        let path = path.into();
        let text = read_text(&path)?;

        let value: Value = serde_json::from_str(&text).map_err(|source| Error::Parse {
            path: path.clone(),
            source,
        })?;

        match value {
            Value::Object(properties) => Ok(Self { path, properties }),
            _ => Err(Error::NotAnObject { path }),
        }
    }

    /// Like [`JsonDocument::open`], but a file that isn't there yet
    /// gives an empty document instead of an error.
    ///
    /// Only a missing file is forgiven: one that exists and is broken
    /// still errors, rather than quietly starting over and overwriting
    /// it on the next save.
    pub fn open_or_new(path: impl Into<PathBuf>) -> Result<Self, Error> {
        let path = path.into();

        match Self::open(&path) {
            Err(Error::Read { source, .. }) if source.kind() == std::io::ErrorKind::NotFound => {
                Ok(Self::new(path))
            }
            other => other,
        }
    }

    /// Sets `key`, replacing whatever was there.
    ///
    /// Takes anything serializable, so a property can be a number, a
    /// string, a list or a whole struct. Returns `&mut Self` so several
    /// can be chained: `doc.set("a", 1)?.set("b", 2)?;`.
    pub fn set(
        &mut self,
        key: impl Into<String>,
        value: impl Serialize,
    ) -> Result<&mut Self, Error> {
        let value = serde_json::to_value(value).map_err(|source| Error::Serialize {
            path: self.path.clone(),
            source,
        })?;

        self.properties.insert(key.into(), value);
        Ok(self)
    }

    /// Reads `key` as `T`, or `None` if the document has no such
    /// property.
    ///
    /// Errors with [`Error::Parse`] if the property is there but isn't a
    /// `T`.
    pub fn get<T>(&self, key: &str) -> Result<Option<T>, Error>
    where
        T: DeserializeOwned,
    {
        let Some(value) = self.properties.get(key) else {
            return Ok(None);
        };

        serde_json::from_value(value.clone())
            .map(Some)
            .map_err(|source| Error::Parse {
                path: self.path.clone(),
                source,
            })
    }

    /// Whether the document has a `key` property.
    pub fn contains(&self, key: &str) -> bool {
        self.properties.contains_key(key)
    }

    /// Removes `key`, reporting whether it was there.
    pub fn remove(&mut self, key: &str) -> bool {
        self.properties.remove(key).is_some()
    }

    /// Every property, as they will be written.
    pub fn properties(&self) -> &Map<String, Value> {
        &self.properties
    }

    /// The file this document is read from and saved to.
    pub fn path(&self) -> &Path {
        &self.path
    }

    /// Writes the document back, replacing the file atomically.
    pub fn save(&self) -> Result<(), Error> {
        write_json(&self.path, &self.properties)
    }
}

/// Reads a whole file as text, naming it in the error.
fn read_text(path: &Path) -> Result<String, Error> {
    fs::read_to_string(path).map_err(|source| Error::Read {
        path: path.to_path_buf(),
        source,
    })
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde::Serializer;
    use std::collections::BTreeMap;
    use std::fs;

    type TestResult<T = ()> = Result<T, Box<dyn std::error::Error + Send + Sync>>;

    fn settings() -> BTreeMap<String, String> {
        BTreeMap::from([
            ("adj_commit".to_string(), "4f1c3b0".to_string()),
            ("time_unit".to_string(), "us".to_string()),
        ])
    }

    #[test]
    fn writes_pretty_json_with_a_trailing_newline_creating_the_parents() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("session/others/settings.json");

        write_json(&path, &settings())?;

        assert_eq!(
            fs::read_to_string(&path)?,
            "{\n  \"adj_commit\": \"4f1c3b0\",\n  \"time_unit\": \"us\"\n}\n"
        );
        Ok(())
    }

    #[test]
    fn what_was_written_parses_back_to_the_same_value() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("settings.json");

        write_json(&path, &settings())?;

        let read: BTreeMap<String, String> = serde_json::from_str(&fs::read_to_string(&path)?)?;
        assert_eq!(read, settings());
        Ok(())
    }

    #[test]
    fn writing_replaces_an_existing_file_rather_than_appending() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("settings.json");

        write_json(&path, &settings())?;
        write_json(&path, &BTreeMap::from([("time_unit", "ms")]))?;

        assert_eq!(
            fs::read_to_string(&path)?,
            "{\n  \"time_unit\": \"ms\"\n}\n"
        );
        Ok(())
    }

    /// A value that fails halfway through being serialized, to check
    /// what the destination looks like when that happens.
    #[derive(Debug)]
    struct Unserializable;

    impl Serialize for Unserializable {
        fn serialize<S: Serializer>(&self, _serializer: S) -> Result<S::Ok, S::Error> {
            Err(serde::ser::Error::custom("not today"))
        }
    }

    #[test]
    fn a_successful_write_leaves_no_temporary_file_behind() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("settings.json");

        write_json(&path, &settings())?;

        assert!(path.exists());
        assert!(!temporary_path(&path).exists());
        Ok(())
    }

    #[test]
    fn a_failed_write_leaves_the_previous_contents_untouched() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("settings.json");
        write_json(&path, &settings())?;
        let before = fs::read_to_string(&path)?;

        let Err(error) = write_json(&path, &Unserializable) else {
            unreachable!("this value can't be serialized");
        };
        assert!(matches!(error, Error::Serialize { .. }));

        // The destination still holds the old document, whole, and the
        // half-written one is gone rather than left next to it.
        assert_eq!(fs::read_to_string(&path)?, before);
        assert!(!temporary_path(&path).exists());
        Ok(())
    }

    #[test]
    fn the_temporary_file_is_a_sibling_so_the_rename_stays_atomic() {
        let path = Path::new("/var/log/session/settings.json");
        let temporary = temporary_path(path);

        assert_eq!(temporary.parent(), path.parent());
        assert_eq!(temporary.file_name(), Some("settings.json.tmp".as_ref()));
    }

    #[test]
    fn read_json_gets_back_what_write_json_put_there() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("settings.json");
        write_json(&path, &settings())?;

        let read: BTreeMap<String, String> = read_json(&path)?;

        assert_eq!(read, settings());
        Ok(())
    }

    #[test]
    fn reading_names_the_file_when_it_is_missing_or_broken() -> TestResult {
        let temp = tempfile::tempdir()?;
        let missing = temp.path().join("not-there.json");
        let broken = temp.path().join("broken.json");
        fs::write(&broken, "{ not json")?;

        let Err(absent) = read_json::<BTreeMap<String, String>>(&missing) else {
            unreachable!("that file was never written");
        };
        assert!(matches!(&absent, Error::Read { path, .. } if path == &missing));

        let Err(malformed) = read_json::<BTreeMap<String, String>>(&broken) else {
            unreachable!("that file is not valid JSON");
        };
        assert!(matches!(&malformed, Error::Parse { path, .. } if path == &broken));
        Ok(())
    }

    #[test]
    fn a_document_takes_several_properties_and_reads_them_back() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("session.json");

        let mut session = JsonDocument::new(&path);
        session
            .set("adj_commit", "4f1c3b0")?
            .set("time_unit", "us")?
            .set("rows", 128_000u64)?;
        session.save()?;

        let session = JsonDocument::open(&path)?;
        assert_eq!(
            session.get::<String>("adj_commit")?.as_deref(),
            Some("4f1c3b0")
        );
        assert_eq!(session.get::<u64>("rows")?, Some(128_000));
        assert_eq!(session.get::<String>("never_set")?, None);
        assert!(session.contains("time_unit"));
        Ok(())
    }

    #[test]
    fn adding_properties_keeps_the_ones_already_in_the_file() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("session.json");
        // A document with a property no type in this crate mentions.
        fs::write(&path, "{\n  \"written_by_someone_else\": [1, 2, 3]\n}\n")?;

        let mut session = JsonDocument::open(&path)?;
        session.set("stopped", true)?;
        session.save()?;

        let session = JsonDocument::open(&path)?;
        assert_eq!(
            session.get::<Vec<u8>>("written_by_someone_else")?,
            Some(vec![1, 2, 3])
        );
        assert_eq!(session.get::<bool>("stopped")?, Some(true));
        Ok(())
    }

    #[test]
    fn a_property_read_as_the_wrong_type_is_an_error_not_a_none() -> TestResult {
        let path = Path::new("in-memory.json");
        let mut session = JsonDocument::new(path);
        session.set("rows", "not a number")?;

        let Err(error) = session.get::<u64>("rows") else {
            unreachable!("a string is not a u64");
        };

        assert!(matches!(&error, Error::Parse { path: named, .. } if named == path));
        Ok(())
    }

    #[test]
    fn removing_a_property_reports_whether_it_was_there() -> TestResult {
        let mut session = JsonDocument::new("in-memory.json");
        session.set("time_unit", "us")?;

        assert!(session.remove("time_unit"));
        assert!(!session.remove("time_unit"));
        assert!(session.properties().is_empty());
        Ok(())
    }

    #[test]
    fn open_or_new_forgives_a_missing_file_but_not_a_broken_one() -> TestResult {
        let temp = tempfile::tempdir()?;
        let missing = temp.path().join("session.json");
        let broken = temp.path().join("broken.json");
        fs::write(&broken, "{ not json")?;

        let mut session = JsonDocument::open_or_new(&missing)?;
        assert!(session.properties().is_empty());
        session.set("time_unit", "us")?;
        session.save()?;
        assert!(missing.exists());

        assert!(matches!(
            JsonDocument::open_or_new(&broken),
            Err(Error::Parse { .. })
        ));
        Ok(())
    }

    #[test]
    fn a_document_whose_root_is_not_an_object_has_no_properties_to_add_to() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("list.json");
        fs::write(&path, "[1, 2, 3]\n")?;

        let Err(error) = JsonDocument::open(&path) else {
            unreachable!("the root of that document is an array");
        };

        assert!(matches!(&error, Error::NotAnObject { path: named } if named == &path));
        Ok(())
    }

    #[test]
    fn a_path_whose_parent_is_a_file_reports_which_file_it_was() -> TestResult {
        let temp = tempfile::tempdir()?;
        let blocking = temp.path().join("settings.json");
        write_json(&blocking, &settings())?;

        let path = blocking.join("nested.json");
        let Err(error) = write_json(&path, &settings()) else {
            unreachable!("a file can't be used as a directory");
        };

        assert!(matches!(&error, Error::Create { path: failed, .. } if failed == &path));
        Ok(())
    }
}
