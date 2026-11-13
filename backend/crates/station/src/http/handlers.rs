//! Handlers for precomputed catalogs and WebSocket upgrades.

use std::sync::Arc;

use axum::{
    body::Bytes,
    extract::{State, WebSocketUpgrade, ws::WebSocket},
    http::{StatusCode, header},
    response::{IntoResponse, Response},
};
use software_core::adj::Adj;
use tokio::sync::mpsc;

/// Immutable state shared by all requests without a mutex.
pub(super) struct HttpState {
    responses: Responses,
    websocket_connections: Option<mpsc::Sender<WebSocket>>,
}

impl HttpState {
    pub(super) fn new(
        adj: &Adj,
        websocket_connections: Option<mpsc::Sender<WebSocket>>,
    ) -> Result<Self, serde_json::Error> {
        Ok(Self {
            responses: Responses::new(adj)?,
            websocket_connections,
        })
    }
}

/// Pre-serialized JSON. Each Bytes clone shares the same underlying content.
struct Responses {
    data_response: Bytes,
    order_response: Bytes,
    protection_response: Bytes,
}

impl Responses {
    // ADJ transformation and serialization happen only at startup.
    fn new(adj: &Adj) -> Result<Self, serde_json::Error> {
        Ok(Self {
            data_response: serde_json::to_vec(&adj.data_response())?.into(),
            order_response: serde_json::to_vec(&adj.order_response())?.into(),
            protection_response: serde_json::to_vec(&adj.protection_response())?.into(),
        })
    }
}

pub(super) async fn data_packet(State(state): State<Arc<HttpState>>) -> Response {
    json_response(state.responses.data_response.clone())
}

pub(super) async fn order_packet(State(state): State<Arc<HttpState>>) -> Response {
    json_response(state.responses.order_response.clone())
}

pub(super) async fn protection_packet(State(state): State<Arc<HttpState>>) -> Response {
    json_response(state.responses.protection_response.clone())
}

/// Negotiates the connection without reading messages or implementing the frontend protocol.
pub(super) async fn websocket(
    State(state): State<Arc<HttpState>>,
    upgrade: WebSocketUpgrade,
) -> Response {
    let Some(connections) = &state.websocket_connections else {
        return StatusCode::SERVICE_UNAVAILABLE.into_response();
    };

    // Reserve a slot before returning 101: a closed or full channel must reject
    // the request rather than accept a socket that cannot be handed off.
    let permit = match connections.clone().try_reserve_owned() {
        Ok(permit) => permit,
        Err(_) => return StatusCode::SERVICE_UNAVAILABLE.into_response(),
    };

    upgrade
        .on_failed_upgrade(|error| {
            tracing::warn!(%error, "falló el upgrade WebSocket");
        })
        .on_upgrade(move |socket| async move {
            // The receiver now owns the socket and manages its lifetime and
            // closure. If the receiver disappears, the socket is dropped.
            permit.send(socket);
        })
}

fn json_response(body: Bytes) -> Response {
    // Do not wrap these bytes in Json: that would serialize the content again.
    ([(header::CONTENT_TYPE, "application/json")], body).into_response()
}
