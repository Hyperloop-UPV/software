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
│                 ├── explicit (Data, Order, Message — declared in packets.json)
│                 └── synthetic (Protection — one per declared protection,
│                       derived from each measurement's own `protections`;
│                       never declared directly in packets.json)
└── info (AdjInfo)
      ├── ports: HashMap<String, Port>
      ├── addresses: HashMap<String, IpAddr>
      ├── message_ids: HashMap<String, AdjId>
      └── protection_types: HashMap<String, ProtectionTypeInfo>
```

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
Protections defined under measurements are materialized during loading as first-class `PacketKind::Protection(Measurement)` packets alongside the explicit data, order and message packets declared in `packets.json`. Downstream networking layers can route and handle every wire event uniformly via `Board::packets` without needing specialized traversal logic for nested measurement alarms. `packets.json` itself never declares a `"type": "protection"` entry directly — that shape only exists synthesized, one per protection a measurement declares, never as a free-standing declaration with its own arbitrary variable list.