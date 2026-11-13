//! Provisional HTTP settings, validation, and server preparation.

use std::{io, net::SocketAddr};

use axum::{
    Router,
    extract::ws::WebSocket,
    http::{HeaderValue, Method, Uri, header},
};
use software_core::adj::Adj;
use tokio::{net::TcpListener, sync::mpsc};
use tower_http::cors::{AllowOrigin, CorsLayer};

use super::server::router_with_cache;

/// Provisional HTTP settings, independent of configuration files and ADJ data.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct HttpConfig {
    /// Address and port to bind. Port zero requests an available port from the OS.
    pub bind_addr: SocketAddr,
    /// Exact HTTP(S) origins permitted by CORS; an empty list grants none.
    ///
    /// Wildcards, credentials, paths, queries, and fragments are not accepted.
    /// The opaque origin `null` can be explicitly allowed for local-file clients,
    /// but it is shared by other opaque origins too, not exclusive to Electron.
    /// This list does not perform WebSocket Origin validation.
    pub allowed_origins: Vec<String>,
    /// Cache-Control policy for the three catalog routes, not WebSocket upgrades.
    pub cache_policy: CachePolicy,
}

impl HttpConfig {
    /// Uses an explicit bind address, no allowed CORS origins, and `no-store`.
    pub fn new(bind_addr: SocketAddr) -> Self {
        Self {
            bind_addr,
            allowed_origins: Vec::new(),
            cache_policy: CachePolicy::default(),
        }
    }
}

/// HTTP caching is independent of the pre-serialized buffers held by the server.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default)]
pub enum CachePolicy {
    /// Do not emit an explicit Cache-Control header.
    Unspecified,
    /// Allow storage, but require revalidation before reuse (`no-cache`).
    NoCache,
    /// Prevent clients and intermediaries from storing responses (`no-store`).
    #[default]
    NoStore,
}

impl CachePolicy {
    pub(super) fn header_value(self) -> Option<HeaderValue> {
        match self {
            Self::Unspecified => None,
            Self::NoCache => Some(HeaderValue::from_static("no-cache")),
            Self::NoStore => Some(HeaderValue::from_static("no-store")),
        }
    }
}

/// Validates settings and prepares a bound listener and router without serving.
///
/// The returned router owns the precomputed catalogs, CORS middleware, optional
/// WebSocket sender, and catalog cache policy. The caller can then run
/// `axum::serve(listener, router)`. Configuration is validated and responses are
/// serialized before binding, so invalid input does not leave a bound listener.
///
/// This function consumes already-loaded settings and ADJ data. It does not
/// read configuration files or implement WebSocket Origin checks or messages.
///
/// # Errors
///
/// Returns `InvalidInput` for invalid CORS origins, serialization errors wrapped
/// in `io::Error`, or the error from binding the configured address.
pub async fn configure_server(
    config: &HttpConfig,
    adj: &Adj,
    websocket_connections: Option<mpsc::Sender<WebSocket>>,
) -> io::Result<(TcpListener, Router)> {
    let cors = cors_layer(&config.allowed_origins)?;
    let app = router_with_cache(adj, websocket_connections, config.cache_policy)?.layer(cors);
    let listener = TcpListener::bind(config.bind_addr).await?;
    Ok((listener, app))
}

/// Validates the explicit origin list and builds CORS rules for GET and HEAD.
/// Rejects malformed origins with `InvalidInput`; an empty list permits none.
/// Handles preflight requests without enabling credentials or wildcard origins.
fn cors_layer(allowed_origins: &[String]) -> io::Result<CorsLayer> {
    let origins = allowed_origins
        .iter()
        .map(|origin| {
            let invalid = || {
                io::Error::new(
                    io::ErrorKind::InvalidInput,
                    format!("invalid CORS origin {origin:?}: expected an HTTP(S) origin or null"),
                )
            };
            let value = origin.parse::<HeaderValue>().map_err(|_| invalid())?;
            if origin == "null" {
                return Ok(value);
            }

            let uri = origin.parse::<Uri>().map_err(|_| invalid())?;
            let (Some(scheme), Some(authority)) = (uri.scheme_str(), uri.authority()) else {
                return Err(invalid());
            };
            if !matches!(scheme, "http" | "https")
                || origin != &format!("{scheme}://{authority}")
                || authority.host().is_empty()
                || authority.as_str().contains(['@', '*'])
                || (authority.as_str() != authority.host() && authority.port_u16().is_none())
            {
                return Err(invalid());
            }
            Ok(value)
        })
        .collect::<io::Result<Vec<_>>>()?;

    // CORS controls browser access, not authentication or WebSocket origins.
    Ok(CorsLayer::new()
        .allow_origin(AllowOrigin::list(origins))
        .allow_methods([Method::GET, Method::HEAD])
        .allow_headers([header::ACCEPT, header::CONTENT_TYPE]))
}

