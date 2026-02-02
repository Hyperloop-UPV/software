type LoggerModule = "testing-view" | "competition-view" | "core" | "ui";

const colors = {
  "testing-view": "\x1b[36m", // Cyan
  "competition-view": "\x1b[35m", // Magenta
  core: "\x1b[33m", // Yellow
  ui: "\x1b[32m", // Green
  reset: "\x1b[0m",
};

function createLogger(module: LoggerModule) {
  const color = colors[module];
  const prefix = `[${module.toUpperCase()}]`;

  return {
    log: console.log.bind(console, `${color}${prefix}${colors.reset}`),
    warn: console.warn.bind(console, `${color}${prefix}${colors.reset}`),
    error: console.error.bind(console, `${color}${prefix}${colors.reset}`),
  };
}

export const logger = {
  testingView: createLogger("testing-view"),
  competitionView: createLogger("competition-view"),
  core: createLogger("core"),
  ui: createLogger("ui"),
};
