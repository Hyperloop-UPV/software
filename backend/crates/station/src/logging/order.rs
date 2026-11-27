//! Order recording in the session's single `order/order.csv` file.
//!
//! Columns, in order: `instant,from,to,id,payload,timestamp`.
//! `timestamp` is the order's wall-clock time formatted as
//! `YYYY-MM-DDTHH-MM-SS` followed by the applicable `Europe/Madrid` UTC offset
//! (`+01:00` for CET or `+02:00` for CEST).
//!
//! This component will own a `software_core::logger::CsvFile` and format rows.
//! Header policy and the exact payload representation remain to be defined.
