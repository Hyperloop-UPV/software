//! Fixtures shared by `tests.rs` and `manual_tests.rs`: a minimal ADJ
//! index, loopback sockets, and waits on the reporter's channels that fail
//! instead of hanging.

use super::*;
use crate::model::{AdjId, Board, BoardId, MacAddress, PacketDef, PacketType, PodData};
use crate::net::{ErrorReport, Event, Notification, Sinks};
use std::collections::HashMap;
use std::net::IpAddr;

/// How long a test waits for something to arrive before failing, so that
/// a broken expectation fails instead of hanging forever.
pub(super) const RECEIVE_TIMEOUT: Duration = Duration::from_secs(1);

/// Id 1000, little-endian, with no measurements after it: the one packet
/// [`index_with_empty_data_packet`] declares.
pub(super) const EMPTY_DATA_DATAGRAM: [u8; 2] = [0xE8, 0x03];

/// Id 0xFFFF, which [`index_with_empty_data_packet`] does not declare.
pub(super) const UNKNOWN_ID_DATAGRAM: [u8; 2] = [0xFF, 0xFF];

/// A fault: packet id 0, which [`index_with_empty_data_packet`] does not
/// declare either — a fault is recognised without the ADJ.
pub(super) const FAULT_DATAGRAM: [u8; 2] = [0x00, 0x00];

/// A board's address on the pod's network, for errors that carry one.
pub(super) fn example_board_addr() -> SocketAddr {
    SocketAddr::new(IpAddr::from([192, 168, 1, 3]), 50400)
}

/// `127.0.0.1` with port 0, so that the OS picks a free one.
pub(super) fn any_loopback_port() -> SocketAddr {
    SocketAddr::new(IpAddr::from([127, 0, 0, 1]), 0)
}

/// An index with a single `Data` packet, id 1000 on board 1, that carries
/// no measurements.
///
/// It has to be `Data`: that is the only type a UDP datagram can carry,
/// and decoding rejects any other with `WrongPacketType`.
pub(super) fn index_with_empty_data_packet() -> Index {
    let packet = PacketDef {
        id: AdjId(1000),
        board: BoardId(1),
        name: "test_data".to_string(),
        packet_type: PacketType::Data(vec![]),
    };
    let board = Board {
        id: BoardId(1),
        name: "TEST".to_string(),
        ip: IpAddr::from([192, 168, 0, 10]),
        mac: MacAddress([0; 6]),
        packets: HashMap::from([(packet.id, packet)]),
    };
    let pod_data = PodData {
        boards: HashMap::from([(board.id, board)]),
    };
    Index::new(&pod_data, None)
}

/// The next notification, or a test failure after [`RECEIVE_TIMEOUT`].
pub(super) async fn receive_notification(sinks: &mut Sinks) -> Notification {
    let Ok(Some(notification)) =
        tokio::time::timeout(RECEIVE_TIMEOUT, sinks.notifications.recv()).await
    else {
        unreachable!("a notification should have arrived within {RECEIVE_TIMEOUT:?}");
    };
    notification
}

/// The next error report, or a test failure after [`RECEIVE_TIMEOUT`].
pub(super) async fn receive_error_report(sinks: &mut Sinks) -> ErrorReport {
    let Ok(Some(report)) = tokio::time::timeout(RECEIVE_TIMEOUT, sinks.errors.recv()).await else {
        unreachable!("an error report should have arrived within {RECEIVE_TIMEOUT:?}");
    };
    report
}

/// Asserts that `notification` is what [`EMPTY_DATA_DATAGRAM`] decodes to.
pub(super) fn assert_is_empty_data_packet(notification: Notification) {
    assert_eq!(notification.board, BoardId(1));
    let Event::Received(Packet::Data(packet)) = notification.event else {
        unreachable!("a datagram should arrive as Event::Received(Packet::Data)");
    };
    assert_eq!(packet.id, AdjId(1000));
    assert!(packet.values.is_empty());
}

/// Binds the telemetry socket on a free loopback port, as [`spawn_udp`] does on
/// the backend's own address, and returns it with the port the OS picked.
pub(super) fn bind_on_loopback(recv_buffer: usize) -> (tokio::net::UdpSocket, SocketAddr) {
    let config = UdpConfig {
        addr: any_loopback_port(),
        recv_buffer,
    };
    let Ok(socket) = bind_telemetry_socket(config) else {
        unreachable!("binding to a free loopback port should succeed");
    };
    let Ok(addr) = socket.local_addr() else {
        unreachable!("a bound socket has a local address");
    };
    (socket, addr)
}

/// Starts receiving on a free loopback port with
/// [`index_with_empty_data_packet`], as [`spawn_udp`] does, and returns the
/// address to send to along with the task's handle.
pub(super) fn start_receiving_on_loopback(reporter: Reporter) -> (SocketAddr, JoinHandle<()>) {
    let (socket, addr) = bind_on_loopback(256 * 1024);
    let index = Arc::new(index_with_empty_data_packet());
    let handle = tokio::spawn(receive_telemetry(socket, index, reporter));
    (addr, handle)
}

/// A socket standing in for a board that sends telemetry.
pub(super) async fn bind_fake_board() -> tokio::net::UdpSocket {
    let Ok(socket) = tokio::net::UdpSocket::bind(any_loopback_port()).await else {
        unreachable!("binding the fake board's socket should succeed");
    };
    socket
}

/// Sends `bytes` as one datagram from `from` to `to`.
pub(super) async fn send_datagram(from: &tokio::net::UdpSocket, bytes: &[u8], to: SocketAddr) {
    let Ok(sent) = from.send_to(bytes, to).await else {
        unreachable!("sending on loopback should succeed");
    };
    assert_eq!(sent, bytes.len());
}
