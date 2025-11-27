const fs = require("fs");
const { dialog } = require("electron");
const toml = require("@iarna/toml");
const { getConfigPath } = require("../utils/paths");
const { restartBackend } = require("../processes/backend");

function getServerConfigSection() {
  return `# Server Configuration
[server.ethernet-view]
address = "127.0.0.1:4040"
static = "./ethernet-view"

[server.ethernet-view.endpoints]
pod_data = "/podDataStructure"
order_data = "/orderStructures"
programable_boards = "/uploadableBoards"
connections = "/backend"
files = "/"

[server.control-station]
address = "127.0.0.1:4000"
static = "./control-station"

[server.control-station.endpoints]
pod_data = "/podDataStructure"
order_data = "/orderStructures"
programable_boards = "/uploadableBoards"
connections = "/backend"
files = "/"
`;
}

function readConfig(configFilePath = getConfigPath()) {
  // Check if file exists, throw error if not
  if (!fs.existsSync(configFilePath)) {
    throw new Error(`Config file not found at: ${configFilePath}`);
  }

  // Read config file
  const content = fs.readFileSync(configFilePath, "utf8");

  // Split at "DO NOT TOUCH" line
  const splitIndex = content.indexOf("# <-- DO NOT TOUCH BELOW THIS LINE -->");
  const editableContent =
    splitIndex !== -1 ? content.substring(0, splitIndex) : content;

  // Parse TOML
  const parsed = toml.parse(editableContent);

  // Map to ConfigData structure
  const config = {
    vehicle: {
      boards: parsed.vehicle?.boards,
    },
    adj: {
      branch: parsed.adj?.branch,
    },
    network: {
      manual: parsed.network?.manual,
    },
    transport: {
      propagate_fault: parsed.transport?.propagate_fault,
    },
    tcp: {
      backoff_min_ms: parsed.tcp?.backoff_min_ms,
      backoff_max_ms: parsed.tcp?.backoff_max_ms,
      backoff_multiplier: parsed.tcp?.backoff_multiplier,
      max_retries: parsed.tcp?.max_retries,
      connection_timeout_ms: parsed.tcp?.connection_timeout_ms,
      keep_alive_ms: parsed.tcp?.keep_alive_ms,
    },
    blcu: {
      ip: parsed.blcu?.ip,
      download_order_id: parsed.blcu?.download_order_id,
      upload_order_id: parsed.blcu?.upload_order_id,
    },
    tftp: {
      block_size: parsed.tftp?.block_size,
      retries: parsed.tftp?.retries,
      timeout_ms: parsed.tftp?.timeout_ms,
      backoff_factor: parsed.tftp?.backoff_factor,
      enable_progress: parsed.tftp?.enable_progress,
    },
    logger: {
      time_unit: parsed.logger?.time_unit,
      logging_path: parsed.logger?.logging_path,
    },
  };

  return config;
}

function writeConfig(config) {
  const configPath = getConfigPath();

  // Check if file exists, throw error if not
  if (!fs.existsSync(configPath)) {
    throw new Error(`Config file not found at: ${configPath}`);
  }

  // Read existing config file
  const fullContent = fs.readFileSync(configPath, "utf8");
  const splitIndex = fullContent.indexOf(
    "\n# <-- DO NOT TOUCH BELOW THIS LINE -->"
  );

  const editableContent =
    splitIndex !== -1 ? fullContent.substring(0, splitIndex) : fullContent;
  const serverSection =
    splitIndex !== -1
      ? fullContent.substring(splitIndex)
      : "\n" + getServerConfigSection();

  // Parse existing TOML
  let parsed = {};
  try {
    parsed = toml.parse(editableContent);
  } catch (error) {
    console.warn("Error parsing existing config, starting fresh:", error);
  }

  // Update with new values
  parsed.vehicle = { boards: config.vehicle.boards };
  parsed.adj = { branch: config.adj.branch, test: false };
  parsed.network = { manual: config.network.manual };
  parsed.transport = { propagate_fault: config.transport.propagate_fault };
  parsed.tcp = {
    backoff_min_ms: config.tcp.backoff_min_ms,
    backoff_max_ms: config.tcp.backoff_max_ms,
    backoff_multiplier: config.tcp.backoff_multiplier,
    max_retries: config.tcp.max_retries,
    connection_timeout_ms: config.tcp.connection_timeout_ms,
    keep_alive_ms: config.tcp.keep_alive_ms,
  };
  parsed.blcu = {
    ip: config.blcu.ip,
    download_order_id: config.blcu.download_order_id,
    upload_order_id: config.blcu.upload_order_id,
  };
  parsed.tftp = {
    block_size: config.tftp.block_size,
    retries: config.tftp.retries,
    timeout_ms: config.tftp.timeout_ms,
    backoff_factor: config.tftp.backoff_factor,
    enable_progress: config.tftp.enable_progress,
  };
  parsed.logger = {
    time_unit: config.logger.time_unit,
    logging_path: config.logger.logging_path,
  };

  // Stringify back to TOML
  const updatedContent = toml.stringify(parsed);

  // Write the updated file
  fs.writeFileSync(configPath, updatedContent + serverSection, "utf8");

  console.log(`Config saved successfully to: ${configPath}`);

  // Restart processes to apply new config
  restartBackend();
}

function importConfig() {
  return new Promise((resolve, reject) => {
    // Lazy load getMainWindow to avoid circular dependency
    const { getMainWindow } = require("../windows/mainWindow");
    const mainWindow = getMainWindow();

    // Show file dialog to select config file
    dialog
      .showOpenDialog(mainWindow, {
        title: "Import Configuration File",
        filters: [
          { name: "TOML Files", extensions: ["toml"] },
          { name: "All Files", extensions: ["*"] },
        ],
        properties: ["openFile"],
      })
      .then((result) => {
        if (result.canceled) {
          reject(new Error("Import cancelled"));
          return;
        }

        const selectedPath = result.filePaths[0];

        if (!fs.existsSync(selectedPath)) {
          reject(new Error("Selected file does not exist"));
          return;
        }

        try {
          // Use readConfig to parse the selected file
          const importedConfig = readConfig(selectedPath);

          // Use writeConfig to write it to the actual config path
          writeConfig(importedConfig);

          const configPath = getConfigPath();
          console.log(
            `Config imported from: ${selectedPath} to: ${configPath}`
          );

          resolve(true);
        } catch (error) {
          console.error("Error importing config:", error);
          reject(error);
        }
      })
      .catch((error) => {
        console.error("Error showing file dialog:", error);
        reject(error);
      });
  });
}

module.exports = { readConfig, writeConfig, importConfig };
