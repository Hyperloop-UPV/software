# ADJ Module (`adj`)

This module deserializes, validates, and loads ADJ JSON fixtures into the backend domain model.

For schema specifications, packet/measurement ID conventions, and network requirements, refer directly to the official documentation in the **ADJ repository**.

---

## The `Adj` Object Structure

Calling `load_from_dir` produces a root `Adj` instance:

```rust
pub struct Adj {
    pub pod_data: PodData,
    pub info: AdjInfo,
}
```

```text
Adj
├── pod_data (PodData)
│     └── boards: HashMap<BoardId, Board>
│           ├── measurements: HashMap<String, Measurement>
│           └── packets: HashMap<AdjId, PacketDef>
│                 ├── explicit (Data, Order, Message — declared in packets.json;
│                 │     a "message"-type packet's own `name` must be one of
│                 │     MessageLevel::ALL's four severities, resolved via
│                 │     MessageLevel::from_name — UnknownMessageSeverity if not)
│                 └── synthetic (Protection — one per declared protection,
│                       derived from each measurement's own `protections`;
│                       never declared directly in packets.json)
└── info (AdjInfo)
      ├── ports: HashMap<String, Port>
      ├── addresses: HashMap<String, IpAddr>
      ├── message_ids: HashMap<String, AdjId>        -- name -> id, straight from the ADJ
      ├── message_levels: HashMap<AdjId, MessageLevel> -- id -> severity, the reverse
      └── protection_types: HashMap<String, ProtectionTypeInfo>
```

`message_ids` is the ADJ's own direction: a name (e.g. `"fault"`) to its
id. Not every entry is one of `model::MessageLevel`'s four severities —
other reserved names (e.g. `add_state_order`) share this same map.

`message_levels` is the direction decoding actually needs: a wire id
(all a decoder ever has) straight to its severity, with no name in
between. It's the reverse of `message_ids`, restricted to whichever of
`MessageLevel::ALL`'s four names `message_ids` declares — built once in
`adj::raw::types`'s `TryFrom<RawGeneralInfo> for AdjInfo`, right after
`message_ids` itself, so it can never drift out of sync with it:

```rust
let message_levels: HashMap<AdjId, MessageLevel> = MessageLevel::ALL
    .into_iter()
    .filter_map(|level| message_ids.get(level.name()).map(|&id| (id, level)))
    .collect();
```

Which ADJ name corresponds to which `MessageLevel` is **not** decided
here — `level.name()`/`MessageLevel::from_name` (see `model/README.md`
§4.4) is the one place that association is spelled out, so `adj`
doesn't hardcode `"fault"`/`"warning"`/`"info"`/`"panic"` itself.

**One layer up, `protocol::Index` is what actually turns
`message_levels` into something a decoder can look up a packet by.**
`Index::new(pod_data, message_levels)` takes `message_levels` as
`Option<&HashMap<AdjId, MessageLevel>>` — `None` for callers with no
`AdjInfo` at all (most tests in this crate, which only build a bare
`PodData`) — and, for each entry, synthesizes a
`PacketDef { packet_type: PacketType::Message(level), board: BoardId(0), .. }`
into the very same `AdjId -> PacketDef` table every other packet lives
in. `BoardId(0)` (reserved, not validated — see `AdjId`/`BoardId`'s own
docs) because a severity isn't owned by any one board — any board's
free-text log frame can reuse the same `"fault"` id. See
`protocol/README.md`'s `index.rs` section for the full picture.

---

## Why It Is Structured This Way

The `Adj` object enforces a clear architectural boundary between **vehicle topology** and **session configuration**:

### 1. Separation of Concerns (`PodData` vs. `AdjInfo`)
* **`pod_data` (Vehicle Domain)**: Represents telemetry, controls, and board topology intrinsic to the physical vehicle. It contains only what exists on the vehicle bus (boards, packets, measurements).
* **`info` (Session & Tooling Domain)**: Captures session-level networking and station UI requirements (host addresses, local server port bindings, and alert format strings like `text` and `textTime`).
* **Design rationale**: The vehicle itself does not know or care about backend socket configurations or display strings. Separating them prevents UI and orchestration details from polluting the core telemetry model.

### 2. Standalone Loader Submodule (`raw`)
The raw deserialization types and the loader logic live isolated inside `raw`[cite: 2]. This enables non-station tools (such as bus sniffers, test runners, or simulators) to parse and ingest ADJ directories without dragging along application-level UI or station state logic.

### 3. Unified Packet Map (`packets`)
Protections defined under measurements are materialized during loading as first-class `PacketType::Protection(Measurement)` packets alongside the explicit data, order and message packets declared in `packets.json`. Downstream networking layers can route and handle every wire event uniformly via `Board::packets` without needing specialized traversal logic for nested measurement alarms. `packets.json` itself never declares a `"type": "protection"` entry directly — that shape only exists synthesized, one per protection a measurement declares, never as a free-standing declaration with its own arbitrary variable list.