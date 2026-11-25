//! The communication between station's modules.
//!
//! Every module runs in its own task and only talks to the others through
//! queues. This module prepares every one of those queues, in one call
//! ([`channels`]), and routes what goes through them ([`spawn`]):
//!
//! - **towards the front**, the routing loop takes what `net` reports and
//!   every error, and hands it to `logging` and `pipeline`, reading errors
//!   first, then TCP, then UDP;
//! - **towards the boards**, two workers write the front's orders and the
//!   fault to TCP, so the routing loop never waits on a socket.
//!
//! The full design (the queues and their numbers, the error procedures,
//! how it stops, the contract with the other modules) is in
//! `event/README.md`; the numbers ①–⑧ below refer to its table.

mod fault;
mod orders;
mod policy;

#[cfg(test)]
mod manual_tests;
#[cfg(test)]
mod tests;

pub use policy::full_message;

use std::collections::{HashMap, HashSet};
use std::future::Future;
use std::net::IpAddr;
use std::pin::Pin;
use std::sync::Arc;
use std::time::{Duration, SystemTime};

use software_core::model::{BoardId, OrderPacket, PodData};
use software_core::net::{ErrorReport, Notification, Reporter, Sinks};
use tokio::sync::{mpsc, oneshot};
use tokio::task::{JoinHandle, JoinSet};
use tracing::{debug, error, warn};

use self::fault::{FAULT_QUEUE, FaultRequest};
use self::policy::Action;

/// A batch of notifications, shared by `logging` and `pipeline` without
/// copying it: one allocation per batch, freed when both have let go of it.
pub type Batch = Arc<[Notification]>;

/// A future that can be sent to another task, boxed so that [`TcpLink`] can
/// be used as a trait object.
pub type BoxFuture<'a, T> = Pin<Box<dyn Future<Output = T> + Send + 'a>>;

/// What `event` needs from the TCP client: writing an order to its board,
/// and sending the fault to every board.
///
/// A trait rather than `net::tcp`'s own type so that the workers can be
/// tested against a fake, and so that `event` does not depend on the TCP
/// client's API beyond these two calls.
pub trait TcpLink: Send + Sync {
    /// Writes `order` to the board it belongs to.
    ///
    /// Returns that board **once the order is written**, not once it is
    /// queued; fails right away, with the reason, if the board is not
    /// connected.
    fn send(&self, order: OrderPacket) -> BoxFuture<'_, Result<BoardId, String>>;

    /// Sends the fault to every board. Fails with the boards it did not
    /// reach.
    fn send_fault(&self) -> BoxFuture<'_, Result<(), Vec<BoardId>>>;
}

/// Sizes of every queue, and the two settings of the error rules.
///
/// Every size is clamped to at least 1.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct EventConfig {
    /// Most notifications taken out of ③ or ④ at once.
    pub batch: usize,
    /// Slots in each of `net`'s error queues (①, one per transport).
    pub errors_queue: usize,
    /// Slots in ② (problems from station modules).
    pub problems_queue: usize,
    /// Slots in ③ (TCP notifications).
    pub tcp_queue: usize,
    /// Slots in ④ (UDP notifications). The only stretch of queue between the
    /// UDP socket and the routing loop, so the widest.
    pub udp_queue: usize,
    /// Slots in ⑤, counted in **batches**, not notifications.
    pub logging_queue: usize,
    /// Slots in ⑥, counted in **batches**, not notifications.
    pub pipeline_queue: usize,
    /// Slots in ⑦ (orders from the front).
    pub orders_queue: usize,
    /// Forward a board's fault to the other boards.
    pub forward_board_faults: bool,
    /// How long a fatal stop waits for the fault to be sent.
    pub fault_timeout: Duration,
}

