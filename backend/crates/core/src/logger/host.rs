//! What the operating system will say about who is running this and
//! where.
//!
//! Part of [`crate::logger`] because it is part of a recording, but
//! not of how one is written: this is the *content* of a recording's
//! metadata, not a way of putting bytes on a disk. Nothing in
//! `logger`'s three formats — nor in [`crate::logger::files`] — uses
//! this module; they still write files without knowing what is in them,
//! and that is worth keeping.
//!
//! One snapshot, [`crate::logger::host::HostInfo::collect`], meant to be written into a
//! recording's metadata so that months later it is still possible to
//! answer *which machine produced this, running which build, and with
//! whose clock and locale*. Every field is optional and nothing here
//! returns a [`Result`]: what the system won't say is simply absent,
//! because a recording must never fail to start over a missing user
//! name.
//!
//! What is deliberately not here: free disk space and memory (another
//! dependency, and the disk is better checked by whoever is about to
//! fill it), the battery, and the network interfaces the backend bound
//! to — that last one belongs to whatever opened the sockets, which is
//! the only thing that actually knows.

use serde::Serialize;
use std::env;
use std::path::PathBuf;
use std::time::{SystemTime, UNIX_EPOCH};
use tracing::debug;

/// Who and what produced a recording.
///
/// Built with [`HostInfo::collect`] and serialized straight into a
/// metadata file. It is a *snapshot*: the values are read once, when it
/// is built, and never refreshed.
///
/// Serialize-only on purpose. Reading one back is reading JSON, not
/// rebuilding this struct, and a field like [`HostInfo::os`] is a
/// compile-time constant of the build that wrote it rather than
/// something to parse.
#[derive(Debug, Clone, Serialize)]
pub struct HostInfo {
    /// The login name (`javier`), from the operating system.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub user: Option<String>,

    /// The user's full name as the operating system knows it
    /// (`Javier Ribal del Río`), which is not the login name.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub real_name: Option<String>,

    /// `user.name` from the global git configuration.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub git_name: Option<String>,

    /// An email address for whoever is running this. See
    /// [`HostInfo::collect`] for where it is looked for, and why no
    /// operating system is one of the places.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub email: Option<String>,

    /// The machine's name: the one a person would recognize if the
    /// system has one, and its network hostname otherwise.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub host: Option<String>,

    /// The operating system this was built for: `linux`, `macos`,
    /// `windows`.
    pub os: &'static str,

    /// The processor architecture this was built for: `x86_64`,
    /// `aarch64`.
    pub arch: &'static str,

    /// The operating system's own name for itself, with its version:
    /// `Fedora Linux 44`, `macOS 15.1`, `Windows 11`.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub distro: Option<String>,

    /// How many threads the machine can actually run at once.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub cpus: Option<usize>,

    /// The version of `software-core` that wrote this. The version of
    /// the *binary* is the binary's own to add: this crate can only see
    /// its own.
    pub core_version: &'static str,

    /// Whether this was built without optimizations and with debug
    /// assertions on, which is worth knowing before reading anything
    /// into the timings of a recording.
    pub debug_build: bool,

    /// The process id, for pairing a recording with whatever else was
    /// logging at the time.
    pub pid: u32,

    /// The binary that is running, which says which build this was far
    /// more precisely than a version number does.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub exe: Option<PathBuf>,

    /// The arguments it was started with, without the program name
    /// (which is [`HostInfo::exe`]). Usually this is where the
    /// configuration file is named.
    pub args: Vec<String>,

    /// The directory it was started from, which is what any relative
    /// path in those arguments was resolved against.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub working_dir: Option<PathBuf>,

    /// The time zone the machine is in, as a name like `Europe/Madrid`.
    ///
    /// Worth more here than it looks: protections and messages carry a
    /// time of day and no date or zone, so without knowing the zone of
    /// the machine that recorded them they can't be placed on a real
    /// timeline, or lined up against video or another machine's log.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub timezone: Option<String>,

    /// The locale, which decides how dates and numbers get formatted by
    /// anything that reads this with the system's settings.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub locale: Option<String>,

    /// When the snapshot was taken, in seconds since the Unix epoch.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub started_at_unix: Option<u64>,

    /// How many files this process is allowed to have open at once. See
    /// [`open_file_limit`], which is the reason this field exists.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub open_file_limit: Option<u64>,
}

