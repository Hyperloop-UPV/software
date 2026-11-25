//! Tests of the routing loop and the workers, with real queues and a fake
//! TCP client. No sockets.
//!
//! Every wait is bounded ([`next`], [`stops`], [`eventually`]), so that a
//! broken expectation fails instead of hanging.

use super::*;
use software_core::model::{AdjId, Board, DataPacket, MacAddress, Packet};
use software_core::net::Event;
use software_core::net::udp::UdpError;
use software_core::protocol::DecodeError;
use std::error::Error;
use std::net::SocketAddr;
use std::sync::atomic::{AtomicUsize, Ordering};
use tokio::time::{sleep, timeout};

type TestResult = Result<(), Box<dyn Error>>;

const WAIT: Duration = Duration::from_secs(1);
const HVSCU: BoardId = BoardId(1);
const VCU: BoardId = BoardId(2);

fn hvscu_addr() -> SocketAddr {
    SocketAddr::new(IpAddr::from([127, 0, 0, 7]), 50400)
}

fn vcu_addr() -> SocketAddr {
    SocketAddr::new(IpAddr::from([127, 0, 0, 8]), 50400)
}

fn board(id: BoardId, name: &str, addr: SocketAddr) -> Board {
    Board {
        id,
        name: name.to_string(),
        ip: addr.ip(),
        mac: MacAddress([0; 6]),
        packets: HashMap::new(),
    }
}

fn boards() -> Boards {
    let pod_data = PodData {
        boards: HashMap::from([
            (HVSCU, board(HVSCU, "HVSCU", hvscu_addr())),
            (VCU, board(VCU, "VCU", vcu_addr())),
        ]),
    };
    Boards::from_pod_data(&pod_data)
}

fn data() -> Event {
    Event::Received(Packet::Data(DataPacket::new(AdjId(1000), vec![])))
}

fn fault_from(from: SocketAddr) -> UdpError {
    UdpError::Fault { from }
}

fn decode_error() -> UdpError {
    UdpError::Decode {
        from: hvscu_addr(),
        source: DecodeError::UnknownId(AdjId(9999)),
    }
}

fn order(id: u16) -> OrderPacket {
    OrderPacket::new(AdjId(id), vec![])
}

/// The next message on `queue`, failing if none arrives within [`WAIT`].
async fn next<T>(queue: &mut mpsc::Receiver<T>) -> Result<T, Box<dyn Error>> {
    timeout(WAIT, queue.recv())
        .await?
        .ok_or_else(|| "the queue closed".into())
}

/// How `event` stopped, failing if it does not within [`WAIT`].
async fn stops(event: JoinHandle<Stop>) -> Result<Stop, Box<dyn Error>> {
    Ok(timeout(WAIT, event).await??)
}

/// Waits until `condition` holds, failing after [`WAIT`].
async fn eventually(condition: impl Fn() -> bool) -> TestResult {
    timeout(WAIT, async {
        while !condition() {
            sleep(Duration::from_millis(5)).await;
        }
    })
    .await?;
    Ok(())
}

/// A TCP client that counts what it is asked to do.
#[derive(Debug, Default)]
struct FakeTcp {
    orders: AtomicUsize,
    faults: AtomicUsize,
    /// Every order fails with this reason.
    refuse_orders: Option<&'static str>,
    /// The fault does not reach these boards.
    unreachable: Vec<BoardId>,
    /// The fault never finishes sending.
    fault_hangs: bool,
}

impl TcpLink for FakeTcp {
    fn send(&self, _order: OrderPacket) -> BoxFuture<'_, Result<BoardId, String>> {
        Box::pin(async move {
            self.orders.fetch_add(1, Ordering::SeqCst);
            match self.refuse_orders {
                Some(reason) => Err(reason.to_string()),
                None => Ok(HVSCU),
            }
        })
    }

    fn send_fault(&self) -> BoxFuture<'_, Result<(), Vec<BoardId>>> {
        Box::pin(async move {
            self.faults.fetch_add(1, Ordering::SeqCst);
            if self.fault_hangs {
                std::future::pending::<()>().await;
            }
            if self.unreachable.is_empty() {
                Ok(())
            } else {
                Err(self.unreachable.clone())
            }
        })
    }
}

fn as_link(fake: &Arc<FakeTcp>) -> Option<Arc<dyn TcpLink>> {
    let link: Arc<dyn TcpLink> = fake.clone();
    Some(link)
}

