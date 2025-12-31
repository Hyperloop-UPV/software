import type { Message } from "../types/data/message";

// TODO: implement real messages type

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
