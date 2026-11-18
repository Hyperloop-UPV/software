use super::*;
use crate::model::{AdjId, OrderPacket, Value};
use std::{io, path::Path};

#[tokio::test]
#[ignore = "manual test: start the documented nc listener on 127.0.0.1:50500 first"]
// THIS TEST IS SPECIAL:
//
// To try it, you need two terminals. Run these commands in this order,
// one in each terminal:
// 1. `{
//        printf '\x03\x00\x0c\x1e\x00\x00nc\x00One\x00'
//        printf '\x03\x00\x0c\x1e\x00\x00nc\x00Two\x00'
//        printf '\x03\x00\x0c\x1e\x00\x00n'
//        sleep 3
//        printf 'c\x00Three\x00'
//      } | nc -lN 127.0.0.1 50500`
// 2. `cargo test -p software-core -F net manual_tcp_receive -- --ignored --nocapture`
//
// The first two frames are sent whole. The third frame is split across two
// writes with a three-second delay. TCP may split or combine reads differently;
// the framing code must not depend on write/read boundaries matching.
// The test prints each complete frame, then finishes when nc closes the connection.
//
// This test checks connection, framing and reporting by displaying notifications.
async fn manual_tcp_receive() -> Result<(), Box<dyn std::error::Error>> {
    // Load the fixture ADJ so the real protocol decoder can resolve message ID 3.
    let adj_path = Path::new(env!("CARGO_MANIFEST_DIR")).join("src/adj/test/adj");
    let adj = crate::adj::load_from_dir(&adj_path)?;
    let index = Arc::new(Index::new(&adj.pod_data, Some(&adj.info.message_levels)));
    let addr = "127.0.0.1:50500".parse()?;
    let link = BoardLink {
        board: BoardId(1),
        addr,
        local_port: 0,
    };

    // Connect to netcat; this test is ignored by the normal automated suite.
    let stream = connection::connect(&link, Duration::from_secs(5)).await?;
    let (read_half, _write_half) = stream.into_split();
    let (reporter, mut sinks) = Reporter::channels(1, 1);
    let receiving = async {
        let result = reader::receive(read_half, link.board, &index, &reporter).await;
        // Close the notification channel after either success or failure so printing ends.
        drop(reporter);
        result
    };
    let displaying = async {
        let mut frames = 0;
        while let Some(notification) = sinks.notifications.recv().await {
            println!("Received notification: {notification:?}");
            frames += 1;
        }
        frames
    };

    // Drain concurrently to respect backpressure; only the manual test has a deadline.
    let (end, frames) = tokio::time::timeout(Duration::from_secs(30), async {
        tokio::join!(receiving, displaying)
    })
    .await?;
    assert_eq!(end?, reader::ReceiveEnd::PeerClosed);
    assert!(
        frames > 0,
        "the peer closed without sending a complete frame"
    );
    Ok(())
}

