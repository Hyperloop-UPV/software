import { colors } from "./colors.js";

/**
 * Create a logger with optional prefix
 */
function createLoggerMethods(prefix = "", prefixColor = "") {
  const prefixText = prefix
    ? `${colors[prefixColor]}[${prefix}]${colors.reset} `
    : "";

  return {
    info: (msg, ...args) => {
      console.log(
        `${prefixText}${colors.blue}[INFO]${colors.reset} ${msg}`,
        ...args
      );
    },

    success: (msg, ...args) => {
      console.log(
        `${prefixText}${colors.brightGreen}[OK]${colors.reset} ${msg}`,
        ...args
      );
    },

    warning: (msg, ...args) => {
      console.log(
        `${prefixText}${colors.yellow}[WARN]${colors.reset} ${msg}`,
        ...args
      );
    },

    error: (msg, ...args) => {
      console.error(
        `${prefixText}${colors.brightRed}[ERROR]${colors.reset} ${msg}`,
        ...args
      );
    },

    debug: (msg, ...args) => {
      console.log(
        `${prefixText}${colors.gray}[DEBUG]${colors.reset} ${msg}`,
        ...args
      );
    },

    header: (msg) => {
      console.log(
        `\n${prefixText}${colors.bright}${colors.cyan}${msg}${colors.reset}\n`
      );
    },

    step: (msg, ...args) => {
      console.log(
        `${prefixText}${colors.dim}  > ${msg}${colors.reset}`,
        ...args
      );
    },

    path: (label, path) => {
      console.log(
        `${prefixText}  ${colors.dim}${label}:${colors.reset} ${colors.cyan}${path}${colors.reset}`
      );
    },
  };
}

/**
 * Main logger with nested context loggers
 */
export const logger = {
  // Color constants
  colors,

  // Default logger methods (no prefix, for build scripts)
  ...createLoggerMethods(),

  // Electron-specific logs
  electron: createLoggerMethods("ELECTRON", "yellow"),

  // Backend-specific logs (for subprocess output)
  backend: createLoggerMethods("Backend", "magenta"),

  // Config-specific logs
  config: createLoggerMethods("Config", "cyan"),

  // Packet Sender-specific logs
  packetSender: createLoggerMethods("Packet Sender", "green"),

  // Generic process logger for custom process names
  process: (name, msg) => {
    console.log(`${colors.magenta}[${name}]${colors.reset} ${msg}`);
  },

  // Raw colored output
  log: (color, msg, ...args) => {
    console.log(`${colors[color] || ""}${msg}${colors.reset}`, ...args);
  },
};
