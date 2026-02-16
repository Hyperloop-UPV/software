import type { ConfigData } from "../types/common/config";

/** Default configuration for the backend in settings form.
 * Used when the configuration is not found or when opened without electron API. */
export const DEFAULT_CONFIG: ConfigData = {
  vehicle: {
    boards: [
      "BCU",
      "BMSL",
      "HVSCU",
      "HVSCU-Cabinet",
      "LCU",
      "PCU",
      "VCU",
      "BLCU",
    ],
  },
  adj: {
    branch: "main",
  },
  network: {
    manual: false,
  },
  transport: {
    propagate_fault: false,
  },
  tcp: {
    backoff_min_ms: 100,
    backoff_max_ms: 5000,
    backoff_multiplier: 1.5,
    max_retries: 0,
    connection_timeout_ms: 1000,
    keep_alive_ms: 1000,
  },
  blcu: {
    ip: "127.0.0.1",
    download_order_id: 0,
    upload_order_id: 0,
  },
  tftp: {
    block_size: 131072,
    retries: 3,
    timeout_ms: 5000,
    backoff_factor: 2,
    enable_progress: true,
  },
  logging: {
    time_unit: "us",
    logging_path: "",
  },
};
