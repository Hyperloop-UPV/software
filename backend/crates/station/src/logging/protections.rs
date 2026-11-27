//! Protection recording in `protections/<board_name>.csv`, one per board.
//!
//! Columns, in order:
//! `instant,from,to,protection_id,severity,protection_type,threshold_1,threshold_2,measurement_id,value,time`.
//! The second threshold is empty unless the protection is a range. `value`
//! is the measurement value that triggered the protection. For a
//! `timeacumulation` protection, `time` is a string containing time and units;
//! for other protection types it is `0`.
//!
//! This component will own the `software_core::logger::CsvFile` handles and
//! format rows. Header policy remains to be defined.
