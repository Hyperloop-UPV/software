//! Raw ADJ JSON shapes and the directory-walking loader.
//!
//! Kept together as their own submodule — unlike `error`/`info` — because
//! this whole module is the one piece of `adj` meant to be reused as-is by
//! a future non-`station` product (a sniffer, a simulator...). The
//! individual `RawX` shapes stay private; what's reusable is the
//! [`load_from_dir`] entry point, not picking apart its internals.

mod loader;
mod types;

pub use loader::load_from_dir;
