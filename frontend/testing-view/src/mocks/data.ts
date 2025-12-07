// Command Types
// export interface Command {
//   id: string;
//   name: string;
//   description: string;
//   category: "test" | "control" | "diagnostic" | "system";
//   parameters?: {
//     name: string;
//     type: "string" | "number" | "boolean";
//     required: boolean;
//     default?: string | number | boolean;
//   }[];
//   icon?: string;
//   dangerous?: boolean;
// }

// Packet Types
export interface PacketType {
  id: string;
  name: string;
  type:
    | "DATA"
    | "ACK"
    | "NACK"
    | "SYNC"
    | "KEEPALIVE"
    | "ERROR"
    | "COMMAND"
    | "RESPONSE";
  description: string;
  size: number; // in bytes
  priority: "high" | "medium" | "low";
  color: string;
}

// Live Packet Instance
export interface Packet {
  id: string;
  packetTypeId: string;
  timestamp: string;
  data?: string;
  source?: string;
  destination?: string;
  status: "sent" | "received" | "failed" | "pending";
}

// Message Types
export interface Message {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  message: string;
  details?: string;
}

// Mock Commands
// export const MOCK_COMMANDS: Command[] = [
//   {
//     id: "cmd_start_test",
//     name: "Start Test",
//     description: "Initiates the testing sequence",
//     category: "test",
//     icon: "▶",
//   },
//   {
//     id: "cmd_stop_test",
//     name: "Stop Test",
//     description: "Stops the current testing sequence",
//     category: "test",
//     icon: "⏹",
//     dangerous: true,
//   },
//   {
//     id: "cmd_pause_test",
//     name: "Pause Test",
//     description: "Temporarily pauses the test",
//     category: "test",
//     icon: "⏸",
//   },
//   {
//     id: "cmd_reset",
//     name: "Reset System",
//     description: "Resets all system states to default",
//     category: "system",
//     icon: "↻",
//     dangerous: true,
//   },
//   {
//     id: "cmd_calibrate",
//     name: "Calibrate Sensors",
//     description: "Runs sensor calibration routine",
//     category: "diagnostic",
//     icon: "⚙",
//     parameters: [
//       {
//         name: "sensor_id",
//         type: "string",
//         required: true,
//       },
//       {
//         name: "duration",
//         type: "number",
//         required: false,
//         default: 30,
//       },
//     ],
//   },
//   {
//     id: "cmd_export",
//     name: "Export Data",
//     description: "Exports test data to file",
//     category: "system",
//     icon: "📥",
//     parameters: [
//       {
//         name: "format",
//         type: "string",
//         required: true,
//         default: "csv",
//       },
//     ],
//   },
//   {
//     id: "cmd_reconnect",
//     name: "Reconnect",
//     description: "Re-establishes connection",
//     category: "control",
//     icon: "🔄",
//   },
//   {
//     id: "cmd_clear_log",
//     name: "Clear Log",
//     description: "Clears all log messages",
//     category: "system",
//     icon: "🗑",
//   },
//   {
//     id: "cmd_send_keepalive",
//     name: "Send Keepalive",
//     description: "Sends keepalive packet",
//     category: "control",
//     icon: "💓",
//   },
//   {
//     id: "cmd_emergency_stop",
//     name: "Emergency Stop",
//     description: "Immediate emergency shutdown",
//     category: "control",
//     icon: "⚠",
//     dangerous: true,
//   },
//   {
//     id: "cmd_run_diagnostics",
//     name: "Run Diagnostics",
//     description: "Performs full system diagnostics",
//     category: "diagnostic",
//     icon: "🔍",
//     parameters: [
//       {
//         name: "verbose",
//         type: "boolean",
//         required: false,
//         default: false,
//       },
//     ],
//   },
//   {
//     id: "cmd_update_firmware",
//     name: "Update Firmware",
//     description: "Updates device firmware",
//     category: "system",
//     icon: "⬆",
//     dangerous: true,
//     parameters: [
//       {
//         name: "version",
//         type: "string",
//         required: true,
//       },
//     ],
//   },
// ];

