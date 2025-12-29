use anyhow::{Context, Result};
#[cfg(unix)]
use std::os::unix::io::AsRawFd;
use tokio::net::UdpSocket;

/// Configure socket with macOS-specific options for localhost networking
pub fn configure_socket(socket: &UdpSocket) -> Result<()> {
    #[cfg(unix)]
    {
        let fd = socket.as_raw_fd();

        // Set SO_REUSEADDR to allow multiple binds to same address
        set_socket_option(fd, libc::SOL_SOCKET, libc::SO_REUSEADDR, 1)
            .context("Failed to set SO_REUSEADDR")?;

        // Set SO_REUSEPORT for macOS (allows multiple sockets on same port)
        #[cfg(target_os = "macos")]
        set_socket_option(fd, libc::SOL_SOCKET, libc::SO_REUSEPORT, 1)
            .context("Failed to set SO_REUSEPORT")?;

        // Disable SIGPIPE on macOS to prevent crashes
        #[cfg(target_os = "macos")]
        set_socket_option(fd, libc::SOL_SOCKET, libc::SO_NOSIGPIPE, 1)
            .context("Failed to set SO_NOSIGPIPE")?;

        // Set receive buffer size for better performance
        set_socket_option(fd, libc::SOL_SOCKET, libc::SO_RCVBUF, 1024 * 1024)
            .context("Failed to set SO_RCVBUF")?;

        // Set send buffer size
        set_socket_option(fd, libc::SOL_SOCKET, libc::SO_SNDBUF, 1024 * 1024)
            .context("Failed to set SO_SNDBUF")?;
    }

    Ok(())
}

#[cfg(unix)]
fn set_socket_option(fd: i32, level: i32, option: i32, value: i32) -> Result<()> {
    unsafe {
        let value_ptr = &value as *const i32 as *const libc::c_void;
        let value_len = std::mem::size_of::<i32>() as libc::socklen_t;

        let result = libc::setsockopt(fd, level, option, value_ptr, value_len);

        if result < 0 {
            return Err(std::io::Error::last_os_error().into());
        }
    }

    Ok(())
}

/// Get macOS-specific loopback interface information
pub fn get_loopback_info() -> Result<LoopbackInfo> {
    Ok(LoopbackInfo {
        interface: "lo0".to_string(),
        addresses: vec!["127.0.0.1".to_string(), "::1".to_string()],
    })
}

pub struct LoopbackInfo {
    pub interface: String,
    pub addresses: Vec<String>,
}

/// Check if an IP address is a valid localhost address on macOS
pub fn is_localhost(ip: &str) -> bool {
    match ip {
        "127.0.0.1" | "localhost" | "::1" => true,
        addr if addr.starts_with("127.0.0.") || addr.starts_with("127.0.1.") => true,
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_localhost_detection() {
        assert!(is_localhost("127.0.0.1"));
        assert!(is_localhost("127.0.0.6"));
        assert!(is_localhost("127.0.1.1"));
        assert!(is_localhost("localhost"));
        assert!(is_localhost("::1"));
        assert!(!is_localhost("192.168.1.1"));
        assert!(!is_localhost("10.0.0.1"));
    }
}
