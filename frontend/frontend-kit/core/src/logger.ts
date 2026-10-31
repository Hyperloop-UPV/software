import { DEFAULT_LOGGER_COLOR, loggerColors } from "./loggerColors";
import type { LoggerModule } from "./types";

export interface Logger {
  log: (...args: unknown[]) => void;
  warn: (...args: unknown[]) => void;
  error: (...args: unknown[]) => void;
}

/**
 * Creates a logger for a given module
 * @param module - the module to log for (it's just a colored string that will be shown between `[` and `]` before the message itself)
 * @param color - ANSI escape to use. Defaults to the color registered for `module`, or gray when none is registered. Use the `ansi` map.
 * @returns a logger object with `log`, `warn`, and `error` methods
 */
export function createLogger(module: LoggerModule, color?: string): Logger {
  const prefixColor = color ?? loggerColors[module] ?? DEFAULT_LOGGER_COLOR;
  const prefix = `[${module.toUpperCase()}]`;

  return {
    // It's important to use `bind` here to correctly display log file path and line number in the console
    // Otherwise, console prints will just point to this file
    log: console.log.bind(console, `${prefixColor}${prefix}${loggerColors.reset}`),
    warn: console.warn.bind(
      console,
      `${prefixColor}${prefix}${loggerColors.reset}`,
    ),
    error: console.error.bind(
      console,
      `${prefixColor}${prefix}${loggerColors.reset}`,
    ),
  };
}

/**
 * Logger object with methods for each module
 */
export const logger = {
  testingView: createLogger("testing-view"),
  competitionView: createLogger("competition-view"),
  loggingView: createLogger("logging-view"),
  flashingView: createLogger("flashing-view"),
  adjView: createLogger("adj-view"),
  core: createLogger("core"),
  ui: createLogger("ui"),
};
