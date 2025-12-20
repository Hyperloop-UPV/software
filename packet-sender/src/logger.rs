#[cfg(windows)]
use enable_ansi_support;

use tracing_subscriber::fmt::format::Writer;
use tracing_subscriber::fmt::time::FormatTime;
use std::io::Write;

struct CompactTimer;

// Format time as HH:MM:SS.mmm or 14:59:59.999
impl FormatTime for CompactTimer {
    fn format_time(&self, w: &mut Writer<'_>) -> Result<(), std::fmt::Error> {
        let now = chrono::Local::now();
        write!(w, "{}", now.format("%H:%M:%S%.3f"))
    }
}

pub fn init(log_level: &str) {
    // Enable ANSI support on Windows before initializing logger
    #[cfg(windows)]
    let _ = enable_ansi_support::enable_ansi_support();
    
    // Initialize logging
    tracing_subscriber::fmt()
        .with_env_filter(log_level)
        .with_timer(CompactTimer)
        .init();
}