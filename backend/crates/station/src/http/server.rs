//! Router construction and server execution using an existing listener.

use std::{io, sync::Arc};

use axum::{
    Router,
    extract::ws::WebSocket,
    http::{HeaderValue, header},
    routing::get,
};
use software_core::adj::Adj;
use tokio::sync::mpsc;
use tower_http::{cors::CorsLayer, set_header::SetResponseHeaderLayer};

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
pub(super) fn setup_router(
    adj: &Adj,
    websocket_connections: Option<mpsc::Sender<WebSocket>>,
) -> io::Result<Router> {
    // Build and serialize the catalogs once, before accepting requests. The
    // state retains the bytes even after the Adj is dropped.
    let state = Arc::new(HttpState::new(adj, websocket_connections).map_err(io::Error::other)?);

    Ok(Router::new()
        .route("/backend/adj/DataPackets", get(data_packet))
        .route("/backend/adj/OrderPackets", get(order_packet))
        .route("/backend/adj/ProtectionPackets", get(protection_packet))
        .route("/backend/ws", get(websocket))
        .layer(CorsLayer::permissive())
        .layer(SetResponseHeaderLayer::overriding(
            header::CACHE_CONTROL,
            HeaderValue::from_static("no-cache"),
        ))
        .with_state(state))
}

#[cfg(test)]
mod tests {
    use std::{io, path::Path, sync::Arc, time::Duration};