// Mock Packet Types
export const MOCK_PACKET_TYPES: PacketType[] = [
  {
    id: "pkt_data",
    name: "DATA",
    type: "DATA",
    description: "Standard data transmission packet",
    size: 128,
    priority: "medium",
    color: "blue",
  },
  {
    id: "pkt_ack",
    name: "ACK",
    type: "ACK",
    description: "Acknowledgment packet",
    size: 64,
    priority: "high",
    color: "green",
  },
  {
    id: "pkt_nack",
    name: "NACK",
    type: "NACK",
    description: "Negative acknowledgment",
    size: 64,
    priority: "high",
    color: "red",
  },
  {
    id: "pkt_sync",
    name: "SYNC",
    type: "SYNC",
    description: "Synchronization packet",
    size: 32,
    priority: "high",
    color: "purple",
  },
  {
    id: "pkt_keepalive",
    name: "KEEPALIVE",
    type: "KEEPALIVE",
    description: "Connection keepalive",
    size: 16,
    priority: "low",
    color: "gray",
  },
  {
    id: "pkt_error",
    name: "ERROR",
    type: "ERROR",
    description: "Error notification packet",
    size: 96,
    priority: "high",
    color: "red",
  },
  {
    id: "pkt_command",
    name: "COMMAND",
    type: "COMMAND",
    description: "Command execution request",
    size: 256,
    priority: "high",
    color: "orange",
  },
  {
    id: "pkt_response",
    name: "RESPONSE",
    type: "RESPONSE",
    description: "Command response",
    size: 192,
    priority: "medium",
    color: "cyan",
  },
];

// Mock Recent Packets (for display)
export const MOCK_PACKETS: Packet[] = [
  {
    id: "1",
    packetTypeId: "pkt_sync",
    timestamp: "12:34:56.123",
    source: "0x01",
    destination: "0xFF",
    status: "received",
  },
  {
    id: "2",
    packetTypeId: "pkt_data",
    timestamp: "12:34:56.456",
    data: "0x4A3F2E1D",
    source: "0x01",
    destination: "0x02",
    status: "received",
  },
  {
    id: "3",
    packetTypeId: "pkt_ack",
    timestamp: "12:34:56.478",
    source: "0x02",
    destination: "0x01",
    status: "sent",
  },
  {
    id: "4",
    packetTypeId: "pkt_keepalive",
    timestamp: "12:34:57.001",
    source: "0x01",
    destination: "0xFF",
    status: "sent",
  },
  {
    id: "5",
    packetTypeId: "pkt_command",
    timestamp: "12:34:57.234",
    data: "START_TEST",
    source: "0x00",
    destination: "0x01",
    status: "sent",
  },
  {
    id: "6",
    packetTypeId: "pkt_response",
    timestamp: "12:34:57.267",
    data: "OK",
    source: "0x01",
    destination: "0x00",
    status: "received",
  },
];

// Mock Messages
export const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    timestamp: "12:34:56",
    level: "info",
    message: "Connection established successfully",
    details: "Connected to device 0x01",
  },
  {
    id: "2",
    timestamp: "12:35:12",
    level: "warn",
    message: "High latency detected",
    details: "Average latency: 250ms (threshold: 200ms)",
  },
  {
    id: "3",
    timestamp: "12:35:45",
    level: "success",
    message: "Test completed successfully",
    details: "All tests passed (12/12)",
  },
  {
    id: "4",
    timestamp: "12:36:01",
    level: "error",
    message: "Failed to send packet",
    details: "Timeout after 3 retries",
  },
  {
    id: "5",
    timestamp: "12:36:15",
    level: "info",
    message: "Calibration started",
    details: "Sensor ID: 0x03",
  },
  {
    id: "6",
    timestamp: "12:36:45",
    level: "success",
    message: "Calibration complete",
    details: "Accuracy: 99.8%",
  },
];

// Helper function to generate new packet
export const generateMockPacket = (typeId: string): Packet => {
  const now = new Date();
  const timestamp =
    now.toTimeString().split(" ")[0] + "." + now.getMilliseconds();

  return {
    id: `pkt_${Date.now()}`,
    packetTypeId: typeId,
    timestamp,
    source: `0x${Math.floor(Math.random() * 16)
      .toString(16)
      .toUpperCase()}${Math.floor(Math.random() * 16)
      .toString(16)
      .toUpperCase()}`,
    destination: `0x${Math.floor(Math.random() * 16)
      .toString(16)
      .toUpperCase()}${Math.floor(Math.random() * 16)
      .toString(16)
      .toUpperCase()}`,
    status: Math.random() > 0.5 ? "sent" : "received",
  };
};

// Helper function to generate new message
export const generateMockMessage = (
  level: Message["level"],
  message: string,
  details?: string,
): Message => {
  const now = new Date();
  const timestamp = now.toTimeString().split(" ")[0];

  return {
    id: `msg_${Date.now()}`,
    timestamp,
    level,
    message,
    details,
  };
};
