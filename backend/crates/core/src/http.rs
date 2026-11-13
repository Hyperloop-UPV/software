//! HTTP server built on Axum.
//!
//! Currently exposes only `GET /health`, returning `{"status":"ok"}`.
//! This reports that HTTP is responding, not that the vehicle is ready.

mod handlers;
mod server;

pub use server::serve;
