import { describe, it, expect } from "vitest";
import { updateTomlFromObject } from "../configManager.js";

describe("updateTomlFromObject", () => {
  it("should update multiple values from object", () => {
    const toml = `name = "old"
version = 1`;

    const config = {
      name: "new",
      version: 2,
    };

    const result = updateTomlFromObject(toml, config);

    expect(result).toContain('name = "new"');
    expect(result).toContain("version = 2");
  });

  it("should update nested sections", () => {
    const toml = `[database]
host = "localhost"
port = 5432`;

    const config = {
      database: {
        host: "192.168.1.1",
        port: 3306,
      },
    };

    const result = updateTomlFromObject(toml, config);

    expect(result).toContain('host = "192.168.1.1"');
    expect(result).toContain("port = 3306");
  });

  it("should handle deeply nested sections", () => {
    const toml = `[parent.child]
value = "old"`;

    const config = {
      parent: {
        child: {
          value: "new",
        },
      },
    };

    const result = updateTomlFromObject(toml, config);

    expect(result).toContain('value = "new"');
  });

  it("should handle mixed root and section values", () => {
    const toml = `root_key = "root_value"

[section]
section_key = "section_value"`;

    const config = {
      root_key: "updated_root",
      section: {
        section_key: "updated_section",
      },
    };

    const result = updateTomlFromObject(toml, config);

    expect(result).toContain('root_key = "updated_root"');
    expect(result).toContain('section_key = "updated_section"');
  });

  it("should update large config with multiple sections preserving comments", () => {
    const toml = `# Application Configuration
[app]
automatic_window_opening = "" # Window opening behavior

# Vehicle Configuration
[vehicle]
boards = ["BCU", "HVSCU"] # Active boards

# Network Settings
[network]
manual = false # Manual device selection

[tcp]
backoff_min_ms = 100       # Min backoff duration
backoff_max_ms = 5000      # Max backoff duration
backoff_multiplier = 1.5   # Exponential multiplier
max_retries = 0            # Max retries (0 = infinite)
connection_timeout_ms = 1000
keep_alive_ms = 1000

[logging]
level = "debug"
console = true
file = "backend.log"`;

    const config = {
      app: {
        automatic_window_opening: "both",
      },
      vehicle: {
        boards: ["BCU", "HVSCU", "LCU", "VCU"],
      },
      network: {
        manual: true,
      },
      tcp: {
        backoff_min_ms: 200,
        backoff_max_ms: 10000,
        backoff_multiplier: 2.0,
        max_retries: 5,
        connection_timeout_ms: 2000,
        keep_alive_ms: 5000,
      },
      logging: {
        level: "info",
        console: false,
        file: "app.log",
      },
    };

    const result = updateTomlFromObject(toml, config);

    // Verify app section
    expect(result).toContain('automatic_window_opening = "both"');
    expect(result).toContain("# Window opening behavior");

    // Verify vehicle section
    expect(result).toContain('boards = ["BCU", "HVSCU", "LCU", "VCU"]');
    expect(result).toContain("# Active boards");

    // Verify network section
    expect(result).toContain("manual = true");

    // Verify TCP section
    expect(result).toContain("backoff_min_ms = 200");
    expect(result).toContain("backoff_max_ms = 10000");
    expect(result).toContain("backoff_multiplier = 2");
    expect(result).toContain("max_retries = 5");
    expect(result).toContain("connection_timeout_ms = 2000");
    expect(result).toContain("keep_alive_ms = 5000");

    // Verify comments are preserved
    expect(result).toContain("# Min backoff duration");
    expect(result).toContain("# Max backoff duration");
    expect(result).toContain("# Exponential multiplier");
    expect(result).toContain("# Max retries (0 = infinite)");

    // Verify logging section
    expect(result).toContain('level = "info"');
    expect(result).toContain("console = false");
    expect(result).toContain('file = "app.log"');
  });

  it("should handle realistic hyperloop config structure", () => {
    const toml = `# Hyperloop Control Station Config
[app]
automatic_window_opening = "control-station"

[vehicle]
boards = ["BCU", "BMSL", "HVSCU", "HVSCU-Cabinet", "LCU", "PCU", "VCU", "BLCU"]

[adj]
branch = "main"
test = true

[transport]
propagate_fault = false

[tcp]
backoff_min_ms = 100
backoff_max_ms = 5000
backoff_multiplier = 1.5
max_retries = 0
connection_timeout_ms = 1000
keep_alive_ms = 1000

[tftp]
block_size = 131072
retries = 3
timeout_ms = 5000
backoff_factor = 2
enable_progress = true

[blcu]
ip = "127.0.0.1"
download_order_id = 0
upload_order_id = 0

[logging]
level = "debug"
console = true
file = "backend.log"
max_size_mb = 100
max_backups = 3
max_age_days = 7
time_unit = "us"`;

    const config = {
      app: {
        automatic_window_opening: "both",
      },
      vehicle: {
        boards: ["HVSCU", "HVSCU-Cabinet"],
      },
      adj: {
        branch: "software",
        test: false,
      },
      transport: {
        propagate_fault: true,
      },
      tcp: {
        backoff_min_ms: 999999,
        backoff_max_ms: 999999,
        backoff_multiplier: 1,
        max_retries: 0,
        connection_timeout_ms: 999999,
        keep_alive_ms: 0,
      },
      tftp: {
        block_size: 512,
        retries: 5,
        timeout_ms: 3000,
        backoff_factor: 3,
        enable_progress: false,
      },
      blcu: {
        ip: "10.10.10.5",
        download_order_id: 1,
        upload_order_id: 2,
      },
      logging: {
        level: "info",
        console: false,
        file: "hyperloop.log",
        max_size_mb: 50,
        max_backups: 5,
        max_age_days: 14,
        time_unit: "ms",
      },
    };

    const result = updateTomlFromObject(toml, config);

    // Verify all sections were updated
    expect(result).toContain('automatic_window_opening = "both"');
    expect(result).toContain('boards = ["HVSCU", "HVSCU-Cabinet"]');
    expect(result).toContain('branch = "software"');
    expect(result).toContain("test = false");
    expect(result).toContain("propagate_fault = true");
    expect(result).toContain("backoff_min_ms = 999999");
    expect(result).toContain("keep_alive_ms = 0");
    expect(result).toContain("block_size = 512");
    expect(result).toContain("retries = 5");
    expect(result).toContain("enable_progress = false");
    expect(result).toContain('ip = "10.10.10.5"');
    expect(result).toContain("download_order_id = 1");
    expect(result).toContain('level = "info"');
    expect(result).toContain("console = false");
    expect(result).toContain('file = "hyperloop.log"');
    expect(result).toContain("max_size_mb = 50");
    expect(result).toContain('time_unit = "ms"');

    // Verify comments are preserved
    expect(result).toContain("# Hyperloop Control Station Config");
  });
});
