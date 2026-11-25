//! Unit tests of the receive path, and tests through a real socket on
//! loopback. Fixtures live in `test_support.rs`.

use super::test_support::*;
use super::*;
use crate::model::AdjId;

// ---------------------------------------------------------------------------
// Error classification
// ---------------------------------------------------------------------------

#[test]
fn a_datagram_that_will_not_decode_faults_the_pod() {
    let error = UdpError::Decode {
        from: example_board_addr(),
        source: DecodeError::UnknownId(AdjId(9999)),
    };

    assert!(error.is_fatal());
}

#[test]
fn losing_the_socket_faults_the_pod_too() {
    let error = UdpError::Recv {
        source: std::io::Error::from(std::io::ErrorKind::ConnectionReset),
    };

    assert!(error.is_fatal());
}

#[test]
fn a_decode_failure_says_where_it_came_from() {
    let error = UdpError::Decode {
        from: example_board_addr(),
        source: DecodeError::UnknownId(AdjId(9999)),
    };

    assert!(error.to_string().contains("192.168.1.3:50400"));
}

#[test]
fn a_board_signalling_a_fault_faults_the_pod() {
    let error = UdpError::Fault {
        from: example_board_addr(),
    };

    assert!(error.is_fatal());
}

#[test]
fn a_fault_says_where_it_came_from() {
    let error = UdpError::Fault {
        from: example_board_addr(),
    };

    assert!(error.to_string().contains("192.168.1.3:50400"));
}

// ---------------------------------------------------------------------------
// decode_and_report, without a socket
// ---------------------------------------------------------------------------

#[tokio::test]
async fn decode_and_report_notifies_a_valid_datagram() {
    let (reporter, mut sinks) = Reporter::channels(16, 16);
    let index = index_with_empty_data_packet();
    let mut traces = ReceiveTraces::default();

    let keep_going = decode_and_report(
        &EMPTY_DATA_DATAGRAM,
        example_board_addr(),
        &index,
        &reporter,
        &mut traces,
    )
    .await;
    assert!(keep_going);

    assert_is_empty_data_packet(receive_notification(&mut sinks).await);
    assert!(
        sinks.errors.try_recv().is_err(),
        "should not have reported an error"
    );
}

#[tokio::test]
async fn decode_and_report_reports_an_unknown_id() {
    let (reporter, mut sinks) = Reporter::channels(16, 16);
    let index = index_with_empty_data_packet();
    let mut traces = ReceiveTraces::default();

    let keep_going = decode_and_report(
        &UNKNOWN_ID_DATAGRAM,
        example_board_addr(),
        &index,
        &reporter,
        &mut traces,
    )
    .await;
    assert!(keep_going);

    let report = receive_error_report(&mut sinks).await;
    let crate::net::Error::Udp(UdpError::Decode { from, source }) = report.error else {
        unreachable!("an undecodable datagram should be reported as udp::UdpError::Decode");
    };
    assert_eq!(from, example_board_addr());
    assert!(matches!(source, DecodeError::UnknownId(AdjId(0xFFFF))));
    assert!(
        sinks.notifications.try_recv().is_err(),
        "should not have notified a packet"
    );
}

#[tokio::test]
async fn decode_and_report_reports_a_fault_without_looking_at_the_adj() {
    let (reporter, mut sinks) = Reporter::channels(16, 16);
    // Declares id 1000 only: id 0 is unknown to it, and yet it is a fault.
    let index = index_with_empty_data_packet();
    let mut traces = ReceiveTraces::default();

    let keep_going = decode_and_report(
        &FAULT_DATAGRAM,
        example_board_addr(),
        &index,
        &reporter,
        &mut traces,
    )
    .await;
    assert!(keep_going);

    let report = receive_error_report(&mut sinks).await;
    let crate::net::Error::Udp(UdpError::Fault { from }) = report.error else {
        unreachable!("a datagram with packet id 0 should be reported as udp::UdpError::Fault");
    };
    assert_eq!(from, example_board_addr());
    assert!(
        sinks.notifications.try_recv().is_err(),
        "should not have notified a packet"
    );
}

#[tokio::test]
async fn whatever_follows_the_fault_id_is_not_read() {
    let (reporter, mut sinks) = Reporter::channels(16, 16);
    let index = index_with_empty_data_packet();
    let mut traces = ReceiveTraces::default();

    decode_and_report(
        &[0x00, 0x00, 0xAB, 0xCD],
        example_board_addr(),
        &index,
        &reporter,
        &mut traces,
    )
    .await;

    let report = receive_error_report(&mut sinks).await;
    assert!(matches!(
        report.error,
        crate::net::Error::Udp(UdpError::Fault { .. })
    ));
}

#[tokio::test]
async fn a_single_zero_byte_is_not_a_fault() {
    let (reporter, mut sinks) = Reporter::channels(16, 16);
    let index = index_with_empty_data_packet();
    let mut traces = ReceiveTraces::default();

    // An id takes two bytes: one zero byte is a truncated datagram.
    decode_and_report(
        &[0x00],
        example_board_addr(),
        &index,
        &reporter,
        &mut traces,
    )
    .await;

    let report = receive_error_report(&mut sinks).await;
    let crate::net::Error::Udp(UdpError::Decode { source, .. }) = report.error else {
        unreachable!("a one-byte datagram should be a decode failure, not a fault");
    };
    assert!(matches!(source, DecodeError::UnexpectedEof));
}