#[tokio::test]
async fn a_batch_reaches_logging_and_pipeline_as_the_same_copy() -> TestResult {
    let config = EventConfig::default();
    let mut channels = channels(&config);
    for _ in 0..3 {
        channels.udp.notify(HVSCU, data()).await?;
    }
    let _event = spawn(config, channels.event, boards(), None);

    let ToLogging::Received(logged) = next(&mut channels.logging).await? else {
        unreachable!("the first thing logging gets is the batch");
    };
    let ToPipeline::Received(shown) = next(&mut channels.pipeline).await? else {
        unreachable!("the first thing pipeline gets is the batch");
    };
    assert_eq!(logged.len(), 3);
    assert!(Arc::ptr_eq(&logged, &shown), "one copy, shared");
    Ok(())
}

#[tokio::test]
async fn errors_come_first_then_tcp_then_udp() -> TestResult {
    let config = EventConfig::default();
    let mut channels = channels(&config);
    // Queued in the opposite order to the one they must come out in.
    channels.udp.notify(HVSCU, data()).await?;
    channels.tcp.notify(VCU, Event::Connected).await?;
    channels.udp.report(fault_from(hvscu_addr())).await?;
    let _event = spawn(config, channels.event, boards(), None);

    let ToPipeline::Problem(problem) = next(&mut channels.pipeline).await? else {
        unreachable!("the error comes first");
    };
    assert!(
        problem.text.contains("signalled a fault"),
        "{}",
        problem.text
    );

    let ToPipeline::Received(tcp) = next(&mut channels.pipeline).await? else {
        unreachable!("then the TCP notification");
    };
    assert!(matches!(tcp[0].event, Event::Connected));

    let ToPipeline::Received(udp) = next(&mut channels.pipeline).await? else {
        unreachable!("then the UDP notification");
    };
    assert!(matches!(udp[0].event, Event::Received(Packet::Data(_))));
    Ok(())
}

#[tokio::test]
async fn a_fatal_error_passes_on_what_was_queued_and_stops() -> TestResult {
    let config = EventConfig::default();
    let mut channels = channels(&config);
    channels.udp.notify(HVSCU, data()).await?;
    channels.udp.notify(HVSCU, data()).await?;
    channels.udp.report(decode_error()).await?;
    let event = spawn(config, channels.event, boards(), None);

    let ToPipeline::Problem(problem) = next(&mut channels.pipeline).await? else {
        unreachable!("the fatal error is shown first");
    };
    assert_eq!(problem.kind, ProblemKind::Fatal);
    assert_eq!(problem.board, Some(HVSCU), "resolved from the address");
    assert!(problem.text.starts_with("HVSCU: "), "{}", problem.text);

    // The data that arrived before the error still gets through.
    let ToPipeline::Received(shown) = next(&mut channels.pipeline).await? else {
        unreachable!("then what was queued");
    };
    let ToLogging::Received(logged) = next(&mut channels.logging).await? else {
        unreachable!("logging gets what was queued too");
    };
    assert_eq!(shown.len(), 2);
    assert_eq!(logged.len(), 2);

    let Stop::Fatal(stopped_by) = stops(event).await? else {
        unreachable!("a decode error is fatal");
    };
    assert_eq!(stopped_by, problem);
    Ok(())
}

#[tokio::test]
async fn a_board_fault_is_shown_once_per_board_and_the_fault_sent_once() -> TestResult {
    let config = EventConfig::default();
    let mut channels = channels(&config);
    let fake = Arc::new(FakeTcp::default());
    let event = spawn(config, channels.event, boards(), as_link(&fake));

    for _ in 0..3 {
        channels.udp.report(fault_from(hvscu_addr())).await?;
    }
    channels.udp.report(fault_from(vcu_addr())).await?;
    // A marker: whatever comes before it on pipeline is all there is.
    channels.udp.notify(HVSCU, data()).await?;

    let ToPipeline::Problem(first) = next(&mut channels.pipeline).await? else {
        unreachable!("HVSCU's first fault is shown");
    };
    let ToPipeline::Problem(second) = next(&mut channels.pipeline).await? else {
        unreachable!("VCU's first fault is shown");
    };
    let ToPipeline::Received(_) = next(&mut channels.pipeline).await? else {
        unreachable!("HVSCU's repeats are not shown");
    };
    assert_eq!(first.board, Some(HVSCU));
    assert_eq!(second.board, Some(VCU));
    assert_eq!(first.kind, ProblemKind::Shown);

    eventually(|| fake.faults.load(Ordering::SeqCst) == 1).await?;
    sleep(Duration::from_millis(50)).await;
    assert_eq!(
        fake.faults.load(Ordering::SeqCst),
        1,
        "the fault goes out once"
    );
    assert!(
        !event.is_finished(),
        "a board fault does not stop the backend"
    );
    Ok(())
}