impl HostInfo {
    /// Reads everything the system will say, right now.
    ///
    /// Never fails and never panics: each field is attempted on its own
    /// and left empty if it can't be read.
    ///
    /// The email is looked for in four places, in this order: `user.email`
    /// in the global git configuration, then `$GIT_AUTHOR_EMAIL`, then
    /// `$EMAIL`, then the account name if it happens to look like an
    /// address. **No operating system exposes an email address
    /// portably** — macOS keeps one in Contacts and Windows only knows
    /// one on a domain-joined machine — so git's own identity is used
    /// instead, which is both reliable on a developer's machine and the
    /// identity the person is already known by. The git configuration is
    /// only read with the `git` feature on; without it, the environment
    /// variables are all that is left.
    ///
    /// # Example
    ///
    /// ```
    /// use software_core::logger::host::HostInfo;
    ///
    /// let host = HostInfo::collect();
    /// println!("{}", serde_json::to_string_pretty(&host)?);
    /// # Ok::<(), serde_json::Error>(())
    /// ```
    pub fn collect() -> Self {
        let git = git_identity();

        let info = Self {
            user: whoami::username().ok(),
            real_name: whoami::realname().ok(),
            git_name: git.name,
            email: git
                .email
                .or_else(|| var("GIT_AUTHOR_EMAIL"))
                .or_else(|| var("EMAIL"))
                .or_else(account_email),
            host: device_name(),
            os: env::consts::OS,
            arch: env::consts::ARCH,
            distro: whoami::distro().ok(),
            cpus: std::thread::available_parallelism().ok().map(Into::into),
            core_version: env!("CARGO_PKG_VERSION"),
            debug_build: cfg!(debug_assertions),
            pid: std::process::id(),
            exe: env::current_exe().ok(),
            // `args_os`, not `args`: the latter panics on an argument
            // that isn't valid Unicode, and nothing in here is allowed
            // to bring the process down.
            args: env::args_os()
                .skip(1)
                .map(|arg| arg.to_string_lossy().into_owned())
                .collect(),
            working_dir: env::current_dir().ok(),
            timezone: timezone(),
            locale: locale(),
            started_at_unix: unix_seconds(),
            open_file_limit: open_file_limit(),
        };

        debug!(
            user = ?info.user,
            host = ?info.host,
            os = info.os,
            open_file_limit = ?info.open_file_limit,
            "host snapshot taken"
        );
        info
    }

    /// The same snapshot with everything that identifies a person
    /// removed: the user name, the real name, the git name, the email
    /// and the machine's name.
    ///
    /// For when a recording is going to be shared outside the team and
    /// only the machine and the build matter.
    pub fn without_identity(mut self) -> Self {
        self.user = None;
        self.real_name = None;
        self.git_name = None;
        self.email = None;
        self.host = None;
        self
    }
}

/// The soft limit on how many files this process may have open at once.
///
/// Worth checking before opening a file per measurement: the default on
/// macOS is **256**, and on Linux usually 1024. Past it, opening a file
/// starts failing in the middle of a recording, which looks like a disk
/// problem and isn't one.
///
/// `None` on Windows, honestly rather than as a failure: it has no
/// equivalent limit for the handles Rust's [`std::fs::File`] uses.
#[cfg(unix)]
pub fn open_file_limit() -> Option<u64> {
    rlimit::getrlimit(rlimit::Resource::NOFILE)
        .ok()
        .map(|(soft, _hard)| soft)
}

/// The soft limit on how many files this process may have open at once,
/// which Windows does not define for the handles [`std::fs::File`] uses.
#[cfg(not(unix))]
pub fn open_file_limit() -> Option<u64> {
    None
}

/// The machine's name.
///
/// The pretty name first — what a desktop shows, from
/// `/etc/machine-info` on Linux and the sharing name on macOS and
/// Windows — and the network hostname when there isn't one, which on a
/// plain Linux install is the usual case.
fn device_name() -> Option<String> {
    whoami::devicename().or_else(|_| whoami::hostname()).ok()
}

/// The time zone the machine is in, as a zone name.
///
/// `$TZ` when it is set, which on Linux it usually isn't: the system zone
/// lives in `/etc/localtime`, a link into the zone database whose target
/// ends in the name (`/usr/share/zoneinfo/Europe/Madrid`). Reading the
/// link is how every other tool finds it. Windows keeps its zones under
/// different names entirely and isn't read here, so there it comes down
/// to `$TZ`.
///
/// A *name* and not an offset on purpose: the offset depends on the date,
/// and the recording this ends up next to may well straddle the day
/// summer time changes.
fn timezone() -> Option<String> {
    if let Some(from_environment) = var("TZ") {
        return Some(from_environment);
    }

    let target = std::fs::read_link("/etc/localtime").ok()?;

    zone_from_link(&target.to_string_lossy())
}

/// The zone name at the end of a link into the zone database, or `None`
/// if the target doesn't look like one.
fn zone_from_link(target: &str) -> Option<String> {
    let (_, zone) = target.rsplit_once("zoneinfo/")?;

    (!zone.is_empty()).then(|| zone.to_string())
}

/// An environment variable, if it is set to something that isn't empty.
fn var(name: &str) -> Option<String> {
    let value = env::var_os(name)?;
    let value = value.to_string_lossy().trim().to_string();

    (!value.is_empty()).then_some(value)
}

/// Seconds since the Unix epoch, or `None` if the clock is set before
/// 1970.
fn unix_seconds() -> Option<u64> {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .ok()
        .map(|since| since.as_secs())
}

/// The locale, from the environment first and from the operating
/// system's own language preferences otherwise — which is what a machine
/// with no `LANG` set, meaning most Windows and macOS desktops, needs.
fn locale() -> Option<String> {
    if let Some(from_environment) = var("LC_ALL").or_else(|| var("LANG")) {
        return Some(from_environment);
    }

    let preferences = whoami::lang_prefs().ok()?;
    preferences.time_langs().next().map(|lang| lang.to_string())
}

