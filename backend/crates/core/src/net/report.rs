//! What [`super::tcp`]/[`super::udp`] report, and the sinks they report
//! through.
//!
//! Two separate channels, both bounded. Notifications
//! ([`Notification`]) carry everything that happened on a link, errors
//! ([`ErrorReport`]) everything that went wrong. They are separate
//! because their rules differ: a notification must never be dropped,
//! while an error is rare enough that it can afford to wait behind a
//! queue of telemetry.
//!
//! Both sinks apply backpressure rather than dropping: see
//! [`Reporter::notify`].

use super::Error;
use crate::model::{BoardId, Packet};
use std::time::SystemTime;
use tokio::sync::mpsc;

/// Something that happened on a link: which board it concerns, when,
/// and what.
///
/// Both `board` and `at` live in this envelope rather than inside the
/// variants of [`Event`], so that **everything** that travels down the
/// channel carries them — there is no event whose board the consumer has
/// to go and look up, and none that can be built without a timestamp.
/// [`Reporter::notify`] is the only thing that stamps `at`.
#[derive(Debug)]
pub struct Notification {
    /// The board this concerns.
    ///
    /// Always known by the time anything is reported: a TCP task was
    /// spawned for one board and knows it without asking, and [`super::udp`]
    /// resolves it from the decoded packet's id through
    /// [`crate::protocol::Index`] — `index.packet(id)` gives a
    /// [`crate::model::PacketDef`], which carries its `board` — so that a
    /// notification looks the same whichever transport brought it.
    pub board: BoardId,
    /// The instant the bytes came off the socket.
    ///
    /// Stamped when the event is reported, never by whoever writes it to
    /// disk later: a queue adds delay under load, so a date taken at
    /// write time would be wrong by exactly that delay, at exactly the
    /// moment the data matters most. The frames that carry a board clock
    /// of their own ([`crate::model::ShortTimestamp`], on protections and
    /// messages) only carry a time of day, with no date, so this is also
    /// the only full date a record can have.
    pub at: SystemTime,
    /// What happened.
    pub event: Event,
}

/// Something that went wrong, and when.
///
/// Carries no identity of its own: whose failure it was travels inside
/// the [`Error`]'s own variant, which is the only place that always has
/// it. A datagram that fails to decode, for instance, resolves to no
/// board at all — its id is not in the ADJ, so there is no
/// [`crate::model::PacketDef`] to ask — and all that can be said about
/// it is the address it came from, which is exactly what
/// [`super::udp::Error::Decode`] holds.
#[derive(Debug)]
pub struct ErrorReport {
    /// The instant the failure was reported, on the same clock as
    /// [`Notification::at`].
    pub at: SystemTime,
    /// What went wrong, identity included.
    pub error: Error,
}

/// What happened on a link.
#[derive(Debug)]
pub enum Event {
    /// The board's connection came up, and it can now be talked to.
    /// Which board is in the [`Notification`] around this, which is all
    /// the identity there is: one connection per board.
    ///
    /// TCP only: there is nothing to connect in UDP, whose socket is
    /// bound once and belongs to no single board.
    Connected,
    /// The board's connection went down, whatever the reason. If the
    /// cause was worth reporting, it already went out as an
    /// [`ErrorReport`] — but on the other channel, so nothing orders the
    /// two against each other.
    ///
    /// TCP only, same as [`Event::Connected`].
    Disconnected,
    /// A packet arrived and was decoded. Whose it is, is in the
    /// [`Notification`] around it.
    ///
    /// [`Packet`] is the whole umbrella, so this one variant covers data,
    /// protections and messages alike, with no second enum repeating that
    /// split. Its [`Packet::Order`] variant is never produced while
    /// receiving; it is what an eventual "the order really did go out on
    /// the wire" report would use, which only `net` is in a position to
    /// make.
    Received(Packet),
}

/// The receiving ends of a [`Reporter`]'s two channels, handed to
/// whoever consumes them (`station`).
#[derive(Debug)]
pub struct Sinks {
    /// Everything that happened, in the order it happened.
    pub notifications: mpsc::Receiver<Notification>,
    /// Everything that went wrong.
    pub errors: mpsc::Receiver<ErrorReport>,
}

