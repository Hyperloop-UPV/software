/**
 * @module utils
 * @description Logger utility for colored console output with context-specific prefixes.
 * Provides structured logging methods for different application components.
 * All logging methods write directly to the console with ANSI color formatting.
 */

import { colors } from "./colors.js";

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
 * @param {string} [prefix=""] - Optional prefix text to display before log messages.
 * @param {keyof typeof colors} [prefixColor=""] - Optional color name from the colors object for the prefix.
 * @returns {LoggerMethods} Logger methods object.
 * @example
 * const myLogger = createLoggerMethods("MyApp", "cyan");
 * myLogger.info("Application started");
 * myLogger.error("Something went wrong");
 */
function createLoggerMethods(prefix = "", prefixColor = "") {
  const prefixText = prefix
    ? `${colors[prefixColor] || ""}[${prefix}]${colors.reset} `
    : "";

  return {
    /**
     * Logs an info-level message to the console.
     * @param {string} msg - The message to log.
     * @param {...any} args - Additional arguments for console.log.
     */
    info: (msg, ...args) => {
      console.log(
        `${prefixText}${colors.blue}[INFO]${colors.reset} ${msg}`,
        ...args
      );
    },

    /**
     * Logs a success-level message to the console.
     * @param {string} msg - The message to log.
     * @param {...any} args - Additional arguments for console.log.
     */
    success: (msg, ...args) => {
      console.log(
        `${prefixText}${colors.brightGreen}[OK]${colors.reset} ${msg}`,
        ...args
      );
    },

    /**
     * Logs a warning-level message to the console.
     * @param {string} msg - The message to log.
     * @param {...any} args - Additional arguments for console.log.
     */
    warning: (msg, ...args) => {
      console.log(
        `${prefixText}${colors.yellow}[WARN]${colors.reset} ${msg}`,
        ...args
      );
    },

    /**
     * Logs an error-level message to the console.
     * @param {string} msg - The message to log.
     * @param {...any} args - Additional arguments for console.error.
     */
    error: (msg, ...args) => {
      console.error(
        `${prefixText}${colors.brightRed}[ERROR]${colors.reset} ${msg}`,
        ...args
      );
    },

    /**
     * Logs a debug-level message to the console.
     * @param {string} msg - The message to log.
     * @param {...any} args - Additional arguments for console.log.
     */
    debug: (msg, ...args) => {
      console.log(
        `${prefixText}${colors.gray}[DEBUG]${colors.reset} ${msg}`,
        ...args
      );
    },

    /**
     * Prints a header message with bright cyan formatting.
     * @param {string} msg - The header message.
     */
    header: (msg) => {
      console.log(
        `\n${prefixText}${colors.bright}${colors.cyan}${msg}${colors.reset}\n`
      );
    },

    /**
     * Prints a step message with dim formatting.
     * @param {string} msg - The step message.
     * @param {...any} args - Additional arguments for console.log.
     */
    step: (msg, ...args) => {
      console.log(
        `${prefixText}${colors.dim}  > ${msg}${colors.reset}`,
        ...args
      );
    },

    /**
     * Prints a labeled path with dim label and cyan path.
     * @param {string} label - Label for the path (e.g., "Config").
     * @param {string} path - The path value.
     */
    path: (label, path) => {
      console.log(
        `${prefixText}  ${colors.dim}${label}:${colors.reset} ${colors.cyan}${path}${colors.reset}`
      );
    },
  };
}

/**
 * @typedef {LoggerMethods & {
 *   colors: typeof colors,
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
  colors,

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
    console.log(`${colors.magenta}[${name}]${colors.reset} ${msg}`);
  },

  /**
   * Logs a message in a specified color.
   * @param {keyof typeof colors} color - Color key from the colors object.
   * @param {string} msg - Message to log.
   * @param {...any} args - Additional arguments for console.log.
   */
  log: (color, msg, ...args) => {
    console.log(`${colors[color] || ""}${msg}${colors.reset}`, ...args);
  },
};
