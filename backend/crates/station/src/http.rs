//! Station HTTP API: ADJ catalogs and incoming WebSocket connections.
//!
//! This module only negotiates WebSocket upgrades and hands sockets to a
//! channel. Message handling and client management belong to the future
//! WebSocket module, which will own the channel's receiver.

use std::io;

use software_core::adj::Adj;
use tokio::net::TcpListener;

mod handlers;
mod server;

pub use server::serve_with_websocket;

/// Serves the catalogs without connecting a WebSocket consumer yet.
///
/// Preserves the entry point used by the test startup code. Upgrade requests
/// to `/backend` receive `503` until [`serve_with_websocket`] is used with a
/// channel connected to the future WebSocket module.
pub async fn serve(listener: TcpListener, adj: &Adj) -> io::Result<()> {
    serve_with_websocket(listener, adj, None).await
}
