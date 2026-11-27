//! Measurement recording under `data/<board_name>/<measurement_id>.csv`.
//!
//! One directory per connected board and one CSV per selected measurement,
//! named with its textual identifier. Files have no header. Columns, in order:
//! `instant,from,to,value`.
//!
//! This component will own the measurement `software_core::logger::CsvFile`
//! handles and translate typed events into rows, reusing the logger's CSV
//! escaping, buffering and explicit flush/close operations.
