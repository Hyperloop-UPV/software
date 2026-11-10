//! A CSV file that knows its own header.

use super::Error;
use super::target::{Target, append_file, create_file};
use std::fmt;
use std::fs::File;
use std::io::{BufWriter, Write};
use std::path::Path;
use tracing::debug;

/// A CSV file being written to, one row at a time.
///
/// Generic over its destination so the format can be exercised against
/// an in-memory buffer, but the common case is the default: a file on
/// disk behind a [`BufWriter`], built with [`CsvFile::create`].
///
/// Three things it guarantees, which are the reason this type exists
/// instead of a bare [`File`]:
///
/// - **A row lands whole or not at all.** Fields are built up in a
///   buffer the file reuses, and only [`Row::end`] writes — so a row
///   rejected for having the wrong number of fields never reaches the
///   file, and a row that does reach it is a single
///   [`Write::write_all`] call.
/// - **A failed write stops the file.** The first failure that reaches
///   the file poisons it: every later call returns
///   [`Error::Poisoned`] instead of appending to something already
///   inconsistent, or repeating the same I/O error once per row.
/// - **Flushing is something you ask for.** [`CsvFile::flush`] and
///   [`CsvFile::close`] return a `Result`. [`Drop`] only does a
///   best-effort flush and traces the failure: a fatal error in the
///   backend ends in `std::process::exit`, which runs no destructor at
///   all, so a log that only flushes on drop loses its tail exactly
///   when it matters most.
///
/// Nothing here is traced per row on purpose: at telemetry rates that
/// would be tens of thousands of events per second. Only opening a file
/// (`debug`) and a failed flush on drop (`error`) are traced.
///
/// # Example
///
/// ```
/// use software_core::logger::CsvFile;
///
/// let mut csv = CsvFile::new(Vec::new(), "in memory", &["t", "origin", "value"])?;
/// csv.row().int(1_250).text("LCU, bay 2").num(53.2).end()?;
///
/// assert_eq!(
///     csv.get_ref().as_slice(),
///     b"t,origin,value\n1250,\"LCU, bay 2\",53.2\n",
/// );
/// # Ok::<(), Box<dyn std::error::Error>>(())
/// ```
#[derive(Debug)]
pub struct CsvFile<W: Write = BufWriter<File>> {
    target: Target<W>,
    /// How many fields every row must have, or `None` when the file was
    /// created with an empty header and there is nothing to check
    /// against.
    fields: Option<usize>,
    /// The row currently being built, reused across rows so writing one
    /// allocates nothing.
    buf: Vec<u8>,
}

impl CsvFile<BufWriter<File>> {
    /// Creates (or truncates) the file at `path`, creating its parent
    /// directories, and writes `header` as its first line.
    ///
    /// An empty `header` writes no header line and leaves the row's
    /// field count unchecked — see [`CsvFile::new`].
    pub fn create(path: impl AsRef<Path>, header: &[&str]) -> Result<Self, Error> {
        let path = path.as_ref();

        // The file is created before the header is written so that a failure to write the header doesn't leave a partially written file.
        let file = Self::new(create_file(path)?, path.display().to_string(), header)?;
        debug!(path = %path.display(), fields = header.len(), "csv file created");
        Ok(file)
    }

    /// Opens the file at `path` to add rows to the end of it, creating it
    /// and its parent directories if they aren't there.
    ///
    /// `header` is written only when the file is empty or brand new.
    /// Otherwise it is taken as a statement of how many fields a row has —
    /// what [`Error::FieldCount`] is checked against — and **what the file
    /// already contains is not looked at**: if its columns are not these
    /// ones, both shapes end up in the same file and nothing says so. The
    /// caller is the one who knows that the file it opens is the file it
    /// thinks it is; copying one with [`CsvFile::create`]'s own header is
    /// the way to be sure.
    ///
    /// The one thing that *is* checked is the line boundary: if the
    /// existing content doesn't end in a newline, one is written first, so
    /// the first new row can't be glued onto a half-finished line.
    pub fn append(path: impl AsRef<Path>, header: &[&str]) -> Result<Self, Error> {
        let path = path.as_ref();
        let (writer, existing) = append_file(path)?;

        let file = if existing == 0 {
            Self::new(writer, path.display().to_string(), header)?
        } else {
            Self {
                target: Target::new(writer, path.display().to_string()),
                // No header line to write, so the count is taken from the
                // argument instead of from what was just written. An empty
                // header leaves rows unchecked, as in `new`.
                fields: (!header.is_empty()).then_some(header.len()),
                buf: Vec::new(),
            }
        };

        debug!(
            path = %path.display(),
            existing_bytes = existing,
            fields = header.len(),
            "csv file opened to append"
        );
        Ok(file)
    }
}

