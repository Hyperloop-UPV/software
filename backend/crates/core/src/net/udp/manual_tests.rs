//! Manual load probe: can the receive loop keep up with the pod's
//! telemetry?
//!
//! Ignored by a normal `cargo test`. It sends 76-byte datagrams over
//! loopback at `UDP_LOAD_MBIT` Mbit/s (default 25, about 41,000 datagrams
//! a second) for `UDP_LOAD_SECS` seconds (default 10), through the real
//! socket, decode and reporter, into a consumer that only counts. It fails
//! if any datagram is lost or fails to decode. `UDP_LOAD_RCVBUF` sets the
//! `SO_RCVBUF` requested (default 2 MiB). Run it in release, which is how
//! the station runs:
//!
//! ```sh
//! cargo test -p software-core --features net --release manual_udp_load -- --ignored --nocapture
//! UDP_LOAD_MBIT=40 cargo test -p software-core --features net --release manual_udp_load -- --ignored --nocapture
//! ```
//!
//! What it does **not** tell: the cost of the real consumer (`station`'s
//! event loop), which comes on top — a consumer that only adds a timer per
//! message was already enough to lose 0.7 % at 25 Mbit/s. And loopback is
//! not the pod's network: sender and receiver share this machine's CPUs,
//! and there is no network card.

use super::test_support::{any_loopback_port, bind_on_loopback};
use super::*;
use crate::model::{
    AdjId, Board, BoardId, DataPacket, MacAddress, Measurement, MeasurementKind, NumericKind,
    PacketDef, PacketType, PodData, Value,
};
use std::collections::HashMap;
use std::net::IpAddr;

/// Bytes of one datagram in the probe: 2 of id and 74 of values.
const PROBE_DATAGRAM_LEN: usize = 76;

fn measurement_with_id(id: u16, kind: MeasurementKind) -> Measurement {
    Measurement {
        id: AdjId(id),
        alias: format!("m{id}"),
        name: format!("measurement {id}"),
        display_units: String::new(),
        kind,
        protections: vec![],
    }
}

/// An index with one `Data` packet (id 1000, board 1) whose datagram is
/// [`PROBE_DATAGRAM_LEN`] bytes, mixing value types the way board telemetry
/// does — floats, integers, enums (which decode into a `String`) and
/// booleans — together with the bytes of one such datagram.
fn telemetry_index_and_datagram() -> (Index, Vec<u8>) {
    let mut measurements = Vec::new();
    let mut values = Vec::new();
    let mut add = |kind: MeasurementKind, value: Value, count: usize| {
        for _ in 0..count {
            let id = u16::try_from(measurements.len() + 1).unwrap_or(u16::MAX);
            measurements.push(measurement_with_id(id, kind.clone()));
            values.push(value.clone());
        }
    };
    let numeric = |wire_type| MeasurementKind::Numeric { wire_type };
    let options = vec!["Idle".to_string(), "Running".into(), "Fault".into()];

    add(numeric(NumericKind::F32), Value::Number(21.5), 14); // 56 bytes
    add(numeric(NumericKind::U16), Value::Number(1234.0), 4); //  8 bytes
    add(numeric(NumericKind::U8), Value::Number(7.0), 6); //  6 bytes
    add(MeasurementKind::Enum { options }, Value::Number(1.0), 2); //  2 bytes
    add(MeasurementKind::Boolean, Value::Bool(true), 2); //  2 bytes

    let packet = PacketDef {
        id: AdjId(1000),
        board: BoardId(1),
        name: "telemetry".to_string(),
        packet_type: PacketType::Data(measurements),
    };
    let board = Board {
        id: BoardId(1),
        name: "TEST".to_string(),
        ip: IpAddr::from([127, 0, 0, 1]),
        mac: MacAddress([0; 6]),
        packets: HashMap::from([(packet.id, packet)]),
    };
    let index = Index::new(
        &PodData {
            boards: HashMap::from([(board.id, board)]),
        },
        None,
    );

    let datagram =
        crate::protocol::packet::data_order::encode(&DataPacket::new(AdjId(1000), values), &index);
    let Ok(datagram) = datagram else {
        unreachable!("the probe's telemetry packet should encode");
    };
    assert_eq!(datagram.len(), PROBE_DATAGRAM_LEN);
    (index, datagram)
}

/// Sends `datagram` to `to` at `per_second` for `duration`, paced in short
/// bursts as a board's network would deliver it. Returns how many were
/// sent and how many sends failed.
fn send_at_rate(
    to: SocketAddr,
    datagram: &[u8],
    per_second: f64,
    duration: Duration,
) -> (u64, u64) {
    let Ok(socket) = std::net::UdpSocket::bind(any_loopback_port()) else {
        unreachable!("binding the probe's sending socket should succeed");
    };
    let start = Instant::now();
    let (mut sent, mut failed) = (0u64, 0u64);
    while start.elapsed() < duration {
        let due = (start.elapsed().as_secs_f64() * per_second) as u64;
        while sent + failed < due {
            match socket.send_to(datagram, to) {
                Ok(_) => sent += 1,
                Err(_) => failed += 1,
            }
        }
        std::thread::sleep(Duration::from_micros(200));
    }
    (sent, failed)
}