#[cfg(test)]
mod tests {
    use std::{io, time::Duration};

    use axum::{
        body::Body,
        http::{Request, StatusCode, header},
    };
    use software_core::adj::Adj;
    use tokio::{net::TcpListener, sync::mpsc, time::timeout};
    use tower::ServiceExt;

    use super::{CachePolicy, HttpConfig, configure_server, cors_layer};
    use crate::http::server::tests::{PATHS, handshake_on};

    #[tokio::test]
    async fn configuration_binds_the_requested_address_and_defaults_to_no_store()
    -> Result<(), Box<dyn std::error::Error>> {
        let config = HttpConfig::new("127.0.0.1:0".parse()?);
        assert!(config.allowed_origins.is_empty());
        assert_eq!(config.cache_policy, CachePolicy::NoStore);
        let (listener, app) = configure_server(&config, &Adj::default(), None).await?;
        assert_eq!(listener.local_addr()?.ip(), config.bind_addr.ip());
        assert_ne!(listener.local_addr()?.port(), 0);

        for path in PATHS {
            let response = app
                .clone()
                .oneshot(Request::builder().uri(path).body(Body::empty())?)
                .await?;
            assert_eq!(response.status(), StatusCode::OK);
            assert_eq!(response.headers()[header::CACHE_CONTROL], "no-store");
            assert_eq!(response.headers()[header::CONTENT_TYPE], "application/json");
            assert!(
                !response
                    .headers()
                    .contains_key(header::ACCESS_CONTROL_ALLOW_ORIGIN)
            );
        }
        Ok(())
    }

