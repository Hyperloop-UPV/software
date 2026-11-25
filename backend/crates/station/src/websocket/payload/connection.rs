use serde::Serialize;
use std::collections::HashMap;

/// Payload of `connection/update`, keyed by board name.
/// Boards remain in the snapshot with `isConnected: false` after a disconnect.
pub type ConnectionUpdate = HashMap<String, Connection>;

/// Whether a board is connected to the backend.
#[derive(Debug, Clone, PartialEq, Eq, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Connection {
    /// Board name, also used as the key in `ConnectionUpdate`.
    pub name: String,
    /// Current connection state.
    pub is_connected: bool,
}
