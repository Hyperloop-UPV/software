//! Serial writing of queued orders and periodic keep-alives for one TCP session.

use super::Error;
use crate::model::BoardId;
use std::{future::pending, io, time::Duration};
use tokio::{
    io::{AsyncWrite, AsyncWriteExt},
    net::tcp::OwnedWriteHalf,
    sync::mpsc,
    time::{Instant, sleep, timeout},
};

/// The application heartbeat is only the reserved ID 1, little-endian.
const KEEP_ALIVE: [u8; 2] = [0x01, 0x00];

/// Writes queued frames in order, ending normally when the channel is closed and drained.
///
/// Owns the write half but only borrows the receiver: ending a session must not
/// destroy the queue. The caller must finish any handshake before starting this
/// writer and must not write frames through another path on the same connection.
/// No index is needed because the queued frames are already encoded.
///
/// `keep_alive` is the configured period; zero disables the timer. The first
/// heartbeat waits one period. Normal orders do not reset it, and a due heartbeat
/// takes priority at frame boundaries, never interrupting a frame in progress.
/// After a heartbeat completes, its timer restarts for a full period: delayed
/// writes produce no catch-up burst, including when the heartbeat itself is slow.
/// A closed and drained channel ends the writer even when a heartbeat is due.
///
/// Each complete frame gets one `write_timeout`, including all partial writes.
/// Waiting for an order has no deadline. Success means the socket accepted all
/// queued bytes, not that firmware received or executed them. Dropping the owned
/// write half shuts down the socket's write side; it is not a delivery guarantee.
///
/// On failure or cancellation during an order write, its dequeued frame is lost
/// to the caller and may have been partly or fully transmitted. A heartbeat write
/// does not dequeue an order. In either case, never automatically retry the frame
/// or continue using that session. Orders not yet dequeued remain in `orders`;
/// their disconnected-order policy belongs to the future session supervisor.
/// That owner must also dispose of the read half and report failures once.
/// This function does not log, report events, reconnect, or broadcast faults.
///
/// # Errors
///
/// Returns non-fatal [`Error::Write`] with the original I/O error, or an I/O
/// error of kind [`io::ErrorKind::TimedOut`] when a frame deadline elapses.
pub(super) async fn send(
    writer: OwnedWriteHalf,
    board: BoardId,
    orders: &mut mpsc::Receiver<Vec<u8>>,
    write_timeout: Duration,
    keep_alive: Duration,
) -> Result<(), Error> {
    write_orders(writer, board, orders, write_timeout, keep_alive).await
}

