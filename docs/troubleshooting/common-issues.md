# Control Station Troubleshooting Guide

## Quick Diagnostics

### System Health Check

Run this checklist when experiencing issues:

1. **Backend Status**
   ```bash
   # Check if backend is running
   ps aux | grep backend
   
   # Check backend logs
   tail -f trace.json | jq
   
   # Verify network interfaces
   ip addr show | grep 192.168.0.9
   ```

2. **Network Connectivity**
   ```bash
   # Test board connectivity
   ping -c 3 192.168.1.4  # Replace with board IP
   
   # Check active connections
   netstat -an | grep -E "504[0-9]"
   
   # Monitor network traffic
   sudo tcpdump -i any -n host 192.168.1.4
   ```

3. **Frontend Connection**
   - Open browser DevTools (F12)
   - Go to Network tab → WS
   - Check WebSocket connection status
   - Look for error messages in Console

## Common Issues and Solutions

### 1. No Data from Boards

#### Symptoms
- Empty dashboard
- No measurements updating
- Connection indicator red

#### Diagnosis
```bash
# Check if board is configured
grep -A 5 "vehicle" config.toml

# Verify ADJ board definition exists
ls adj/boards/[BOARD_NAME]/

# Check network connectivity
ping 192.168.1.[BOARD_IP]
```

#### Solutions

**Solution A: Board not in config.toml**
```toml
# Edit config.toml
[vehicle]
boards = ["LCU", "HVSCU", "BMSL"]  # Add missing board
```

**Solution B: Network configuration issue**
```bash
# Set correct IP on backend machine
sudo ip addr add 192.168.0.9/24 dev eth0

# Verify routing
ip route | grep 192.168
```

**Solution C: Board firmware issue**
- Check board has correct backend IP (192.168.0.9)
- Verify board is sending to correct ports (50400/50500)
- Use Wireshark to capture packets

### 2. Orders Not Executing

#### Symptoms
- Orders sent but no response
- Board doesn't react to commands
- No error messages

#### Diagnosis
```bash
# Check order exists in ADJ
cat adj/boards/[BOARD]/orders.json | jq '.[] | select(.id == [ORDER_ID])'

# Monitor order flow
tail -f trace.json | jq 'select(.topic == "order/send")'
```

#### Solutions

**Solution A: Invalid order ID**
- Verify order ID exists in board's orders.json
- Check for typos in order name
- Ensure all required fields are provided

**Solution B: WebSocket message format**
```javascript
// Correct format
{
    "topic": "order/send",
    "payload": {
        "id": 9995,
        "fields": {
            "ldu_id": { "value": 1, "type": "uint8" }
        }
    }
}
```

**Solution C: Board not processing orders**
- Check board TCP connection is established
- Verify board firmware handles the order ID
- Look for ACK messages in logs

### 3. WebSocket Disconnections

#### Symptoms
- "Disconnected" message in UI
- Data stops updating
- Need to refresh page frequently

#### Diagnosis
```javascript
// In browser console
// Check WebSocket state
console.log(ws.readyState);  // Should be 1 (OPEN)
```

#### Solutions

**Solution A: Backend crashed**
```bash
# Check backend process
ps aux | grep backend

# Restart if needed
./scripts/dev.sh backend
```

**Solution B: Network interruption**
- Check for proxy/firewall blocking WebSocket
- Verify no rate limiting on network
- Try different browser/disable extensions

**Solution C: Frontend error**
- Check browser console for JavaScript errors
- Clear browser cache and reload
- Update to latest frontend version

### 4. BLCU Upload/Download Fails

#### Symptoms
- Firmware upload stuck at 0%
- "Transfer failed" error
- Timeout during TFTP operation

#### Diagnosis
```bash
# Test TFTP connectivity
tftp 192.168.1.254
> status
> quit

# Check BLCU orders in logs
tail -f trace.json | jq 'select(.board == "BLCU")'
```

#### Solutions

**Solution A: BLCU not responding**
- Verify BLCU IP address is correct
- Check BLCU is in bootloader mode
- Power cycle the BLCU board

**Solution B: TFTP timeout**
```go
// Increase timeout in config
[blcu]
timeout_ms = 10000  # Increase from 5000
```

**Solution C: File too large**
- Check file size is within limits
- Split large files if necessary
- Verify adequate network bandwidth

### 5. High CPU/Memory Usage

#### Symptoms
- System sluggish
- Fan running constantly
- Backend using >50% CPU

#### Diagnosis
```bash
# Monitor resource usage
htop

# Check goroutine count
curl http://localhost:4040/debug/pprof/goroutine?debug=1 | grep goroutine | wc -l

# Profile CPU usage
go tool pprof http://localhost:4040/debug/pprof/profile?seconds=30
```