    #[tokio::test]
    async fn configured_cors_allows_only_explicit_origins() -> Result<(), Box<dyn std::error::Error>>
    {
        let mut config = HttpConfig::new("127.0.0.1:0".parse()?);
        config.allowed_origins = vec![
            "http://localhost:9000".into(),
            "https://station.example".into(),
        ];
        let (_listener, app) = configure_server(&config, &Adj::default(), None).await?;

        for origin in [
            "http://localhost:9000",
            "https://station.example",
            "http://untrusted.example",
        ] {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .uri(PATHS[0])
                        .header(header::ORIGIN, origin)
                        .body(Body::empty())?,
                )
                .await?;
            // CORS restricts browser access; it is not authorization for HTTP clients.
            assert_eq!(response.status(), StatusCode::OK);
            if config
                .allowed_origins
                .iter()
                .any(|allowed| allowed == origin)
            {
                assert_eq!(
                    response.headers()[header::ACCESS_CONTROL_ALLOW_ORIGIN],
                    origin
                );
            } else {
                assert!(
                    !response
                        .headers()
                        .contains_key(header::ACCESS_CONTROL_ALLOW_ORIGIN)
                );
            }
            assert!(
                !response
                    .headers()
                    .contains_key(header::ACCESS_CONTROL_ALLOW_CREDENTIALS)
            );
        }
        Ok(())
    }

    #[tokio::test]
    async fn configured_cors_handles_preflight() -> Result<(), Box<dyn std::error::Error>> {
        let mut config = HttpConfig::new("127.0.0.1:0".parse()?);
        config.allowed_origins.push("http://localhost:9000".into());
        let (_listener, app) = configure_server(&config, &Adj::default(), None).await?;

        for (origin, method, expected_origin) in [
            (
                "http://localhost:9000",
                "GET",
                Some("http://localhost:9000"),
            ),
            ("http://untrusted.example", "GET", None),
            (
                "http://localhost:9000",
                "POST",
                Some("http://localhost:9000"),
            ),
        ] {
            let response = app
                .clone()
                .oneshot(
                    Request::builder()
                        .method("OPTIONS")
                        .uri(PATHS[0])
                        .header(header::ORIGIN, origin)
                        .header(header::ACCESS_CONTROL_REQUEST_METHOD, method)
                        .header(header::ACCESS_CONTROL_REQUEST_HEADERS, "content-type")
                        .body(Body::empty())?,
                )
                .await?;
            assert!(response.status().is_success());
            assert_eq!(
                response
                    .headers()
                    .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
                    .map(|value| value.to_str())
                    .transpose()?,
                expected_origin
            );
            let methods = response.headers()[header::ACCESS_CONTROL_ALLOW_METHODS].to_str()?;
            assert!(methods.split(',').any(|value| value.trim() == "GET"));
            assert!(!methods.split(',').any(|value| value.trim() == "POST"));
            assert!(
                response.headers()[header::ACCESS_CONTROL_ALLOW_HEADERS]
                    .to_str()?
                    .contains("content-type")
            );
        }
        Ok(())
    }

    #[tokio::test]
    async fn invalid_origins_are_rejected_before_binding() -> Result<(), Box<dyn std::error::Error>>
    {
        let occupied = TcpListener::bind("127.0.0.1:0").await?;
        for origin in [
            "*",
            "",
            "localhost:9000",
            "ws://localhost:9000",
            "http://*.example.com",
            "http://localhost:9000/",
            "http://localhost:9000/path",
            "http://localhost?query=1",
            "http://localhost#fragment",
            "http://user:password@localhost",
            "http://localhost:",
            "http://localhost:abc",
            "http://localhost:99999",
            "http://localhost\r\nInjected: value",
        ] {
            let mut config = HttpConfig::new(occupied.local_addr()?);
            config.allowed_origins = vec![origin.into()];
            let error = configure_server(&config, &Adj::default(), None)
                .await
                .err()
                .ok_or_else(|| io::Error::other("invalid origin was accepted"))?;
            assert_eq!(error.kind(), io::ErrorKind::InvalidInput, "{origin:?}");
        }
        Ok(())
    }

    #[test]
    fn explicit_opaque_and_ipv6_origins_are_valid() -> Result<(), Box<dyn std::error::Error>> {
        for origin in [
            "null",
            "http://[::1]:9000",
            "https://example.com",
            "http://127.0.0.1:9000",
        ] {
            let _ = cors_layer(&[origin.into()])?;
        }
        Ok(())
    }

    #[tokio::test]
    async fn binding_errors_are_propagated_without_fallback()
    -> Result<(), Box<dyn std::error::Error>> {
        let occupied = TcpListener::bind("127.0.0.1:0").await?;
        let config = HttpConfig::new(occupied.local_addr()?);
        let error = configure_server(&config, &Adj::default(), None)
            .await
            .err()
            .ok_or_else(|| io::Error::other("occupied address did not fail"))?;
        assert_eq!(error.kind(), io::ErrorKind::AddrInUse);
        Ok(())
    }

    #[tokio::test]
    async fn cache_policy_is_applied_only_to_catalogs() -> Result<(), Box<dyn std::error::Error>> {
        for (policy, expected) in [
            (CachePolicy::NoStore, Some("no-store")),
            (CachePolicy::NoCache, Some("no-cache")),
            (CachePolicy::Unspecified, None),
        ] {
            let mut config = HttpConfig::new("127.0.0.1:0".parse()?);
            config.cache_policy = policy;
            let (_listener, app) = configure_server(&config, &Adj::default(), None).await?;
            for path in PATHS {
                let response = app
                    .clone()
                    .oneshot(Request::builder().uri(path).body(Body::empty())?)
                    .await?;
                assert_eq!(
                    response
                        .headers()
                        .get(header::CACHE_CONTROL)
                        .map(|value| value.to_str())
                        .transpose()?,
                    expected
                );
            }
            let response = app
                .oneshot(Request::builder().uri("/backend").body(Body::empty())?)
                .await?;
            assert_eq!(response.status(), StatusCode::BAD_REQUEST);
            assert!(!response.headers().contains_key(header::CACHE_CONTROL));
        }
        Ok(())
    }

    #[tokio::test]
    async fn configured_server_preserves_websocket_handoff()
    -> Result<(), Box<dyn std::error::Error>> {
        let config = HttpConfig::new("127.0.0.1:0".parse()?);
        let (connections, mut receiver) = mpsc::channel(1);
        let (listener, app) = configure_server(&config, &Adj::default(), Some(connections)).await?;
        let (headers, _client) = handshake_on(listener, app).await?;
        assert!(headers.starts_with("HTTP/1.1 101 Switching Protocols\r\n"));
        assert!(!headers.to_ascii_lowercase().contains("cache-control:"));
        let socket = timeout(Duration::from_secs(5), receiver.recv())
            .await?
            .ok_or_else(|| io::Error::other("socket was not handed off"))?;
        drop(socket);
        Ok(())
    }
}