/// Preserves station's original supervised probe, now driven through spawn/Handles.
///
/// From backend/, with the ADJ matching the selected firmware:
/// ```text
/// ADJ_DIR=/path/to/adj TCP_BOARD=TEST \
/// cargo test -p software-core --features net manual_tcp_supervisor -- --ignored --nocapture
/// ```
/// Optional TCP_LOCAL_PORT defaults to 0; TCP_KEEP_ALIVE_MS defaults to 1000
/// (zero disables keep-alive). The board IP and TCP_SERVER port come from ADJ.
/// For a local simulator, use a private ADJ copy with the board IP 127.0.0.1
/// and start `nc -l 50500 | od -An -tx1 -v -w2` if TCP_SERVER is 50500.
///
/// WARNING: this test sends order 1001 with numeric parameter 5.0 once. Use only
/// the intended TEST board/firmware or simulator, not an arbitrary real board.
/// For a float32 parameter, its bytes are e9 03 00 00 a0 40; keep-alive is 01 00.
/// Closing and reopening the simulator should reconnect without repeating the
/// order. Backoff grows from 500 to 5000 ms on failures and resets on success.
///
/// Prints both Reporter channels until Ctrl+C, without a test-only read timeout.
/// Ctrl+C closes the consumers; task joining and guaranteed final-event draining
/// are not implemented. The existing manual_tcp_receive test remains unchanged.
#[tokio::test]
#[ignore = "manual probe: requires ADJ_DIR, TCP_BOARD and a real board or simulator; sends order 1001"]
async fn manual_tcp_supervisor() -> Result<(), Box<dyn std::error::Error>> {
    let adj_path = std::env::var_os("ADJ_DIR").ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "set ADJ_DIR to the matching ADJ directory",
        )
    })?;
    let board_name = std::env::var("TCP_BOARD")?;
    let local_port = match std::env::var("TCP_LOCAL_PORT") {
        Ok(value) => value.parse::<u16>()?,
        Err(std::env::VarError::NotPresent) => 0,
        Err(error) => return Err(error.into()),
    };
    let keep_alive_ms = match std::env::var("TCP_KEEP_ALIVE_MS") {
        Ok(value) => value.parse::<u64>()?,
        Err(std::env::VarError::NotPresent) => 1000,
        Err(error) => return Err(error.into()),
    };
    let adj = crate::adj::load_from_dir(Path::new(&adj_path))?;
    let board = adj
        .pod_data
        .boards
        .values()
        .find(|board| board.name == board_name)
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("board {board_name:?} is not declared in the supplied ADJ"),
            )
        })?;
    let port = adj.info.ports.get("TCP_SERVER").ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "the supplied ADJ has no TCP_SERVER port",
        )
    })?;
    let link = BoardLink {
        board: board.id,
        addr: SocketAddr::new(board.ip, port.0),
        local_port,
    };
    let index = Arc::new(Index::new(&adj.pod_data, Some(&adj.info.message_levels)));
    let config = Config {
        boards: vec![link],
        connect_timeout: Duration::from_secs(5),
        backoff: Backoff::new(500, 5000),
        write_timeout: Duration::from_secs(2),
        keep_alive: Duration::from_millis(keep_alive_ms),
    };
    println!(
        "Manual TCP probe: {board_name} at {}; order 1001(5.0) once; press Ctrl+C to stop",
        link.addr
    );
    let (reporter, mut sinks) = Reporter::channels(256, 16);
    let handles = spawn(config, index, reporter);
    let running = async {
        handles
            .send(OrderPacket::new(AdjId(1001), vec![Value::Number(-5.0)]))
            .await?;
        tokio::signal::ctrl_c().await?;
        Ok::<_, Box<dyn std::error::Error>>(())
    };
    let display = async {
        tokio::join!(
            async {
                while let Some(notification) = sinks.notifications.recv().await {
                    println!("{notification:#?}");
                }
            },
            async {
                while let Some(report) = sinks.errors.recv().await {
                    eprintln!("{report:#?}");
                }
            },
        );
    };
    let result = tokio::select! {
        result = running => result,
        () = display => Err(io::Error::new(io::ErrorKind::BrokenPipe, "TCP reporting stopped before Ctrl+C").into()),
    };
    sinks.notifications.close();
    sinks.errors.close();
    drop(handles);
    result
}

