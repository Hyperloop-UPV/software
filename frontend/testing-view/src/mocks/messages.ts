import type { Message } from "../types/data/message";

// Mock Messages
export const MOCK_MESSAGES: Message[] = [
  {
    id: "1",
    timestamp: {
      counter: 1,
      second: 56,
      minute: 34,
      hour: 12,
      day: 1,
      month: 1,
      year: 2026,
    },
    kind: "info",
    payload: {
      connection: "established",
      device: "0x01",
    },
    board: "board1",
    name: "connection",
  },
  {
    id: "2",
    timestamp: {
      counter: 2,
      second: 12,
      minute: 35,
      hour: 12,
      day: 1,
      month: 1,
      year: 2026,
    },
    kind: "warning",
    payload: {
      latency: 250,
      threshold: 200,
    },
    board: "board1",
    name: "latency",
  },
  {
    id: "3",
    timestamp: {
      counter: 4,
      second: 1,
      minute: 36,
      hour: 12,
      day: 1,
      month: 1,
      year: 2026,
    },
    kind: "fault",
    payload: {
      error: "Failed to send packet",
      details: "Timeout after 3 retries",
    },
    board: "board1",
    name: "packet",
  },
  {
    id: "4",
    timestamp: {
      counter: 5,
      second: 15,
      minute: 36,
      hour: 12,
      day: 1,
      month: 1,
      year: 2026,
    },
    kind: "ok",
    payload: {
      message: "Calibration complete",
      details: "Accuracy: 99.8%",
    },
    board: "board1",
    name: "calibration",
  },
];
