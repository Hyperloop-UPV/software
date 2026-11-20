use super::*;
use crate::net::{Notification, Sinks};
use crate::protocol::DecodeError;
use tokio::{io::AsyncReadExt, net::TcpStream};

fn io_error() -> std::io::Error {
    std::io::Error::from(std::io::ErrorKind::ConnectionRefused)
}

async fn next_notification(
    sinks: &mut Sinks,
    missing: &str,
) -> Result<Notification, Box<dyn std::error::Error>> {
    sinks
        .notifications
        .recv()
        .await
        .ok_or_else(|| missing.into())
}

async fn assert_fault_broadcast(
    handles: &BoardClients,
    first: &mut TcpStream,
    second: &mut TcpStream,
) -> Result<(), Box<dyn std::error::Error>> {
    let (mut a, mut b) = ([0xff; 2], [0xff; 2]);
    let (broadcast, read_a, read_b) = tokio::join!(
        handles.broadcast_fault(),
        first.read_exact(&mut a),
        second.read_exact(&mut b)
    );
    assert_eq!(broadcast, Ok(()));
    read_a?;
    read_b?;
    assert_eq!((a, b), ([0, 0], [0, 0]));
    Ok(())
}

#[tokio::test]
async fn broadcasts_faults_over_active_clients_without_replaying_after_reconnect()
-> Result<(), Box<dyn std::error::Error>> {
    use crate::net::Event;
    use std::net::Ipv4Addr;
    use tokio::{net::TcpListener, time::timeout};

    timeout(Duration::from_secs(6), async {
        let first_listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let third_listener = TcpListener::bind((Ipv4Addr::LOCALHOST, 0)).await?;
        let config = TcpConfig {
            boards: vec![
                BoardLink {
                    board: BoardId(1),
                    addr: first_listener.local_addr()?,
                    local_port: Port(0),
                },
                BoardLink {
                    board: BoardId(3),
                    addr: third_listener.local_addr()?,
                    local_port: Port(0),
                },
            ],
            connect_timeout: Duration::from_millis(100),
            backoff: Backoff::new(1000, 1000),
            write_timeout: Duration::from_millis(200),
            keep_alive: Duration::ZERO,
        };
        let (reporter, mut sinks) = Reporter::channels(32, 16);
        // Reserved ID 0 must work with no ADJ orders declared at all.
        let handles = spawn(config, Arc::new(Index::default()), reporter);
        let (first, third) = tokio::try_join!(first_listener.accept(), third_listener.accept())?;
        let (mut first, mut third) = (first.0, third.0);
        for _ in 0..2 {
            let notification = next_notification(&mut sinks, "reporting stopped").await?;
            assert!(matches!(notification.event, Event::Connected));
        }

        assert_fault_broadcast(&handles, &mut first, &mut third).await?;

        drop(first);
        let notification = next_notification(&mut sinks, "missing disconnection").await?;
        assert_eq!(notification.board, BoardId(1));
        assert!(matches!(notification.event, Event::Disconnected));
        // The offline board fails, without preventing the healthy board's write.
        let mut b = [0xff; 2];
        let (broadcast, read_b) = tokio::join!(handles.broadcast_fault(), third.read_exact(&mut b));
        assert_eq!(broadcast, Err(Unreachable(vec![BoardId(1)])));
        read_b?;
        assert_eq!(b, [0, 0]);

        let (mut reconnected, _) = first_listener.accept().await?;
        let notification = next_notification(&mut sinks, "missing reconnection").await?;
        assert_eq!(notification.board, BoardId(1));
        assert!(matches!(notification.event, Event::Connected));
        // Neither the successful first fault nor the offline request is replayed.
        let mut a = [0xff; 2];
        assert!(
            timeout(Duration::from_millis(30), reconnected.read_exact(&mut a))
                .await
                .is_err()
        );
        assert_fault_broadcast(&handles, &mut reconnected, &mut third).await?;
        sinks.notifications.close();
        sinks.errors.close();
        Ok::<_, Box<dyn std::error::Error>>(())
    })
    .await??;
    Ok(())
}

#[test]
fn backoff_doubles_in_milliseconds_and_stays_at_the_cap() {
    // A non-power-of-two cap must be reached without rounding or wrapping.
    let mut backoff = Backoff::new(100, 700);
    for expected in [100, 200, 400, 700] {
        assert_eq!(backoff.get_interval(), Duration::from_millis(expected));
    }
    // Staying capped must not leave an ever-growing exponent or counter.
    for _ in 0..10_000 {
        assert_eq!(backoff.get_interval(), Duration::from_millis(700));
    }
}

