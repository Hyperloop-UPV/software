/**
 * Raw ANSI escapes, exported so a custom module can pick its own color.
 */
export const ansi = {
  black: "\x1b[30m",
  red: "\x1b[31m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  blue: "\x1b[34m",
  magenta: "\x1b[35m",
  cyan: "\x1b[36m",
  white: "\x1b[37m",
  gray: "\x1b[90m",
  reset: "\x1b[0m",
} as const;

/**
 * Color per module name. Typed as an open record so that an app outside this
 * repository can register its own module through `registerLoggerColor`.
 */
export const loggerColors: Record<string, string> = {
  "testing-view": ansi.cyan,
  "competition-view": ansi.magenta,
  "logging-view": ansi.blue,
  "flashing-view": ansi.red,
  "adj-view": ansi.white,
  core: ansi.yellow,
  ui: ansi.green,
  reset: ansi.reset,
};

/** Color used for a module that has no registered color. */
export const DEFAULT_LOGGER_COLOR = ansi.gray;

/**
 * Registers the color a module is logged with, so a later `createLogger` call
 * for that module picks it up.
 */
export const registerLoggerColor = (module: string, color: string) => {
  loggerColors[module] = color;
};
