export type ConfigData = {
  vehicle: {
    boards: string[];
  };
  adj: {
    branch: string;
  };
  network: {
    manual: boolean;
  };
  transport: {
    propagate_fault: boolean;
  };
  tcp: {
    backoff_min_ms: number;
    backoff_max_ms: number;
    backoff_multiplier: number;
    max_retries: number;
    connection_timeout_ms: number;
    keep_alive_ms: number;
  };
  blcu: {
    ip: string;
    download_order_id: number;
    upload_order_id: number;
  };
  tftp: {
    block_size: number;
    retries: number;
    timeout_ms: number;
    backoff_factor: number;
    enable_progress: boolean;
  };
  logging: {
    time_unit: string;
    logging_path: string;
  };
};