impl Default for EventConfig {
    // Default config
    fn default() -> Self {
        Self {
            batch: 512,
            errors_queue: 16,
            problems_queue: 16,
            tcp_queue: 1024,
            udp_queue: 8192,
            logging_queue: 64,
            pipeline_queue: 64,
            orders_queue: 32,
            forward_board_faults: true,
            fault_timeout: Duration::from_secs(2),
        }
    }
}

/// Something the operator has to see.
#[derive(Debug, Clone, PartialEq, Eq)]
pub struct Problem {
    /// When it was detected.
    pub at: SystemTime,
    /// The board, if known.
    pub board: Option<BoardId>,
    /// What it means for the backend.
    pub kind: ProblemKind,
    /// The message with all its causes: "could not X: because Y: because Z"
    /// (see [`full_message`]).
    pub text: String,
}

impl Problem {
    /// A problem detected now.
    pub fn now(kind: ProblemKind, board: Option<BoardId>, text: impl Into<String>) -> Self {
        Self {
            at: SystemTime::now(),
            board,
            kind,
            text: text.into(),
        }
    }
}

/// What a [`Problem`] means for the backend.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProblemKind {
    /// Shown on the front; the backend keeps running.
    Shown,
    /// Shown on the front; the fault is sent and the backend stops.
    Fatal,
    /// Only written to the trace: not shown, the backend keeps running.
    Silent,
}

/// What `logging` receives (⑤).
#[derive(Debug)]
pub enum ToLogging {
    /// A batch of notifications, TCP or UDP.
    Received(Batch),
    /// An order TCP confirmed it wrote.
    OrderSent {
        /// When the write was confirmed.
        at: SystemTime,
        /// The board it was written to.
        board: BoardId,
        /// The order.
        order: OrderPacket,
    },
}

/// What `pipeline` receives (⑥).
#[derive(Debug)]
pub enum ToPipeline {
    /// A batch of notifications, TCP or UDP.
    Received(Batch),
    /// Something the operator has to see.
    Problem(Problem),
    /// An order that did not go out.
    OrderFailed {
        /// When it failed.
        at: SystemTime,
        /// The order.
        order: OrderPacket,
        /// Why.
        reason: String,
    },
}

/// Why `event` ended. `main` reads it and shuts everything down in order.
#[derive(Debug)]
pub enum Stop {
    /// A fatal error: shown on the front, fault sent (or attempted).
    Fatal(Problem),
    /// `net`'s queues closed: UDP and TCP were stopped.
    NetGone,
}

/// The boards as `event` needs them: who an IP belongs to, and what each
/// board is called. Built once from the ADJ.
#[derive(Debug, Clone, Default)]
pub struct Boards {
    by_ip: HashMap<IpAddr, BoardId>,
    names: HashMap<BoardId, String>,
}

impl Boards {
    /// Reads every board's IP and name.
    pub fn from_pod_data(pod_data: &PodData) -> Self {
        let by_ip = pod_data
            .boards
            .values()
            .map(|board| (board.ip, board.id))
            .collect();
        let names = pod_data
            .boards
            .values()
            .map(|board| (board.id, board.name.clone()))
            .collect();
        Self { by_ip, names }
    }

    /// The board at `ip`, if any.
    pub fn by_ip(&self, ip: IpAddr) -> Option<BoardId> {
        self.by_ip.get(&ip).copied()
    }

    /// The board's name, or its id if the ADJ does not declare it.
    pub fn name(&self, board: BoardId) -> String {
        self.names
            .get(&board)
            .cloned()
            .unwrap_or_else(|| format!("{board:?}"))
    }
}

/// Every queue between modules, as [`channels`] hands them out.
#[derive(Debug)]
pub struct Channels {
    /// For `net::udp`: reports on ① and ④.
    pub udp: Reporter,
    /// For `net::tcp`: reports on ① and ③. Drop it if TCP is not started.
    pub tcp: Reporter,
    /// `event`'s own ends, for [`spawn`].
    pub event: EventEnds,
    /// ⑦, for websocket's order forwarder.
    pub orders: mpsc::Sender<OrderPacket>,
    /// ②, cloned for every station module that reports problems.
    pub problems: mpsc::Sender<Problem>,
    /// ⑤, for `logging`.
    pub logging: mpsc::Receiver<ToLogging>,
    /// ⑥, for `pipeline`.
    pub pipeline: mpsc::Receiver<ToPipeline>,
}