/// Some accounts are named after an email address — a domain-joined
/// Windows account, a managed macOS one — and that is the one place an
/// operating system does hand one over. When the account name looks like
/// an address, take it as one.
fn account_email() -> Option<String> {
    whoami::account()
        .ok()
        .filter(|account| account.contains('@'))
}

/// The name and email git would sign a commit with on this machine.
#[derive(Debug, Default)]
struct GitIdentity {
    /// `user.name`, if it is set.
    name: Option<String>,
    /// `user.email`, if it is set.
    email: Option<String>,
}

/// Reads `user.name` and `user.email` from the git configuration.
///
/// Global and system files only. No repository is opened: the identity
/// wanted here is the person's, and it must not depend on which
/// directory the backend happens to have been started from. A global
/// `includeIf` makes this fail, since resolving one needs a repository —
/// hence an empty identity rather than an error.
#[cfg(feature = "git")]
fn git_identity() -> GitIdentity {
    let Ok(config) = gix::config::File::from_globals() else {
        return GitIdentity::default();
    };

    let value = |key| {
        let raw = config.string(key)?;
        let text = String::from_utf8_lossy(&raw).trim().to_string();
        (!text.is_empty()).then_some(text)
    };

    GitIdentity {
        name: value("user.name"),
        email: value("user.email"),
    }
}

/// Without the `git` feature there is no git configuration to read, so
/// the identity is left to the environment variables.
#[cfg(not(feature = "git"))]
fn git_identity() -> GitIdentity {
    GitIdentity::default()
}

#[cfg(test)]
mod tests {
    use super::*;

    type TestResult<T = ()> = Result<T, Box<dyn std::error::Error + Send + Sync>>;

    #[test]
    fn a_snapshot_fills_in_what_the_build_already_knows() -> TestResult {
        let host = HostInfo::collect();

        // The fields that can't be missing, because they are decided at
        // compile time or by the process itself. Everything else depends
        // on the machine the tests run on and is not asserted here.
        assert!(!host.os.is_empty());
        assert!(!host.arch.is_empty());
        assert!(!host.core_version.is_empty());
        assert!(host.pid > 0);
        assert_eq!(host.debug_build, cfg!(debug_assertions));
        Ok(())
    }

    #[test]
    fn a_snapshot_serializes_without_the_fields_it_could_not_read() -> TestResult {
        let host = HostInfo {
            user: None,
            real_name: None,
            git_name: None,
            email: None,
            host: None,
            distro: None,
            cpus: None,
            exe: None,
            working_dir: None,
            timezone: None,
            locale: None,
            started_at_unix: None,
            open_file_limit: None,
            ..HostInfo::collect()
        };

        let json = serde_json::to_string(&host)?;

        assert!(!json.contains("null"), "{json}");
        assert!(json.contains("\"os\""), "{json}");
        Ok(())
    }

    #[test]
    fn without_identity_leaves_the_machine_and_takes_the_person() -> TestResult {
        let host = HostInfo {
            user: Some("javier".into()),
            real_name: Some("Javier".into()),
            git_name: Some("Javier".into()),
            email: Some("someone@example.test".into()),
            host: Some("a-laptop".into()),
            ..HostInfo::collect()
        }
        .without_identity();

        assert_eq!(host.user, None);
        assert_eq!(host.real_name, None);
        assert_eq!(host.git_name, None);
        assert_eq!(host.email, None);
        assert_eq!(host.host, None);

        // The machine and the build survive, which is the point.
        assert!(!host.os.is_empty());
        assert!(!host.core_version.is_empty());
        Ok(())
    }

    #[test]
    fn unix_reports_a_file_limit_and_windows_says_nothing() -> TestResult {
        let limit = open_file_limit();

        if cfg!(unix) {
            let Some(limit) = limit else {
                unreachable!("every unix defines RLIMIT_NOFILE");
            };
            assert!(limit > 0);
        } else {
            assert_eq!(limit, None);
        }
        Ok(())
    }

    #[test]
    fn a_zone_name_is_whatever_follows_the_zone_database() -> TestResult {
        assert_eq!(
            zone_from_link("/usr/share/zoneinfo/Europe/Madrid").as_deref(),
            Some("Europe/Madrid")
        );
        // Relative links are just as common as absolute ones.
        assert_eq!(
            zone_from_link("../usr/share/zoneinfo/UTC").as_deref(),
            Some("UTC")
        );

        // Nothing that isn't a zone database link.
        assert_eq!(zone_from_link("/etc/localtime"), None);
        assert_eq!(zone_from_link("/usr/share/zoneinfo/"), None);
        Ok(())
    }

    #[test]
    fn a_variable_that_is_not_set_reads_as_none() -> TestResult {
        // The other half of `var` — that a variable set to an empty or
        // blank string also reads as `None` — can't be tested here:
        // setting an environment variable is `unsafe` in this edition,
        // and this crate forbids `unsafe`.
        assert_eq!(var("SOFTWARE_CORE_UTILS_HOST_UNSET"), None);
        Ok(())
    }
}
