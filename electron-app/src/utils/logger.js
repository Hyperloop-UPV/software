/**
 * @module utils
 * @description Logger utility for colored console output with context-specific prefixes.
 * Provides structured logging methods for different application components.
 * All logging methods write directly to the console with ANSI color formatting.
 */

import pc from "picocolors";

/**
 * @typedef {Object} LoggerMethods
 * @property {function(string, ...any): void} info - Info-level logging.
 * @property {function(string, ...any): void} success - Success-level logging.
 * @property {function(string, ...any): void} warning - Warning-level logging.
 * @property {function(string, ...any): void} error - Error-level logging.
 * @property {function(string, ...any): void} debug - Debug-level logging.
 * @property {function(string): void} header - Prints a header message.
 * @property {function(string, ...any): void} step - Prints a step message.
 * @property {function(string, string): void} path - Prints a labeled path.
 */

/**
 * Creates a set of logger methods with an optional prefix and color.
 * @param {string} [prefix=""] - Optional prefix text.
 * @param {string} [prefixColor=""] - Color name from picocolors (e.g., "cyan", "magenta").
 */
function createLoggerMethods(prefix = "", prefixColor = "") {
  // Get the color function from picocolors, or fallback to a plain string
  const colorFn = pc[prefixColor] || ((s) => s);
  const prefixText = prefix ? `${colorFn(`[${prefix}]`)} ` : "";

  return {
    info: (msg, ...args) => {
      console.log(`${prefixText}${pc.blue("[INFO]")} ${msg}`, ...args);
    },

    success: (msg, ...args) => {
      console.log(`${prefixText}${pc.green("[OK]")} ${msg}`, ...args);
    },

    warning: (msg, ...args) => {
      console.log(`${prefixText}${pc.yellow("[WARN]")} ${msg}`, ...args);
    },

    error: (msg, ...args) => {
      console.error(`${prefixText}${pc.red("[ERROR]")} ${msg}`, ...args);
    },

    debug: (msg, ...args) => {
      console.log(`${prefixText}${pc.gray("[DEBUG]")} ${msg}`, ...args);
    },

    header: (msg) => {
      console.log(`\n${prefixText}${pc.bold(pc.cyan(msg))}\n`);
    },

    step: (msg, ...args) => {
      console.log(`${prefixText}${pc.dim(`  > ${msg}`)}`, ...args);
    },

    path: (label, path) => {
      console.log(`${prefixText}  ${pc.dim(`${label}:`)} ${pc.cyan(path)}`);
    },
  };
}

/**
 * @typedef {LoggerMethods & {
 *   electron: LoggerMethods,
 *   backend: LoggerMethods,
 *   config: LoggerMethods,
 *   packetSender: LoggerMethods,
 *   process: function(string, string): void,
 *   log: function(keyof typeof colors, string, ...any): void
 * }} Logger
 */

/**
 * Main logger object with default methods and context-specific loggers.
 * @type {Logger}
 * @example
 * import { logger } from './logger.js';
 * logger.info("Application started");
 * logger.electron.info("Window created");
 * logger.backend.error("Connection failed");
 * logger.process("CustomProcess", "Custom message");
 * logger.log("green", "Success message");
 */
export const logger = {
  // Default logger methods (no prefix)
  ...createLoggerMethods(),

  // Context-specific loggers
  electron: createLoggerMethods("ELECTRON", "yellow"),
  backend: createLoggerMethods("Backend", "magenta"),
  config: createLoggerMethods("Config", "cyan"),
  packetSender: createLoggerMethods("Packet Sender", "green"),

  /**
   * Logs a message with a custom process name.
   * @param {string} name - Name of the process.
   * @param {string} msg - Message to log.
   */
  process: (name, msg) => {
    console.log(`${pc.magenta}[${name}]${pc.reset} ${msg}`);
  },

  /**
   * Logs a message in a specified color.
   * @param {keyof typeof pc} color - Color key from the pc object.
   * @param {string} msg - Message to log.
   * @param {...any} args - Additional arguments for console.log.
   */
  log: (color, msg, ...args) => {
    console.log(`${pc[color] || ""}${msg}${pc.reset}`, ...args);
  },
};
