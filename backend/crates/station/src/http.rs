//! Station HTTP API: ADJ catalogs and incoming WebSocket connections.
//!
//! This module only negotiates WebSocket upgrades and hands sockets to a
//! channel. Message handling and client management belong to the future
//! WebSocket module, which will own the channel's receiver.

use std::io;

use axum::extract::ws::WebSocket;
use software_core::adj::Adj;
use tokio::{net::TcpListener, sync::mpsc};

use crate::http::server::setup_router;

mod handlers;
mod server;

/// Serves the ADJ catalogs and the WebSocket upgrade endpoint.
pub async fn serve(
    listener: TcpListener,
    adj: &Adj,
    ws: Option<mpsc::Sender<WebSocket>>,
) -> io::Result<()> {
    axum::serve(listener, setup_router(adj, ws)?).await
}