#[tokio::test]
async fn forwarding_a_board_fault_can_be_turned_off() -> TestResult {
    let config = EventConfig {
        forward_board_faults: false,
        ..EventConfig::default()
    };
    let mut channels = channels(&config);
    let fake = Arc::new(FakeTcp::default());
    let _event = spawn(config, channels.event, boards(), as_link(&fake));

    channels.udp.report(fault_from(hvscu_addr())).await?;
    let ToPipeline::Problem(_) = next(&mut channels.pipeline).await? else {
        unreachable!("the fault is still shown");
    };
    sleep(Duration::from_millis(50)).await;
    assert_eq!(fake.faults.load(Ordering::SeqCst), 0);
    Ok(())
}

#[tokio::test]
async fn closed_queues_do_not_hide_the_others() -> TestResult {
    let config = EventConfig::default();
    let Channels {
        udp,
        tcp,
        event,
        orders,
        problems,
        mut logging,
        pipeline: _pipeline,
    } = channels(&config);
    drop((tcp, orders, problems));
    let _event = spawn(config, event, boards(), None);

    udp.notify(HVSCU, data()).await?;
    let ToLogging::Received(batch) = next(&mut logging).await? else {
        unreachable!("the UDP notification gets through");
    };
    assert_eq!(batch.len(), 1);
    Ok(())
}

#[tokio::test]
async fn without_tcp_an_order_fails() -> TestResult {
    let config = EventConfig::default();
    let mut channels = channels(&config);
    let _event = spawn(config, channels.event, boards(), None);

    channels.orders.send(order(5)).await?;
    let ToPipeline::OrderFailed { order, reason, .. } = next(&mut channels.pipeline).await? else {
        unreachable!("the order fails");
    };
    assert_eq!(order.id, AdjId(5));
    assert_eq!(reason, orders::TCP_NOT_AVAILABLE);
    Ok(())
}

#[tokio::test]
async fn a_written_order_is_logged() -> TestResult {
    let config = EventConfig::default();
    let mut channels = channels(&config);
    let fake = Arc::new(FakeTcp::default());
    let _event = spawn(config, channels.event, boards(), as_link(&fake));

    channels.orders.send(order(5)).await?;
    let ToLogging::OrderSent { board, order, .. } = next(&mut channels.logging).await? else {
        unreachable!("the order is logged");
    };
    assert_eq!(board, HVSCU);
    assert_eq!(order.id, AdjId(5));
    Ok(())
}

#[tokio::test]
async fn an_order_that_was_not_written_is_shown() -> TestResult {
    let config = EventConfig::default();
    let mut channels = channels(&config);
    let fake = Arc::new(FakeTcp {
        refuse_orders: Some("board not connected"),
        ..FakeTcp::default()
    });
    let _event = spawn(config, channels.event, boards(), as_link(&fake));

    channels.orders.send(order(5)).await?;
    let ToPipeline::OrderFailed { reason, .. } = next(&mut channels.pipeline).await? else {
        unreachable!("the order is shown as failed");
    };
    assert_eq!(reason, "board not connected");
    Ok(())
}

#[tokio::test]
async fn order_id_0_is_the_fault() -> TestResult {
    let config = EventConfig::default();
    let channels = channels(&config);
    let fake = Arc::new(FakeTcp::default());
    let _event = spawn(config, channels.event, boards(), as_link(&fake));

    channels.orders.send(order(0)).await?;
    eventually(|| fake.faults.load(Ordering::SeqCst) == 1).await?;
    assert_eq!(
        fake.orders.load(Ordering::SeqCst),
        0,
        "not written as an order"
    );
    Ok(())
}

