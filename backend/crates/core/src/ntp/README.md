# NTP module

NTP (**Network Time Protocol**) is a protocol used to synchronize clocks between devices over a network. In this project, it is used to synchronize the boards in the pod, with the *backend*.

There are two related concepts worth mentioning:

- **SNTP (Simple Network Time Protocol):** a simplified subset of NTP intended for simpler synchronization scenarios, such as clients using a single time server.
- **NTS (Network Time Security):** an extension to NTP that adds authentication and cryptographic security to time synchronization (not used in this project).

The boards in this project use **SNTP**. However, this module implements an **NTP server**, since NTP and SNTP use compatible protocol messages and are interoperable. An SNTP client can therefore communicate with this NTP server as defined by RFC 5905.

## Implementation

The server is implemented using the [`ntp_usg-server`](https://crates.io/crates/ntp_usg-server) crate with the **Tokio** runtime. It also uses [`tracing`](https://crates.io/crates/tracing) crate for logging.

The crate handles the NTP protocol logic, including request parsing and response generation, while this module is responsible for configuring and starting the server.

The server interface and port can be configured when starting it. By default, the server listens on:

- Interface: `0.0.0.0`
- Port: `8123`

The standard NTP port is `123`, but this project uses `8123` as its default port.

## Documentation

The module documentation can be generated and opened with:

```bash
cargo doc --open -p software-core -F ntp --no-deps
```