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
pub(super) mod tests {
    use std::{io, path::Path, time::Duration};

    use axum::{
        body::{Body, to_bytes},
        http::{Method, Request, StatusCode, header},
    };
    use software_core::adj::{Adj, load_from_dir};
    use tokio::{
        io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader},
        net::{TcpListener, TcpStream},
        sync::{mpsc, oneshot},
        time::timeout,
    };
    use tower::ServiceExt;

    use super::setup_router;

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
    async fn handshake(
        app: axum::Router,
    ) -> Result<(String, TcpStream), Box<dyn std::error::Error>> {
        let listener = TcpListener::bind("127.0.0.1:0").await?;
        handshake_on(listener, app).await
    }

    pub(in crate::http) async fn handshake_on(
        listener: TcpListener,
        app: axum::Router,
    ) -> Result<(String, TcpStream), Box<dyn std::error::Error>> {
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
    async fn websocket_subscription_receives_connection_snapshots()
    -> Result<(), Box<dyn std::error::Error>> {
        use crate::websocket::payload::{Connection, StateOrdersUpdate};

        let (broker, client) = crate::websocket::broker::Broker::new();
        let broker_worker = tokio::spawn(broker.run());
        let (connections, receiver) = mpsc::channel(1);
        let worker = tokio::spawn(crate::websocket::run(receiver, client.clone(), None));
        let app = setup_router(&Adj::default(), Some(connections))?;
        let (headers, mut first) = handshake(app.clone()).await?;
        assert!(headers.starts_with("HTTP/1.1 101 Switching Protocols\r\n"));
        let (_headers, mut second) = handshake(app).await?;

        timeout(Duration::from_secs(5), async {
            send_text(
                &mut first,
                r#"{"topic":"connection/heartbeat","payload":{}}"#,
            )
            .await?;
            // Other frontend topics can be added incrementally without closing the socket.
            send_text(
                &mut first,
                r#"{"topic":"not-a-topic","payload":{"subscribe":true}}"#,
            )
            .await?;
            send_text(
                &mut first,
                r#"{"topic":"connection/update","payload":{"subscribe":true}}"#,
            )
            .await?;
            assert_eq!(
                read_json(&mut first).await?,
                serde_json::json!({
                    "topic": "connection/update", "payload": {}
                })
            );

            client
                .publish_connection(Connection {
                    name: "LCU".into(),
                    is_connected: true,
                })
                .await?;
            let expected = serde_json::json!({
                "topic": "connection/update",
                "payload": {"LCU": {"name": "LCU", "isConnected": true}}
            });
            assert_eq!(read_json(&mut first).await?, expected);

            // A client receives nothing before subscribing, then receives the current map.
            assert!(
                timeout(Duration::from_millis(50), second.read_u8())
                    .await
                    .is_err()
            );
            send_text(&mut second, r#"{"topic":"connection/update","payload":{}}"#).await?;
            assert_eq!(read_json(&mut second).await?, expected);

            client
                .publish_connection(Connection {
                    name: "HVBMS".into(),
                    is_connected: false,
                })
                .await?;
            let expected = serde_json::json!({
                "topic": "connection/update",
                "payload": {
                    "LCU": {"name": "LCU", "isConnected": true},
                    "HVBMS": {"name": "HVBMS", "isConnected": false}
                }
            });
            assert_eq!(read_json(&mut first).await?, expected);
            assert_eq!(read_json(&mut second).await?, expected);

            send_text(
                &mut first,
                r#"{"topic":"order/stateOrders","payload":{"subscribe":true}}"#,
            )
            .await?;
            assert_eq!(
                read_json(&mut first).await?,
                serde_json::json!({
                    "topic": "order/stateOrders", "payload": {}
                })
            );
            send_text(
                &mut second,
                r#"{"topic":"logger/response","payload":{"subscribe":true}}"#,
            )
            .await?;
            assert_eq!(
                read_json(&mut second).await?,
                serde_json::json!({
                    "topic": "logger/response", "payload": false
                })
            );

            client
                .publish_state_orders(StateOrdersUpdate::from([("LCU".into(), vec![1001])]))
                .await?;
            assert_eq!(
                read_json(&mut first).await?,
                serde_json::json!({
                    "topic": "order/stateOrders", "payload": {"LCU": [1001]}
                })
            );
            assert!(
                timeout(Duration::from_millis(50), second.read_u8())
                    .await
                    .is_err()
            );

            client.publish_logger(true).await?;
            assert_eq!(
                read_json(&mut second).await?,
                serde_json::json!({
                    "topic": "logger/response", "payload": true
                })
            );
            assert!(
                timeout(Duration::from_millis(50), first.read_u8())
                    .await
                    .is_err()
            );

            // The logger snapshot confirms the preceding unsubscribe was handled.
            send_text(
                &mut first,
                r#"{"topic":"order/stateOrders","payload":{"subscribe":false}}"#,
            )
            .await?;
            send_text(
                &mut first,
                r#"{"topic":"logger/response","payload":{"subscribe":true}}"#,
            )
            .await?;
            assert_eq!(
                read_json(&mut first).await?,
                serde_json::json!({
                    "topic": "logger/response", "payload": true
                })
            );
            client
                .publish_state_orders(StateOrdersUpdate::from([("LCU".into(), vec![])]))
                .await?;
            assert!(
                timeout(Duration::from_millis(50), first.read_u8())
                    .await
                    .is_err()
            );

            // Resubscribing recovers the latest full state, including empty lists.
            send_text(&mut first, r#"{"topic":"order/stateOrders","payload":{}}"#).await?;
            assert_eq!(
                read_json(&mut first).await?,
                serde_json::json!({
                    "topic": "order/stateOrders", "payload": {"LCU": []}
                })
            );
            client.publish_logger(false).await?;
            let expected = serde_json::json!({"topic": "logger/response", "payload": false});
            assert_eq!(read_json(&mut first).await?, expected);
            assert_eq!(read_json(&mut second).await?, expected);

            for socket in [&mut first, &mut second] {
                socket.write_all(&[0x88, 0x80, 0, 0, 0, 0]).await?;
                assert_eq!(socket.read_u8().await?, 0x88);
            }
            Ok::<_, Box<dyn std::error::Error>>(())
        })
        .await??;
        drop(client);
        worker.await?;
        timeout(Duration::from_secs(5), broker_worker).await??;
        Ok(())
    }

    #[tokio::test]
    async fn websocket_telemetry_sends_complete_snapshots() -> Result<(), Box<dyn std::error::Error>>
    {
        use crate::websocket::payload::{DataPacketUpdate, MeasurementUpdate};
        use software_core::model::AdjId;

        let (broker, client) = crate::websocket::broker::Broker::new();
        let broker_worker = tokio::spawn(broker.run());
        let (connections, receiver) = mpsc::channel(1);
        let worker = tokio::spawn(crate::websocket::run(receiver, client.clone(), None));
        let app = setup_router(&Adj::default(), Some(connections))?;
        let (_, mut first) = handshake(app.clone()).await?;
        let (_, mut second) = handshake(app).await?;

        timeout(Duration::from_secs(5), async {
            send_text(
                &mut first,
                r#"{"topic":"podData/update","payload":{"subscribe":true}}"#,
            )
            .await?;
            assert_eq!(
                read_json(&mut first).await?,
                serde_json::json!({
                    "topic": "podData/update", "payload": {}
                })
            );

            let packet = DataPacketUpdate {
                id: AdjId(1000),
                hex_value: "e8030000bc41".into(),
                count: 1,
                cycle_time: 100_000_000,
                measurement_updates: std::collections::HashMap::from([(
                    "temperature".into(),
                    MeasurementUpdate::Numeric {
                        last: 23.5,
                        average: 23.0,
                    },
                )]),
            };
            client.publish_data(packet.clone()).await?;
            let expected = serde_json::json!({
                "topic": "podData/update",
                "payload": {"1000": {
                    "id": 1000, "hexValue": "e8030000bc41", "count": 1, "cycleTime": 100_000_000,
                    "measurementUpdates": {"temperature": {"last": 23.5, "average": 23.0}}
                }}
            });
            assert_eq!(read_json(&mut first).await?, expected);

            send_text(&mut second, r#"{"topic":"podData/update","payload":{}}"#).await?;
            assert_eq!(read_json(&mut second).await?, expected);
            client
                .publish_data(DataPacketUpdate {
                    id: AdjId(1001),
                    hex_value: "e9030000bc41".into(),
                    ..packet
                })
                .await?;
            let updated = read_json(&mut first).await?;
            assert_eq!(updated["topic"], "podData/update");
            assert_eq!(updated["payload"].as_object().map(|map| map.len()), Some(2));
            assert_eq!(updated["payload"]["1000"], expected["payload"]["1000"]);
            assert_eq!(updated["payload"]["1001"]["id"], 1001);
            assert_eq!(read_json(&mut second).await?, updated);

            for socket in [&mut first, &mut second] {
                socket.write_all(&[0x88, 0x80, 0, 0, 0, 0]).await?;
                assert_eq!(socket.read_u8().await?, 0x88);
            }
            Ok::<_, Box<dyn std::error::Error>>(())
        })
        .await??;
        drop(client);
        worker.await?;
        timeout(Duration::from_secs(5), broker_worker).await??;
        Ok(())
    }

    #[tokio::test]
    async fn websocket_event_subscriptions_deliver_live_payloads()
    -> Result<(), Box<dyn std::error::Error>> {
        use crate::websocket::{
            broker::Broker,
            payload::{
                MessageKind, MessagePayload, MessageTimestamp, MessageUpdate, ProtectionUpdate,
            },
        };
        use serde_json::json;
        use software_core::model::{AdjId, ShortTimestamp, Value};

        let (broker, client) = Broker::new();
        let broker_worker = tokio::spawn(broker.run());
        let (sockets, receiver) = mpsc::channel(1);
        let worker = tokio::spawn(crate::websocket::run(receiver, client.clone(), None));
        let message = MessageUpdate {
            kind: MessageKind::Info,
            payload: MessagePayload::Text("Order Sent".into()),
            board: "LCU".into(),
            name: "1001".into(),
            timestamp: MessageTimestamp {
                counter: 0,
                second: 5,
                minute: 30,
                hour: 12,
                day: 24,
                month: 11,
                year: 2026,
            },
        };
        let protection = ProtectionUpdate {
            id: AdjId(11192),
            value: Value::Number(105.5),
            timestamp: ShortTimestamp {
                hour: 12,
                minute: 30,
                second: 6,
                subsecond: 0,
            },
        };
        let expected_message: serde_json::Value =
            serde_json::from_str(include_str!("../websocket/payload/example/message.json"))?;
        let expected_protection: serde_json::Value =
            serde_json::from_str(include_str!("../websocket/payload/example/protection.json"))?;
        let (_, mut socket) = handshake(setup_router(&Adj::default(), Some(sockets))?).await?;

        timeout(Duration::from_secs(5), async {
            let mut logger = client.subscribe_logger();
            client
                .publish_message(MessageUpdate {
                    payload: MessagePayload::Text("Before subscribing".into()),
                    ..message.clone()
                })
                .await?;
            client.publish_logger(true).await?;
            logger.changed().await?;
            send_text(&mut socket, r#"{"topic":"message/update","payload":{}}"#).await?;
            send_text(
                &mut socket,
                r#"{"topic":"protection/update","payload":{"subscribe":true}}"#,
            )
            .await?;
            // The state snapshot confirms the preceding subscriptions were processed.
            send_text(&mut socket, r#"{"topic":"logger/response","payload":{}}"#).await?;
            assert_eq!(
                read_json(&mut socket).await?,
                json!({"topic": "logger/response", "payload": true})
            );

            client.publish_message(message.clone()).await?;
            assert_eq!(read_json(&mut socket).await?, expected_message);
            client.publish_protection(protection.clone()).await?;
            assert_eq!(read_json(&mut socket).await?, expected_protection);

            send_text(
                &mut socket,
                r#"{"topic":"message/update","payload":{"subscribe":false}}"#,
            )
            .await?;
            send_text(&mut socket, r#"{"topic":"connection/update","payload":{}}"#).await?;
            assert_eq!(
                read_json(&mut socket).await?,
                json!({"topic": "connection/update", "payload": {}})
            );
            client
                .publish_message(MessageUpdate {
                    payload: MessagePayload::Text("While unsubscribed".into()),
                    ..message
                })
                .await?;
            client.publish_protection(protection).await?;
            assert_eq!(read_json(&mut socket).await?, expected_protection);
            assert!(
                timeout(Duration::from_millis(50), socket.read_u8())
                    .await
                    .is_err()
            );

            socket.write_all(&[0x88, 0x80, 0, 0, 0, 0]).await?;
            assert_eq!(socket.read_u8().await?, 0x88);
            Ok::<_, Box<dyn std::error::Error>>(())
        })
        .await??;
        drop(client);
        worker.await?;
        timeout(Duration::from_secs(5), broker_worker).await??;
        Ok(())
    }

    #[tokio::test]
    async fn websocket_forwards_validated_orders_in_adj_order()
    -> Result<(), Box<dyn std::error::Error>> {
        use crate::websocket::{OrderForwarder, broker::Broker};
        use software_core::{
            model::{AdjId, OrderPacket, Value},
            protocol::Index,
        };
        use std::sync::Arc;

        let path = Path::new(env!("CARGO_MANIFEST_DIR")).join("../core/src/adj/test/adj");
        let adj = load_from_dir(&path)?;
        let index = Arc::new(Index::new(&adj.pod_data, None));
        let (order_tx, mut orders) = mpsc::channel(1);
        let forwarder = OrderForwarder::new(index, order_tx);
        let (broker, client) = Broker::new();
        let broker_worker = tokio::spawn(broker.run());
        let (connections, receiver) = mpsc::channel(1);
        let worker = tokio::spawn(crate::websocket::run(receiver, client, Some(forwarder)));
        let (_, mut socket) = handshake(setup_router(&adj, Some(connections))?).await?;

        timeout(Duration::from_secs(5), async {
            for invalid in [
                r#"{"topic":"order/send","payload":{"id":65535,"fields":{}}}"#,
                r#"{"topic":"order/send","payload":{"id":809,"fields":{}}}"#,
                r#"{"topic":"order/send","payload":{"id":801,"fields":{"extra":{"value":0,"type":"uint8"}}}}"#,
                r#"{"topic":"order/send","payload":{"id":809,"fields":{"desired_current":{"value":12.5,"type":"float64"},"lpu_id":{"value":2,"type":"uint32"}}}}"#,
                r#"{"topic":"order/send","payload":{"id":809,"fields":{"desired_current":{"value":12.5,"type":"float32"},"lpu_id":{"value":2.5,"type":"uint32"}}}}"#,
            ] {
                send_text(&mut socket, invalid).await?;
            }
            send_text(&mut socket, r#"{"topic":"order/send","payload":{"id":809,"fields":{"desired_current":{"value":12.5,"type":"float32"},"lpu_id":{"value":2,"type":"uint32"}}}}"#).await?;
            let stop = r#"{"topic":"order/send","payload":{"id":801,"fields":{}}}"#;
            send_text(&mut socket, stop).await?;

            // The snapshot confirms both requests reached the receiver before we free the queue.
            send_text(&mut socket, r#"{"topic":"connection/update","payload":{}}"#).await?;
            assert_eq!(read_json(&mut socket).await?["topic"], "connection/update");
            assert_eq!(orders.recv().await, Some(OrderPacket::new(
                AdjId(809), vec![Value::Number(2.0), Value::Number(12.5)],
            )));
            assert!(matches!(orders.try_recv(), Err(mpsc::error::TryRecvError::Empty)));

            send_text(&mut socket, stop).await?;
            assert_eq!(orders.recv().await, Some(OrderPacket::new(AdjId(801), vec![])));

            socket.write_all(&[0x88, 0x80, 0, 0, 0, 0]).await?;
            assert_eq!(socket.read_u8().await?, 0x88);
            Ok::<_, Box<dyn std::error::Error>>(())
        }).await??;
        worker.await?;
        timeout(Duration::from_secs(5), broker_worker).await??;
        Ok(())
    }

    async fn send_text(
        client: &mut TcpStream,
        text: &str,
    ) -> Result<(), Box<dyn std::error::Error>> {
        // A zero mask leaves the test JSON unchanged.
        let length = u16::try_from(text.len())?;
        if length < 126 {
            client.write_all(&[0x81, 0x80 | length as u8]).await?;
        } else {
            client.write_all(&[0x81, 0xfe]).await?;
            client.write_u16(length).await?;
        }
        client.write_all(&[0; 4]).await?;
        client.write_all(text.as_bytes()).await?;
        Ok(())
    }

    async fn read_json(
        client: &mut TcpStream,
    ) -> Result<serde_json::Value, Box<dyn std::error::Error>> {
        assert_eq!(client.read_u8().await?, 0x81);
        let header = client.read_u8().await?;
        assert_eq!(header & 0x80, 0, "server frames must not be masked");
        let length = match header {
            126 => usize::from(client.read_u16().await?),
            127 => usize::try_from(client.read_u64().await?)?,
            length => usize::from(length),
        };
        let mut body = vec![0; length];
        client.read_exact(&mut body).await?;
        Ok(serde_json::from_slice(&body)?)
    }

    #[tokio::test]
    async fn websocket_without_a_consumer_returns_unavailable()
    -> Result<(), Box<dyn std::error::Error>> {
        let app = setup_router(&Adj::default(), None)?;
        let (headers, _client) = handshake(app).await?;
        assert!(headers.starts_with("HTTP/1.1 503 Service Unavailable\r\n"));
        Ok(())
    }

    #[tokio::test]
    async fn websocket_with_a_closed_channel_returns_unavailable()
    -> Result<(), Box<dyn std::error::Error>> {
        let (connections, receiver) = mpsc::channel(1);
        drop(receiver);
        let app = setup_router(&Adj::default(), Some(connections))?;
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
        let app = setup_router(&Adj::default(), Some(connections))?;
        let (headers, _client) = handshake(app).await?;
        assert!(headers.starts_with("HTTP/1.1 503 Service Unavailable\r\n"));
        drop(reservation);
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
