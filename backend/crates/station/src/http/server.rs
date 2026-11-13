use std::{io, sync::Arc};

use axum::{Router, routing::get};
use software_core::adj::Adj;
use tokio::net::TcpListener;

use crate::http::handlers::{Responses, data_packet, order_packet, protection_packet};

/// Serves HTTP requests on an already-bound listener.
///
/// The caller chooses the interface and port when binding the listener.
/// This future runs until the server stops; await it or spawn it on Tokio.
///
/// # Errors
///
/// Returns errors serializing the catalogs at startup or reported by Axum's server.
pub async fn serve(listener: TcpListener, adj: &Adj) -> io::Result<()> {
    axum::serve(listener, router(adj)?).await
}

fn router(adj: &Adj) -> io::Result<Router> {
    let responses = Arc::new(Responses::new(adj).map_err(io::Error::other)?);

    Ok(Router::new()
        .route("/backend/adj/DataPackets", get(data_packet))
        .route("/backend/adj/OrderPackets", get(order_packet))
        .route("/backend/adj/ProtectionPackets", get(protection_packet))
        .with_state(responses))
}

#[cfg(test)]
mod tests {
    use std::path::Path;

    use axum::{
        body::{Body, to_bytes},
        http::{Request, StatusCode, header},
    };
    use software_core::adj::{
        Adj,
        http::{data_response, order_response, protection_response},
        load_from_dir,
    };
    use tower::ServiceExt;

    use super::router;

    const PATHS: [&str; 3] = [
        "/backend/adj/DataPackets",
        "/backend/adj/OrderPackets",
        "/backend/adj/ProtectionPackets",
    ];

    #[tokio::test]
    async fn catalogs_return_cached_json() -> Result<(), Box<dyn std::error::Error>> {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../core/src/adj/test/adj");
        let adj = load_from_dir(&path)?;
        let expected = [
            serde_json::to_value(data_response(&adj))?,
            serde_json::to_value(order_response(&adj))?,
            serde_json::to_value(protection_response(&adj))?,
        ];
        let app = router(&adj)?;
        drop(adj);

        for (path, expected) in PATHS.into_iter().zip(expected) {
            let mut previous_body = None;
            for _ in 0..2 {
                let response = app
                    .clone()
                    .oneshot(Request::builder().uri(path).body(Body::empty())?)
                    .await?;

                assert_eq!(response.status(), StatusCode::OK);
                assert_eq!(response.headers()[header::CONTENT_TYPE], "application/json");
                let body = to_bytes(response.into_body(), usize::MAX).await?;
                let actual: serde_json::Value = serde_json::from_slice(&body)?;
                assert_eq!(actual, expected);
                if let Some(previous) = previous_body {
                    assert_eq!(body, previous);
                }
                previous_body = Some(body);
            }
        }
        Ok(())
    }

    #[tokio::test]
    async fn empty_catalogs_return_json_objects() -> Result<(), Box<dyn std::error::Error>> {
        let app = router(&Adj::default())?;
        let expected = [
            serde_json::json!({"boards": []}),
            serde_json::json!({"boards": []}),
            serde_json::json!({"protections": [], "info": {}}),
        ];

        for (path, expected) in PATHS.into_iter().zip(expected) {
            let response = app
                .clone()
                .oneshot(Request::builder().uri(path).body(Body::empty())?)
                .await?;
            assert_eq!(response.status(), StatusCode::OK);
            let body = to_bytes(response.into_body(), 1024).await?;
            let actual: serde_json::Value = serde_json::from_slice(&body)?;
            assert_eq!(actual, expected);
        }
        Ok(())
    }
}
