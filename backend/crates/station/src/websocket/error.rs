/// Errors handling WebSocket connections and broker communication.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// The broker no longer accepts updates.
    #[error("WebSocket broker is closed")]
    BrokerClosed,
    /// Reading or writing the socket failed.
    #[error("WebSocket I/O failed: {0}")]
    Socket(#[from] axum::Error),
    /// The message or its payload could not be converted to JSON models.
    #[error("invalid WebSocket JSON: {0}")]
    Json(#[from] serde_json::Error),
    /// No valid application message arrived before the deadline.
    #[error("WebSocket heartbeat timed out")]
    HeartbeatTimeout,
}
