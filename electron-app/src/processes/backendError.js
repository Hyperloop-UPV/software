/**
 * @module processes
 * @description Error formatting and hint utilities for backend crash diagnostics.
 * Parses zerolog console output, strips ANSI codes, and maps known error patterns
 * to actionable user-facing messages shown in the crash dialog.
 */

/**
 * List of known error patterns with human-readable messages and fix advice.
 * Each entry is matched against the raw stripped stderr output.
 */
const ERROR_HINTS = [
  {
    pattern: /bind: The requested address is not valid/,
    message: "Network address unavailable",
    advice:
      "The configured IP address doesn't exist on this machine. Check your network adapter or ADJ.",
  },
  {
    pattern: /failed to start UDP server/,
    message: "UDP server failed to start",
    advice: "Another process may already be using this port.",
  },
  {
    pattern: /jsonschema/,
    message: "ADJ Validator dependency missing",
    advice:
      "Install the required Python package by running: pip install jsonschema==4.25.0",
  },
  {
    pattern: /No Python interpreter found/,
    message: "Python not found",
    advice:
      "Install Python 3 and make sure it is accessible via 'python3', 'python', or 'py' in your PATH.",
  },
  {
    pattern: /ADJ Validator failed with error/,
    message: "ADJ validation failed",
    advice:
      "Your ADJ files contain schema errors. Check the ADJ validator log file in the logs folder for details.",
  },
  {
    pattern: /error reading config file/,
    message: "Config file not found",
    advice:
      "The configuration file could not be read. Check that the config file path is correct and the file exists.",
  },
  {
    pattern: /error unmarshaling toml file/,
    message: "Config file has errors",
    advice:
      "The configuration file contains invalid TOML. Check the config file for syntax or type errors.",
  },
  {
    pattern: /setting up ADJ/,
    message: "ADJ not available",
    advice:
      "Could not load the ADJ. If this is your first run, connect to the internet so the ADJ can be downloaded.",
  },
];

/**
 * Reformats a single stripped zerolog console line into a readable block.
 * Zerolog console format: "TIME LEVEL FILE > message key=value ..."
 * @param {string} line - A single log line with ANSI codes already stripped.
 * @returns {string} A formatted multi-line string with level, file, and key-value pairs on separate lines.
 * @example
 * formatLine("11:43AM FTL setup_transport.go:143 > failed to start UDP server error=\"some error\"");
 * // "[FTL] at setup_transport.go:143\n  failed to start UDP server\n  error: \"some error\""
 */
function formatLine(line) {
  const m = line.match(/^\S+\s+(\S+)\s+(\S+)\s+>\s+(.*)/);
  if (!m) return line;
  const [, level, file, rest] = m;
  const body = rest.replace(
    /\s+(\w+)=("(?:[^"\\]|\\.)*"|\S+)/g,
    "\n  $1: $2",
  );
  return `[${level}] at ${file}\n  ${body.trim()}`;
}

/**
 * Formats a full multi-line stderr output by reformatting each zerolog line.
 * @param {string} text - Raw stderr text with ANSI codes already stripped.
 * @returns {string} Formatted text with each log line reformatted for readability.
 * @example
 * formatBackendError("11:43AM FTL file.go:10 > something failed error=\"bad\"");
 */
function formatBackendError(text) {
  return text.split("\n").filter(Boolean).map(formatLine).join("\n\n");
}

/**
 * Returns a user-facing error message by matching the raw error against known patterns.
 * If a match is found, prepends a hint and advice to the formatted error.
 * Falls back to the formatted error text if no pattern matches.
 * @param {string} raw - Raw stripped stderr text used for pattern matching.
 * @param {string} formatted - Pre-formatted version of the error for display.
 * @returns {string} The final message to show in the crash dialog.
 * @example
 * getHint("failed to start UDP server ...", "[FTL] at ...");
 * // "UDP server failed to start\n\nAnother process may already be using this port.\n\n[FTL] at ..."
 */
function getHint(raw, formatted) {
  const match = ERROR_HINTS.find(({ pattern }) => pattern.test(raw));
  return match
    ? `${match.message}\n\n${match.advice}\n\n${formatted}`
    : formatted;
}

export { formatBackendError, getHint };