/// Runs the current station main probe through the public multi-board `spawn` API.
///
/// From backend/, with an ADJ matching the selected firmware:
/// ```text
/// ADJ_DIR=/path/to/adj TCP_BOARD=TEST \
/// cargo test -p software-core --features net manual_tcp_spawn -- --ignored --nocapture
/// ```
/// Optional TCP_LOCAL_PORT defaults to 0; TCP_KEEP_ALIVE_MS defaults to 1000
/// (zero disables keep-alive). The selected board IP and TCP_SERVER port come
/// from the supplied ADJ. This probe sends no orders; it prints both Reporter
/// channels until Ctrl+C and exercises spawn, connect, receive and reconnect.
/// For a loopback simulator, use a private ADJ copy with the board IP set to
/// 127.0.0.1 and observe the configured port, e.g. `nc -l 50500`.
///
/// Ctrl+C closes the reporting consumers and drops Handles. There is not yet an
/// explicit task join, so this is a manual probe rather than a shutdown test.
#[tokio::test]
#[ignore = "manual spawn probe: requires ADJ_DIR, TCP_BOARD and a real board or simulator"]
async fn manual_tcp_spawn() -> Result<(), Box<dyn std::error::Error>> {
    let adj_path = std::env::var_os("ADJ_DIR").ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "set ADJ_DIR to the matching ADJ directory",
        )
    })?;
    let board_name = std::env::var("TCP_BOARD")?;
    let local_port = match std::env::var("TCP_LOCAL_PORT") {
        Ok(value) => value.parse::<u16>()?,
        Err(std::env::VarError::NotPresent) => 0,
        Err(error) => return Err(error.into()),
    };
    let keep_alive_ms = match std::env::var("TCP_KEEP_ALIVE_MS") {
        Ok(value) => value.parse::<u64>()?,
        Err(std::env::VarError::NotPresent) => 1000,
        Err(error) => return Err(error.into()),
    };
    let adj = crate::adj::load_from_dir(Path::new(&adj_path))?;
    let board = adj
        .pod_data
        .boards
        .values()
        .find(|board| board.name == board_name)
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("board {board_name:?} is not declared in the supplied ADJ"),
            )
        })?;
    let port = adj.info.ports.get("TCP_SERVER").ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "the supplied ADJ has no TCP_SERVER port",
        )
    })?;
    let link = BoardLink {
        board: board.id,
        addr: SocketAddr::new(board.ip, port.0),
        local_port,
    };
    let index = Arc::new(Index::new(&adj.pod_data, Some(&adj.info.message_levels)));
    let config = Config {
        boards: vec![link],
        connect_timeout: Duration::from_secs(5),
        backoff: Backoff::new(500, 5000),
        write_timeout: Duration::from_secs(2),
        keep_alive: Duration::from_millis(keep_alive_ms),
    };
    println!(
        "Manual TCP spawn probe: {board_name} at {}; no orders; press Ctrl+C to stop",
        link.addr
    );
    let (reporter, mut sinks) = Reporter::channels(256, 16);
    let handles = spawn(config, index, reporter);
    let running = tokio::signal::ctrl_c();
    let display = async {
        tokio::join!(
            async {
                while let Some(notification) = sinks.notifications.recv().await {
                    println!("{notification:#?}");
                }
            },
            async {
                while let Some(report) = sinks.errors.recv().await {
                    eprintln!("{report:#?}");
                }
            },
        );
    };
    let result = tokio::select! {
        stopped = running => stopped,
        () = display => Err(io::Error::new(
            io::ErrorKind::BrokenPipe,
            "TCP reporting stopped before Ctrl+C",
        )),
    };
    // As in station main, consumer closure asks detached supervisors to stop.
    sinks.notifications.close();
    sinks.errors.close();
    drop(handles);
    result?;
    Ok(())
}