#### Solutions

**Solution A: Too many reconnection attempts**
- Check for boards that are offline
- Increase reconnection backoff
- Remove offline boards from config

**Solution B: Memory leak**
- Restart backend periodically
- Update to latest version
- Report issue with heap profile

**Solution C: Excessive logging**
```bash
# Reduce log verbosity
./backend -trace=warn  # Instead of debug/trace
```

## Advanced Debugging

### Packet Analysis

**Capture all pod traffic**:
```bash
sudo tcpdump -i any -w capture.pcap 'net 192.168.0.0/16'
```

**Analyze with Wireshark**:
1. Open capture.pcap in Wireshark
2. Apply filter: `ip.addr == 192.168.1.4`
3. Look for:
   - TCP RST packets (connection issues)
   - Retransmissions (network problems)
   - Malformed packets (firmware bugs)

### Backend Debug Mode

**Enable verbose logging**:
```bash
./backend -trace=trace -log=detailed.json
```

**Enable CPU profiling**:
```bash
./backend -cpuprofile=cpu.prof
go tool pprof -http=:8081 cpu.prof
```

**Memory profiling**:
```bash
curl http://localhost:4040/debug/pprof/heap > heap.prof
go tool pprof -http=:8082 heap.prof
```

### Frontend Debugging

**Enable React DevTools**:
1. Install React Developer Tools extension
2. Open Components tab in DevTools
3. Search for problematic component
4. Check props and state

**Network debugging**:
```javascript
// In browser console
// Log all WebSocket messages
const originalSend = WebSocket.prototype.send;
WebSocket.prototype.send = function(data) {
    console.log('WS Send:', data);
    return originalSend.call(this, data);
};
```

## Error Messages Reference

### Backend Errors

| Error | Meaning | Solution |
|-------|---------|----------|
| `failed to obtain sniffer source` | Cannot access network interface | Run with sudo or fix permissions |
| `backend address not found in any device` | Wrong network configuration | Set correct IP on network interface |
| `failed to compile bpf filter` | Invalid packet filter | Check filter syntax |
| `Backend is already running` | PID file exists | Remove `/tmp/backendPid` or kill existing process |

### Frontend Errors

| Error | Meaning | Solution |
|-------|---------|----------|
| `WebSocket connection failed` | Cannot reach backend | Check backend is running and accessible |
| `Invalid message format` | Malformed WebSocket message | Check message structure matches API |
| `Unknown topic` | Topic not recognized | Verify topic name is correct |

### Board Communication Errors

| Error | Meaning | Solution |
|-------|---------|----------|
| `Connection refused` | Board not listening | Check board IP and port |
| `Connection timeout` | Network unreachable | Verify network path to board |
| `Packet decode error` | Malformed packet | Check ADJ matches firmware |
| `Invalid packet ID` | Unknown packet type | Update ADJ configuration |

## Performance Tuning

### Network Optimization

```toml
# config.toml
[tcp]
connection_timeout = 5000     # Increase for slow networks
keep_alive = 1000            # Decrease for faster detection
backoff_multiplier = 1.5     # Adjust reconnection rate

[transport]
propagate_fault = true       # Enable fast fault propagation
```

### Resource Limits

```bash
# Increase file descriptor limit
ulimit -n 4096

# Increase network buffers
sudo sysctl -w net.core.rmem_max=134217728
sudo sysctl -w net.core.wmem_max=134217728
```

## Getting Help

### Before Asking for Help

1. **Collect information**:
   ```bash
   # System info
   uname -a
   go version
   node --version
   
   # Recent logs
   tail -n 1000 trace.json > debug_logs.json
   
   # Configuration
   cp config.toml debug_config.toml
   ```

2. **Try basic fixes**:
   - Restart backend and frontend
   - Clear browser cache
   - Update to latest version
   - Check network connectivity

3. **Document the issue**:
   - What were you trying to do?
   - What did you expect to happen?
   - What actually happened?
   - Can you reproduce it?

### Where to Get Help

1. **GitHub Issues**: For bugs and feature requests
2. **Team Discord**: For quick questions
3. **Documentation**: Check if already documented
4. **Code Comments**: Often contain helpful context

### Creating Bug Reports

Include:
- System information
- Steps to reproduce
- Expected vs actual behavior
- Relevant logs
- Screenshots if UI issue
- Configuration files (sanitized)

---

*For architecture details and how the system works, see the [Complete Architecture Guide](../../CONTROL_STATION_COMPLETE_ARCHITECTURE.md).*