/// `event`'s own ends of the queues: the reading side of ① ② ③ ④ ⑦ and the
/// writing side of ⑤ ⑥. Only [`spawn`] opens it.
#[derive(Debug)]
pub struct EventEnds {
    udp: Sinks,
    tcp: Sinks,
    problems: mpsc::Receiver<Problem>,
    orders: mpsc::Receiver<OrderPacket>,
    logging: mpsc::Sender<ToLogging>,
    pipeline: mpsc::Sender<ToPipeline>,
    /// Capacities of ③ and ④: how much a fatal stop drains at most.
    tcp_capacity: usize,
    udp_capacity: usize,
}

/// Creates every queue between modules. `main` calls it once, before
/// spawning anything, and hands each end to whoever uses it.
///
/// `net`'s queues are built with `net`'s own [`Reporter::channels`], once per
/// transport: TCP and UDP each get their own notification queue, so that TCP
/// can be read first, and their own error queue.
pub fn channels(config: &EventConfig) -> Channels {
    let errors = config.errors_queue.max(1);
    let tcp_capacity = config.tcp_queue.max(1);
    let udp_capacity = config.udp_queue.max(1);

    let (udp, udp_sinks) = Reporter::channels(udp_capacity, errors);
    let (tcp, tcp_sinks) = Reporter::channels(tcp_capacity, errors);
    let (problems_tx, problems_rx) = mpsc::channel(config.problems_queue.max(1));
    let (orders_tx, orders_rx) = mpsc::channel(config.orders_queue.max(1));
    let (logging_tx, logging_rx) = mpsc::channel(config.logging_queue.max(1));
    let (pipeline_tx, pipeline_rx) = mpsc::channel(config.pipeline_queue.max(1));

    Channels {
        udp,
        tcp,
        event: EventEnds {
            udp: udp_sinks,
            tcp: tcp_sinks,
            problems: problems_rx,
            orders: orders_rx,
            logging: logging_tx,
            pipeline: pipeline_tx,
            tcp_capacity,
            udp_capacity,
        },
        orders: orders_tx,
        problems: problems_tx,
        logging: logging_rx,
        pipeline: pipeline_rx,
    }
}

/// Starts the routing loop and the two workers.
///
/// Without a TCP client (`tcp: None`), every order fails with "TCP not
/// available" and the fault is only traced.
///
/// The returned task ends with the reason it stopped, once the workers have
/// been stopped too: by then every sender of ⑤ and ⑥ is gone, so `logging`
/// and `pipeline` finish what they have queued and end on their own.
pub fn spawn(
    config: EventConfig,
    ends: EventEnds,
    boards: Boards,
    tcp: Option<Arc<dyn TcpLink>>,
) -> JoinHandle<Stop> {
    tokio::spawn(run(config, ends, boards, tcp))
}