/// The sinks [`super::tcp`] and [`super::udp`] report through.
///
/// Cloneable, and meant to be cloned: every task gets its own copy — one
/// per TCP connection, one for the UDP loop — and they all feed the same
/// two channels.
#[derive(Debug, Clone)]
pub struct Reporter {
    notifications: mpsc::Sender<Notification>,
    errors: mpsc::Sender<ErrorReport>,
}

/// The consumer is gone, so there is nobody left to report to.
///
/// The only failure either sink has, and a signal to stop rather than
/// something to retry.
#[derive(Debug, Clone, Copy, PartialEq, Eq, thiserror::Error)]
#[error("the receiving end is gone")]
pub struct Closed;

impl Reporter {
    /// Builds both channels with the given capacities, and returns the
    /// sending half to hand to the submodules plus the receiving halves
    /// to hand to the consumer.
    ///
    /// Both are bounded on purpose: see [`Reporter::notify`] for what
    /// happens when the notification channel fills up.
    pub fn channels(notifications: usize, errors: usize) -> (Self, Sinks) {
        let (notification_tx, notification_rx) = mpsc::channel(notifications);
        let (error_tx, error_rx) = mpsc::channel(errors);

        (
            Self {
                notifications: notification_tx,
                errors: error_tx,
            },
            Sinks {
                notifications: notification_rx,
                errors: error_rx,
            },
        )
    }

    /// Stamps the instant and queues `event`.
    ///
    /// **Waits** if the channel is full, rather than dropping anything:
    /// a packet that has already been decoded always reaches the
    /// consumer. What that costs is backpressure — the wait reaches back
    /// to the read loop, which stops reading, and the kernel's own
    /// receive buffer becomes the only place anything can be lost. That
    /// is deliberate: whatever is dropped there is dropped *before* being
    /// decoded, so "everything decoded gets through" stays literally
    /// true.
    ///
    /// The instant is taken before the wait, not after, so a full queue
    /// delays the notification without distorting its timestamp.
    pub async fn notify(&self, board: BoardId, event: Event) -> Result<(), Closed> {
        let notification = Notification {
            board,
            at: SystemTime::now(),
            event,
        };

        self.notifications
            .send(notification)
            .await
            .map_err(|_| Closed)
    }