/// Sends one real fault through spawn/Handles after the first connection.
///
/// WARNING: this actively requests a firmware fault. Use only a safe test
/// setup or simulator. From backend/:
/// ```text
/// ADJ_DIR=/path/to/adj TCP_BOARD=TEST \
/// cargo test -p software-core --features net manual_tcp_fault -- --ignored --nocapture
/// ```
/// TCP_LOCAL_PORT defaults to 0 and TCP_KEEP_ALIVE_MS to 1000; zero disables
/// keep-alive. The board IP and TCP_SERVER port come from the supplied ADJ.
/// With a private loopback ADJ and port 50500, observe the fault bytes `00 00`
/// using `nc -l 50500 | od -An -tx1 -v -w2`; keep-alive bytes are `01 00`.
///
/// Both Reporter channels are consumed while waiting, writing and observing
/// firmware afterwards. Success only confirms write_all, not firmware receipt
/// or execution: verify the board's fault state separately. A failed broadcast
/// fails the test. No normal order, hash, automatic retry of the fault, or
/// second fault after reconnection is sent. Ctrl+C stops the probe even before
/// connection; closing consumers cancels supervisors without explicit joining.
#[tokio::test]
#[ignore = "manual fault probe: sends a REAL fault; requires ADJ_DIR, TCP_BOARD and a safe board or simulator"]
async fn manual_tcp_fault() -> Result<(), Box<dyn std::error::Error>> {
    use crate::net::Event;
    use tokio::sync::oneshot;

    let adj_path = std::env::var_os("ADJ_DIR").ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "set ADJ_DIR to the matching ADJ directory",
        )
    })?;
    let board_name = std::env::var("TCP_BOARD")?;
    let local_port = match std::env::var("TCP_LOCAL_PORT") {
        Ok(value) => value.parse::<u16>()?,
        Err(std::env::VarError::NotPresent) => 0,
        Err(error) => return Err(error.into()),
    };
    let keep_alive_ms = match std::env::var("TCP_KEEP_ALIVE_MS") {
        Ok(value) => value.parse::<u64>()?,
        Err(std::env::VarError::NotPresent) => 1000,
        Err(error) => return Err(error.into()),
    };
    let adj = crate::adj::load_from_dir(Path::new(&adj_path))?;
    let board = adj
        .pod_data
        .boards
        .values()
        .find(|board| board.name == board_name)
        .ok_or_else(|| {
            io::Error::new(
                io::ErrorKind::InvalidInput,
                format!("board {board_name:?} is not declared in the supplied ADJ"),
            )
        })?;
    let port = adj.info.ports.get("TCP_SERVER").ok_or_else(|| {
        io::Error::new(
            io::ErrorKind::InvalidInput,
            "the supplied ADJ has no TCP_SERVER port",
        )
    })?;
    let link = BoardLink {
        board: board.id,
        addr: SocketAddr::new(board.ip, port.0),
        local_port,
    };
    let index = Arc::new(Index::new(&adj.pod_data, Some(&adj.info.message_levels)));
    let config = Config {
        boards: vec![link],
        connect_timeout: Duration::from_secs(5),
        backoff: Backoff::new(500, 5000),
        write_timeout: Duration::from_secs(2),
        keep_alive: Duration::from_millis(keep_alive_ms),
    };
    println!(
        "WARNING: manual TCP fault probe: {board_name} at {}; sends 00 00 once after connecting; press Ctrl+C to stop",
        link.addr
    );
    let (reporter, mut sinks) = Reporter::channels(256, 16);
    let handles = spawn(config, index, reporter);
    let (connected, first_connection) = oneshot::channel();
    let running = async {
        // Wait outside the display loops so neither reporting channel is
        // blocked by admission or completion of the fault write.
        first_connection.await.map_err(|_| {
            io::Error::new(
                io::ErrorKind::BrokenPipe,
                "reporting stopped before connection",
            )
        })?;
        println!("First connection established; requesting fault once");
        if let Err(error) = handles.propagate_fault().await {
            eprintln!("Fault write NOT confirmed: {error}");
            return Err(error.into());
        }
        println!(
            "Fault write confirmed; NOT a firmware ACK. Verify the board's fault state; press Ctrl+C to stop"
        );
        // Keep the same handles and consumers alive for observation, without
        // creating another fault request when the supervisor reconnects.
        std::future::pending::<Result<(), Box<dyn std::error::Error>>>().await
    };
    let display = async {
        let mut connected = Some(connected);
        tokio::join!(
            async {
                while let Some(notification) = sinks.notifications.recv().await {
                    let ready = notification.board == link.board
                        && matches!(&notification.event, Event::Connected);
                    println!("{notification:#?}");
                    // Taking the sender makes the trigger one-shot across all
                    // subsequent Connected events, including reconnections.
                    if ready && let Some(connected) = connected.take() {
                        let _ = connected.send(());
                    }
                }
            },
            async {
                while let Some(report) = sinks.errors.recv().await {
                    eprintln!("{report:#?}");
                }
            },
        );
    };
    let result = tokio::select! {
        result = running => result,
        stopped = tokio::signal::ctrl_c() => stopped.map_err(Into::into),
        () = display => Err(io::Error::new(
            io::ErrorKind::BrokenPipe,
            "TCP reporting stopped before Ctrl+C",
        ).into()),
    };
    sinks.notifications.close();
    sinks.errors.close();
    drop(handles);
    result
}
