//! Backend-session metadata from `general_info.json`.
//!
//! This is not vehicle data — that's [`crate::model::PodData`] — but what
//! *this backend session* needs beyond the vehicle: known ports and
//! addresses, message-id conventions, and how to display a triggered
//! protection.

use crate::model::{AdjId, MessageLevel, Port};
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
    /// This is the ADJ's own direction: a severity's *name* to its id.
    /// Not every entry here is one of [`MessageLevel`]'s four severities
    /// — other reserved names (e.g. `add_state_order`) share this same
    /// map — see [`MessageLevel::name`] for which ones are.
    pub message_ids: HashMap<String, AdjId>,
    /// The reverse of [`AdjInfo::message_ids`], and only for the four
    /// entries that actually are a [`MessageLevel`]: a wire id straight
    /// to its severity.
    ///
    /// Decoding a free-text log frame only ever has the raw id off the
    /// wire, not its name — without this, every decoder would have to
    /// search `message_ids` by value (or re-derive this same reverse
    /// map itself) just to answer "which severity is id 2?". Built once
    /// here, when the ADJ is loaded (see `adj::raw::types`'s
    /// `TryFrom<RawGeneralInfo> for AdjInfo`),
    /// from `message_ids` and [`MessageLevel::ALL`]/[`MessageLevel::name`]
    /// — never constructed by hand, and never out of sync with
    /// `message_ids` since it's derived from it.
    pub message_levels: HashMap<AdjId, MessageLevel>,
    /// Declared protection types, by name (e.g. `"Range"`).
    pub protection_types: HashMap<String, ProtectionTypeInfo>,
}