    /// Stamps the instant and queues an error, on the error channel.
    ///
    /// Takes anything that converts into [`Error`], so a submodule
    /// reports its own error type directly:
    /// `reporter.report(tcp::Error::Connect { .. }).await`.
    ///
    /// Reporting is not deciding: by the time an error gets here its
    /// submodule has already done whatever it was going to do about it
    /// (reconnect, carry on with the next datagram), and has already
    /// logged it through `tracing`. This channel is only for telling the
    /// operator, through the frontend.
    pub async fn report(&self, error: impl Into<Error>) -> Result<(), Closed> {
        let report = ErrorReport {
            at: SystemTime::now(),
            error: error.into(),
        };

        self.errors.send(report).await.map_err(|_| Closed)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::model::{AdjId, DataPacket};
    use crate::net::udp;
    use std::net::{IpAddr, SocketAddr};
    use std::time::Duration;

    fn a_packet() -> Event {
        Event::Received(Packet::Data(DataPacket::new(AdjId(1000), vec![])))
    }

    fn an_error() -> udp::Error {
        udp::Error::Recv {
            source: std::io::Error::from(std::io::ErrorKind::ConnectionReset),
        }
    }

    #[tokio::test]
    async fn a_notification_arrives_stamped() {
        let (reporter, mut sinks) = Reporter::channels(4, 4);

        let before = SystemTime::now();
        let Ok(()) = reporter.notify(BoardId(3), a_packet()).await else {
            unreachable!("the receiver is still alive");
        };
        let after = SystemTime::now();

        let Some(notification) = sinks.notifications.recv().await else {
            unreachable!("exactly one notification was sent");
        };
        assert!(notification.at >= before && notification.at <= after);
        assert_eq!(
            notification.board,
            BoardId(3),
            "the board travels with every notification, received packets included"
        );
    }

    #[tokio::test]
    async fn a_connection_event_names_its_board() {
        let (reporter, mut sinks) = Reporter::channels(4, 4);

        // The one identity that cannot be derived from a packet: there is
        // no packet here at all.
        let Ok(()) = reporter.notify(BoardId(3), Event::Disconnected).await else {
            unreachable!("the receiver is still alive");
        };

        let Some(notification) = sinks.notifications.recv().await else {
            unreachable!("exactly one notification was sent");
        };
        // The board is the whole identity: one connection per board.
        assert_eq!(notification.board, BoardId(3));
        let Event::Disconnected = notification.event else {
            unreachable!("a disconnection should arrive as Event::Disconnected");
        };
    }

    #[tokio::test]
    async fn a_full_channel_makes_the_reporter_wait_instead_of_dropping() {
        let (reporter, mut sinks) = Reporter::channels(1, 1);

        // Fill the single slot, then start a second report that cannot
        // fit yet.
        let Ok(()) = reporter.notify(BoardId(3), a_packet()).await else {
            unreachable!("the first one fits");
        };
        let blocked = tokio::spawn({
            let reporter = reporter.clone();
            async move { reporter.notify(BoardId(3), a_packet()).await }
        });

        // It is still waiting: nothing was dropped, and nothing got
        // through either.
        tokio::time::sleep(Duration::from_millis(50)).await;
        assert!(
            !blocked.is_finished(),
            "the second report should be waiting"
        );

        // Draining one slot lets it through, so both are delivered.
        let Some(_first) = sinks.notifications.recv().await else {
            unreachable!("the first notification was sent");
        };
        let Ok(Ok(())) = blocked.await else {
            unreachable!("once a slot frees up, the second one goes through");
        };
        let Some(_second) = sinks.notifications.recv().await else {
            unreachable!("the second notification went through");
        };
    }

    #[tokio::test]
    async fn waiting_on_a_full_channel_does_not_delay_the_timestamp() {
        let (reporter, mut sinks) = Reporter::channels(1, 1);

        let Ok(()) = reporter.notify(BoardId(3), a_packet()).await else {
            unreachable!("the first one fits");
        };
        let blocked = tokio::spawn({
            let reporter = reporter.clone();
            async move { reporter.notify(BoardId(3), a_packet()).await }
        });

        // Let the second report sit in the queue for a while before
        // anything drains it.
        tokio::time::sleep(Duration::from_millis(50)).await;
        let after_the_wait = SystemTime::now();

        let Some(_first) = sinks.notifications.recv().await else {
            unreachable!("the first notification was sent");
        };
        let Ok(Ok(())) = blocked.await else {
            unreachable!("the second one goes through once there is room");
        };
        let Some(second) = sinks.notifications.recv().await else {
            unreachable!("the second notification went through");
        };

        // Stamped when it was reported, not when it finally fit.
        assert!(
            second.at <= after_the_wait,
            "the timestamp should predate the end of the wait"
        );
    }

    #[tokio::test]
    async fn an_error_arrives_on_its_own_channel() {
        let (reporter, mut sinks) = Reporter::channels(4, 4);

        let Ok(()) = reporter.report(an_error()).await else {
            unreachable!("the receiver is still alive");
        };

        let Some(report) = sinks.errors.recv().await else {
            unreachable!("exactly one error was reported");
        };
        let Error::Udp(udp::Error::Recv { .. }) = report.error else {
            unreachable!("a udp error should arrive as Error::Udp");
        };
        // Nothing reached the notification channel.
        assert!(sinks.notifications.try_recv().is_err());
    }

    #[test]
    fn a_udp_decode_error_keeps_the_address_it_cannot_resolve_to_a_board() {
        let addr = SocketAddr::new(IpAddr::from([192, 168, 1, 3]), 50400);
        let error = udp::Error::Decode {
            from: addr,
            source: crate::protocol::DecodeError::UnknownId(AdjId(9999)),
        };

        // The whole reason an error report carries no board: this one has
        // an address, and no board to attribute it to.
        let Error::Udp(udp::Error::Decode { from, .. }) = Error::from(error) else {
            unreachable!("a decode error should convert into Error::Udp");
        };
        assert_eq!(from, addr);
    }

    #[tokio::test]
    async fn reporting_once_the_consumer_is_gone_says_so() {
        let (reporter, sinks) = Reporter::channels(4, 4);
        drop(sinks);

        assert_eq!(reporter.notify(BoardId(3), a_packet()).await, Err(Closed));
        assert_eq!(reporter.report(an_error()).await, Err(Closed));
    }
}
