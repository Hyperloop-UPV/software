//! A plain text file, written a line at a time.

use super::Error;
use super::target::{Target, append_file, create_file};
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;
use tracing::debug;

/// A text file being written to, one line at a time.
///
/// Deliberately the same vocabulary as [`crate::logger::CsvFile`] —
/// `create`, `new`, `flush`, `close`, `get_ref`, `is_poisoned`, the same
/// [`Error`], the same poisoning after a failed write and the same
/// courtesy flush on drop — so there is nothing to relearn moving
/// between the two.
///
/// What it does *not* have is everything that only means something for
/// columns: no header, no field count, no quoting. A line is written
/// exactly as given, with a `\n` after it, and a line that contains a
/// comma or a quote is not special in any way. That also means a text
/// file can't tell you a line came out malformed — if the content has
/// fields in it, it wants [`crate::logger::CsvFile`] instead.
///
/// # Example
///
/// ```
/// use software_core::logger::TextFile;
///
/// let mut log = TextFile::new(Vec::new(), "in memory");
/// log.write_line("session started")?;
/// log.write_line("board LCU connected")?;
///
/// assert_eq!(log.get_ref().as_slice(), b"session started\nboard LCU connected\n");
/// # Ok::<(), Box<dyn std::error::Error>>(())
/// ```
#[derive(Debug)]
pub struct TextFile<W: Write = BufWriter<File>> {
    target: Target<W>,
    /// The line currently being written, reused across lines so writing
    /// one allocates nothing.
    buf: Vec<u8>,
}

impl TextFile<BufWriter<File>> {
    /// Creates (or truncates) the file at `path`, creating its parent
    /// directories.
    pub fn create(path: impl AsRef<Path>) -> Result<Self, Error> {
        let path = path.as_ref();
        let file = Self::new(create_file(path)?, path.display().to_string());
        debug!(path = %path.display(), "text file created");
        Ok(file)
    }

    /// Opens the file at `path` to add lines to the end of it, creating it
    /// and its parent directories if they aren't there.
    ///
    /// Nothing about what the file already contains is read, with one
    /// exception: if it doesn't end in a newline, one is written first, so
    /// the first new line can't continue a half-finished one.
    pub fn append(path: impl AsRef<Path>) -> Result<Self, Error> {
        let path = path.as_ref();
        let (writer, existing) = append_file(path)?;
        let file = Self::new(writer, path.display().to_string());
        debug!(
            path = %path.display(),
            existing_bytes = existing,
            "text file opened to append"
        );
        Ok(file)
    }
}

impl<W: Write> TextFile<W> {
    /// Wraps an already-open destination.
    ///
    /// `label` is what this file is called in any [`Error`] it produces;
    /// [`TextFile::create`] uses the path for it.
    ///
    /// Unlike [`crate::logger::CsvFile::new`] this can't fail: there is
    /// no header to write before the caller's first line.
    pub fn new(inner: W, label: impl Into<String>) -> Self {
        Self {
            target: Target::new(inner, label.into()),
            buf: Vec::new(),
        }
    }

    /// Writes `line`, followed by a `\n`.
    ///
    /// The line and its terminator reach the destination as a single
    /// write, so a line lands whole or not at all — the same guarantee
    /// a CSV row gets.
    pub fn write_line(&mut self, line: &str) -> Result<(), Error> {
        self.buf.clear();
        self.buf.extend_from_slice(line.as_bytes());
        self.buf.push(b'\n');
        self.target.write_all(&self.buf)
    }

    /// Flushes everything written so far to the destination.
    pub fn flush(&mut self) -> Result<(), Error> {
        self.target.flush()
    }

    /// Flushes and closes the file, reporting a failure instead of
    /// swallowing it like [`Drop`] has to.
    pub fn close(mut self) -> Result<(), Error> {
        self.target.close()
    }

    /// Borrows the destination, e.g. to read back what was written to an
    /// in-memory buffer.
    pub fn get_ref(&self) -> &W {
        self.target.get_ref()
    }

    /// Whether an earlier write or flush failed, leaving this file
    /// closed to further writes.
    pub fn is_poisoned(&self) -> bool {
        self.target.is_poisoned()
    }

    /// What this file is called in its errors: the path it was created
    /// with, or the label it was given.
    ///
    /// Worth having beyond [`Error`]'s own text: a caller that notices a
    /// file went [`TextFile::is_poisoned`] has no error in hand any more,
    /// and still needs to say which file stopped.
    pub fn label(&self) -> &str {
        self.target.label()
    }