#[test]
fn backoff_bounds_the_first_interval() {
    // Equal and excessive initial values both start at the configured cap.
    for initial in [700, 701, u64::MAX] {
        let mut backoff = Backoff::new(initial, 700);
        for _ in 0..100 {
            assert_eq!(backoff.get_interval(), Duration::from_millis(700));
        }
    }
}

#[test]
fn backoff_preserves_zero_intervals_without_overflow() {
    // Preserve zero-valued configuration, including after the old exponent
    // calculation would overflow even with an initial interval of zero.
    for (initial, max) in [(0, 0), (0, 700), (0, u64::MAX), (100, 0)] {
        let mut backoff = Backoff::new(initial, max);
        for _ in 0..1_000 {
            assert_eq!(backoff.get_interval(), Duration::ZERO);
        }
    }
}

#[test]
fn backoff_saturates_before_applying_a_large_cap() {
    // Doubling the initial interval exceeds u64::MAX, but a lower cap must
    // still win over saturation. Also cover the largest representable cap.
    let initial = u64::MAX / 2 + 1;
    for max in [u64::MAX - 1, u64::MAX] {
        let mut backoff = Backoff::new(initial, max);
        assert_eq!(backoff.get_interval(), Duration::from_millis(initial));
        for _ in 0..100 {
            assert_eq!(backoff.get_interval(), Duration::from_millis(max));
        }
    }
}

#[test]
fn backoff_reaches_the_largest_cap_from_one() {
    // Exercise every representable power of two before saturation; merely
    // capping the attempt counter would incorrectly stop at 2^63.
    let mut backoff = Backoff::new(1, u64::MAX);
    for exponent in 0..64 {
        assert_eq!(
            backoff.get_interval(),
            Duration::from_millis(1u64 << exponent)
        );
    }
    for _ in 0..100 {
        assert_eq!(backoff.get_interval(), Duration::from_millis(u64::MAX));
    }
}

#[test]
fn backoff_reset_restarts_growth_even_after_reaching_the_cap() {
    let mut backoff = Backoff::new(100, 700);
    // Reset before the first wait, during growth and at the cap. None of
    // these operations should consume the initial interval or change max.
    for consumed in [0, 2, 20] {
        backoff.reset();
        for _ in 0..consumed {
            backoff.get_interval();
        }
        backoff.reset();
        backoff.reset();
        for expected in [100, 200, 400, 700, 700] {
            assert_eq!(backoff.get_interval(), Duration::from_millis(expected));
        }
    }
}

#[test]
fn backoff_reset_preserves_bounded_zero_and_extreme_initial_intervals() {
    // Reset retains the constructor's clamping and zero semantics, without
    // reintroducing overflow when an extreme sequence grows again.
    for (initial, max) in [
        (0, 0),
        (0, u64::MAX),
        (100, 0),
        (900, 700),
        (u64::MAX / 2 + 1, u64::MAX),
        (u64::MAX, u64::MAX),
    ] {
        let mut backoff = Backoff::new(initial, max);
        for _ in 0..100 {
            backoff.get_interval();
        }
        backoff.reset();
        assert_eq!(
            backoff.get_interval(),
            Duration::from_millis(initial.min(max))
        );
        assert_eq!(
            backoff.get_interval(),
            Duration::from_millis(initial.min(max).saturating_mul(2).min(max))
        );
    }
}

#[test]
fn a_frame_that_will_not_decode_faults_the_pod() {
    let error = Error::Decode {
        board: BoardId(3),
        source: DecodeError::UnknownId(crate::model::AdjId(9999)),
    };

    // Not a desynchronised stream to retry: the ADJ does not match
    // the firmware, and reconnecting cannot fix that.
    assert!(error.is_fatal());
}

#[test]
fn a_board_that_is_not_up_yet_does_not_fault_the_pod() {
    let connect = Error::Connect {
        board: BoardId(3),
        source: io_error(),
    };
    let write = Error::Write {
        board: BoardId(3),
        source: io_error(),
    };

    // That is what the reconnection backoff is for.
    assert!(!connect.is_fatal());
    assert!(!write.is_fatal());
}

#[test]
fn an_error_says_which_board_it_was() {
    let error = Error::Write {
        board: BoardId(3),
        source: io_error(),
    };

    // The identity survives being formatted, which is what reaches
    // the operator.
    assert!(error.to_string().contains("BoardId(3)"));
}
