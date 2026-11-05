//! Serial writing of already-encoded frames for one established TCP session.

use super::Error;
use crate::model::BoardId;
use std::{io, time::Duration};
use tokio::{
    io::{AsyncWrite, AsyncWriteExt},
    net::tcp::OwnedWriteHalf,
    sync::mpsc,
    time::timeout,
};

/// Writes queued frames in order, ending normally when the channel is closed and drained.
///
/// Owns the write half but only borrows the receiver: ending a session must not
/// destroy the queue. The caller must finish any handshake before starting this
/// writer and must not write frames through another path on the same connection.
/// No index is needed because the queued frames are already encoded.
///
/// Each complete frame gets one `write_timeout`, including all partial writes.
/// Waiting for an order has no deadline. Success means the socket accepted all
/// queued bytes, not that firmware received or executed them. Dropping the owned
/// write half shuts down the socket's write side; it is not a delivery guarantee.
///
/// On failure or cancellation during a write, the current dequeued frame is lost
/// to the caller and may have been partly or fully transmitted. Never automatically
/// retry it or continue using that session. Frames not yet dequeued remain in `orders`;
/// their disconnected-order policy belongs to the future session supervisor.
/// That owner must also dispose of the read half and report failures once.
/// This function does not log, report events, reconnect, or send keep-alives.
///
/// # Errors
///
/// Returns non-fatal [`Error::Write`] with the original I/O error, or an I/O
/// error of kind [`io::ErrorKind::TimedOut`] when a frame deadline elapses.
// The session supervisor will use this once it is implemented.
#[cfg_attr(not(test), allow(dead_code))]
pub(super) async fn send(
    writer: OwnedWriteHalf,
    board: BoardId,
    orders: &mut mpsc::Receiver<Vec<u8>>,
    write_timeout: Duration,
) -> Result<(), Error> {
    write_orders(writer, board, orders, write_timeout).await
}

/// Drives the same loop over TCP or a controlled test writer, without socket-specific behavior.
async fn write_orders<W: AsyncWrite + Unpin>(
    mut writer: W,
    board: BoardId,
    orders: &mut mpsc::Receiver<Vec<u8>>,
    write_timeout: Duration,
) -> Result<(), Error> {
    while let Some(bytes) = orders.recv().await {
        // Keep one deadline around the whole frame, not one deadline per partial write.
        timeout(write_timeout, writer.write_all(&bytes))
            .await
            .map_err(|_| Error::Write {
                board,
                source: io::Error::new(io::ErrorKind::TimedOut, "TCP frame write timed out"),
            })?
            .map_err(|source| Error::Write { board, source })?;
    }
    Ok(())
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
    }

    impl ControlledWriter {
        fn new(steps: impl IntoIterator<Item = Step>) -> Self {
            Self {
                steps: steps.into_iter().collect(),
                delay: None,
                written: vec![],
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
                send(write_half, BoardId(3), &mut receiver, TEST_TIMEOUT),
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
            write_orders(&mut writer, BoardId(3), &mut receiver, FRAME_TIMEOUT),
        )
        .await??;
        assert!(writer.written.is_empty());
        assert_eq!(writer.steps.len(), 1);
        Ok(())
    }

    #[tokio::test(start_paused = true)]
    async fn waiting_for_an_order_has_no_write_deadline() -> Result<(), Box<dyn std::error::Error>>
    {
        // Advance virtual time well beyond the frame timeout while the queue is empty.
        // The writer must remain pending, then accept a later order normally.
        let (sender, mut receiver) = mpsc::channel(1);
        let mut writer = ControlledWriter::new([]);
        {
            let sending = write_orders(&mut writer, BoardId(3), &mut receiver, FRAME_TIMEOUT);
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
            write_orders(&mut writer, BoardId(3), &mut receiver, FRAME_TIMEOUT),
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
                write_orders(&mut writer, BoardId(3), &mut receiver, FRAME_TIMEOUT),
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
            write_orders(&mut writer, BoardId(3), &mut receiver, FRAME_TIMEOUT),
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
                write_orders(&mut writer, BoardId(3), &mut receiver, FRAME_TIMEOUT),
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
            write_orders(&mut writer, BoardId(3), &mut receiver, FRAME_TIMEOUT),
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
            write_orders(&mut writer, BoardId(3), &mut receiver, FRAME_TIMEOUT),
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
            let sending = write_orders(&mut writer, BoardId(3), &mut receiver, FRAME_TIMEOUT);
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
}