/// Drives the same loop over TCP or a controlled test writer, without socket-specific behavior.
async fn write_orders<W: AsyncWrite + Unpin>(
    mut writer: W,
    board: BoardId,
    orders: &mut mpsc::Receiver<Vec<u8>>,
    write_timeout: Duration,
    keep_alive: Duration,
) -> Result<(), Error> {
    let mut heartbeat = (!keep_alive.is_zero()).then(|| Box::pin(sleep(keep_alive)));

    loop {
        // Some owns one queued order; None selects the static heartbeat bytes.
        // Choose only between frames, so neither branch can cancel write_all.
        let order = tokio::select! {
            biased;
            _ = async {
                match &mut heartbeat {
                    Some(timer) => timer.as_mut().await,
                    None => pending::<()>().await,
                }
            } => {
                // Closure wins over a due timer once the queue is empty. recv
                // also waits for outstanding reserved permits before declaring
                // the channel drained; is_closed + is_empty alone is not enough.
                if orders.is_closed() && orders.is_empty() {
                    let Some(bytes) = orders.recv().await else { return Ok(()) };
                    Some(bytes)
                } else {
                    None
                }
            }
            order = orders.recv() => {
                let Some(bytes) = order else { return Ok(()) };
                Some(bytes)
            }
        };
        let bytes = order.as_deref().unwrap_or(&KEEP_ALIVE);
        // Keep one deadline around the whole frame, not one deadline per partial write.
        timeout(write_timeout, writer.write_all(bytes))
            .await
            .map_err(|_| Error::Write {
                board,
                source: io::Error::new(io::ErrorKind::TimedOut, "TCP frame write timed out"),
            })?
            .map_err(|source| Error::Write { board, source })?;

        if order.is_none()
            && let Some(timer) = &mut heartbeat
        {
            // Restart only after heartbeat completion, not after ordinary traffic.
            timer.as_mut().reset(Instant::now() + keep_alive);
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::{
        collections::VecDeque,
        future::{Future, poll_fn},
        net::Ipv4Addr,
        pin::Pin,
        task::{Context, Poll},
    };
    use tokio::{
        io::AsyncReadExt,
        net::{TcpListener, TcpStream},
        time::{Instant, Sleep, advance},
    };

    const TEST_TIMEOUT: Duration = Duration::from_secs(2);
    const FRAME_TIMEOUT: Duration = Duration::from_millis(10);
    const FIRST: &[u8] = &[0x58, 0x02, 42];
    const SECOND: &[u8] = &[0x59, 0x02];

    /// One action at the next write attempt, independent of kernel buffer sizes.
    #[derive(Debug)]
    enum Step {
        Write(usize),
        Wait(Duration),
        Fail(io::ErrorKind),
        Zero,
        Pending,
    }

    /// Records accepted bytes while scripting partial progress, failures and stalls.
    #[derive(Debug)]
    struct ControlledWriter {
        steps: VecDeque<Step>,
        delay: Option<Pin<Box<Sleep>>>,
        written: Vec<u8>,
        write_times: Vec<Instant>,
    }

    impl ControlledWriter {
        // New empty ControlledWriter
        fn new(steps: impl IntoIterator<Item = Step>) -> Self {
            Self {
                steps: steps.into_iter().collect(),
                delay: None,
                written: vec![],
                write_times: vec![],
            }
        }
    }

    impl AsyncWrite for ControlledWriter {
        fn poll_write(
            mut self: Pin<&mut Self>,
            cx: &mut Context<'_>,
            bytes: &[u8],
        ) -> Poll<io::Result<usize>> {
            loop {
                if let Some(delay) = &mut self.delay {
                    // Start each delay when reached, rather than at fixture construction.
                    if delay.as_mut().poll(cx).is_pending() {
                        return Poll::Pending;
                    }
                    self.delay = None;
                }
                match self.steps.pop_front() {
                    Some(Step::Wait(duration)) => {
                        self.delay = Some(Box::pin(tokio::time::sleep(duration)));
                    }
                    Some(Step::Fail(kind)) => {
                        return Poll::Ready(Err(io::Error::new(kind, "scripted write failure")));
                    }
                    Some(Step::Zero) => return Poll::Ready(Ok(0)),
                    Some(Step::Pending) => {
                        // This sink never becomes writable; only the deadline can finish it.
                        self.steps.push_front(Step::Pending);
                        return Poll::Pending;
                    }
                    step => {
                        let count = match step {
                            Some(Step::Write(limit)) => limit.min(bytes.len()),
                            None => bytes.len(),
                            _ => unreachable!("all non-write actions are handled above"),
                        };
                        self.written.extend_from_slice(&bytes[..count]);
                        self.write_times.push(Instant::now());
                        return Poll::Ready(Ok(count));
                    }
                }
            }
        }

        fn poll_flush(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
            Poll::Ready(Ok(()))
        }

        fn poll_shutdown(self: Pin<&mut Self>, _cx: &mut Context<'_>) -> Poll<io::Result<()>> {
            Poll::Ready(Ok(()))
        }
    }

    /// Preloads two complete frames and keeps the sender alive for failure-path checks.
    fn queued_frames() -> (mpsc::Sender<Vec<u8>>, mpsc::Receiver<Vec<u8>>) {
        let (sender, receiver) = mpsc::channel(2);
        assert!(sender.try_send(FIRST.to_vec()).is_ok());
        assert!(sender.try_send(SECOND.to_vec()).is_ok());
        (sender, receiver)
    }

    /// Checks the public transport classification as well as the underlying failure.
    fn assert_write_error(error: Error, kind: io::ErrorKind) -> io::Error {
        assert!(!error.is_fatal());
        let Error::Write { board, source } = error else {
            unreachable!("writer failures must retain their board and I/O cause");
        };
        assert_eq!(board, BoardId(3));
        assert_eq!(source.kind(), kind);
        source
    }

    /// Polls once without sleeping, proving the writer is still waiting for work or time.
    async fn assert_pending_once<F: Future>(mut future: Pin<&mut F>) {
        poll_fn(|cx| {
            assert!(future.as_mut().poll(cx).is_pending());
            Poll::Ready(())
        })
        .await;
    }

    /// Expresses recorded write times relative to the scenario's virtual start.
    fn elapsed_writes(writer: &ControlledWriter, started: Instant) -> Vec<Duration> {
        writer
            .write_times
            .iter()
            .map(|at| at.duration_since(started))
            .collect()
    }

    #[tokio::test]
    async fn writes_queued_frames_to_tcp_in_order_and_closes_its_write_side()
    -> Result<(), Box<dyn std::error::Error>> {
        // Use ordinary loopback sockets, not zero linger, to observe bytes followed by EOF.
        // Assert the concatenated stream: TCP need not preserve individual write boundaries.
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let client = timeout(TEST_TIMEOUT, TcpStream::connect(listener.local_addr()?)).await??;
        let (mut peer, _) = timeout(TEST_TIMEOUT, listener.accept()).await??;
        let (_read_half, write_half) = client.into_split();
        let (sender, mut receiver) = queued_frames();
        drop(sender);
        let mut received = vec![];

        let (sent, read) = timeout(TEST_TIMEOUT, async {
            tokio::join!(
                send(
                    write_half,
                    BoardId(3),
                    &mut receiver,
                    TEST_TIMEOUT,
                    Duration::ZERO
                ),
                peer.read_to_end(&mut received),
            )
        })
        .await?;
        sent?;
        read?;
        assert_eq!(received, [FIRST, SECOND].concat());
        assert_eq!(
            receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Disconnected)
        );
        Ok(())
    }

    #[tokio::test]
    async fn an_empty_closed_channel_finishes_without_attempting_a_write()
    -> Result<(), Box<dyn std::error::Error>> {
        // The failure action is a sentinel: a drained channel must not touch the writer.
        let (sender, mut receiver) = mpsc::channel(1);
        drop(sender);
        let mut writer = ControlledWriter::new([Step::Fail(io::ErrorKind::BrokenPipe)]);
        timeout(
            TEST_TIMEOUT,
            write_orders(
                &mut writer,
                BoardId(3),
                &mut receiver,
                FRAME_TIMEOUT,
                Duration::ZERO,
            ),
        )
        .await??;
        assert!(writer.written.is_empty());
        assert_eq!(writer.steps.len(), 1);
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn waiting_for_an_order_has_no_write_deadline() -> Result<(), Box<dyn std::error::Error>>
    {
        // With keep-alive disabled, advance well beyond the frame timeout while idle.
        // The writer must remain pending, then accept a later order normally.
        let (sender, mut receiver) = mpsc::channel(1);
        let mut writer = ControlledWriter::new([]);
        {
            let sending = write_orders(
                &mut writer,
                BoardId(3),
                &mut receiver,
                FRAME_TIMEOUT,
                Duration::ZERO,
            );
            tokio::pin!(sending);
            poll_fn(|cx| {
                assert!(sending.as_mut().poll(cx).is_pending());
                Poll::Ready(())
            })
            .await;
            advance(FRAME_TIMEOUT * 10).await;
            poll_fn(|cx| {
                assert!(sending.as_mut().poll(cx).is_pending());
                Poll::Ready(())
            })
            .await;
            sender.try_send(FIRST.to_vec())?;
            drop(sender);
            timeout(TEST_TIMEOUT, sending).await??;
        }
        assert_eq!(writer.written, FIRST);
        Ok(())
    }

    #[tokio::test]
    async fn completes_partial_writes_before_starting_the_next_frame()
    -> Result<(), Box<dyn std::error::Error>> {
        // Accept only one byte per write call. write_all must finish FIRST before SECOND,
        // even though each frame requires several successful partial writes.
        let (sender, mut receiver) = queued_frames();
        drop(sender);
        let mut writer = ControlledWriter::new((0..5).map(|_| Step::Write(1)));
        timeout(
            TEST_TIMEOUT,
            write_orders(
                &mut writer,
                BoardId(3),
                &mut receiver,
                FRAME_TIMEOUT,
                Duration::ZERO,
            ),
        )
        .await??;
        assert_eq!(writer.written, [FIRST, SECOND].concat());
        assert!(writer.steps.is_empty());
        Ok(())
    }

    #[tokio::test]
    async fn io_failure_stops_without_retrying_or_dequeueing_the_next_frame()
    -> Result<(), Box<dyn std::error::Error>> {
        // Fail both before any progress and after a prefix. In either case FIRST is
        // not requeued, SECOND stays untouched, and the borrowed receiver remains open.
        for prefix in [0, 2] {
            let (sender, mut receiver) = queued_frames();
            let mut steps = vec![];
            if prefix > 0 {
                steps.push(Step::Write(prefix));
            }
            steps.push(Step::Fail(io::ErrorKind::BrokenPipe));
            let mut writer = ControlledWriter::new(steps);
            let Err(error) = timeout(
                TEST_TIMEOUT,
                write_orders(
                    &mut writer,
                    BoardId(3),
                    &mut receiver,
                    FRAME_TIMEOUT,
                    Duration::ZERO,
                ),
            )
            .await?
            else {
                unreachable!("the scripted I/O failure must terminate this session");
            };
            let source = assert_write_error(error, io::ErrorKind::BrokenPipe);
            assert_eq!(source.to_string(), "scripted write failure");
            assert_eq!(writer.written, FIRST[..prefix]);
            assert_eq!(receiver.try_recv(), Ok(SECOND.to_vec()));
            assert_eq!(receiver.try_recv(), Err(mpsc::error::TryRecvError::Empty));
            sender.try_send(vec![0xaa])?;
        }
        Ok(())
    }

    #[tokio::test]
    async fn a_zero_byte_write_is_a_write_zero_error_not_success()
    -> Result<(), Box<dyn std::error::Error>> {
        // AsyncWrite can return zero without an I/O error; write_all must treat that
        // as inability to complete a nonempty frame and leave SECOND in the queue.
        let (_sender, mut receiver) = queued_frames();
        let mut writer = ControlledWriter::new([Step::Zero]);
        let Err(error) = timeout(
            TEST_TIMEOUT,
            write_orders(
                &mut writer,
                BoardId(3),
                &mut receiver,
                FRAME_TIMEOUT,
                Duration::ZERO,
            ),
        )
        .await?
        else {
            unreachable!("zero progress cannot complete a nonempty frame");
        };
        assert_write_error(error, io::ErrorKind::WriteZero);
        assert!(writer.written.is_empty());
        assert_eq!(receiver.try_recv(), Ok(SECOND.to_vec()));
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn a_stalled_write_times_out_without_touching_the_next_frame()
    -> Result<(), Box<dyn std::error::Error>> {
        // A permanently pending sink deterministically exercises the timeout path,
        // both before any bytes and after partial progress, without filling a TCP buffer.
        for prefix in [0, 2] {
            let (sender, mut receiver) = queued_frames();
            let mut steps = vec![];
            if prefix > 0 {
                steps.push(Step::Write(prefix));
            }
            steps.push(Step::Pending);
            let mut writer = ControlledWriter::new(steps);
            let started = Instant::now();
            let Err(error) = timeout(
                TEST_TIMEOUT,
                write_orders(
                    &mut writer,
                    BoardId(3),
                    &mut receiver,
                    FRAME_TIMEOUT,
                    Duration::ZERO,
                ),
            )
            .await?
            else {
                unreachable!("a stalled frame must hit its deadline");
            };
            assert_write_error(error, io::ErrorKind::TimedOut);
            assert_eq!(started.elapsed(), FRAME_TIMEOUT);
            assert_eq!(writer.written, FIRST[..prefix]);
            assert_eq!(receiver.try_recv(), Ok(SECOND.to_vec()));
            assert_eq!(receiver.try_recv(), Err(mpsc::error::TryRecvError::Empty));
            sender.try_send(vec![0xaa])?;
        }
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn partial_progress_does_not_restart_the_frame_deadline()
    -> Result<(), Box<dyn std::error::Error>> {
        // Each delayed write takes less than 10 ms, but the whole frame takes longer.
        // A per-write timeout would incorrectly succeed; the frame deadline must expire.
        let (_sender, mut receiver) = queued_frames();
        let mut writer = ControlledWriter::new([
            Step::Wait(Duration::from_millis(6)),
            Step::Write(1),
            Step::Wait(Duration::from_millis(6)),
            Step::Write(1),
            Step::Wait(Duration::from_millis(6)),
            Step::Write(1),
        ]);
        let started = Instant::now();
        let Err(error) = timeout(
            TEST_TIMEOUT,
            write_orders(
                &mut writer,
                BoardId(3),
                &mut receiver,
                FRAME_TIMEOUT,
                Duration::ZERO,
            ),
        )
        .await?
        else {
            unreachable!("partial progress must not extend the frame's deadline");
        };
        assert_write_error(error, io::ErrorKind::TimedOut);
        assert_eq!(started.elapsed(), FRAME_TIMEOUT);
        assert_eq!(writer.written, FIRST[..1]);
        assert_eq!(receiver.try_recv(), Ok(SECOND.to_vec()));
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn each_frame_receives_a_fresh_write_deadline() -> Result<(), Box<dyn std::error::Error>>
    {
        // Two 6 ms frames exceed 10 ms together but each fits its own deadline.
        // This rules out accidentally timing the entire queue-draining loop.
        let (sender, mut receiver) = queued_frames();
        drop(sender);
        let mut writer = ControlledWriter::new([
            Step::Wait(Duration::from_millis(6)),
            Step::Write(usize::MAX),
            Step::Wait(Duration::from_millis(6)),
            Step::Write(usize::MAX),
        ]);
        let started = Instant::now();
        timeout(
            TEST_TIMEOUT,
            write_orders(
                &mut writer,
                BoardId(3),
                &mut receiver,
                FRAME_TIMEOUT,
                Duration::ZERO,
            ),
        )
        .await??;
        assert_eq!(started.elapsed(), Duration::from_millis(12));
        assert_eq!(writer.written, [FIRST, SECOND].concat());
        Ok(())
    }

    #[tokio::test]
    async fn cancellation_does_not_requeue_the_current_frame_or_destroy_the_receiver()
    -> Result<(), Box<dyn std::error::Error>> {
        // Cancel after a prefix reached the sink. The remaining queue survives, but
        // FIRST is no longer recoverable: a supervisor must discard this session.
        let (sender, mut receiver) = queued_frames();
        let mut writer = ControlledWriter::new([Step::Write(1), Step::Pending]);
        {
            let sending = write_orders(
                &mut writer,
                BoardId(3),
                &mut receiver,
                FRAME_TIMEOUT,
                Duration::ZERO,
            );
            tokio::pin!(sending);
            poll_fn(|cx| {
                assert!(sending.as_mut().poll(cx).is_pending());
                Poll::Ready(())
            })
            .await;
            // Leaving this scope drops the in-flight future, not the borrowed receiver.
        }
        assert_eq!(writer.written, FIRST[..1]);
        assert_eq!(receiver.try_recv(), Ok(SECOND.to_vec()));
        assert_eq!(receiver.try_recv(), Err(mpsc::error::TryRecvError::Empty));
        sender.try_send(vec![0xaa])?;
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn idle_keep_alives_wait_a_full_configured_period_and_repeat()
    -> Result<(), Box<dyn std::error::Error>> {
        // Different periods must produce their first two heartbeats at the configured
        // times, never immediately. An open, empty order channel must stay alive.
        for period in [Duration::from_millis(10), Duration::from_millis(24)] {
            let (sender, mut receiver) = mpsc::channel(1);
            let mut writer = ControlledWriter::new([]);
            let started = Instant::now();
            {
                let sending = write_orders(
                    &mut writer,
                    BoardId(3),
                    &mut receiver,
                    FRAME_TIMEOUT,
                    period,
                );
                tokio::pin!(sending);
                assert_pending_once(sending.as_mut()).await;
                advance(period / 2).await;
                assert_pending_once(sending.as_mut()).await;
                advance(period / 2).await;
                assert_pending_once(sending.as_mut()).await;
                advance(period).await;
                assert_pending_once(sending.as_mut()).await;
                drop(sender);
                timeout(TEST_TIMEOUT, sending).await??;
            }
            assert_eq!(writer.written, KEEP_ALIVE.repeat(2));
            assert_eq!(elapsed_writes(&writer, started), vec![period, period * 2]);
        }
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn ordinary_traffic_does_not_reset_or_starve_the_keep_alive()
    -> Result<(), Box<dyn std::error::Error>> {
        // Each queued order takes 12 ms, crossing the 10 ms heartbeat period.
        // The due heartbeat must win before the next queued order, not wait for idle time.
        let period = Duration::from_millis(10);
        let order_time = Duration::from_millis(12);
        let (sender, mut receiver) = queued_frames();
        let mut writer = ControlledWriter::new([
            Step::Wait(order_time),
            Step::Write(usize::MAX),
            Step::Write(usize::MAX),
            Step::Wait(order_time),
            Step::Write(usize::MAX),
        ]);
        let started = Instant::now();
        {
            let sending =
                write_orders(&mut writer, BoardId(3), &mut receiver, TEST_TIMEOUT, period);
            tokio::pin!(sending);
            assert_pending_once(sending.as_mut()).await;
            advance(order_time).await;
            assert_pending_once(sending.as_mut()).await;
            advance(order_time).await;
            assert_pending_once(sending.as_mut()).await;
            drop(sender);
            timeout(TEST_TIMEOUT, sending).await??;
        }
        assert_eq!(
            writer.written,
            [FIRST, &KEEP_ALIVE, SECOND, &KEEP_ALIVE].concat()
        );
        assert_eq!(
            elapsed_writes(&writer, started),
            vec![order_time, order_time, order_time * 2, order_time * 2]
        );
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn a_due_keep_alive_never_interrupts_a_partially_written_order()
    -> Result<(), Box<dyn std::error::Error>> {
        // FIRST pauses after one byte while several heartbeat periods elapse.
        // Only its remaining bytes may follow that prefix; the heartbeat comes afterward.
        let period = Duration::from_millis(10);
        let delay = Duration::from_millis(35);
        let (sender, mut receiver) = queued_frames();
        let mut writer =
            ControlledWriter::new([Step::Write(1), Step::Wait(delay), Step::Write(usize::MAX)]);
        {
            let sending =
                write_orders(&mut writer, BoardId(3), &mut receiver, TEST_TIMEOUT, period);
            tokio::pin!(sending);
            assert_pending_once(sending.as_mut()).await;
            advance(delay).await;
            assert_pending_once(sending.as_mut()).await;
            drop(sender);
            timeout(TEST_TIMEOUT, sending).await??;
        }
        assert_eq!(writer.written, [FIRST, &KEEP_ALIVE, SECOND].concat());
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn missed_keep_alive_periods_produce_one_send_not_a_catch_up_burst()
    -> Result<(), Box<dyn std::error::Error>> {
        // Delay an order for seven periods. Resuming must send one heartbeat, then
        // wait a new period. Include 1 ms to catch timer policies with short-delay bursts.
        for period in [Duration::from_millis(1), Duration::from_millis(10)] {
            let delay = period * 7;
            let (sender, mut receiver) = mpsc::channel(1);
            sender.try_send(FIRST.to_vec())?;
            let mut writer = ControlledWriter::new([Step::Wait(delay), Step::Write(usize::MAX)]);
            let started = Instant::now();
            {
                let sending =
                    write_orders(&mut writer, BoardId(3), &mut receiver, TEST_TIMEOUT, period);
                tokio::pin!(sending);
                assert_pending_once(sending.as_mut()).await;
                advance(delay).await;
                assert_pending_once(sending.as_mut()).await;
                advance(period).await;
                assert_pending_once(sending.as_mut()).await;
                drop(sender);
                timeout(TEST_TIMEOUT, sending).await??;
            }
            assert_eq!(writer.written, [FIRST, &KEEP_ALIVE, &KEEP_ALIVE].concat());
            assert_eq!(
                elapsed_writes(&writer, started),
                vec![delay, delay, delay + period]
            );
        }
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn a_slow_partial_keep_alive_finishes_before_orders_and_rearms_after_completion()
    -> Result<(), Box<dyn std::error::Error>> {
        // Stall between the two heartbeat bytes, then queue an ordinary order.
        // Neither that order nor another overdue heartbeat may split or follow the
        // slow heartbeat as a catch-up send; its next period starts at completion.
        let period = Duration::from_millis(10);
        let delay = Duration::from_millis(35);
        let (sender, mut receiver) = mpsc::channel(1);
        let mut writer = ControlledWriter::new([Step::Write(1), Step::Wait(delay), Step::Write(1)]);
        let started = Instant::now();
        {
            let sending =
                write_orders(&mut writer, BoardId(3), &mut receiver, TEST_TIMEOUT, period);
            tokio::pin!(sending);
            assert_pending_once(sending.as_mut()).await;
            advance(period).await;
            assert_pending_once(sending.as_mut()).await;
            sender.try_send(FIRST.to_vec())?;
            advance(delay).await;
            assert_pending_once(sending.as_mut()).await;
            advance(period).await;
            assert_pending_once(sending.as_mut()).await;
            drop(sender);
            timeout(TEST_TIMEOUT, sending).await??;
        }
        assert_eq!(writer.written, [&KEEP_ALIVE, FIRST, &KEEP_ALIVE].concat());
        assert_eq!(
            elapsed_writes(&writer, started),
            vec![period, period + delay, period + delay, period * 2 + delay]
        );
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn keep_alive_io_failures_preserve_the_cause_and_leave_orders_queued()
    -> Result<(), Box<dyn std::error::Error>> {
        // Make the timer and an order ready together. The due heartbeat wins, but
        // failing before/after a prefix must not dequeue or silently discard that order.
        for prefix in [0, 1] {
            let period = Duration::from_millis(10);
            let (sender, mut receiver) = mpsc::channel(1);
            let mut steps = vec![];
            if prefix > 0 {
                steps.push(Step::Write(prefix));
            }
            steps.push(Step::Fail(io::ErrorKind::BrokenPipe));
            let mut writer = ControlledWriter::new(steps);
            let error;
            {
                let sending = write_orders(
                    &mut writer,
                    BoardId(3),
                    &mut receiver,
                    FRAME_TIMEOUT,
                    period,
                );
                tokio::pin!(sending);
                assert_pending_once(sending.as_mut()).await;
                advance(period).await;
                sender.try_send(FIRST.to_vec())?;
                let Err(failure) = timeout(TEST_TIMEOUT, sending).await? else {
                    unreachable!("a failed heartbeat must terminate this session");
                };
                error = failure;
            }
            let source = assert_write_error(error, io::ErrorKind::BrokenPipe);
            assert_eq!(source.to_string(), "scripted write failure");
            assert_eq!(writer.written, KEEP_ALIVE[..prefix]);
            assert_eq!(receiver.try_recv(), Ok(FIRST.to_vec()));
            assert_eq!(receiver.try_recv(), Err(mpsc::error::TryRecvError::Empty));
        }
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn keep_alive_timeouts_use_the_frame_deadline_and_leave_orders_queued()
    -> Result<(), Box<dyn std::error::Error>> {
        // A heartbeat has the same whole-frame deadline as an order. Stalling
        // before or after its first byte must return TimedOut without consuming FIRST.
        for prefix in [0, 1] {
            let period = Duration::from_millis(10);
            let (sender, mut receiver) = mpsc::channel(1);
            let mut steps = vec![];
            if prefix > 0 {
                steps.push(Step::Write(prefix));
            }
            steps.push(Step::Pending);
            let mut writer = ControlledWriter::new(steps);
            let started = Instant::now();
            let error;
            {
                let sending = write_orders(
                    &mut writer,
                    BoardId(3),
                    &mut receiver,
                    FRAME_TIMEOUT,
                    period,
                );
                tokio::pin!(sending);
                assert_pending_once(sending.as_mut()).await;
                advance(period).await;
                sender.try_send(FIRST.to_vec())?;
                assert_pending_once(sending.as_mut()).await;
                let Err(failure) = timeout(TEST_TIMEOUT, sending).await? else {
                    unreachable!("a stalled heartbeat must hit the frame deadline");
                };
                error = failure;
            }
            assert_write_error(error, io::ErrorKind::TimedOut);
            assert_eq!(started.elapsed(), period + FRAME_TIMEOUT);
            assert_eq!(writer.written, KEEP_ALIVE[..prefix]);
            assert_eq!(receiver.try_recv(), Ok(FIRST.to_vec()));
            assert_eq!(receiver.try_recv(), Err(mpsc::error::TryRecvError::Empty));
        }
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn cancelling_a_partial_keep_alive_preserves_the_order_queue()
    -> Result<(), Box<dyn std::error::Error>> {
        // Cancellation must drop the partial heartbeat, not move or requeue an order.
        // The connection must be discarded afterward, just as for partial order writes.
        let period = Duration::from_millis(10);
        let (sender, mut receiver) = mpsc::channel(1);
        let mut writer = ControlledWriter::new([Step::Write(1), Step::Pending]);
        {
            let sending = write_orders(
                &mut writer,
                BoardId(3),
                &mut receiver,
                FRAME_TIMEOUT,
                period,
            );
            tokio::pin!(sending);
            assert_pending_once(sending.as_mut()).await;
            advance(period).await;
            sender.try_send(FIRST.to_vec())?;
            assert_pending_once(sending.as_mut()).await;
        }
        assert_eq!(writer.written, KEEP_ALIVE[..1]);
        assert_eq!(receiver.try_recv(), Ok(FIRST.to_vec()));
        assert_eq!(receiver.try_recv(), Err(mpsc::error::TryRecvError::Empty));
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn a_closed_drained_channel_wins_even_when_the_keep_alive_is_due()
    -> Result<(), Box<dyn std::error::Error>> {
        // Close while the writer waits, then wake it with both closure and a due
        // timer. It must finish without sending a final heartbeat or waiting forever.
        let period = Duration::from_millis(10);
        let (sender, mut receiver) = mpsc::channel(1);
        let mut writer = ControlledWriter::new([Step::Fail(io::ErrorKind::BrokenPipe)]);
        {
            let sending = write_orders(
                &mut writer,
                BoardId(3),
                &mut receiver,
                FRAME_TIMEOUT,
                period,
            );
            tokio::pin!(sending);
            assert_pending_once(sending.as_mut()).await;
            drop(sender);
            advance(period).await;
            timeout(TEST_TIMEOUT, sending).await??;
        }
        assert!(writer.written.is_empty());
        assert_eq!(writer.steps.len(), 1);
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn closing_drains_orders_but_suppresses_a_keep_alive_after_the_last_frame()
    -> Result<(), Box<dyn std::error::Error>> {
        // Keep-alives still fit between pending orders during draining, but the
        // timer must not send again once the last queued frame has completed.
        let period = Duration::from_millis(10);
        let order_time = Duration::from_millis(12);
        let (sender, mut receiver) = queued_frames();
        drop(sender);
        let mut writer = ControlledWriter::new([
            Step::Wait(order_time),
            Step::Write(usize::MAX),
            Step::Write(usize::MAX),
            Step::Wait(order_time),
            Step::Write(usize::MAX),
        ]);
        timeout(
            TEST_TIMEOUT,
            write_orders(&mut writer, BoardId(3), &mut receiver, TEST_TIMEOUT, period),
        )
        .await??;
        assert_eq!(writer.written, [FIRST, &KEEP_ALIVE, SECOND].concat());
        assert_eq!(
            receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Disconnected)
        );
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn closing_waits_for_reserved_orders_without_emitting_keep_alives_on_an_empty_queue()
    -> Result<(), Box<dyn std::error::Error>> {
        // A reserved permit can still enqueue after Receiver::close. Closed plus
        // empty is therefore not proof that recv is finished; do not lose that order.
        let period = Duration::from_millis(10);
        let (sender, mut receiver) = mpsc::channel(1);
        let permit = sender.reserve().await?;
        receiver.close();
        let mut writer = ControlledWriter::new([]);
        {
            let sending = write_orders(
                &mut writer,
                BoardId(3),
                &mut receiver,
                FRAME_TIMEOUT,
                period,
            );
            tokio::pin!(sending);
            assert_pending_once(sending.as_mut()).await;
            advance(period).await;
            assert_pending_once(sending.as_mut()).await;
            permit.send(FIRST.to_vec());
            timeout(TEST_TIMEOUT, sending).await??;
        }
        assert_eq!(writer.written, FIRST);
        assert_eq!(
            receiver.try_recv(),
            Err(mpsc::error::TryRecvError::Disconnected)
        );
        Ok(())
    }

    #[tokio::test]
    async fn the_tcp_writer_sends_the_exact_keep_alive_bytes_until_the_channel_closes()
    -> Result<(), Box<dyn std::error::Error>> {
        // Exercise the concrete socket adapter, not only the controlled loop.
        // Close after observing one heartbeat; any bytes already sent afterward
        // must still consist solely of whole ID-1 frames before write-side EOF.
        let listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let client = timeout(TEST_TIMEOUT, TcpStream::connect(listener.local_addr()?)).await??;
        let (mut peer, _) = timeout(TEST_TIMEOUT, listener.accept()).await??;
        let (_read_half, write_half) = client.into_split();
        let (sender, mut receiver) = mpsc::channel(1);
        let mut first = [0; 2];
        let mut rest = vec![];
        let (sent, received) = timeout(TEST_TIMEOUT, async {
            tokio::join!(
                send(
                    write_half,
                    BoardId(3),
                    &mut receiver,
                    TEST_TIMEOUT,
                    Duration::from_millis(10)
                ),
                async {
                    peer.read_exact(&mut first).await?;
                    drop(sender);
                    peer.read_to_end(&mut rest).await?;
                    Ok::<_, io::Error>(())
                },
            )
        })
        .await?;
        sent?;
        received?;
        assert_eq!(first, KEEP_ALIVE);
        assert_eq!(rest.len() % KEEP_ALIVE.len(), 0);
        assert!(
            rest.chunks(KEEP_ALIVE.len())
                .all(|frame| frame == KEEP_ALIVE)
        );
        Ok(())
    }
}
