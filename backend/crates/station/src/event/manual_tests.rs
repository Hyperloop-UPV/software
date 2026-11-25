//! A throughput probe for the routing loop, ignored by default:
//!
//! ```sh
//! cargo test -p station --release manual_event -- --ignored --nocapture
//! ```
//!
//! The requirement is 25 Mbit/s in 76-byte packets, about 41,000
//! notifications a second, and the routing loop is the bottleneck: on
//! loopback the UDP socket alone loses nothing. This pushes notifications
//! straight through a `Reporter`, with no socket, so what it measures is the
//! routing loop and its two queues.

use super::*;
use software_core::model::{AdjId, DataPacket, Packet};
use software_core::net::Event;
use std::error::Error;
use std::time::Instant;

const NOTIFICATIONS: usize = 1_000_000;
const REQUIRED_PER_SECOND: f64 = 41_000.0;

#[tokio::test(flavor = "multi_thread", worker_threads = 4)]
#[ignore = "load probe: run it by hand, in release"]
async fn manual_event_throughput() -> Result<(), Box<dyn Error>> {
    let config = EventConfig::default();
    let Channels {
        udp,
        tcp,
        event,
        orders,
        problems,
        mut logging,
        mut pipeline,
    } = channels(&config);
    drop((tcp, orders, problems));
    let event = spawn(config, event, Boards::default(), None);

    let logged = tokio::spawn(async move {
        let mut count = 0;
        while let Some(message) = logging.recv().await {
            if let ToLogging::Received(batch) = message {
                count += batch.len();
            }
        }
        count
    });
    let shown = tokio::spawn(async move {
        let mut count = 0;
        while let Some(message) = pipeline.recv().await {
            if let ToPipeline::Received(batch) = message {
                count += batch.len();
            }
        }
        count
    });

    let start = Instant::now();
    let producer = tokio::spawn(async move {
        for _ in 0..NOTIFICATIONS {
            let packet = DataPacket::new(AdjId(1000), vec![]);
            if udp
                .notify(BoardId(1), Event::Received(Packet::Data(packet)))
                .await
                .is_err()
            {
                break;
            }
        }
        // `udp` is dropped here: event passes on what is left and stops.
    });
    producer.await?;
    let stop = event.await?;
    let (logged, shown) = (logged.await?, shown.await?);
    let elapsed = start.elapsed();

    let per_second = NOTIFICATIONS as f64 / elapsed.as_secs_f64();
    println!(
        "{NOTIFICATIONS} notifications in {elapsed:.2?}: {per_second:.0}/s \
         ({:.1}x the required {REQUIRED_PER_SECOND:.0}/s)",
        per_second / REQUIRED_PER_SECOND
    );

    assert!(matches!(stop, Stop::NetGone));
    assert_eq!(logged, NOTIFICATIONS, "logging got every notification");
    assert_eq!(shown, NOTIFICATIONS, "pipeline got every notification");
    assert!(per_second > REQUIRED_PER_SECOND);
    Ok(())
}
