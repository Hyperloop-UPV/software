/** Special id for starting logger command */
export const START_LOGGER_COMMAND_ID = -1;

/** Special id for stopping logger command */
export const STOP_LOGGER_COMMAND_ID = -2;

/** Special id for toggling logger command */
export const TOGGLE_LOGGER_COMMAND_ID = -3;

export const SPECIAL_COMMANDS: Record<number, string> = {
  [START_LOGGER_COMMAND_ID]: "Start Logger",
  [STOP_LOGGER_COMMAND_ID]: "Stop Logger",
  [TOGGLE_LOGGER_COMMAND_ID]: "Toggle Logger",
};