    /// Every byte handed to the destination so far, line terminators
    /// included — the file's size on disk, once flushed.
    pub fn bytes_written(&self) -> u64 {
        self.target.bytes_written()
    }

    /// The bytes written since the last successful flush.
    ///
    /// This is what a flush policy is built on: "flush every so many
    /// kilobytes, or every so often" is the caller's decision (see this
    /// module's docs), and this saves it from keeping its own tally for
    /// each of the hundreds of files it may have open.
    pub fn bytes_since_flush(&self) -> u64 {
        self.target.bytes_since_flush()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    type TestResult<T = ()> = Result<T, Box<dyn std::error::Error + Send + Sync>>;

    fn written(text: &TextFile<Vec<u8>>) -> String {
        String::from_utf8_lossy(text.get_ref()).into_owned()
    }

    /// A destination that takes `ok_writes` writes and fails every one
    /// after that — what a full disk looks like from in here.
    #[derive(Debug)]
    struct FailsAfter {
        ok_writes: usize,
    }

    impl Write for FailsAfter {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            if self.ok_writes == 0 {
                return Err(std::io::Error::other("disk full"));
            }
            self.ok_writes -= 1;
            Ok(buf.len())
        }

        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    #[test]
    fn appending_keeps_the_lines_that_were_already_there() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("output/build.txt");

        let mut log = TextFile::create(&path)?;
        log.write_line("compiling")?;
        log.close()?;

        let mut log = TextFile::append(&path)?;
        log.write_line("done")?;
        log.close()?;

        assert_eq!(fs::read_to_string(&path)?, "compiling\ndone\n");
        Ok(())
    }

    #[test]
    fn appending_to_content_that_lacks_its_last_newline_starts_a_fresh_line() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("script.log");
        fs::write(&path, "the script stopped here")?;

        let mut log = TextFile::append(&path)?;
        log.write_line("and this is ours")?;
        log.close()?;

        assert_eq!(
            fs::read_to_string(&path)?,
            "the script stopped here\nand this is ours\n"
        );
        Ok(())
    }

    #[test]
    fn every_line_is_written_with_its_terminator() -> TestResult {
        let mut text = TextFile::new(Vec::new(), "in memory");

        text.write_line("session started")?;
        text.write_line("board LCU connected")?;

        assert_eq!(written(&text), "session started\nboard LCU connected\n");
        Ok(())
    }

    #[test]
    fn an_empty_line_is_just_a_terminator() -> TestResult {
        let mut text = TextFile::new(Vec::new(), "in memory");

        text.write_line("")?;
        text.write_line("after the blank")?;

        assert_eq!(written(&text), "\nafter the blank\n");
        Ok(())
    }

    #[test]
    fn a_line_is_written_verbatim_with_no_quoting() -> TestResult {
        let mut text = TextFile::new(Vec::new(), "in memory");

        text.write_line("LCU, bay 2: say \"hi\"")?;

        assert_eq!(written(&text), "LCU, bay 2: say \"hi\"\n");
        Ok(())
    }

    #[test]
    fn a_failed_write_poisons_the_file() -> TestResult {
        let mut text = TextFile::new(FailsAfter { ok_writes: 1 }, "failing");

        text.write_line("this one gets through")?;
        assert!(matches!(
            text.write_line("this one doesn't"),
            Err(Error::Write { .. })
        ));
        assert!(text.is_poisoned());

        assert!(matches!(
            text.write_line("nor this one"),
            Err(Error::Poisoned { .. })
        ));
        assert!(matches!(text.flush(), Err(Error::Poisoned { .. })));
        Ok(())
    }

    #[test]
    fn a_file_reports_the_name_it_answers_to_and_the_bytes_it_has_taken() -> TestResult {
        let mut text = TextFile::new(Vec::new(), "in memory");
        assert_eq!(text.label(), "in memory");
        assert_eq!(text.bytes_written(), 0);

        text.write_line("session started")?;
        assert_eq!(text.bytes_written(), "session started\n".len() as u64);
        assert_eq!(text.bytes_since_flush(), "session started\n".len() as u64);

        text.flush()?;
        assert_eq!(text.bytes_since_flush(), 0);
        assert_eq!(text.bytes_written(), "session started\n".len() as u64);
        Ok(())
    }

    #[test]
    fn create_makes_the_parent_directories_and_close_persists_every_line() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("session/others/session.log");

        let mut text = TextFile::create(&path)?;
        text.write_line("session started")?;
        text.write_line("session stopped")?;
        text.close()?;

        assert_eq!(
            fs::read_to_string(&path)?,
            "session started\nsession stopped\n"
        );
        Ok(())
    }
}