async fn run(
    config: EventConfig,
    ends: EventEnds,
    boards: Boards,
    tcp: Option<Arc<dyn TcpLink>>,
) -> Stop {
    let boards = Arc::new(boards);
    let (fault_tx, fault_rx) = mpsc::channel(FAULT_QUEUE);

    let mut workers = JoinSet::new();
    workers.spawn(fault::run(
        fault_rx,
        tcp.clone(),
        ends.pipeline.clone(),
        boards.clone(),
    ));
    workers.spawn(orders::run(
        ends.orders,
        tcp,
        fault_tx.clone(),
        ends.logging.clone(),
        ends.pipeline.clone(),
    ));

    let batch = config.batch.max(1);
    let router = Router {
        config,
        batch,
        boards,
        udp: ends.udp,
        tcp: ends.tcp,
        problems: ends.problems,
        logging: ends.logging,
        pipeline: ends.pipeline,
        fault: fault_tx,
        open: Open::default(),
        tcp_batch: Vec::with_capacity(batch),
        udp_batch: Vec::with_capacity(batch),
        tcp_capacity: ends.tcp_capacity,
        udp_capacity: ends.udp_capacity,
        faults_shown: HashSet::new(),
    };

    // The router's senders are dropped when `route` returns; the workers'
    // when they are stopped here.
    let stop = router.route().await;
    workers.shutdown().await;
    stop
}

/// Which transport a notification queue belongs to.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Transport {
    Tcp,
    Udp,
}

/// A consumer of the routing loop that has stopped.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum Consumer {
    Logging,
    Pipeline,
}

/// Why the routing loop has to stop, before it does it.
#[derive(Debug)]
enum Halt {
    Fatal(Problem),
    Gone(Consumer),
}

/// What one round of the `select!` got.
enum Step {
    NetError(Transport, Option<ErrorReport>),
    Problem(Option<Problem>),
    Notifications(Transport, usize),
}

/// Which input queues are still open. A closed queue answers "closed"
/// instantly, every time, so it is no longer watched: in fixed order it would
/// win every round and hide the queues below it.
#[derive(Debug, Clone, Copy)]
struct Open {
    udp_errors: bool,
    tcp_errors: bool,
    problems: bool,
    tcp_notifications: bool,
    udp_notifications: bool,
}

impl Default for Open {
    fn default() -> Self {
        Self {
            udp_errors: true,
            tcp_errors: true,
            problems: true,
            tcp_notifications: true,
            udp_notifications: true,
        }
    }
}

impl Open {
    /// Whether any of `net`'s four queues is still open. The loop only ends
    /// once all four are closed, so an error queued just before its
    /// transport stopped is never lost.
    fn net(&self) -> bool {
        self.udp_errors || self.tcp_errors || self.tcp_notifications || self.udp_notifications
    }
}

/// The routing loop's state: everything towards the front.
struct Router {
    config: EventConfig,
    batch: usize,
    boards: Arc<Boards>,
    udp: Sinks,
    tcp: Sinks,
    problems: mpsc::Receiver<Problem>,
    logging: mpsc::Sender<ToLogging>,
    pipeline: mpsc::Sender<ToPipeline>,
    fault: mpsc::Sender<FaultRequest>,
    open: Open,
    /// One reused buffer per notification queue (the two are read in the
    /// same `select!`, so they cannot share one).
    tcp_batch: Vec<Notification>,
    udp_batch: Vec<Notification>,
    tcp_capacity: usize,
    udp_capacity: usize,
    /// The addresses whose fault has already been shown.
    faults_shown: HashSet<IpAddr>,
}

