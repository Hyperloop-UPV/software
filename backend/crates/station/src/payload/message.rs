use super::ProtectionPayload;
use serde::Serialize;
use software_core::model::{MessageLevel, Severity};

/// Payload of `message/update`, preserving the legacy event envelope.
#[derive(Debug, Clone, PartialEq, Serialize)]
pub struct MessageUpdate {
    /// Event severity, represented by the legacy JSON field `kind`.
    pub kind: MessageKind,
    /// Text or protection details.
    pub payload: MessagePayload,
    /// Name of the board that produced the event.
    pub board: String,
    /// Display name of the event; order-sent notices use the order id as text.
    pub name: String,
    /// Original RTC fields, without a timezone conversion.
    pub timestamp: MessageTimestamp,
}

/// Both message shapes accepted by the existing frontend.
#[derive(Debug, Clone, PartialEq, Serialize)]
#[serde(untagged)]
pub enum MessagePayload {
    /// An informational notice or a board's free-text message.
    Text(String),
    /// Protection details, as published on `message/update` by Go.
    Protection(ProtectionPayload),
}

/// Event severity: legacy values plus ADJv3's `panic` message level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum MessageKind {
    /// Informational message.
    Info,
    /// Unexpected condition.
    Warning,
    /// Fault condition.
    Fault,
    /// A legacy protection returned to its appropriate range.
    Ok,
    /// Unrecoverable firmware error.
    Panic,
}

impl From<MessageLevel> for MessageKind {
    fn from(level: MessageLevel) -> Self {
        match level {
            MessageLevel::Fault => Self::Fault,
            MessageLevel::Warning => Self::Warning,
            MessageLevel::Info => Self::Info,
            MessageLevel::Panic => Self::Panic,
        }
    }
}

impl From<Severity> for MessageKind {
    fn from(severity: Severity) -> Self {
        match severity {
            Severity::Fault => Self::Fault,
            Severity::Warning => Self::Warning,
        }
    }
}

/// Calendar timestamp used by the frontend's event display.
///
/// The event publisher supplies the date and RTC counter. The board's
/// `ShortTimestamp` contains the time of day and a raw subsecond byte.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize)]
pub struct MessageTimestamp {
    /// RTC counter supplied by the publisher.
    pub counter: u16,
    /// Second of the minute.
    pub second: u8,
    /// Minute of the hour.
    pub minute: u8,
    /// Hour of the day.
    pub hour: u8,
    /// Day of the month.
    pub day: u8,
    /// Month of the year.
    pub month: u8,
    /// Calendar year.
    pub year: u16,
}