impl<W: Write> CsvFile<W> {
    /// Wraps an already-open destination, writing `header` as its first
    /// line.
    ///
    /// `label` is what this file is called in any [`Error`] it produces;
    /// [`CsvFile::create`] uses the path for it.
    ///
    /// An empty `header` writes no header line, and leaves every row's
    /// field count unchecked — for a file whose columns aren't known up
    /// front. With a header, a row with a different number of fields is
    /// an [`Error::FieldCount`].
    pub fn new(inner: W, label: impl Into<String>, header: &[&str]) -> Result<Self, Error> {
        let mut file = Self {
            target: Target::new(inner, label.into()),
            fields: None,
            buf: Vec::new(),
        };

        if !header.is_empty() {
            // Written through `Row` like any other line, so a header
            // with a comma or a quote in it is quoted the same way a
            // field would be. The field count is still `None` here, so
            // the header itself is what sets the count rather than being
            // checked against it.
            let mut row = file.row();
            for field in header {
                row = row.text(field);
            }
            row.end()?;
            file.fields = Some(header.len());
        }

        Ok(file)
    }

    /// Starts a row. Add its fields, then call [`Row::end`].
    ///
    /// Nothing is written to the file until `end`, and a row dropped
    /// without it writes nothing at all.
    pub fn row(&mut self) -> Row<'_, W> {
        self.buf.clear();
        Row {
            file: self,
            count: 0,
            error: None,
        }
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
    /// file went [`CsvFile::is_poisoned`] has no error in hand any more,
    /// and still needs to say which file stopped.
    pub fn label(&self) -> &str {
        self.target.label()
    }

    /// Every byte handed to the destination so far, header included —
    /// the file's size on disk, once flushed.
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

    /// Writes the row held in `buf`, terminator included, as one call.
    fn write_row(&mut self) -> Result<(), Error> {
        self.buf.push(b'\n');
        self.target.write_all(&self.buf)
    }
}

/// A single row being built, field by field.
///
/// Every field method appends to the file's row buffer and keeps the
/// first error it hits, so a row reads as one expression without a `?`
/// per field; [`Row::end`] is where that error — and the field count —
/// is reported.
#[derive(Debug)]
pub struct Row<'a, W: Write> {
    file: &'a mut CsvFile<W>,
    count: usize,
    error: Option<Error>,
}

impl<W: Write> Row<'_, W> {
    /// Appends an integer field.
    pub fn int(self, value: i64) -> Self {
        self.number(format_args!("{value}"))
    }

    /// Appends a floating point field.
    ///
    /// Written with its [`fmt::Display`], i.e. the shortest form that
    /// round-trips back to the same `f64`: a value with no fractional
    /// part has no decimal point (`1.0` is written `1`), and `NaN` and
    /// the infinities are written as `NaN`, `inf` and `-inf` rather than
    /// replaced by an empty field — if a board sent one, the log should
    /// say so.
    pub fn num(self, value: f64) -> Self {
        self.number(format_args!("{value}"))
    }

    /// Appends a boolean field, as `true` or `false`.
    pub fn bool(self, value: bool) -> Self {
        self.number(format_args!("{value}"))
    }

    /// Appends a text field, quoted if it needs to be.
    ///
    /// A field containing a comma, a double quote, a carriage return or
    /// a line feed is wrapped in double quotes, with every inner quote
    /// doubled (RFC 4180). This is the only method that can need
    /// quoting — a number or a boolean never contains any of those — and
    /// the one that matters: a board's free-text message or the path it
    /// came from can contain all four.
    pub fn text(mut self, value: &str) -> Self {
        if self.error.is_some() {
            return self;
        }

        let separated = self.count > 0;
        match append_text(&mut self.file.buf, value, separated) {
            Ok(()) => {
                self.count += 1;
                self
            }
            Err(source) => {
                self.error = Some(Error::Write {
                    label: self.file.target.label().to_string(),
                    source,
                });
                self
            }
        }
    }

    /// Validates the row against the file's header and writes it.
    ///
    /// Errors with [`Error::FieldCount`] — writing nothing — if the row
    /// doesn't have as many fields as the header declares.
    pub fn end(mut self) -> Result<(), Error> {
        if let Some(error) = self.error.take() {
            return Err(error);
        }

        if self.file.target.is_poisoned() {
            return Err(self.file.target.poisoned_error());
        }

        if let Some(expected) = self.file.fields
            && self.count != expected
        {
            return Err(Error::FieldCount {
                label: self.file.target.label().to_string(),
                expected,
                got: self.count,
            });
        }

        self.file.write_row()
    }

    /// Appends a field that can't need quoting: every numeric and
    /// boolean field goes through here, which is also what makes them
    /// the cheap ones.
    fn number(mut self, value: fmt::Arguments<'_>) -> Self {
        if self.error.is_some() {
            return self;
        }

        let separator = if self.count > 0 { "," } else { "" };
        // Appending to a `Vec<u8>` can only fail by running out of
        // memory, but `write!` is fallible all the same: keep the error
        // rather than discard it, and let `end` be the one to report it.
        match write!(self.file.buf, "{separator}{value}") {
            Ok(()) => {
                self.count += 1;
                self
            }
            Err(source) => {
                self.error = Some(Error::Write {
                    label: self.file.target.label().to_string(),
                    source,
                });
                self
            }
        }
    }
}

