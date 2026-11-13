use std::io;

use axum::{Router, routing::get};
use software_core::adj::Adj;
use tokio::{net::TcpListener};
use std::sync::Arc;

use crate::http::handlers::{Responses, data_packet, order_packet, protection_packet};

/// Serves HTTP requests on an already-bound listener.
///
/// The caller chooses the interface and port when binding the listener.
/// This future runs until the server stops; await it or spawn it on Tokio.
///
/// # Errors
///
/// Returns errors reported by Axum's server.
pub async fn serve(listener: TcpListener, adj: &Adj) -> io::Result<()> {
    axum::serve(listener, router(adj)).await
}

fn router(adj: &Adj) -> Router {    
    let responses = Arc::new(Responses::new(adj));

    Router::new()
        .route(
            "/backend/adj/DataPackets", 
            get(data_packet)
        )
        .route(
            "/backend/adj/OrderPackets", 
            get(order_packet)
        )
        .route(
            "/backend/adj/ProtectionPackets",
             get(protection_packet)
        )
        .with_state(responses)
}