    use axum::{
        body::{Body, to_bytes},
        http::{Method, Request, StatusCode, header},
    };
    use software_core::{
        adj::{Adj, load_from_dir},
        model::{AdjId, OrderPacket, ShortTimestamp, Value},
        protocol::Index,
    };
    use tokio::{
        io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader},
        net::{TcpListener, TcpStream},
        sync::{mpsc, oneshot},
        time::{Instant, timeout},
    };
    use tower::ServiceExt;

    use super::setup_router;
    use crate::websocket::{
        self, Commands, OrderForwarder, broker::Broker, payload::ProtectionUpdate,
    };

    pub(in crate::http) const PATHS: [&str; 3] = [
        "/backend/adj/DataPackets",
        "/backend/adj/OrderPackets",
        "/backend/adj/ProtectionPackets",
    ];

    #[tokio::test]
    async fn catalogs_return_precomputed_json() -> Result<(), Box<dyn std::error::Error>> {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../core/src/adj/test/adj");
        let adj = load_from_dir(&path)?;
        let expected = [
            serde_json::to_value(&adj.data_response())?,
            serde_json::to_value(&adj.order_response())?,
            serde_json::to_value(&adj.protection_response())?,
        ];
        let app = setup_router(&adj, None)?;
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
        let app = setup_router(&Adj::default(), None)?;
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

    #[tokio::test]
    async fn all_routes_return_no_cache_and_allow_any_origin()
    -> Result<(), Box<dyn std::error::Error>> {
        let app = setup_router(&Adj::default(), None)?;

        for path in PATHS.into_iter().chain(["/backend/ws"]) {
            for origin in ["http://localhost:3000", "https://example.com"] {
                let response = app
                    .clone()
                    .oneshot(
                        Request::builder()
                            .uri(path)
                            .header(header::ORIGIN, origin)
                            .body(Body::empty())?,
                    )
                    .await?;

                let expected_status = if path == "/backend/ws" {
                    StatusCode::BAD_REQUEST
                } else {
                    StatusCode::OK
                };
                assert_eq!(response.status(), expected_status);
                assert_eq!(response.headers()[header::CACHE_CONTROL], "no-cache");
                assert_eq!(response.headers()[header::ACCESS_CONTROL_ALLOW_ORIGIN], "*");
                assert!(
                    !response
                        .headers()
                        .contains_key(header::ACCESS_CONTROL_ALLOW_CREDENTIALS)
                );
            }
        }
        Ok(())
    }

    #[tokio::test]
    async fn all_routes_allow_cors_preflight_with_no_cache()
    -> Result<(), Box<dyn std::error::Error>> {
        let app = setup_router(&Adj::default(), None)?;

        for path in PATHS.into_iter().chain(["/backend/ws"]) {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method(Method::OPTIONS)
                        .uri(path)
                        .header(header::ORIGIN, "http://localhost:3000")
                        .header(header::ACCESS_CONTROL_REQUEST_METHOD, "GET")
                        .header(header::ACCESS_CONTROL_REQUEST_HEADERS, "x-client-id")
                        .body(Body::empty())?,
                )
                .await?;

            assert_eq!(response.status(), StatusCode::OK);
            assert_eq!(response.headers()[header::CACHE_CONTROL], "no-cache");
            assert_eq!(response.headers()[header::ACCESS_CONTROL_ALLOW_ORIGIN], "*");
            assert_eq!(
                response.headers()[header::ACCESS_CONTROL_ALLOW_METHODS],
                "*"
            );
            assert_eq!(
                response.headers()[header::ACCESS_CONTROL_ALLOW_HEADERS],
                "*"
            );
        }
        Ok(())
    }

    // Upgrades require a real HTTP connection: oneshot does not provide Hyper's
    // OnUpgrade extension. The server only runs for the duration of the test.
    pub(super) async fn handshake(
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
                "GET /backend/ws HTTP/1.1\r\n\
                 Host: {address}\r\n\
                 Origin: http://localhost:3000\r\n\
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
        let app = setup_router(&Adj::default(), Some(connections.clone()))?;
        let (headers, _client) = handshake(app).await?;

        assert!(headers.starts_with("HTTP/1.1 101 Switching Protocols\r\n"));
        assert!(
            headers
                .to_ascii_lowercase()
                .contains("sec-websocket-accept: s3pplmbitxaq9kygzzhzrbk+xoo=\r\n")
        );
        assert!(
            headers
                .to_ascii_lowercase()
                .contains("cache-control: no-cache\r\n")
        );
        assert!(
            headers
                .to_ascii_lowercase()
                .contains("access-control-allow-origin: *\r\n")
        );
        let socket = timeout(Duration::from_secs(5), receiver.recv())
            .await?
            .ok_or_else(|| io::Error::other("no se entregó el socket"))?;
        assert_eq!(connections.capacity(), 1);
        drop(socket);
        Ok(())
    }

    #[tokio::test]
    async fn websocket_routes_messages_until_the_last_frontend_disconnects()
    -> Result<(), Box<dyn std::error::Error>> {
        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../core/src/adj/test/adj");
        let adj = load_from_dir(&path)?;
        let (order_tx, mut orders) = mpsc::channel(1);
        let commands = Commands {
            orders: Some(OrderForwarder::new(
                Arc::new(Index::new(&adj.pod_data, None)),
                order_tx,
            )),
            ..Commands::default()
        };
        let (broker, client) = Broker::new();
        let broker_task = tokio::spawn(broker.run());
        let (sockets, receiver) = mpsc::channel(1);
        let heartbeat_timeout = Duration::from_secs(3);
        let socket_task = tokio::spawn(websocket::run(
            receiver,
            client.clone(),
            commands,
            heartbeat_timeout,
        ));
        let (headers, mut socket) = handshake(setup_router(&adj, Some(sockets.clone()))?).await?;
        assert!(headers.starts_with("HTTP/1.1 101 Switching Protocols\r\n"));

        timeout(Duration::from_secs(5), async {
            send_text(&mut socket, r#"{"topic":"protection/update","payload":{}}"#).await?;
            // Receiving the snapshot confirms the preceding event subscription is active.
            send_text(&mut socket, r#"{"topic":"connection/update","payload":{}}"#).await?;
            assert_eq!(
                read_json(&mut socket).await?,
                serde_json::json!({"topic": "connection/update", "payload": {}})
            );

            client
                .publish_protection(ProtectionUpdate {
                    id: AdjId(11192),
                    value: Value::Number(105.5),
                    timestamp: ShortTimestamp {
                        hour: 12,
                        minute: 30,
                        second: 6,
                        subsecond: 0,
                    },
                })
                .await?;
            let expected: serde_json::Value = serde_json::from_str(include_str!(
                "../websocket/payload/example/protection.json"
            ))?;
            assert_eq!(read_json(&mut socket).await?, expected);

            send_text(
                &mut socket,
                r#"{"topic":"order/send","payload":{"id":809,"fields":{"desired_current":{"value":12.5,"type":"float32"},"lpu_id":{"value":2,"type":"uint32"}}}}"#,
            )
            .await?;
            assert_eq!(
                orders.recv().await,
                Some(OrderPacket::new(
                    AdjId(809),
                    vec![Value::Number(2.0), Value::Number(12.5)],
                ))
            );

            let disconnected_at = Instant::now();
            drop(socket);
            assert_eq!(socket_task.await?, Err(websocket::FrontendDisconnected));
            assert!(disconnected_at.elapsed() >= heartbeat_timeout);
            drop(sockets);
            drop(client);
            broker_task.await?;
            Ok::<_, Box<dyn std::error::Error>>(())
        })
        .await??;
        Ok(())
    }

    async fn send_text(
        socket: &mut TcpStream,
        text: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        let length = u16::try_from(text.len())?;
        if length < 126 {
            socket.write_all(&[0x81, 0x80 | length as u8]).await?;
        } else {
            socket.write_all(&[0x81, 0xfe]).await?;
            socket.write_u16(length).await?;
        }
        // The zero mask keeps the test payload bytes unchanged.
        socket.write_all(&[0; 4]).await?;
        socket.write_all(text.as_bytes()).await?;
        Ok(())
    }

    async fn read_json(
        socket: &mut TcpStream,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        assert_eq!(socket.read_u8().await?, 0x81);
        let length = match socket.read_u8().await? {
            length @ 0..=125 => usize::from(length),
            126 => usize::from(socket.read_u16().await?),
            _ => panic!("expected a short, unmasked server frame"),
        };
        let mut body = vec![0; length];
        socket.read_exact(&mut body).await?;
        Ok(serde_json::from_slice(&body)?)
    }

    #[tokio::test]
    async fn websocket_returns_unavailable_when_handoff_cannot_accept_a_socket()
    -> Result<(), Box<dyn std::error::Error>> {
        let (closed, receiver) = mpsc::channel(1);
        drop(receiver);
        let (full, _receiver) = mpsc::channel(1);
        let _reservation = full.clone().try_reserve_owned()?;

        for (case, connections) in [
            ("missing", None),
            ("closed", Some(closed)),
            ("full", Some(full)),
        ] {
            let app = setup_router(&Adj::default(), connections)?;
            let (headers, _client) = handshake(app).await?;
            assert!(
                headers.starts_with("HTTP/1.1 503 Service Unavailable\r\n"),
                "expected 503 for {case} channel, got {headers}",
            );
        }
        Ok(())
    }

    #[tokio::test]
    async fn websocket_rejects_requests_without_upgrade_headers()
    -> Result<(), Box<dyn std::error::Error>> {
        let (connections, mut receiver) = mpsc::channel(1);
        let app = setup_router(&Adj::default(), Some(connections.clone()))?;
        let response = app
            .oneshot(Request::builder().uri("/backend/ws").body(Body::empty())?)
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