/// Appends `value` to `buf`, preceded by a separator if `separated`, and
/// quoted per RFC 4180 if it contains anything that needs it.
fn append_text(buf: &mut Vec<u8>, value: &str, separated: bool) -> std::io::Result<()> {
    if separated {
        buf.write_all(b",")?;
    }

    if !value.contains([',', '"', '\n', '\r']) {
        return buf.write_all(value.as_bytes());
    }

    buf.write_all(b"\"")?;
    let mut rest = value;
    while let Some(quote) = rest.find('"') {
        buf.write_all(&rest.as_bytes()[..quote])?;
        buf.write_all(b"\"\"")?;
        rest = &rest[quote + 1..];
    }
    buf.write_all(rest.as_bytes())?;
    buf.write_all(b"\"")
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    type TestResult<T = ()> = Result<T, Box<dyn std::error::Error + Send + Sync>>;

    fn in_memory(header: &[&str]) -> TestResult<CsvFile<Vec<u8>>> {
        Ok(CsvFile::new(Vec::new(), "in memory", header)?)
    }

    fn written(csv: &CsvFile<Vec<u8>>) -> String {
        String::from_utf8_lossy(csv.get_ref()).into_owned()
    }

    /// A destination that takes `ok_writes` writes and fails every one
    /// after that — what a full disk looks like from in here.
    #[derive(Debug)]
    struct FailsAfter {
        ok_writes: usize,
        taken: Vec<u8>,
    }

    impl Write for FailsAfter {
        fn write(&mut self, buf: &[u8]) -> std::io::Result<usize> {
            if self.ok_writes == 0 {
                return Err(std::io::Error::other("disk full"));
            }
            self.ok_writes -= 1;
            self.taken.extend_from_slice(buf);
            Ok(buf.len())
        }

        fn flush(&mut self) -> std::io::Result<()> {
            Ok(())
        }
    }

    #[test]
    fn appending_continues_a_file_without_writing_the_header_again() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("data/lcu.csv");

        let mut csv = CsvFile::create(&path, &["t", "value"])?;
        csv.row().int(1).num(1.5).end()?;
        csv.close()?;

        let mut csv = CsvFile::append(&path, &["t", "value"])?;
        csv.row().int(2).num(2.5).end()?;
        csv.close()?;

        assert_eq!(fs::read_to_string(&path)?, "t,value\n1,1.5\n2,2.5\n");
        Ok(())
    }

    #[test]
    fn appending_to_a_file_that_is_not_there_yet_writes_the_header() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("data/lcu.csv");

        let mut csv = CsvFile::append(&path, &["t", "value"])?;
        csv.row().int(1).num(1.5).end()?;
        csv.close()?;

        assert_eq!(fs::read_to_string(&path)?, "t,value\n1,1.5\n");
        Ok(())
    }

    #[test]
    fn appending_to_content_that_lacks_its_last_newline_starts_a_fresh_line() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("copied.csv");
        // What a file copied from elsewhere can easily look like.
        fs::write(&path, "t,value\n1,1.5")?;

        let mut csv = CsvFile::append(&path, &["t", "value"])?;
        csv.row().int(2).num(2.5).end()?;
        csv.close()?;

        assert_eq!(fs::read_to_string(&path)?, "t,value\n1,1.5\n2,2.5\n");
        Ok(())
    }

    #[test]
    fn an_appended_row_is_still_checked_against_the_header_it_was_given() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("data.csv");
        fs::write(&path, "t,value\n")?;

        let mut csv = CsvFile::append(&path, &["t", "value"])?;
        let Err(error) = csv.row().int(1).num(1.5).text("extra").end() else {
            unreachable!("three fields where the header says two");
        };

        assert!(matches!(
            error,
            Error::FieldCount {
                expected: 2,
                got: 3,
                ..
            }
        ));
        Ok(())
    }

    #[test]
    fn the_header_is_the_files_first_line() -> TestResult {
        let csv = in_memory(&["t", "value"])?;
        assert_eq!(written(&csv), "t,value\n");
        Ok(())
    }

    #[test]
    fn an_empty_header_writes_nothing_and_leaves_the_field_count_unchecked() -> TestResult {
        let mut csv = in_memory(&[])?;
        assert_eq!(written(&csv), "");

        csv.row().int(1).end()?;
        csv.row().int(1).int(2).int(3).end()?;

        assert_eq!(written(&csv), "1\n1,2,3\n");
        Ok(())
    }

    #[test]
    fn a_text_field_is_quoted_only_when_it_has_to_be() -> TestResult {
        let mut csv = in_memory(&[])?;

        csv.row().text("LCU").end()?;
        csv.row().text("LCU, bay 2").end()?;
        csv.row().text("say \"hi\"").end()?;
        csv.row().text("two\nlines").end()?;
        csv.row().text("carriage\rreturn").end()?;

        assert_eq!(
            written(&csv),
            "LCU\n\"LCU, bay 2\"\n\"say \"\"hi\"\"\"\n\"two\nlines\"\n\"carriage\rreturn\"\n"
        );
        Ok(())
    }

    #[test]
    fn a_header_field_is_quoted_like_any_other_text() -> TestResult {
        let csv = in_memory(&["t", "value, raw"])?;
        assert_eq!(written(&csv), "t,\"value, raw\"\n");
        Ok(())
    }

    #[test]
    fn numbers_and_booleans_are_never_quoted() -> TestResult {
        let mut csv = in_memory(&[])?;
        csv.row()
            .int(-1_250)
            .num(53.2)
            .bool(true)
            .bool(false)
            .end()?;
        assert_eq!(written(&csv), "-1250,53.2,true,false\n");
        Ok(())
    }

    #[test]
    fn a_float_is_written_as_the_shortest_form_that_round_trips() -> TestResult {
        let mut csv = in_memory(&[])?;
        csv.row()
            .num(1.0)
            .num(53.2)
            .num(-0.5)
            .num(f64::NAN)
            .num(f64::INFINITY)
            .end()?;
        assert_eq!(written(&csv), "1,53.2,-0.5,NaN,inf\n");
        Ok(())
    }

    #[test]
    fn a_row_with_the_wrong_number_of_fields_is_rejected_whole() -> TestResult {
        let mut csv = in_memory(&["t", "value"])?;

        let too_few = csv.row().int(1).end();
        assert!(matches!(
            too_few,
            Err(Error::FieldCount {
                expected: 2,
                got: 1,
                ..
            })
        ));

        let too_many = csv.row().int(1).int(2).int(3).end();
        assert!(matches!(
            too_many,
            Err(Error::FieldCount {
                expected: 2,
                got: 3,
                ..
            })
        ));

        // Neither rejected row reached the file, and the file still
        // takes a correct row afterwards.
        assert_eq!(written(&csv), "t,value\n");
        csv.row().int(1).num(2.5).end()?;
        assert_eq!(written(&csv), "t,value\n1,2.5\n");
        Ok(())
    }

    #[test]
    fn a_row_dropped_without_end_writes_nothing() -> TestResult {
        let mut csv = in_memory(&["t"])?;

        let _ = csv.row().int(7);
        assert_eq!(written(&csv), "t\n");

        csv.row().int(8).end()?;
        assert_eq!(written(&csv), "t\n8\n");
        Ok(())
    }

    #[test]
    fn a_failed_write_poisons_the_file_instead_of_reporting_once_per_row() -> TestResult {
        // One write for the header, so the first row is what fails.
        let destination = FailsAfter {
            ok_writes: 1,
            taken: Vec::new(),
        };
        let mut csv = CsvFile::new(destination, "failing", &["t"])?;

        assert!(matches!(csv.row().int(1).end(), Err(Error::Write { .. })));
        assert!(csv.is_poisoned());

        assert!(matches!(
            csv.row().int(2).end(),
            Err(Error::Poisoned { .. })
        ));
        assert!(matches!(csv.flush(), Err(Error::Poisoned { .. })));

        // Nothing past the header ever reached the destination.
        assert_eq!(String::from_utf8_lossy(&csv.get_ref().taken), "t\n");
        Ok(())
    }

    #[test]
    fn writing_rows_reuses_one_buffer_instead_of_allocating_per_row() -> TestResult {
        let mut csv = in_memory(&["t", "origin", "value"])?;

        // Two identical passes: the first lets the row buffer grow to
        // whatever the widest of these rows needs, the second must not
        // make it grow at all. Comparing passes rather than asserting
        // some size keeps this about reuse and not about how wide a
        // formatted `f64` happens to be.
        let mut after_first_pass = None;
        for _pass in 0..2 {
            for i in 0..10_000usize {
                let origin = &"src/boards/lcu/main.cpp"[..(i % 23) + 1];
                csv.row().int(i as i64).text(origin).num(i as f64).end()?;
            }

            match after_first_pass {
                None => after_first_pass = Some(csv.buf.capacity()),
                Some(grown) => assert_eq!(
                    csv.buf.capacity(),
                    grown,
                    "the row buffer grew again on the second pass"
                ),
            }
        }
        // And it is one row's worth, not every row appended: if `row()`
        // ever stopped clearing it, this would be in the megabytes.
        assert!(
            csv.buf.capacity() < 256,
            "row buffer grew to {} bytes",
            csv.buf.capacity()
        );
        Ok(())
    }

    #[test]
    fn a_file_reports_the_name_it_answers_to_in_its_errors() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("current.csv");

        let on_disk = CsvFile::create(&path, &["t"])?;
        assert_eq!(on_disk.label(), path.display().to_string());

        let in_memory = in_memory(&["t"])?;
        assert_eq!(in_memory.label(), "in memory");
        Ok(())
    }

    #[test]
    fn bytes_written_counts_the_header_and_every_row() -> TestResult {
        let mut csv = in_memory(&["t", "value"])?;
        assert_eq!(csv.bytes_written(), "t,value\n".len() as u64);

        csv.row().int(1).num(2.5).end()?;
        assert_eq!(csv.bytes_written(), "t,value\n1,2.5\n".len() as u64);
        Ok(())
    }

    #[test]
    fn bytes_since_flush_is_what_a_flush_policy_reads_and_resets() -> TestResult {
        let mut csv = in_memory(&["t"])?;
        csv.row().int(1).end()?;
        assert_eq!(csv.bytes_since_flush(), "t\n1\n".len() as u64);

        csv.flush()?;
        assert_eq!(csv.bytes_since_flush(), 0);
        // Flushing doesn't reset the total, only what is pending.
        assert_eq!(csv.bytes_written(), "t\n1\n".len() as u64);

        csv.row().int(2).end()?;
        assert_eq!(csv.bytes_since_flush(), "2\n".len() as u64);
        Ok(())
    }

    #[test]
    fn a_rejected_row_counts_no_bytes() -> TestResult {
        let mut csv = in_memory(&["t", "value"])?;
        let header = csv.bytes_written();

        assert!(csv.row().int(1).end().is_err());
        assert_eq!(csv.bytes_written(), header);
        Ok(())
    }

    #[test]
    fn create_makes_the_parent_directories_and_close_persists_every_row() -> TestResult {
        let temp = tempfile::tempdir()?;
        let path = temp.path().join("session/data/LCU/current.csv");

        let mut csv = CsvFile::create(&path, &["t", "value"])?;
        csv.row().int(0).num(1.5).end()?;
        csv.row().int(1_000).num(2.5).end()?;
        csv.close()?;

        assert_eq!(fs::read_to_string(&path)?, "t,value\n0,1.5\n1000,2.5\n");
        Ok(())
    }
}
