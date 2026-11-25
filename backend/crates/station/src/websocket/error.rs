use software_core::model::AdjId;

/// Errors handling WebSocket connections and broker communication.
#[derive(Debug, thiserror::Error)]
pub enum Error {
    /// The broker no longer accepts updates.
    #[error("WebSocket broker is closed")]
    BrokerClosed,
    /// The session ends when the writer can no longer keep up with subscription changes.
    #[error("WebSocket subscription queue is full")]
    SubscriptionQueueFull,
    /// The event buffer overwrote unread events. The session logs the loss and closes.
    #[error("WebSocket subscriber missed {missed} events on {topic}")]
    EventLagged { topic: &'static str, missed: u64 },
    /// Reading or writing the socket failed.
    #[error("WebSocket I/O failed: {0}")]
    Socket(#[from] axum::Error),
    /// A WebSocket message or payload failed JSON encoding or decoding.
    #[error("invalid WebSocket JSON: {0}")]
    Json(#[from] serde_json::Error),
    /// No valid application message arrived before the deadline.
    #[error("WebSocket heartbeat timed out")]
    HeartbeatTimeout,
}

/// Rejections of individual order requests. The reader logs these and keeps the session open.
#[derive(Debug, thiserror::Error)]
pub(super) enum OrderError {
    #[error("invalid order payload: {0}")]
    Json(#[from] serde_json::Error),
    #[error("unknown order id {0:?}")]
    UnknownOrder(AdjId),
    #[error("missing order field {0:?}")]
    MissingField(String),
    #[error("unexpected order field {0:?}")]
    UnexpectedField(String),
    #[error("order field {field:?} must have type {expected}")]
    WrongFieldType {
        field: String,
        expected: &'static str,
    },
    #[error("invalid value for order field {0:?}")]
    InvalidValue(String),
    #[error("vehicle order queue is full")]
    QueueFull,
    #[error("vehicle order receiver is unavailable")]
    VehicleUnavailable,
}

/// Rejections of individual logger requests. The reader logs these and keeps the session open.
#[derive(Debug, thiserror::Error)]
pub(super) enum LoggerError {
    #[error("invalid logger payload: {0}")]
    Json(#[from] serde_json::Error),
    #[error("logger command queue is full")]
    QueueFull,
    #[error("logger command receiver is unavailable")]
    Unavailable,
}
