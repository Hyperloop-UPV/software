//! Backend and recording-session `logger-settings.json` metadata.
//!
//! Backend settings in `others/` contain `adj_commit_hash`, `time_unit` and
//! `date`, where `date` matches the backend startup directory name.
//! Session settings preserve that metadata, replace `date` with the session
//! directory name and add `selected_variables`. The representation of that
//! selection remains to be defined.
//!
//! Settings will be written through `software_core::logger::write_json` or
//! `software_core::logger::JsonDocument`, allowing the metadata to grow later.