#[tokio::test]
async fn decode_and_report_stops_once_nobody_listens() {
    let (reporter, sinks) = Reporter::channels(16, 16);
    let index = index_with_empty_data_packet();
    let mut traces = ReceiveTraces::default();
    drop(sinks);

    // With the receivers gone, reporting tells the loop to stop (false).
    let keep_going = decode_and_report(
        &UNKNOWN_ID_DATAGRAM,
        example_board_addr(),
        &index,
        &reporter,
        &mut traces,
    )
    .await;
    assert!(!keep_going);
}

// ---------------------------------------------------------------------------
// Rate limit of the decode-failure trace
// ---------------------------------------------------------------------------

#[test]
fn decode_failures_are_traced_at_most_once_a_second() {
    let mut trace = TraceRateLimit::default();
    let t0 = Instant::now();
    let at = |ms: u64| t0 + Duration::from_millis(ms);

    assert_eq!(
        trace.should_trace(at(0)),
        Some(0),
        "the first one is traced"
    );
    assert_eq!(
        trace.should_trace(at(300)),
        None,
        "within the second: counted"
    );
    assert_eq!(
        trace.should_trace(at(900)),
        None,
        "within the second: counted"
    );
    assert_eq!(
        trace.should_trace(at(1100)),
        Some(2),
        "after a second: traced, with the two left out"
    );
    assert_eq!(trace.should_trace(at(1500)), None);
    assert_eq!(
        trace.should_trace(at(2200)),
        Some(1),
        "the window restarts at the last traced one"
    );
}

// ---------------------------------------------------------------------------
// Through a real socket on loopback
// ---------------------------------------------------------------------------

#[tokio::test]
async fn a_datagram_sent_to_the_socket_arrives_as_a_notification() {
    let (reporter, mut sinks) = Reporter::channels(16, 16);
    let (addr, handle) = start_receiving_on_loopback(reporter);
    let board = bind_fake_board().await;

    send_datagram(&board, &EMPTY_DATA_DATAGRAM, addr).await;

    assert_is_empty_data_packet(receive_notification(&mut sinks).await);
    handle.abort();
}

#[tokio::test]
async fn an_undecodable_datagram_is_reported_with_its_sender() {
    let (reporter, mut sinks) = Reporter::channels(16, 16);
    let (addr, handle) = start_receiving_on_loopback(reporter);
    let board = bind_fake_board().await;
    let Ok(board_addr) = board.local_addr() else {
        unreachable!("a bound socket has a local address");
    };

    send_datagram(&board, &UNKNOWN_ID_DATAGRAM, addr).await;

    let report = receive_error_report(&mut sinks).await;
    let crate::net::Error::Udp(UdpError::Decode { from, .. }) = report.error else {
        unreachable!("an undecodable datagram should be reported as udp::UdpError::Decode");
    };
    assert_eq!(from, board_addr);
    handle.abort();
}

#[tokio::test]
async fn a_fault_sent_to_the_socket_is_reported_with_its_sender() {
    let (reporter, mut sinks) = Reporter::channels(16, 16);
    let (addr, handle) = start_receiving_on_loopback(reporter);
    let board = bind_fake_board().await;
    let Ok(board_addr) = board.local_addr() else {
        unreachable!("a bound socket has a local address");
    };

    send_datagram(&board, &FAULT_DATAGRAM, addr).await;

    let report = receive_error_report(&mut sinks).await;
    let crate::net::Error::Udp(UdpError::Fault { from }) = report.error else {
        unreachable!("a datagram with packet id 0 should be reported as udp::UdpError::Fault");
    };
    assert_eq!(from, board_addr);
    handle.abort();
}

#[tokio::test]
async fn the_loop_stops_on_the_next_datagram_once_nobody_listens() {
    let (reporter, sinks) = Reporter::channels(16, 16);
    let (addr, handle) = start_receiving_on_loopback(reporter);
    drop(sinks);
    let board = bind_fake_board().await;

    // Without a datagram the loop would keep waiting on the socket: it only
    // notices the consumer is gone when it tries to report.
    send_datagram(&board, &EMPTY_DATA_DATAGRAM, addr).await;

    let Ok(Ok(())) = tokio::time::timeout(RECEIVE_TIMEOUT, handle).await else {
        unreachable!("the loop should end once a report finds nobody listening");
    };
}

#[tokio::test]
async fn binding_an_address_already_in_use_is_a_bind_error() {
    let (_first, taken) = bind_on_loopback(256 * 1024);

    let second = bind_telemetry_socket(UdpConfig {
        addr: taken,
        recv_buffer: 256 * 1024,
    });

    let Err(UdpError::Bind { addr, .. }) = second else {
        unreachable!("binding an address already in use should fail with UdpError::Bind");
    };
    assert_eq!(addr, taken);
}