impl Router {
    async fn route(mut self) -> Stop {
        loop {
            if !self.open.net() {
                return Stop::NetGone;
            }

            let limit = self.batch;
            let open = self.open;
            // Fixed order: errors, then TCP, then UDP.
            let step = tokio::select! {
                biased;
                report = self.udp.errors.recv(), if open.udp_errors => {
                    Step::NetError(Transport::Udp, report)
                }
                report = self.tcp.errors.recv(), if open.tcp_errors => {
                    Step::NetError(Transport::Tcp, report)
                }
                problem = self.problems.recv(), if open.problems => Step::Problem(problem),
                n = self.tcp.notifications.recv_many(&mut self.tcp_batch, limit),
                    if open.tcp_notifications => Step::Notifications(Transport::Tcp, n),
                n = self.udp.notifications.recv_many(&mut self.udp_batch, limit),
                    if open.udp_notifications => Step::Notifications(Transport::Udp, n),
                else => return Stop::NetGone,
            };

            let handled = match step {
                Step::NetError(Transport::Udp, None) => {
                    self.open.udp_errors = false;
                    Ok(())
                }
                Step::NetError(Transport::Tcp, None) => {
                    self.open.tcp_errors = false;
                    Ok(())
                }
                Step::NetError(_, Some(report)) => self.on_net_error(report).await,
                Step::Problem(None) => {
                    self.open.problems = false;
                    Ok(())
                }
                Step::Problem(Some(problem)) => self.on_problem(problem).await,
                // 0 only once the queue is closed and empty.
                Step::Notifications(Transport::Tcp, 0) => {
                    self.open.tcp_notifications = false;
                    Ok(())
                }
                Step::Notifications(Transport::Udp, 0) => {
                    self.open.udp_notifications = false;
                    Ok(())
                }
                Step::Notifications(transport, _) => {
                    self.forward(transport).await.map_err(Halt::Gone)
                }
            };

            match handled {
                Ok(()) => {}
                Err(Halt::Fatal(problem)) => return self.stop_fatal(problem).await,
                Err(Halt::Gone(consumer)) => return self.stop_consumer_gone(consumer).await,
            }
        }
    }

    /// Sends the batch just taken from `transport`'s queue to both consumers,
    /// as one shared copy.
    async fn forward(&mut self, transport: Transport) -> Result<(), Consumer> {
        let batch = match transport {
            Transport::Tcp => &mut self.tcp_batch,
            Transport::Udp => &mut self.udp_batch,
        };
        // One allocation; the buffer keeps its capacity for the next batch.
        let shared: Batch = batch.drain(..).collect();

        self.logging
            .send(ToLogging::Received(shared.clone()))
            .await
            .map_err(|_| Consumer::Logging)?;
        self.pipeline
            .send(ToPipeline::Received(shared))
            .await
            .map_err(|_| Consumer::Pipeline)
    }

    async fn on_net_error(&mut self, report: ErrorReport) -> Result<(), Halt> {
        let action = policy::classify(&report.error);
        let source = policy::source(&report.error);
        let board = source
            .board
            .or_else(|| source.ip.and_then(|ip| self.boards.by_ip(ip)));

        // UDP errors only carry an address: put the board's name in front.
        let mut text = full_message(&report.error);
        if let (Some(board), Some(_)) = (board, source.ip) {
            text = format!("{}: {text}", self.boards.name(board));
        }

        let kind = match action {
            Action::Fatal => ProblemKind::Fatal,
            Action::Silent => ProblemKind::Silent,
            Action::Show | Action::BoardFault => ProblemKind::Shown,
        };
        let problem = Problem {
            at: report.at,
            board,
            kind,
            text,
        };

        match action {
            Action::Fatal => Err(Halt::Fatal(problem)),
            Action::BoardFault => self.on_board_fault(problem, source.ip).await,
            Action::Show => self.show(problem).await.map_err(Halt::Gone),
            Action::Silent => {
                self.trace_silent(&problem);
                Ok(())
            }
        }
    }

    async fn on_problem(&mut self, problem: Problem) -> Result<(), Halt> {
        match policy::for_problem(problem.kind) {
            Action::Fatal => Err(Halt::Fatal(problem)),
            Action::Silent => {
                self.trace_silent(&problem);
                Ok(())
            }
            Action::Show | Action::BoardFault => self.show(problem).await.map_err(Halt::Gone),
        }
    }

    /// Procedure 1: written to the trace, and nothing else.
    fn trace_silent(&self, problem: &Problem) {
        let board = problem.board.map(|board| self.boards.name(board));
        warn!(board = ?board, problem = %problem.text, "problem not shown on the front");
    }

