/**
 * @module utils
 * @description ANSI color codes for terminal output formatting.
 * Provides color constants for styling console messages with reset, brightness, and color options.
 */

/**
 * Object containing ANSI escape codes for terminal text coloring and formatting.
 * @type {Object<string, string>}
 * @property {string} reset - ANSI reset code to clear all formatting.
 * @property {string} bright - ANSI code for bright/bold text.
 * @property {string} dim - ANSI code for dim text.
 * @property {string} red - ANSI code for red text.
 * @property {string} green - ANSI code for green text.
 * @property {string} yellow - ANSI code for yellow text.
 * @property {string} blue - ANSI code for blue text.
 * @property {string} magenta - ANSI code for magenta text.
 * @property {string} cyan - ANSI code for cyan text.
 * @property {string} white - ANSI code for white text.
 * @property {string} gray - ANSI code for gray text.
 * @property {string} brightRed - ANSI code for bright red text.
 * @property {string} brightGreen - ANSI code for bright green text.
 * @property {string} brightYellow - ANSI code for bright yellow text.
 * @property {string} brightBlue - ANSI code for bright blue text.
 * @property {string} brightMagenta - ANSI code for bright magenta text.
 * @property {string} brightCyan - ANSI code for bright cyan text.
 * @example
 * import { colors } from './colors.js';
 * console.log(`${colors.green}Success!${colors.reset}`);
 * console.log(`${colors.brightRed}Error!${colors.reset}`);
 */
export const colors = {
  reset: "\x1b[0m",
  bright: "\x1b[1m",
  dim: "\x1b[2m",

  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",

  brightRed: "\x1b[91m",
  brightGreen: "\x1b[92m",
  brightYellow: "\x1b[93m",
  brightBlue: "\x1b[94m",
  brightMagenta: "\x1b[95m",
  brightCyan: "\x1b[96m",
};