#[tokio::test]
async fn a_fault_that_misses_boards_is_shown() -> TestResult {
    let config = EventConfig::default();
    let mut channels = channels(&config);
    let fake = Arc::new(FakeTcp {
        unreachable: vec![VCU],
        ..FakeTcp::default()
    });
    let _event = spawn(config, channels.event, boards(), as_link(&fake));

    channels.udp.report(fault_from(hvscu_addr())).await?;
    let ToPipeline::Problem(fault) = next(&mut channels.pipeline).await? else {
        unreachable!("the board's fault is shown");
    };
    let ToPipeline::Problem(missed) = next(&mut channels.pipeline).await? else {
        unreachable!("then the boards the fault did not reach");
    };
    assert!(fault.text.contains("signalled a fault"), "{}", fault.text);
    assert_eq!(missed.kind, ProblemKind::Shown);
    assert!(missed.text.contains("VCU"), "{}", missed.text);
    Ok(())
}

#[tokio::test]
async fn a_station_problem_is_traced_shown_or_stops_as_its_module_says() -> TestResult {
    let config = EventConfig::default();
    let mut channels = channels(&config);
    let event = spawn(config, channels.event, boards(), None);

    let silent = Problem::now(ProblemKind::Silent, None, "only for the trace");
    let shown = Problem::now(ProblemKind::Shown, None, "something to show");
    channels.problems.send(silent).await?;
    channels.problems.send(shown.clone()).await?;
    let ToPipeline::Problem(problem) = next(&mut channels.pipeline).await? else {
        unreachable!("a shown problem reaches pipeline");
    };
    // The silent one went first, but only to the trace.
    assert_eq!(problem, shown);

    let fatal = Problem::now(ProblemKind::Fatal, None, "the disk is full");
    channels.problems.send(fatal.clone()).await?;
    let Stop::Fatal(stopped_by) = stops(event).await? else {
        unreachable!("a fatal problem stops event");
    };
    assert_eq!(stopped_by, fatal);
    Ok(())
}

#[tokio::test]
async fn when_logging_stops_event_stops_and_tells_pipeline() -> TestResult {
    let config = EventConfig::default();
    let Channels {
        udp,
        tcp: _tcp,
        event,
        orders: _orders,
        problems: _problems,
        logging,
        mut pipeline,
    } = channels(&config);
    drop(logging);
    let event = spawn(config, event, boards(), None);

    udp.notify(HVSCU, data()).await?;
    let ToPipeline::Problem(problem) = next(&mut pipeline).await? else {
        unreachable!("pipeline is told that logging stopped");
    };
    assert_eq!(problem.kind, ProblemKind::Fatal);
    assert!(problem.text.contains("logging"), "{}", problem.text);

    let Stop::Fatal(_) = stops(event).await? else {
        unreachable!("losing logging is fatal");
    };
    Ok(())
}

#[tokio::test]
async fn when_net_closes_what_was_left_is_passed_on_and_event_stops() -> TestResult {
    let config = EventConfig::default();
    let Channels {
        udp,
        tcp,
        event,
        orders: _orders,
        problems: _problems,
        mut logging,
        pipeline: _pipeline,
    } = channels(&config);
    udp.notify(HVSCU, data()).await?;
    udp.notify(HVSCU, data()).await?;
    drop((udp, tcp));
    let event = spawn(config, event, boards(), None);

    let ToLogging::Received(batch) = next(&mut logging).await? else {
        unreachable!("what was queued gets through");
    };
    assert_eq!(batch.len(), 2);

    let Stop::NetGone = stops(event).await? else {
        unreachable!("both transports are gone");
    };
    // Once event has stopped, logging's queue closes: logging can finish.
    assert!(timeout(WAIT, logging.recv()).await?.is_none());
    Ok(())
}

#[tokio::test]
async fn a_fault_that_never_goes_out_does_not_block_the_stop() -> TestResult {
    let config = EventConfig {
        fault_timeout: Duration::from_millis(50),
        ..EventConfig::default()
    };
    let channels = channels(&config);
    let fake = Arc::new(FakeTcp {
        fault_hangs: true,
        ..FakeTcp::default()
    });
    let event = spawn(config, channels.event, boards(), as_link(&fake));

    channels.udp.report(decode_error()).await?;
    let Stop::Fatal(_) = stops(event).await? else {
        unreachable!("a decode error is fatal");
    };
    assert_eq!(
        fake.faults.load(Ordering::SeqCst),
        1,
        "the fault was attempted"
    );
    Ok(())
}