/// The kernel's count of UDP datagrams dropped for lack of receive buffer,
/// system-wide (`RcvbufErrors` in `/proc/net/snmp`). Linux only.
fn kernel_rcvbuf_errors() -> Option<u64> {
    let snmp = std::fs::read_to_string("/proc/net/snmp").ok()?;
    let mut udp = snmp.lines().filter(|line| line.starts_with("Udp:"));
    let header = udp.next()?;
    let values = udp.next()?;
    let column = header
        .split_whitespace()
        .position(|c| c == "RcvbufErrors")?;
    values.split_whitespace().nth(column)?.parse().ok()
}

/// The environment variable `name` parsed as `T`, or `default`.
fn env_var_or<T: std::str::FromStr>(name: &str, default: T) -> T {
    std::env::var(name)
        .ok()
        .and_then(|value| value.parse().ok())
        .unwrap_or(default)
}

#[tokio::test(flavor = "multi_thread", worker_threads = 2)]
#[ignore = "load probe: run in release with --ignored --nocapture"]
async fn manual_udp_load() {
    let mbit: f64 = env_var_or("UDP_LOAD_MBIT", 25.0);
    let secs: u64 = env_var_or("UDP_LOAD_SECS", 10);
    let recv_buffer: usize = env_var_or("UDP_LOAD_RCVBUF", 2 * 1024 * 1024);
    let per_second = mbit * 1_000_000.0 / 8.0 / PROBE_DATAGRAM_LEN as f64;
    let (index, datagram) = telemetry_index_and_datagram();

    let (socket, addr) = bind_on_loopback(recv_buffer);
    let granted = socket2::SockRef::from(&socket).recv_buffer_size().ok();
    let (reporter, mut sinks) = Reporter::channels(8192, 16);
    let receiver = tokio::spawn(receive_telemetry(socket, Arc::new(index), reporter));

    // Counts until told the sender is done, then drains what is left. No
    // timer per message, so that the consumer costs as little as possible
    // and what is measured is this module.
    let (done_tx, mut done_rx) = tokio::sync::oneshot::channel::<()>();
    let consumer = tokio::spawn(async move {
        let (mut received, mut errors) = (0u64, 0u64);
        loop {
            tokio::select! {
                biased;
                Some(_) = sinks.notifications.recv() => received += 1,
                Some(_) = sinks.errors.recv() => errors += 1,
                _ = &mut done_rx => break,
            }
        }
        while let Ok(Some(_)) =
            tokio::time::timeout(Duration::from_millis(200), sinks.notifications.recv()).await
        {
            received += 1;
        }
        while sinks.errors.try_recv().is_ok() {
            errors += 1;
        }
        (received, errors)
    });

    let drops_before = kernel_rcvbuf_errors();
    let started = Instant::now();
    let sender = tokio::task::spawn_blocking(move || {
        send_at_rate(addr, &datagram, per_second, Duration::from_secs(secs))
    });
    let Ok((sent, failed)) = sender.await else {
        unreachable!("the sender thread should not panic");
    };
    let send_time = started.elapsed();
    let _ = done_tx.send(());
    let Ok((received, errors)) = consumer.await else {
        unreachable!("the consumer task should not panic");
    };
    let drops = match (drops_before, kernel_rcvbuf_errors()) {
        (Some(before), Some(after)) => format!("+{}", after.saturating_sub(before)),
        _ => "unavailable".to_string(),
    };
    receiver.abort();

    let lost = sent.saturating_sub(received);
    println!(
        "UDP load probe: {mbit} Mbit/s in {PROBE_DATAGRAM_LEN}-byte datagrams \
         = {per_second:.0} datagrams/s, for {secs} s"
    );
    println!(
        "  sent {sent} in {:.2} s ({:.0}/s), {failed} sends failed",
        send_time.as_secs_f64(),
        sent as f64 / send_time.as_secs_f64()
    );
    println!(
        "  received {received}, lost {lost} ({:.4} %), decode errors {errors}",
        100.0 * lost as f64 / sent.max(1) as f64
    );
    println!(
        "  SO_RCVBUF requested {recv_buffer} bytes, read back {granted:?}; \
         kernel RcvbufErrors (system-wide): {drops}"
    );

    assert_eq!(errors, 0, "every datagram should decode");
    assert_eq!(lost, 0, "every datagram sent should be received");
}