    /// The first fault from each address is shown and forwarded; repeats are
    /// not (`net` already traces them, rate-limited).
    async fn on_board_fault(&mut self, problem: Problem, ip: Option<IpAddr>) -> Result<(), Halt> {
        let first = ip.is_none_or(|ip| self.faults_shown.insert(ip));
        if !first {
            return Ok(());
        }

        warn!(fault = %problem.text, "first fault from this board");
        self.show(problem).await.map_err(Halt::Gone)?;

        if self.config.forward_board_faults {
            // Never waits: if the queue is full a request is already pending,
            // and the fault goes out only once anyway.
            if let Err(error) = self.fault.try_send(FaultRequest { done: None }) {
                debug!(%error, "fault request not queued");
            }
        }
        Ok(())
    }

    async fn show(&self, problem: Problem) -> Result<(), Consumer> {
        self.pipeline
            .send(ToPipeline::Problem(problem))
            .await
            .map_err(|_| Consumer::Pipeline)
    }

    /// Procedure 3: show it, pass on what was already queued, send the fault,
    /// stop.
    async fn stop_fatal(mut self, problem: Problem) -> Stop {
        error!(problem = %problem.text, "fatal error, stopping");

        let pipeline_alive = self
            .pipeline
            .send(ToPipeline::Problem(problem.clone()))
            .await
            .is_ok();
        if pipeline_alive {
            // Errors are read first, so this one has overtaken the data that
            // arrived just before it: pass that on before stopping. If a
            // consumer stops meanwhile, there is nothing left to do with it.
            let _ = self.drain().await;
        }

        self.send_fault_and_wait().await;
        Stop::Fatal(problem)
    }

    /// `logging` or `pipeline` stopped: nothing is recorded, or nothing is
    /// shown. Fatal, without draining.
    async fn stop_consumer_gone(self, consumer: Consumer) -> Stop {
        let text = match consumer {
            Consumer::Logging => "logging stopped: nothing is being recorded",
            Consumer::Pipeline => "pipeline stopped: nothing reaches the front",
        };
        let problem = Problem::now(ProblemKind::Fatal, None, text);
        error!(problem = %problem.text, "fatal error, stopping");

        if consumer == Consumer::Logging {
            let _ = self
                .pipeline
                .send(ToPipeline::Problem(problem.clone()))
                .await;
        }

        self.send_fault_and_wait().await;
        Stop::Fatal(problem)
    }

    /// Passes on what is already in ③ and ④, at most their capacity each, so
    /// that it cannot chase a queue that keeps filling up.
    async fn drain(&mut self) -> Result<(), Consumer> {
        for transport in [Transport::Tcp, Transport::Udp] {
            let mut left = match transport {
                Transport::Tcp => self.tcp_capacity,
                Transport::Udp => self.udp_capacity,
            };
            while left > 0 {
                let (queue, batch) = match transport {
                    Transport::Tcp => (&mut self.tcp.notifications, &mut self.tcp_batch),
                    Transport::Udp => (&mut self.udp.notifications, &mut self.udp_batch),
                };
                let limit = self.batch.min(left);
                while batch.len() < limit {
                    match queue.try_recv() {
                        Ok(notification) => batch.push(notification),
                        Err(_) => break,
                    }
                }
                if batch.is_empty() {
                    break;
                }
                left -= batch.len();
                self.forward(transport).await?;
            }
        }
        Ok(())
    }

    /// Asks the fault worker for the fault and waits until it has gone out
    /// (or had gone out already), within [`Config::fault_timeout`].
    async fn send_fault_and_wait(&self) {
        let (done_tx, done_rx) = oneshot::channel();
        let request = FaultRequest {
            done: Some(done_tx),
        };
        let wait = async {
            if self.fault.send(request).await.is_ok() {
                let _ = done_rx.await;
            }
        };
        if tokio::time::timeout(self.config.fault_timeout, wait)
            .await
            .is_err()
        {
            warn!(
                timeout = ?self.config.fault_timeout,
                "the fault was not confirmed in time; stopping anyway"
            );
        }
    }
}
