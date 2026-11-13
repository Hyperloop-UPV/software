use std::sync::Arc;

use axum::{Json, extract::State};
use software_core::{adj::{Adj, http::{DataResponse, OrderResponse, ProtectionResponse, data_response, order_response, protection_response}}};

pub(super) struct Responses {
    pub(super) data_response: DataResponse,
    pub(super) order_response: OrderResponse,
    pub(super) protection_response: ProtectionResponse
}

impl Responses {
    pub fn new(adj: &Adj) -> Self {
        Self {
            data_response: data_response(adj),
            order_response: order_response(adj),
            protection_response: protection_response(adj)
        } 
    }
}

pub(super) async fn data_packet(State(responses): State<Arc<Responses>>) -> Json<DataResponse> {
    Json(responses.data_response.clone())
}

pub(super) async fn order_packet(State(responses): State<Arc<Responses>>) -> Json<OrderResponse> {
    Json(responses.order_response.clone())
}

pub(super) async fn protection_packet(State(responses): State<Arc<Responses>>) -> Json<ProtectionResponse> {
    Json(responses.protection_response.clone())
}

