//! Backend-session metadata from `general_info.json`.
//!
//! This is not vehicle data — that's [`crate::model::PodData`] — but what
//! *this backend session* needs beyond the vehicle: known ports and
//! addresses, message-id conventions, and how to display a triggered
//! protection.

use crate::model::{AdjId, Port};
use std::collections::HashMap;
use std::net::IpAddr;

/// A protection type's display text, as declared in `general_info.json`'s
/// `protectionTypes`.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct ProtectionTypeInfo {
    /// Whether this protection type takes an interval (`[min, max]`)
    /// instead of a single bound.
    pub is_range: bool,
    /// The message template shown at the control station; `{}` stands for
    /// the protection's bound(s), `%` for the value that triggered it.
    pub text: String,
    /// The alternative template for time-accumulation protections, if one
    /// was declared.
    pub text_time: Option<String>,
}

/// Backend-session metadata parsed from `general_info.json`.
#[derive(Debug, Clone, PartialEq, Eq, Default)]
pub struct AdjInfo {
    /// Known port numbers, by name (e.g. `"TCP_SERVER"` -> `Port(50500)`).
    pub ports: HashMap<String, Port>,
    /// Known addresses, by name (e.g. `"backend"` -> `192.168.0.9`).
    pub addresses: HashMap<String, IpAddr>,
    /// Known message ids, by name (e.g. `"fault"` -> `AdjId(2)`) — these
    /// live in the ADJ's own special reserved id range (`[0, 511]`, see
    /// [`AdjId`]'s own docs), not a separate numbering of their own.
    pub message_ids: HashMap<String, AdjId>,
    /// Declared protection types, by name (e.g. `"Range"`).
    pub protection_types: HashMap<String, ProtectionTypeInfo>,
}
