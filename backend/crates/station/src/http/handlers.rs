use std::sync::Arc;

use axum::{
    body::Bytes,
    extract::State,
    http::header,
    response::{IntoResponse, Response},
};
use software_core::adj::{
    Adj,
    http::{data_response, order_response, protection_response},
};

pub(super) struct Responses {
    data_response: Bytes,
    order_response: Bytes,
    protection_response: Bytes,
}

impl Responses {
    // Serialize once at startup; Bytes clones share the existing JSON buffer.
    pub(super) fn new(adj: &Adj) -> Result<Self, serde_json::Error> {
        Ok(Self {
            data_response: serde_json::to_vec(&data_response(adj))?.into(),
            order_response: serde_json::to_vec(&order_response(adj))?.into(),
            protection_response: serde_json::to_vec(&protection_response(adj))?.into(),
        })
    }
}

pub(super) async fn data_packet(State(responses): State<Arc<Responses>>) -> Response {
    json_response(responses.data_response.clone())
}

pub(super) async fn order_packet(State(responses): State<Arc<Responses>>) -> Response {
    json_response(responses.order_response.clone())
}

pub(super) async fn protection_packet(State(responses): State<Arc<Responses>>) -> Response {
    json_response(responses.protection_response.clone())
}

fn json_response(body: Bytes) -> Response {
    ([(header::CONTENT_TYPE, "application/json")], body).into_response()
}
