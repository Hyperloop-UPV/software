import type { SettingsSection } from "../types/common/settings";
import type { BoardName } from "../types/data/board";

/** Settings form is generated from this schema. */
export const getSettingsSchema = (boards: BoardName[], branches: string[] = []): SettingsSection[] => [
  {
    title: "Vehicle Configuration",
    fields: [
      {
        label: "Boards",
        path: "vehicle.boards",
        type: "multi-checkbox",
        options: boards,
      },
    ],
  },
  {
    title: "ADJ Configuration",
    fields: [
      {
        label: "Branch",
        path: "adj.branch",
        type: "combobox",
        options: branches,
      },
    ],
  },
  {
    title: "Transport Configuration",
    fields: [
      {
        label: "Propagate Fault",
        path: "transport.propagate_fault",
        type: "boolean",
      },
    ],
  },
  {
    title: "TCP Configuration",
    fields: [
      { label: "Backoff Min (ms)", path: "tcp.backoff_min_ms", type: "number" },
      { label: "Backoff Max (ms)", path: "tcp.backoff_max_ms", type: "number" },
      {
        label: "Backoff Multiplier",
        path: "tcp.backoff_multiplier",
        type: "number",
      },
      { label: "Max Retries", path: "tcp.max_retries", type: "number" },
      {
        label: "Connection Timeout (ms)",
        path: "tcp.connection_timeout_ms",
        type: "number",
      },
      { label: "Keep Alive (ms)", path: "tcp.keep_alive_ms", type: "number" },
    ],
  },
  {
    title: "BLCU Configuration",
    fields: [
      {
        label: "IP Address",
        path: "blcu.ip",
        type: "text",
        placeholder: "127.0.0.1",
      },
      {
        label: "Download Order ID",
        path: "blcu.download_order_id",
        type: "number",
      },
      {
        label: "Upload Order ID",
        path: "blcu.upload_order_id",
        type: "number",
      },
    ],
  },
  {
    title: "TFTP Configuration",
    fields: [
      { label: "Block Size", path: "tftp.block_size", type: "number" },
      { label: "Retries", path: "tftp.retries", type: "number" },
      { label: "Timeout (ms)", path: "tftp.timeout_ms", type: "number" },
      { label: "Backoff Factor", path: "tftp.backoff_factor", type: "number" },
      {
        label: "Enable Progress",
        path: "tftp.enable_progress",
        type: "boolean",
      },
    ],
  },
  {
    title: "Logging Configuration",
    fields: [
      {
        label: "Time Unit",
        path: "logging.time_unit",
        type: "select",
        options: ["ns", "us", "ms", "s"],
      },
      {
        label: "Logging Path",
        path: "logging.logging_path",
        type: "path",
      },
    ],
  },
];
