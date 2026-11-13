//! Router construction and server execution using an existing listener.

use std::{io, sync::Arc};

use axum::{Router, extract::ws::WebSocket, routing::get};
use software_core::adj::Adj;
use tokio::{net::TcpListener, sync::mpsc};

use super::handlers::{HttpState, data_packet, order_packet, protection_packet, websocket};

/// Serves the catalogs and hands connections to the future WebSocket module.
///
/// The caller chooses the address and port when binding the listener. To enable
/// WebSocket, pass `Some(sender)` from a bounded channel and keep its receiver
/// in the module that will manage the sockets. With `None`, a closed receiver,
/// or a full channel, upgrade requests receive `503`.
///
/// This future runs until the server stops; await it or spawn it on Tokio.
///
/// # Errors
///
/// Propagates errors serializing the catalogs or running the Axum server.
pub async fn serve_with_websocket(
    listener: TcpListener,
    adj: &Adj,
    websocket_connections: Option<mpsc::Sender<WebSocket>>,
) -> io::Result<()> {
    axum::serve(listener, router(adj, websocket_connections)?).await
}

fn router(adj: &Adj, websocket_connections: Option<mpsc::Sender<WebSocket>>) -> io::Result<Router> {
    // Build and serialize the catalogs once, before accepting requests. The
    // state retains the bytes even after the Adj is dropped.
    let state = Arc::new(HttpState::new(adj, websocket_connections).map_err(io::Error::other)?);

    Ok(Router::new()
        .route("/backend/adj/DataPackets", get(data_packet))
        .route("/backend/adj/OrderPackets", get(order_packet))
        .route("/backend/adj/ProtectionPackets", get(protection_packet))
        .route("/backend", get(websocket))
        .with_state(state))
}

#[cfg(test)]
mod tests {
    use std::{io, path::Path, time::Duration};

    use axum::{
        body::{Body, to_bytes},
        http::{Request, StatusCode, header},
    };
    use software_core::adj::{Adj, load_from_dir};
    use tokio::{
        io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
        net::{TcpListener, TcpStream},
        sync::{mpsc, oneshot},
        time::timeout,
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
            serde_json::to_value(&adj.data_response())?,
            serde_json::to_value(&adj.order_response())?,
            serde_json::to_value(&adj.protection_response())?,
        ];
        let app = router(&adj, None)?;
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
        let app = router(&Adj::default(), None)?;
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

    // Upgrades require a real HTTP connection: oneshot does not provide Hyper's
    // OnUpgrade extension. The server only runs for the duration of the test.
    async fn handshake(
        app: axum::Router,
    ) -> Result<(String, TcpStream), Box<dyn std::error::Error>> {
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        let address = listener.local_addr()?;
        let (shutdown, stopped) = oneshot::channel();
        let server = tokio::spawn(async move {
            axum::serve(listener, app)
                .with_graceful_shutdown(async move {
                    let _ = stopped.await;
                })
                .await
        });

        let response = timeout(Duration::from_secs(5), async {
            let mut stream = TcpStream::connect(address).await?;
            let request = format!(
                "GET /backend HTTP/1.1\r\n\
                 Host: {address}\r\n\
                 Connection: Upgrade\r\n\
                 Upgrade: websocket\r\n\
                 Sec-WebSocket-Version: 13\r\n\
                 Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\n\r\n"
            );
            stream.write_all(request.as_bytes()).await?;

            let mut reader = BufReader::new(stream);
            let mut headers = String::new();
            while !headers.ends_with("\r\n\r\n") {
                if reader.read_line(&mut headers).await? == 0 {
                    return Err(io::Error::from(io::ErrorKind::UnexpectedEof));
                }
            }
            Ok((headers, reader.into_inner()))
        })
        .await;

        let _ = shutdown.send(());
        timeout(Duration::from_secs(5), server).await???;
        Ok(response??)
    }

    #[tokio::test]
    async fn websocket_upgrade_delivers_the_socket() -> Result<(), Box<dyn std::error::Error>> {
        let (connections, mut receiver) = mpsc::channel(1);
        let app = router(&Adj::default(), Some(connections.clone()))?;
        let (headers, _client) = handshake(app).await?;

        assert!(headers.starts_with("HTTP/1.1 101 Switching Protocols\r\n"));
        assert!(
            headers
                .to_ascii_lowercase()
                .contains("sec-websocket-accept: s3pplmbitxaq9kygzzhzrbk+xoo=\r\n")
        );
        let socket = timeout(Duration::from_secs(5), receiver.recv())
            .await?
            .ok_or_else(|| io::Error::other("no se entregó el socket"))?;
        assert_eq!(connections.capacity(), 1);
        drop(socket);
        Ok(())
    }

    #[tokio::test]
    async fn websocket_without_a_consumer_returns_unavailable()
    -> Result<(), Box<dyn std::error::Error>> {
        let app = router(&Adj::default(), None)?;
        let (headers, _client) = handshake(app).await?;
        assert!(headers.starts_with("HTTP/1.1 503 Service Unavailable\r\n"));
        Ok(())
    }

    #[tokio::test]
    async fn websocket_with_a_closed_channel_returns_unavailable()
    -> Result<(), Box<dyn std::error::Error>> {
        let (connections, receiver) = mpsc::channel(1);
        drop(receiver);
        let app = router(&Adj::default(), Some(connections))?;
        let (headers, _client) = handshake(app).await?;
        assert!(headers.starts_with("HTTP/1.1 503 Service Unavailable\r\n"));
        Ok(())
    }

    #[tokio::test]
    async fn websocket_with_a_full_channel_returns_unavailable()
    -> Result<(), Box<dyn std::error::Error>> {
        let (connections, _receiver) = mpsc::channel(1);
        // Simulate an occupied slot without requiring another test socket.
        let reservation = connections.clone().try_reserve_owned()?;
        let app = router(&Adj::default(), Some(connections))?;
        let (headers, _client) = handshake(app).await?;
        assert!(headers.starts_with("HTTP/1.1 503 Service Unavailable\r\n"));
        drop(reservation);
        Ok(())
    }

    #[tokio::test]
    async fn websocket_rejects_requests_without_upgrade_headers()
    -> Result<(), Box<dyn std::error::Error>> {
        let (connections, mut receiver) = mpsc::channel(1);
        let app = router(&Adj::default(), Some(connections.clone()))?;
        let response = app
            .oneshot(Request::builder().uri("/backend").body(Body::empty())?)
            .await?;

        assert_eq!(response.status(), StatusCode::BAD_REQUEST);
        assert_eq!(connections.capacity(), 1);
        assert!(matches!(
            receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Empty)
        ));
        Ok(())
    }
}
