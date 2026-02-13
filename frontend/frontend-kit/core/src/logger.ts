import { loggerColors } from "./loggerColors";
import type { LoggerModule } from "./types";

/**
 * Creates a logger for a given module
 * @param module - the module to log for (it's just a colored string that will be shown between `[` and `]` before the message itself)
 * @returns a logger object with `log`, `warn`, and `error` methods
 */
function createLogger(module: LoggerModule) {
  const color = loggerColors[module];
  const prefix = `[${module.toUpperCase()}]`;

  return {
    // It's important to use `bind` here to correctly display log file path and line number in the console
    // Otherwise, console prints will just point to this file
    log: console.log.bind(console, `${color}${prefix}${loggerColors.reset}`),
    warn: console.warn.bind(console, `${color}${prefix}${loggerColors.reset}`),
    error: console.error.bind(
      console,
      `${color}${prefix}${loggerColors.reset}`,
    ),
  };
}

/**
 * Logger object with methods for each module
 */
export const logger = {
  testingView: createLogger("testing-view"),
  competitionView: createLogger("competition-view"),
  core: createLogger("core"),
  ui: createLogger("ui"),
};
